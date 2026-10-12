import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { rafraichirIdentite } from "../lib/identiteDocuments.js";
import { isDeepStrictEqual } from "node:util";
import { aLaPermission } from "../lib/rbac.js";
import { HttpError } from "../middleware/error.js";
import { fusionnerRegles, reglesSchema, stageSchema, REGLES_DEFAUT, REGLES_SECTION_DEFAUT } from "../lib/regles.js";
import { CHEMINS_SECRETS, MASQUE, chiffrer, cleDisponible, dechiffrer, ecrireChemin, lireChemin, masquerSecrets } from "../lib/secrets.js";
import { creerTransport } from "../lib/mail.js";

export const parametresRouter = Router();
/** Rôle de l'utilisateur authentifié (requireAuth est monté sur tout le routeur). */
const roleDe = (req: unknown) => (req as AuthRequest).user!.role;
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
    ville: "Pointe-Noire",
    courriel: "contact@barreau-pointe-noire.cg",
    site: "www.barreau-pointe-noire.cg",
    telephones: "+242 05 000 00 00 / +242 06 000 00 00",
    logo: "",
    // Mention C-13 (données fictives) sur les documents et l'accueil de l'instance de démonstration.
    modeDemonstration: false,
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
  // Valeurs juridiques : source unique lib/regles.ts (REGLES_DEFAUT).
  stage: REGLES_DEFAUT.stage,
  regles: REGLES_SECTION_DEFAUT,
  conseil: {
    fonctions: ["Bâtonnier", "Vice-Bâtonnier", "Secrétaire Général", "Trésorière", "Membre du Conseil"],
  },
  libellesStatuts: { membre: {}, cotisation: {}, dossier: {}, publication: {} },
  // Passerelles de paiement : mode verrouillé sur TEST (aucun encaissement réel).
  passerelles: { mode: "TEST" },
  notifications: { sms: { actif: false } },
  messagerie: { interneActive: true, piecesJointes: true, pieceMaxMo: 5, relaisEmail: true, relaisSms: false },
  modules: { masques: [] as string[] },
};

/** Sections réservées à la permission « parametres » (lecture comme écriture) : elles portent des secrets ou des accès externes. */
const SECTIONS_SENSIBLES = ["passerelles", "notifications", "smtp", "messagerie"] as const;
/** Modules jamais masquables : obligations de traçabilité et de tenue du tableau, plus l'accès à la configuration. */
const MODULES_OBLIGATOIRES = ["/", "/parametres", "/journal-audit", "/tableau", "/discipline"];

/** Vue renvoyée au client : secrets toujours masqués, sections sensibles retirées sans la permission « parametres ». */
function vue(data: Record<string, unknown>, role: string): Record<string, unknown> {
  const v = masquerSecrets(data);
  if (!aLaPermission(role, "parametres")) for (const k of SECTIONS_SENSIBLES) delete v[k];
  return v;
}

const estObjet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/** Fusion profonde (objets seulement, tableaux remplacés) : une mise à jour partielle n'efface pas les champs voisins. */
function fusionner(base: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = estObjet(base) ? { ...base } : {};
  for (const [k, v] of Object.entries(patch)) r[k] = estObjet(v) ? fusionner(r[k], v) : v;
  return r;
}

parametresRouter.get(
  "/",
  asyncH(async (req, res) => {
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    // Fusion avec les valeurs par défaut : garantit la présence des nouvelles
    // sections même pour un enregistrement créé avant leur introduction.
    const { stage, ...regles } = fusionnerRegles(row?.data);
    res.json(vue({ ...DEFAUT, ...((row?.data as object) ?? {}), stage, regles }, roleDe(req)));
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
  ville: z.string().max(80), modeDemonstration: z.boolean(),
  courriel: z.string().max(120), site: z.string().max(120), telephones: z.string().max(120),
  // Logo institutionnel en data URI image (≈2 Mo max) ; chaîne vide = sceau dessiné.
  logo: z.string().max(3_000_000).refine(
    (v) => v === "" || v.startsWith("data:image/"),
    "Le logo doit être une image (data URI) ou vide.",
  ),
}).partial();
const listeLibellesSchema = z.record(z.string(), z.string());
const secret = z.string().max(500);
const texte = z.string().trim().max(200);
const passerellesSchema = z.object({
  // Production verrouillée : la lever exige une décision de Fabrice et du Barreau (prestataire agréé CEMAC).
  mode: z.literal("TEST"),
  mtn: z.object({ actif: z.boolean(), apiUser: texte, abonnementCle: secret, cleSecrete: secret, environnement: z.literal("sandbox") }).partial().strict(),
  airtel: z.object({ actif: z.boolean(), clientId: texte, cleSecrete: secret }).partial().strict(),
  agregateur: z.object({ actif: z.boolean(), fournisseur: z.literal("CINETPAY"), siteId: texte, cleApi: secret, cleWebhook: secret }).partial().strict(),
}).partial().strict();
const urlHttps = z.union([z.literal(""), z.string().url().max(300).refine((u) => u.startsWith("https://"), "URL https:// attendue.")]);
const notificationsSchema = z.object({
  sms: z.object({ actif: z.boolean(), url: urlHttps, expediteur: z.string().trim().max(11), cleApi: secret }).partial().strict(),
}).partial().strict();
const smtpMajSchema = z.object({
  host: z.string().trim().max(253), port: z.coerce.number().int().min(1).max(65535), secure: z.boolean(),
  user: texte, pass: secret, from: texte,
}).partial().strict();
const messagerieSchema = z.object({
  interneActive: z.boolean(), piecesJointes: z.boolean(),
  pieceMaxMo: z.number().int().min(1).max(5), // plafonné par PIECE_MAX (5 Mo)
  relaisEmail: z.boolean(), relaisSms: z.boolean(),
}).partial().strict();
const modulesSchema = z.object({
  masques: z.array(z.string().regex(/^\/[a-z0-9-]*$/)).max(40).refine(
    (l) => !l.some((p) => MODULES_OBLIGATOIRES.includes(p)),
    "Accueil, Paramètres, Journal d'audit, Tableau et Discipline ne sont pas masquables.",
  ),
}).strict();
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
  stage: stageSchema.partial().optional(),
  regles: reglesSchema.optional(),
  conseil: z.object({
    fonctions: z.array(z.string().trim().min(1)).max(40),
  }).partial().optional(),
  libellesStatuts: z.object({
    membre: listeLibellesSchema, cotisation: listeLibellesSchema,
    dossier: listeLibellesSchema, publication: listeLibellesSchema,
  }).partial().optional(),
  passerelles: passerellesSchema.optional(),
  notifications: notificationsSchema.optional(),
  smtp: smtpMajSchema.optional(),
  messagerie: messagerieSchema.optional(),
  modules: modulesSchema.optional(),
}).strict();

