import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const parametresRouter = Router();
// Lecture ouverte à tout profil authentifié (données de référence d'affichage) ;
// l'écriture reste réservée au Secrétaire Général (cf. PUT ci-dessous).
parametresRouter.use(requireAuth);

const DEFAUT = {
  tarifs: { avocat: 150000, stagiaire: 75000, droitsPlaidoirie: 60000 },
  exerciceCourant: 2026,
  exercices: { premier: 2020 },
  identite: {
    denomination: "Barreau de Pointe-Noire",
    ordre: "Ordre National des Avocats du Congo",
    batonnier: "Me BIKINDOU Audrey Séverin",
    tresoriere: "Me ONDZE BOYA Armelle Laure Carine",
    secretaireGeneral: "Me KALINA-MENGA Lionel",
    adresse: "Maison de l'Avocat — Pointe-Noire, République du Congo",
  },
  documents: {
    categoriesArchives: [
      "Attestation d'inscription", "Quitus", "Reçu de paiement", "Procès-verbal (Conseil)",
      "Convocation (Conseil)", "Feuille de présence", "Procès-verbal (AG)", "Convocation (AG)",
      "Convocation disciplinaire", "Décision disciplinaire", "Lettre du Bâtonnier",
    ],
    typesPublication: ["Avis", "Communiqué"],
  },
  paiement: { canauxActifs: ["MTN", "AIRTEL", "CARTE", "VIREMENT"] },
  stage: { dureeMois: 24 },
  conseil: {
    fonctions: ["Bâtonnier", "Vice-Bâtonnier", "Secrétaire Général", "Trésorière", "Membre du Conseil"],
  },
  libellesStatuts: { membre: {}, cotisation: {}, dossier: {}, publication: {} },
};

parametresRouter.get(
  "/",
  asyncH(async (_req, res) => {
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    // Fusion avec les valeurs par défaut : garantit la présence des nouvelles
    // sections même pour un enregistrement créé avant leur introduction.
    res.json({ ...DEFAUT, ...((row?.data as object) ?? {}) });
  })
);

const tarifsSchema = z.object({
  avocat: z.number().int().nonnegative(),
  stagiaire: z.number().int().nonnegative(),
  droitsPlaidoirie: z.number().int().nonnegative(),
}).partial();
const identiteSchema = z.object({
  denomination: z.string(), ordre: z.string(), batonnier: z.string(),
  tresoriere: z.string(), secretaireGeneral: z.string(), adresse: z.string(),
}).partial();
const listeLibellesSchema = z.record(z.string(), z.string());
const majSchema = z.object({
  tarifs: tarifsSchema.optional(),
  exerciceCourant: z.number().int().optional(),
  exercices: z.object({ premier: z.number().int() }).partial().optional(),
  identite: identiteSchema.optional(),
  documents: z.object({
    categoriesArchives: z.array(z.string().trim().min(1)).max(60),
    typesPublication: z.array(z.string().trim().min(1)).max(40),
  }).partial().optional(),
  paiement: z.object({
    canauxActifs: z.array(z.enum(["MTN", "AIRTEL", "CARTE", "VIREMENT"])),
  }).partial().optional(),
  stage: z.object({ dureeMois: z.number().int().positive().max(120) }).partial().optional(),
  conseil: z.object({
    fonctions: z.array(z.string().trim().min(1)).max(40),
  }).partial().optional(),
  libellesStatuts: z.object({
    membre: listeLibellesSchema, cotisation: listeLibellesSchema,
    dossier: listeLibellesSchema, publication: listeLibellesSchema,
  }).partial().optional(),
}).strict();

/** Mise à jour des paramètres — réservée au Secrétaire Général / Admin. */
parametresRouter.put(
  "/",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    // Validation stricte : interdit les clés arbitraires et les valeurs qui
    // corrompraient les calculs (tarifs négatifs) ou les listes (entrées vides).
    const patch = majSchema.parse(req.body);
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    const base = (row?.data as object) ?? DEFAUT;
    const data = { ...base, ...patch };
    const saved = await prisma.parametres.upsert({
      where: { id: 1 },
      create: { id: 1, data },
      update: { data },
    });
    res.json(saved.data);
  })
);

/**
 * POST /parametres/reinitialiser-donnees — RÉINITIALISATION TOTALE (ADMIN).
 * Supprime toutes les données métier (membres, finances, institutionnel,
 * documents, messagerie, journaux, comptes non-admin) en CONSERVANT uniquement
 * le(s) compte(s) ADMIN et la configuration (table Parametres). Atomique : en
 * cas d'échec d'une contrainte, rien n'est supprimé. Outil de remise à zéro.
 */
parametresRouter.post(
  "/reinitialiser-donnees",
  requireRole("ADMIN"),
  asyncH(async (_req, res) => {
    // Ordre : enfants / tables à contrainte « restrict » d'abord, comptes
    // non-admin, puis les membres en dernier (les cascades font le reste).
    await prisma.$transaction([
      prisma.message.deleteMany({}),
      prisma.conversationParticipant.deleteMany({}),
      prisma.conversation.deleteMany({}),
      prisma.emargement.deleteMany({}),
      prisma.candidat.deleteMany({}),
      prisma.scrutin.deleteMany({}),
      prisma.journalDiscipline.deleteMany({}),
      prisma.dossierDisciplinaire.deleteMany({}),
      prisma.pieceDossier.deleteMany({}),
      prisma.quitus.deleteMany({}),
      prisma.recu.deleteMany({}),
      prisma.paiement.deleteMany({}),
      prisma.droitPlaidoirie.deleteMany({}),
      prisma.cotisation.deleteMany({}),
      prisma.rapportStage.deleteMany({}),
      prisma.membreConseil.deleteMany({}),
      prisma.reunion.deleteMany({}),
      prisma.assemblee.deleteMany({}),
      prisma.archive.deleteMany({}),
      prisma.compteur.deleteMany({}),
      prisma.publication.deleteMany({}),
      prisma.calendrierEditorial.deleteMany({}),
      prisma.journalNotification.deleteMany({}),
      prisma.demandeAcces.deleteMany({}),
      prisma.journalAudit.deleteMany({}),
      // Comptes non-admin (les jetons de rafraîchissement liés sont supprimés en cascade).
      prisma.user.deleteMany({ where: { role: { not: "ADMIN" } } }),
      prisma.membre.deleteMany({}),
    ]);
    res.json({ ok: true });
  })
);
