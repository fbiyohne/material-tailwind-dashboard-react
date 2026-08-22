import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { prochainNumeroTimbre, archiver } from "../lib/business.js";

/**
 * Timbres / vignettes électroniques de droit de plaidoirie. Émission par le
 * Secrétariat / la Trésorière : chaque timbre porte un n° séquentiel, un
 * identifiant unique (barre noire) et une preuve vérifiable via QR
 * (page publique /verifier/timbre/:code). Données financières (RG-15).
 */
export const timbresRouter = Router();
timbresRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "TRESORIERE"));

const LETTRES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/**
 * Identifiant lisible : préfixe distinctif (cabinet/nom, mot générique de tête
 * retiré) + segment aléatoire. Ex. « CABINET KALINA » → « KALINAUKXEFTQIKHL ».
 */
function genererCode(base: string): string {
  const distinctif = (base || "").replace(/^\s*(cabinet|scpa?|société|societe|association|selarl)\s+/i, "");
  const prefixe = distinctif.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "BPN";
  const alea = Array.from(crypto.randomBytes(10)).map((b) => LETTRES[b % 26]).join("");
  return prefixe + alea;
}

const creerSchema = z.object({
  membreId: z.number().int(),
  affaire: z.string().trim().min(1).max(200),
  reference: z.string().trim().max(100).optional(),
  juridiction: z.string().trim().max(160).optional(),
  montant: z.number().int().positive().max(100_000_000),
});

/** POST /timbres — émet un timbre pour un avocat / une affaire. */
timbresRouter.post(
  "/",
  asyncH(async (req, res) => {
    const data = creerSchema.parse(req.body);
    const membre = await prisma.membre.findUnique({ where: { id: data.membreId } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");

    const numero = await prochainNumeroTimbre();
    // Numéro consommé une fois ; on ne rejoue que la génération du code en cas de
    // collision (@unique), quasi nulle mais gérée en profondeur.
    let timbre;
    for (let tentative = 0; ; tentative++) {
      try {
        timbre = await prisma.timbre.create({
          data: {
            numero,
            code: genererCode(membre.cabinet ?? membre.nom),
            membreId: membre.id,
            affaire: data.affaire,
            reference: data.reference,
            juridiction: data.juridiction,
            cabinet: membre.cabinet,
            montant: data.montant,
          },
        });
        break;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && tentative < 5) continue;
        throw e;
      }
    }

    await archiver({
      categorie: "Timbre — droit de plaidoirie",
      titre: `Timbre N° ${numero} — Me ${membre.nom} (${data.affaire})`,
      reference: String(numero),
      date: new Date(),
      membreNom: membre.nom,
    });
    res.status(201).json({ ...timbre, membre: { nom: membre.nom, num: membre.num } });
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
