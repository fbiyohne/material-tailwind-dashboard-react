import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth.js";

/**
 * Personnes morales (cabinets, sociétés, associations d'avocats). Lecture SG/Bâtonnier ;
 * gestion réservée au SG. Chaque cabinet est enrichi de son effectif actif, de son
 * titulaire et de son ancienneté (serment le plus ancien de ses membres), ce qui
 * permet à l'écran de numéroter les personnes morales (C1, C2…) par ancienneté.
 */
export const cabinetsRouter = Router();
cabinetsRouter.use(requireAuth, requirePermission("membres"));

const membreSel = { id: true, nom: true, statut: true, qualite: true, dateServment: true } as const;

/** Met en forme un cabinet : effectif actif, titulaire, ancienneté. */
function enrichir(c: {
  id: number; nom: string; forme: string | null; adresse: string | null; tel: string | null; email: string | null;
  conventionDeposee: boolean; statut: string; dateRetrait: Date | null; motifRetrait: string | null; titulaireId: number | null;
  titulaire: { id: number; nom: string; statut: string; qualite: string; dateServment: Date | null } | null;
  membres: { id: number; nom: string; statut: string; qualite: string; dateServment: Date | null }[];
}) {
  const actifs = c.membres.filter((m) => m.statut === "INSCRIT");
  const serments = c.membres.map((m) => m.dateServment).filter((d): d is Date => d != null).map((d) => d.getTime());
  return {
    id: c.id, nom: c.nom, forme: c.forme, adresse: c.adresse, tel: c.tel, email: c.email,
    conventionDeposee: c.conventionDeposee, statut: c.statut, dateRetrait: c.dateRetrait, motifRetrait: c.motifRetrait,
    titulaire: c.titulaire ? { id: c.titulaire.id, nom: c.titulaire.nom, statut: c.titulaire.statut } : null,
    membres: c.membres.map((m) => ({ id: m.id, nom: m.nom, statut: m.statut })),
    effectif: actifs.length,
    anciennete: serments.length ? new Date(Math.min(...serments)) : null,
  };
}

/** GET /cabinets — personnes morales avec effectif, titulaire et ancienneté. */
cabinetsRouter.get(
  "/",
  asyncH(async (_req, res) => {
    const cabinets = await prisma.cabinet.findMany({
      include: { titulaire: { select: membreSel }, membres: { select: membreSel } },
      orderBy: { nom: "asc" },
    });
    res.json(cabinets.map(enrichir));
  })
);

const cabinetSchema = z.object({
  nom: z.string().trim().min(1).max(200),
  forme: z.string().trim().max(80).nullable().optional(),
  adresse: z.string().trim().max(300).nullable().optional(),
  tel: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().max(160).nullable().optional(),
  conventionDeposee: z.boolean().optional(),
  titulaireId: z.number().int().positive().nullable().optional(),
});

async function renvoyer(id: number, res: import("express").Response) {
  const c = await prisma.cabinet.findUnique({ where: { id }, include: { titulaire: { select: membreSel }, membres: { select: membreSel } } });
  if (!c) throw new HttpError(404, "Cabinet introuvable");
  res.json(enrichir(c));
}

/** POST /cabinets — crée une personne morale (SG). */
cabinetsRouter.post(
  "/",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const d = cabinetSchema.parse(req.body);
    const c = await prisma.cabinet.create({
      data: {
        nom: d.nom, forme: d.forme ?? null, adresse: d.adresse ?? null, tel: d.tel ?? null, email: d.email ?? null,
        conventionDeposee: d.conventionDeposee ?? false, titulaireId: d.titulaireId ?? null,
      },
    });
    res.status(201);
    await renvoyer(c.id, res);
  })
);

const cabinetPatch = cabinetSchema.partial().extend({
  statut: z.enum(["actif", "retiré"]).optional(),
  dateRetrait: z.string().nullable().optional(),
  motifRetrait: z.string().trim().max(200).nullable().optional(),
});
const dateField = (v?: string | null) => (v === undefined ? undefined : v === null ? null : new Date(v));

/** PATCH /cabinets/:id — met à jour la fiche / le titulaire / le retrait (SG). */
cabinetsRouter.patch(
  "/:id",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const d = cabinetPatch.parse(req.body);
    await prisma.cabinet.update({
      where: { id },
      data: {
        nom: d.nom, forme: d.forme, adresse: d.adresse, tel: d.tel, email: d.email,
        conventionDeposee: d.conventionDeposee,
        titulaireId: d.titulaireId === undefined ? undefined : d.titulaireId,
        statut: d.statut,
        dateRetrait: dateField(d.dateRetrait),
        motifRetrait: d.motifRetrait === undefined ? undefined : d.motifRetrait,
      },
    });
    await renvoyer(id, res);
  })
);

/** DELETE /cabinets/:id — supprime une personne morale (SG). Détache d'abord les membres. */
cabinetsRouter.delete(
  "/:id",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.membre.updateMany({ where: { cabinetId: id }, data: { cabinetId: null } });
    await prisma.cabinet.delete({ where: { id } });
    res.status(204).end();
  })
);

/** POST /cabinets/:id/membres/:membreId — rattache un membre au cabinet (SG). */
cabinetsRouter.post(
  "/:id/membres/:membreId",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const membreId = Number(req.params.membreId);
    const c = await prisma.cabinet.findUnique({ where: { id }, select: { nom: true } });
    if (!c) throw new HttpError(404, "Cabinet introuvable");
    // On aligne aussi l'intitulé texte historique du membre sur la personne morale.
    await prisma.membre.update({ where: { id: membreId }, data: { cabinetId: id, cabinet: c.nom } });
    await renvoyer(id, res);
  })
);

/** DELETE /cabinets/:id/membres/:membreId — détache un membre du cabinet (SG). */
cabinetsRouter.delete(
  "/:id/membres/:membreId",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const membreId = Number(req.params.membreId);
    await prisma.membre.update({ where: { id: membreId }, data: { cabinetId: null } });
    await renvoyer(id, res);
  })
);

/**
 * POST /cabinets/purge — retire les cabinets actifs dont le titulaire n'est plus
 * en exercice (radié, suspendu, omis) ou n'a pas de titulaire (SG). Réversible.
 */
cabinetsRouter.post(
  "/purge",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (_req, res) => {
    const cabinets = await prisma.cabinet.findMany({ where: { statut: "actif" }, include: { titulaire: { select: { statut: true } } } });
    const cibles = cabinets.filter((c) => !c.titulaire || c.titulaire.statut !== "INSCRIT").map((c) => c.id);
    if (cibles.length) {
      await prisma.cabinet.updateMany({
        where: { id: { in: cibles } },
        data: { statut: "retiré", dateRetrait: new Date(), motifRetrait: "Titulaire non actif (purge)" },
      });
    }
    res.json({ retires: cibles.length });
  })
);
