import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const parametresRouter = Router();
// Configuration système (tarifs, identité) : réservé SG/Admin comme au front.
parametresRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL"));

const DEFAUT = {
  tarifs: { avocat: 150000, stagiaire: 75000, droitsPlaidoirie: 60000 },
  exerciceCourant: 2026,
  identite: {
    denomination: "Barreau de Pointe-Noire",
    ordre: "Ordre National des Avocats du Congo",
    batonnier: "Me BIKINDOU Audrey Séverin",
    tresoriere: "Me ONDZE BOYA Armelle Laure Carine",
    secretaireGeneral: "Me KALINA-MENGA Lionel",
    adresse: "Maison de l'Avocat — Pointe-Noire, République du Congo",
  },
};

parametresRouter.get(
  "/",
  asyncH(async (_req, res) => {
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    res.json(row?.data ?? DEFAUT);
  })
);

/** Mise à jour des paramètres — SG / Admin. */
parametresRouter.put(
  "/",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    const base = (row?.data as object) ?? DEFAUT;
    const data = { ...base, ...req.body };
    const saved = await prisma.parametres.upsert({
      where: { id: 1 },
      create: { id: 1, data },
      update: { data },
    });
    res.json(saved.data);
  })
);
