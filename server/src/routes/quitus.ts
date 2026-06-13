import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { eligibleQuitus, prochainNumeroQuitus } from "../lib/business.js";

export const quitusRouter = Router();
quitusRouter.use(requireAuth);

/** GET /quitus/eligibles?annee= — avocats éligibles (à jour ET validés). BR-01. */
quitusRouter.get(
  "/eligibles",
  asyncH(async (req, res) => {
    const annee = Number(req.query.annee ?? new Date().getFullYear());
    const cotisations = await prisma.cotisation.findMany({ where: { annee }, include: { membre: true } });
    const eligibles = cotisations
      .filter((c) => eligibleQuitus(c))
      .map((c) => ({ id: c.membre.id, num: c.membre.num, nom: c.membre.nom }));
    res.json({ annee, eligibles });
  })
);

/** GET /quitus — registre des quitus émis. */
quitusRouter.get(
  "/",
  asyncH(async (_req, res) => {
    const quitus = await prisma.quitus.findMany({
      orderBy: { id: "desc" },
      include: { membre: { select: { nom: true } } },
    });
    res.json(quitus);
  })
);

const genSchema = z.object({ membreId: z.number().int(), annee: z.number().int() });

/** POST /quitus — génère un quitus si éligible (BR-01). SG/Admin. */
quitusRouter.post(
  "/",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const { membreId, annee } = genSchema.parse(req.body);
    const cotisation = await prisma.cotisation.findUnique({ where: { membreId_annee: { membreId, annee } }, include: { membre: true } });
    if (!cotisation || !eligibleQuitus(cotisation)) {
      throw new HttpError(409, "Quitus bloqué : l'avocat doit être à jour ET validé par la Trésorière (BR-01)");
    }
    const numero = await prochainNumeroQuitus(annee);
    const dateEmission = new Date();

    const quitus = await prisma.$transaction(async (tx) => {
      const q = await tx.quitus.create({ data: { numero, membreId, annee, dateEmission } });
      await tx.archive.create({
        data: { categorie: "Quitus", titre: `Quitus ${numero} — Me ${cotisation.membre.nom}`, reference: numero, date: dateEmission, membreNom: cotisation.membre.nom },
      });
      return q;
    });
    res.status(201).json(quitus);
  })
);
