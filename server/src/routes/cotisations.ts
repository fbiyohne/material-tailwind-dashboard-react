import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { archiver, montantDu, prochainNumeroRecu, statutCotisation } from "../lib/business.js";
import { envoyerMail, modeSimulation } from "../lib/mail.js";

export const cotisationsRouter = Router();
// Données financières restreintes aux profils autorisés (RG-15) : SG, Trésorière, Admin.
cotisationsRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "TRESORIERE"));

/** POST /cotisations/relances?annee= — relance email des retardataires (FR). */
cotisationsRouter.post(
  "/relances",
  requireRole("SECRETAIRE_GENERAL", "TRESORIERE"),
  asyncH(async (req, res) => {
    const annee = Number(req.query.annee ?? new Date().getFullYear());
    const membres = await prisma.membre.findMany({ include: { cotisations: { where: { annee } } } });
    const cibles = membres.filter((m) => {
      const c = m.cotisations[0];
      const du = c?.montantDu ?? montantDu(m.qualite);
      const st = statutCotisation(du, c?.montantPaye ?? 0);
      return (st === "retard" || st === "partiel") && m.email;
    });

    let envoyes = 0;
    for (const m of cibles) {
      const c = m.cotisations[0];
      const du = c?.montantDu ?? montantDu(m.qualite);
      const solde = du - (c?.montantPaye ?? 0);
      await envoyerMail({
        to: m.email!,
        subject: `Relance — cotisation ordinale ${annee} · Barreau de Pointe-Noire`,
        text: `Maître ${m.nom},\n\nVotre cotisation ordinale au titre de l'exercice ${annee} présente un solde restant dû de ${solde.toLocaleString("fr-FR")} FCFA.\nNous vous invitons à régulariser votre situation auprès de la Trésorerie.\n\nLe Secrétariat Général du Barreau de Pointe-Noire.`,
      });
      envoyes += 1;
    }
    res.json({ annee, envoyes, simulation: modeSimulation, destinataires: cibles.map((m) => ({ nom: m.nom, email: m.email })) });
  })
);

/** GET /cotisations?annee= — situation de tous les membres pour l'exercice. */
cotisationsRouter.get(
  "/",
  asyncH(async (req, res) => {
    const annee = Number(req.query.annee ?? new Date().getFullYear());
    const membres = await prisma.membre.findMany({
      orderBy: { num: "asc" },
      include: { cotisations: { where: { annee } } },
    });
    const lignes = membres.map((m) => {
      const c = m.cotisations[0];
      const du = c?.montantDu ?? montantDu(m.qualite);
      const paye = c?.montantPaye ?? 0;
      return {
        membre: { id: m.id, num: m.num, nom: m.nom, qualite: m.qualite, cabinet: m.cabinet },
        montantDu: du,
        montantPaye: paye,
        solde: Math.max(0, du - paye),
        datePaiement: c?.datePaiement ?? null,
        valideTresoriere: c?.valideTresoriere ?? false,
        statut: statutCotisation(du, paye),
      };
    });
    res.json({ annee, lignes });
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
 * POST /cotisations/paiement — enregistre un paiement et émet le reçu (BR-03).
 * Met à jour la cotisation et archive le reçu, en une transaction.
 */
cotisationsRouter.post(
  "/paiement",
  requireRole("SECRETAIRE_GENERAL", "TRESORIERE"),
  asyncH(async (req, res) => {
    const { membreId, annee, montant, mode, ref, date } = paiementSchema.parse(req.body);
    const membre = await prisma.membre.findUnique({ where: { id: membreId } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    const dateP = date ? new Date(date) : new Date();
    const numero = await prochainNumeroRecu();

    const resultat = await prisma.$transaction(async (tx) => {
      const cotisation = await tx.cotisation.upsert({
        where: { membreId_annee: { membreId, annee } },
        create: { membreId, annee, montantDu: montantDu(membre.qualite), montantPaye: montant, datePaiement: dateP, mode, ref },
        update: { montantPaye: { increment: montant }, datePaiement: dateP, mode, ref },
      });
      const recu = await tx.recu.create({
        data: { numero, membreId, montant, annee, date: dateP, mode, ref, objet: `Cotisation ordinale ${annee}` },
      });
      await tx.archive.create({
        data: { categorie: "Reçu de paiement", titre: `Reçu N° ${numero} — Me ${membre.nom}`, reference: numero, date: dateP, membreNom: membre.nom },
      });
      return { cotisation, recu };
    });

    res.status(201).json(resultat);
  })
);

const validationSchema = z.object({ annee: z.number().int(), valide: z.boolean().default(true) });

/** POST /cotisations/:membreId/valider — validation Trésorière (US-07/FR-QUI-02). */
cotisationsRouter.post(
  "/:membreId/valider",
  requireRole("TRESORIERE"),
  asyncH(async (req, res) => {
    const membreId = Number(req.params.membreId);
    const { annee, valide } = validationSchema.parse(req.body);
    const membre = await prisma.membre.findUnique({ where: { id: membreId } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    const cotisation = await prisma.cotisation.upsert({
      where: { membreId_annee: { membreId, annee } },
      create: { membreId, annee, montantDu: montantDu(membre.qualite), montantPaye: 0, valideTresoriere: valide },
      update: { valideTresoriere: valide },
    });
    res.json(cotisation);
  })
);
