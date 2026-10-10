import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { CANAUX } from "../lib/paiement.js";
import { emettreTimbre } from "../lib/timbres.js";
import { notifier, userDeMembre } from "../lib/centreNotifications.js";

/**
 * Timbres / vignettes électroniques de droit de plaidoirie. Émission par le
 * Secrétariat / la Trésorière (l'avocat peut émettre les siens depuis l'espace) :
 * chaque timbre porte un n° séquentiel, un identifiant unique et une preuve
 * vérifiable via QR (page publique /verifier/timbre/:code). Données financières (RG-15).
 */
export const timbresRouter = Router();
timbresRouter.use(requireAuth, requirePermission("finances"));

const creerSchema = z.object({
  membreId: z.number().int(),
  affaire: z.string().trim().min(1).max(200),
  reference: z.string().trim().max(100).optional(),
  juridiction: z.string().trim().max(160).optional(),
  montant: z.number().int().positive().max(100_000_000),
  canal: z.enum(CANAUX).optional(),
});

/** POST /timbres — émet un timbre pour un avocat / une affaire (paiement acquitté). */
timbresRouter.post(
  "/",
  asyncH(async (req, res) => {
    const data = creerSchema.parse(req.body);
    const membre = await prisma.membre.findUnique({ where: { id: data.membreId } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    const timbre = await emettreTimbre({ membre, affaire: data.affaire, reference: data.reference, juridiction: data.juridiction, montant: data.montant, canal: data.canal });
    // Alerte in-app de l'avocat : timbre émis pour son compte (best-effort).
    void userDeMembre(membre.id)
      .then((uid) => (uid ? notifier([uid], { type: "TIMBRE", titre: "Timbre disponible", message: `Votre timbre N° ${timbre.numero} (${data.affaire}) est disponible.`, lien: "/timbres" }) : 0))
      .catch(() => {});
    res.status(201).json({ ...timbre, membre: { nom: membre.nom, num: membre.num } });
  })
);

const externesSchema = z.object({
  lignes: z.array(z.object({
    reference: z.string().trim().min(1).max(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}/).refine((d) => !Number.isNaN(Date.parse(d))),
    montant: z.number().int().nonnegative().max(100_000_000),
    canal: z.string().trim().min(1).max(30).transform((c) => c.toUpperCase()),
    avocatNom: z.string().trim().max(160).optional(),
  })).min(1).max(5000),
  source: z.string().trim().min(1).max(30).default("MTN"),
});

/** POST /timbres/externes — import mensuel (dispositif MTN). Idempotent par référence unique. */
timbresRouter.post(
  "/externes",
  asyncH(async (req: AuthRequest, res) => {
    const { lignes, source } = externesSchema.parse(req.body);
    const uniques = [...new Map(lignes.map((l) => [l.reference, l])).values()]; // doublons dans le fichier
    const r = await prisma.timbreExterne.createMany({
      data: uniques.map((l) => ({ ...l, date: new Date(l.date), source, importePar: req.user?.nom })),
      skipDuplicates: true,
    });
    res.status(201).json({ importes: r.count, doublons: lignes.length - r.count });
  })
);

/** GET /timbres/stats?annee= — volumes et montants par mois et par canal, internes et externes. */
timbresRouter.get(
  "/stats",
  asyncH(async (req, res) => {
    const annee = z.coerce.number().int().min(2000).max(2100).parse(req.query.annee ?? new Date().getFullYear());
    const du = new Date(Date.UTC(annee, 0, 1));
    const au = new Date(Date.UTC(annee + 1, 0, 1));
    type L = { mois: number; canal: string; source: string; nombre: number; montant: number };
    const [internes, externes] = await Promise.all([
      prisma.$queryRaw<L[]>(Prisma.sql`SELECT EXTRACT(MONTH FROM "createdAt")::int AS mois, COALESCE("canal", 'INCONNU') AS canal, 'interne' AS source,
        COUNT(*)::int AS nombre, COALESCE(SUM("montant"), 0)::int AS montant FROM "Timbre"
        WHERE "statut" = 'VALIDE' AND "createdAt" >= ${du} AND "createdAt" < ${au} GROUP BY 1, 2 ORDER BY 1, 2`),
      prisma.$queryRaw<L[]>(Prisma.sql`SELECT EXTRACT(MONTH FROM "date")::int AS mois, "canal", 'externe' AS source,
        COUNT(*)::int AS nombre, COALESCE(SUM("montant"), 0)::int AS montant FROM "TimbreExterne"
        WHERE "date" >= ${du} AND "date" < ${au} GROUP BY 1, 2 ORDER BY 1, 2`),
    ]);
    res.json({ annee, lignes: [...internes, ...externes] });
  })
);

/** GET /timbres — registre des timbres émis. */
timbresRouter.get(
  "/",
  asyncH(async (_req, res) => {
    const timbres = await prisma.timbre.findMany({
      orderBy: { id: "desc" },
      include: { membre: { select: { nom: true, num: true } } },
    });
    res.json(timbres);
  })
);

/** GET /timbres/:id — détail d'un timbre. */
timbresRouter.get(
  "/:id",
  asyncH(async (req, res) => {
    const timbre = await prisma.timbre.findUnique({
      where: { id: Number(req.params.id) },
      include: { membre: { select: { nom: true, num: true } } },
    });
    if (!timbre) throw new HttpError(404, "Timbre introuvable");
    res.json(timbre);
  })
);

/** POST /timbres/:id/annuler — annule un timbre (émission erronée). ADMIN. */
timbresRouter.post(
  "/:id/annuler",
  requireRole("ADMIN"),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const timbre = await prisma.timbre.findUnique({ where: { id } });
    if (!timbre) throw new HttpError(404, "Timbre introuvable");
    await prisma.timbre.update({ where: { id }, data: { statut: "ANNULE" } });
    res.json({ ok: true, numero: timbre.numero });
  })
);