/** Règles qui commandent l'effet d'une décision (sanction, radiation, électorat, éligibilité) : séparation bâtonnier / SG (R-42). */
const REGLES_DE_DECISION = ["sanctions", "effetRadiation", "sursisAutorise", "peineAccessoireMaxMois", "electoral", "eligibilite", "exclurePeineAccessoire"] as const;

/** Mise à jour des paramètres — SG, bâtonnier ou Admin ; les règles de décision exigent discipline_decider (SG exclu). */
parametresRouter.put(
  "/",
  requireRole("SECRETAIRE_GENERAL", "BATONNIER"),
  asyncH(async (req, res) => {
    // Validation stricte : interdit les clés arbitraires et les valeurs qui
    // corrompraient les calculs (tarifs négatifs) ou les listes (entrées vides).
    const patch = majSchema.parse(req.body);
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    const base = ((row?.data as object) ?? DEFAUT) as Record<string, unknown>;
    const journal: string[] = [];
    const sensibles = SECTIONS_SENSIBLES.filter((k) => patch[k] !== undefined);
    if (sensibles.length && !aLaPermission(roleDe(req), "parametres"))
      throw new HttpError(403, "Accès refusé : les sections " + sensibles.join(", ") + " relèvent de la permission parametres.");
    // Anti-escalade (comme rbac.ts) : modifier une règle de décision exige discipline_decider.
    if (patch.regles) {
      const courant = fusionnerRegles(row?.data) as unknown as Record<string, unknown>;
      const modifiees = REGLES_DE_DECISION.filter((k) => !isDeepStrictEqual(courant[k], (patch.regles as Record<string, unknown>)[k]));
      if (modifiees.length) {
        if (!aLaPermission(roleDe(req), "discipline_decider"))
          throw new HttpError(403, "Accès refusé : modifier les règles de décision (" + modifiees.join(", ") + ") relève de l'action discipline_decider.");
        journal.push("règles modifiées : " + modifiees.join(", "));
      }
    }
    const data: Record<string, unknown> = { ...base, ...patch };
    // Le stage porte deux règles indépendantes : une mise à jour partielle ne doit pas effacer l'autre.
    if (patch.stage) data.stage = { ...((base as { stage?: object }).stage ?? {}), ...patch.stage };
    for (const k of sensibles) data[k] = fusionner(base[k], patch[k] as Record<string, unknown>);
    // Secrets : vide ou masqué → on conserve l'existant ; nouvelle valeur → chiffrée (jamais stockée en clair).
    const secretsMaj: string[] = [];
    for (const c of CHEMINS_SECRETS) {
      const v = lireChemin(patch, c);
      if (typeof v !== "string") continue;
      if (v === "" || v.startsWith(MASQUE)) { ecrireChemin(data, c, lireChemin(base, c)); continue; }
      if (!cleDisponible())
        throw new HttpError(400, "Secret non enregistré : la variable d'environnement PARAMS_CLE (32 octets en base64) est absente ou invalide sur le serveur.");
      ecrireChemin(data, c, chiffrer(v));
      secretsMaj.push(c);
    }
    // T27 : le mot de passe SMTP ne suit pas un changement de serveur (hôte, port, chiffrement) : sans
    // ressaisie, il est effacé. Sinon un opérateur qui ne peut pas le lire l'enverrait (AUTH) au serveur
    // de son choix, par /tester/smtp ou le prochain envoi.
    const smtpAvant = (base.smtp ?? {}) as Record<string, unknown>;
    const serveurSmtpChange = (["host", "port", "secure"] as const).some((k) => patch.smtp?.[k] !== undefined && String(patch.smtp[k]) !== String(smtpAvant[k]));
    if (serveurSmtpChange && !secretsMaj.includes("smtp.pass") && smtpAvant.pass !== undefined) {
      ecrireChemin(data, "smtp.pass", undefined);
      journal.push("mot de passe SMTP effacé (serveur modifié)");
    }
    // Journal : noms de sections et de champs seulement, jamais de valeur.
    if (sensibles.length) journal.push("sections : " + sensibles.join(", "));
    if (secretsMaj.length) journal.push("secrets remplacés : " + secretsMaj.join(", "));
    if (patch.modules) journal.push("modules masqués : " + patch.modules.masques.length);
    if (journal.length) res.locals.auditDetail = journal.join(" ; ");
    const saved = await prisma.parametres.upsert({
      where: { id: 1 },
      create: { id: 1, data: data as object },
      update: { data: data as object },
    });
    // Rafraîchit la source unique d'identité des documents (si l'identité a changé).
    if (patch.identite) await rafraichirIdentite();
    res.json(vue(saved.data as Record<string, unknown>, roleDe(req)));
  })
);

