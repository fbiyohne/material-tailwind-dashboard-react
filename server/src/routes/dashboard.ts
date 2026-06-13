import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth } from "../middleware/auth.js";
import { montantDu, statutCotisation } from "../lib/business.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

/** GET /dashboard?annee= — indicateurs clés (FR-DB-01 → 07). */
dashboardRouter.get(
  "/",
  asyncH(async (req, res) => {
    const annee = Number(req.query.annee ?? new Date().getFullYear());
    const membres = await prisma.membre.findMany({ include: { cotisations: { where: { annee } } } });

    let inscrits = 0;
    let stagiaires = 0;
    let aJour = 0;
    let enRetard = 0;
    let payees = 0;
    let du = 0;

    for (const m of membres) {
      if (m.qualite === "AVOCAT") inscrits += 1;
      if (m.qualite === "STAGIAIRE") stagiaires += 1;
      const montantDuM = montantDu(m.qualite);
      const paye = m.cotisations[0]?.montantPaye ?? 0;
      du += montantDuM;
      payees += paye;
      const st = statutCotisation(montantDuM, paye);
      if (st === "ajour") aJour += 1;
      else if (st === "retard" || st === "partiel") enRetard += 1;
    }

    res.json({
      annee,
      membres: { inscrits, stagiaires, aJour, enRetard },
      finances: { payees, impayees: du - payees, solde: du - payees },
    });
  })
);
