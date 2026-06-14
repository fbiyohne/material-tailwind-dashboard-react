import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { eligibiliteElectorale } from "../lib/business.js";

export const corpsElectoralRouter = Router();
// Corps électoral (éligibilité = cotisations + discipline) : SG/Bâtonnier/Admin.
corpsElectoralRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "BATONNIER"));

/** GET /corps-electoral?annee= — liste générée automatiquement (RG-04 à RG-06). */
corpsElectoralRouter.get(
  "/",
  asyncH(async (req, res) => {
    const annee = Number(req.query.annee ?? new Date().getFullYear());
    const membres = await prisma.membre.findMany({
      where: { qualite: { not: "STAGIAIRE" } },
      orderBy: { num: "asc" },
      include: { cotisations: { where: { annee } } },
    });

    const electeurs: any[] = [];
    const exclusCotisation: any[] = [];
    const exclusStatut: any[] = [];
    for (const m of membres) {
      const { eligible, raison } = eligibiliteElectorale(m, m.cotisations[0] ?? null);
      const item = { id: m.id, num: m.num, nom: m.nom, cabinet: m.cabinet, dateInscription: m.dateInscription };
      if (eligible) electeurs.push(item);
      else if (raison === "cotisation") exclusCotisation.push(item);
      else if (raison === "statut") exclusStatut.push(item);
    }
    res.json({
      annee,
      electeurs,
      exclusCotisation,
      exclusStatut,
      stats: { electeurs: electeurs.length, exclusCotisation: exclusCotisation.length, exclusStatut: exclusStatut.length },
    });
  })
);