/** Champs requis par canal simulé : [section de Parametres.data, champs]. */
const CHAMPS_REQUIS: Record<string, [string, string[]]> = {
  sms: ["notifications.sms", ["url", "expediteur", "cleApi"]],
  mtn: ["passerelles.mtn", ["apiUser", "abonnementCle", "cleSecrete"]],
  airtel: ["passerelles.airtel", ["clientId", "cleSecrete"]],
  agregateur: ["passerelles.agregateur", ["siteId", "cleApi"]],
};

/**
 * POST /parametres/tester/:canal — test de connexion SANS aucun envoi.
 * smtp : poignée de main verify() (aucun message) ; sms et passerelles : contrôle
 * de complétude en simulation, aucun appel externe (pas d'adaptateur réel).
 */
parametresRouter.post(
  "/tester/:canal",
  requireRole("SECRETAIRE_GENERAL", "BATONNIER"),
  asyncH(async (req, res) => {
    const canal = req.params.canal;
    const data = ((await prisma.parametres.findUnique({ where: { id: 1 } }))?.data ?? {}) as Record<string, unknown>;
    if (canal === "smtp") {
      const s = (data.smtp ?? {}) as { host?: string; port?: number; secure?: boolean; user?: string; pass?: string };
      if (!s.host) return res.json({ canal, simulation: false, ok: false, manquants: ["host"], message: "Champs manquants : host." });
      let ok = true, message = "Connexion SMTP établie (aucun message envoyé).";
      try {
        await creerTransport({ host: s.host, port: Number(s.port) || 587, secure: !!s.secure, user: s.user || undefined, pass: s.pass ? dechiffrer(s.pass) : undefined }, 10_000).verify();
      } catch (e) {
        // Code d'erreur seul (ECONNREFUSED, EAUTH…) : ni secret ni bannière du serveur distant.
        const code = (e as { code?: unknown }).code;
        ok = false;
        message = "Échec de la connexion SMTP" + (typeof code === "string" ? ` (${code})` : "") + ".";
      }
      res.locals.auditDetail = `test smtp : ${ok ? "réussi" : "échec"}`;
      return res.json({ canal, simulation: false, ok, manquants: [], message });
    }
    const def = CHAMPS_REQUIS[canal];
    if (!def) throw new HttpError(400, "Canal inconnu : smtp, sms, mtn, airtel ou agregateur attendu.");
    const section = (lireChemin(data, def[0]) ?? {}) as Record<string, unknown>;
    const manquants = def[1].filter((k) => !section[k]);
    const ok = manquants.length === 0;
    res.locals.auditDetail = `test ${canal} : ${ok ? "complet" : "incomplet"}`;
    res.json({
      canal, simulation: true, ok, manquants,
      message: ok ? "simulation : configuration complète" : "simulation : champs manquants : " + manquants.join(", "),
    });
  })
);

/**
 * POST /parametres/reinitialiser-donnees — RÉINITIALISATION TOTALE (ADMIN).
 * Supprime toutes les données métier (membres, finances, institutionnel,
 * documents, messagerie, journaux métier, comptes non-admin) en CONSERVANT le(s)
 * compte(s) ADMIN, la configuration (table Parametres) et le journal d'audit
 * (JournalAudit, non modifiable : traçabilité de la réinitialisation elle-même). Atomique : en
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
      // Comptes non-admin (les jetons de rafraîchissement liés sont supprimés en cascade).
      prisma.user.deleteMany({ where: { role: { not: "ADMIN" } } }),
      prisma.membre.deleteMany({}),
    ]);
    res.json({ ok: true });
  })
);
