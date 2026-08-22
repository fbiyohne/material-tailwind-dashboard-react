import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { anneeDeRequete } from "../lib/requete.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth.js";
import { droitDue, statutCotisation, tarifsActuels } from "../lib/business.js";
import { encaisser, gardeVersement } from "../lib/encaissement.js";
import { envoyerEmail, envoyerSms, emailEnSimulation } from "../lib/notifications.js";

export const droitsRouter = Router();
// Données financières restreintes (RG-15) : SG, Trésorière, Admin.
droitsRouter.use(requireAuth, requirePermission("finances"));

/** POST /droits/relances?annee= — relance email/SMS des avocats au droit de plaidoirie impayé. */
droitsRouter.post(
  "/relances",
  requireRole("SECRETAIRE_GENERAL", "TRESORIERE"),
  asyncH(async (req, res) => {
    const annee = anneeDeRequete(req);
    const [tarifs, membres] = await Promise.all([
      tarifsActuels(),
      prisma.membre.findMany({ where: { qualite: "AVOCAT" }, include: { droitsPlaidoirie: { where: { annee } } } }),
    ]);
    const cibles = membres.filter((m) => {
      const d = m.droitsPlaidoirie[0];
      const du = droitDue(d, tarifs, m.qualite);
      const st = statutCotisation(du, d?.montantPaye ?? 0);
      return (st === "retard" || st === "partiel") && m.email;
    });

    let envoyes = 0;
    for (const m of cibles) {
      const d = m.droitsPlaidoirie[0];
      const du = droitDue(d, tarifs, m.qualite);
      const solde = du - (d?.montantPaye ?? 0);
      await envoyerEmail({
        to: m.email!,
        subject: `Relance — droit de plaidoirie ${annee} · Barreau de Pointe-Noire`,
        text: `Maître ${m.nom},\n\nVotre droit de plaidoirie au titre de l'exercice ${annee} présente un solde restant dû de ${solde.toLocaleString("fr-FR")} FCFA.\nNous vous invitons à régulariser votre situation auprès de la Trésorerie.\n\nLe Secrétariat Général du Barreau de Pointe-Noire.`,
        evenement: "RELANCE",
      });
      if (m.tel) {
        await envoyerSms({
          to: m.tel,
          message: `Barreau de Pointe-Noire : votre droit de plaidoirie ${annee} présente un solde de ${solde.toLocaleString("fr-FR")} FCFA. Merci de régulariser auprès de la Trésorerie.`,
          evenement: "RELANCE",
        });
      }
      envoyes += 1;
    }
    res.json({ annee, envoyes, simulation: await emailEnSimulation(), destinataires: cibles.map((m) => ({ nom: m.nom, email: m.email })) });
  })
);

/** GET /droits?annee= — suivi réel des droits de plaidoirie (FR-DROITS). */
droitsRouter.get(
  "/",
  asyncH(async (req, res) => {
    const annee = anneeDeRequete(req);
    const [tarifs, membres] = await Promise.all([
      tarifsActuels(),
      prisma.membre.findMany({
        where: { qualite: "AVOCAT" },
        orderBy: { num: "asc" },
        include: { droitsPlaidoirie: { where: { annee } } },
      }),
    ]);
    let totDu = 0;
    let totPaye = 0;
    const lignes = membres.map((m) => {
      const d = m.droitsPlaidoirie[0];
      const du = droitDue(d, tarifs, m.qualite);
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
        // Ligne réellement persistée (donc supprimable par l'ADMIN) vs calculée.
        aLigne: !!d,
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
    // Garde anti-surpaiement / double-saisie (miroir des cotisations).
    const tarifs = await tarifsActuels();
    const d = await prisma.droitPlaidoirie.findUnique({ where: { membreId_annee: { membreId, annee } } });
    gardeVersement(droitDue(d, tarifs, membre.qualite), d?.montantPaye ?? 0, montant, "Le droit de plaidoirie est déjà soldé pour cet exercice.");
    const resultat = await encaisser({ membre, annee, montant, type: "droit", mode, ref, date: date ? new Date(date) : undefined });
    res.status(201).json(resultat);
  })
);

/**
 * DELETE /droits/:membreId/:annee — efface la ligne de droit de plaidoirie d'un
 * avocat pour un exercice (réinitialise sa situation). Réservé au
 * super-administrateur (ADMIN) ; outil de correction des données.
 */
droitsRouter.delete(
  "/:membreId/:annee",
  requireRole("ADMIN"),
  asyncH(async (req, res) => {
    const membreId = Number(req.params.membreId);
    const annee = Number(req.params.annee);
    const d = await prisma.droitPlaidoirie.findUnique({ where: { membreId_annee: { membreId, annee } } });
    if (!d) throw new HttpError(404, "Droit de plaidoirie introuvable");
    await prisma.droitPlaidoirie.delete({ where: { membreId_annee: { membreId, annee } } });
    res.json({ ok: true });
  })
);
