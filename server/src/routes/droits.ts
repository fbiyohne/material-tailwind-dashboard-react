import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth } from "../middleware/auth.js";
import { droitDu, droitPaye } from "../lib/business.js";

export const droitsRouter = Router();
droitsRouter.use(requireAuth);

/** GET /droits?annee= — suivi des droits de plaidoirie (FR-DROITS). */
droitsRouter.get(
  "/",
  asyncH(async (req, res) => {
    const annee = Number(req.query.annee ?? new Date().getFullYear());
    const membres = await prisma.membre.findMany({ where: { qualite: "AVOCAT" }, orderBy: { num: "asc" } });
    let totDu = 0;
    let totPaye = 0;
    const lignes = membres.map((m) => {
      const du = droitDu(m.qualite);
      const paye = Math.min(du, droitPaye(m.id, annee));
      totDu += du;
      totPaye += paye;
      return {
        membre: { id: m.id, num: m.num, nom: m.nom },
        du,
        paye,
        solde: Math.max(0, du - paye),
        statut: du === 0 ? "exonere" : paye >= du ? "ajour" : paye > 0 ? "partiel" : "retard",
      };
    });
    res.json({ annee, lignes, totaux: { du: totDu, paye: totPaye, solde: totDu - totPaye } });
  })
);
