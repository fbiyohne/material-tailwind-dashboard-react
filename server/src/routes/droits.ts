import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { anneeDeRequete } from "../lib/requete.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { droitDuAvec, statutCotisation, tarifsActuels } from "../lib/business.js";
import { encaisser } from "../lib/encaissement.js";

export const droitsRouter = Router();
// Données financières restreintes (RG-15) : SG, Trésorière, Admin.
droitsRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "TRESORIERE"));

/** GET /droits?annee= — suivi réel des droits de plaidoirie (FR-DROITS). */
droitsRouter.get(
  "/",
  asyncH(async (req, res) => {
    const annee = anneeDeRequete(req);
    const tarifs = await tarifsActuels();
    const membres = await prisma.membre.findMany({
      where: { qualite: "AVOCAT" },
      orderBy: { num: "asc" },
      include: { droitsPlaidoirie: { where: { annee } } },
    });
    let totDu = 0;
    let totPaye = 0;
    const lignes = membres.map((m) => {
      const d = m.droitsPlaidoirie[0];
      const du = d?.montantDu ?? droitDuAvec(tarifs, m.qualite);
      const paye = Math.min(du, d?.montantPaye ?? 0);
      totDu += du;
      totPaye += paye;
      return {
        membre: { id: m.id, num: m.num, nom: m.nom },
        du,
        paye,
        solde: Math.max(0, du - paye),
        // Champs alignés sur le module Cotisations pour réutiliser le PaiementModal.
        montantDu: du,
        montantPaye: paye,
        datePaiement: d?.datePaiement ?? null,
        statut: statutCotisation(du, paye),
      };
    });
    res.json({ annee, lignes, totaux: { du: totDu, paye: totPaye, solde: totDu - totPaye } });
  })
);

const paiementSchema = z.object({
  membreId: z.number().int(),
  annee: z.number().int(),
  montant: z.number().int().positive(),
  mode: z.string().optional(),
  ref: z.string().optional(),
  date: z.string().optional(),
});

/**
 * POST /droits/paiement — enregistre un paiement de droit de plaidoirie et émet
 * le reçu officiel (miroir de BR-03 pour les cotisations). SG / Trésorière.
 */
droitsRouter.post(
  "/paiement",
  requireRole("SECRETAIRE_GENERAL", "TRESORIERE"),
  asyncH(async (req, res) => {
    const { membreId, annee, montant, mode, ref, date } = paiementSchema.parse(req.body);
    const membre = await prisma.membre.findUnique({ where: { id: membreId } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    if (membre.qualite !== "AVOCAT") throw new HttpError(400, "Seuls les avocats sont redevables du droit de plaidoirie");
    const resultat = await encaisser({ membre, annee, montant, type: "droit", mode, ref, date: date ? new Date(date) : undefined });
    res.status(201).json(resultat);
  })
);
