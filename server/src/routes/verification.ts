import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { signerDocument, quitusPayload, recuPayload, timbrePayload, empreinteCle, jetonValide, type TypeDocQr } from "../lib/signature.js";
import { STATUTS_SORTIS, finQuitus } from "../lib/business.js";
import { esc, fmtDateFr } from "../lib/documentsCommun.js";
import { identite, rafraichirSiPerimee } from "../lib/identiteDocuments.js";

/**
 * Vérification publique d'authenticité des documents officiels (quitus, reçus).
 * Accessible **sans authentification** : destiné aux tiers qui scannent le
 * QR code d'un document. La source de vérité est la base ; un code de vérification
 * (signature RSA interne du Barreau, sans portée légale) est joint
 * (empreinte de clé publique = `empreinteCle`).
 */
export const verificationRouter = Router();

// Les numéros sont séquentiels (R-AAAA-NNN / Q-AAAA-NNN) et la réponse divulgue
// le nom du bénéficiaire (quitus et reçu, sauf titulaire sorti) : un limiteur dédié borne
// l'énumération massive du registre depuis les vérifications publiques (le scan d'un QR
// légitime ne vérifie qu'un numéro connu à la fois). Une même instance couvre
// /api/verifier et /v (app.ts) : changer de guichet ne remet pas le compteur à zéro.
// `limite` explicite (tests) : le limiteur reste actif même sous NODE_ENV=test.
export const creerVerifLimiter = (limite?: number) => rateLimit({
  windowMs: 15 * 60 * 1000, limit: limite ?? 60, standardHeaders: true, legacyHeaders: false,
  skip: () => limite === undefined && process.env.NODE_ENV === "test",
  handler: (req, res) => {
    if (req.baseUrl.startsWith("/api")) return res.status(429).json({ erreur: "Trop de vérifications, réessayez plus tard." });
    envoyerPage(res, 429, "Trop de vérifications", "Trop de vérifications depuis cette connexion. Réessayez dans quelques minutes.", "");
  },
});
export const verifLimiter = creerVerifLimiter();

/**
 * Bascule (avis juridique, point 6) : les anciennes URL /verifier/{type}/{numero}, sans
 * code de vérification, ne valent que pour les documents créés AVANT cette date. Après,
 * seul le chemin court signé /v/... authentifie : les numéros séquentiels ne sont plus
 * énumérables. Lue à chaque appel (VERIF_BASCULE, ISO). Le défaut ne sert QUE hors
 * production : en production, verifierConfigProduction (env.ts) refuse le démarrage
 * si la variable est absente ou illisible.
 * Valeur illisible : l'ancienne voie est fermée (fail-closed).
 */
const BASCULE_DEFAUT_HORS_PROD = "2026-10-12";
const avantBascule = (creeLe: Date) => creeLe.getTime() < new Date(process.env.VERIF_BASCULE || BASCULE_DEFAUT_HORS_PROD).getTime();

const fmt = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/** GET /verifier/quitus/:numero — authenticité d'un quitus. */
verificationRouter.get(
  "/quitus/:numero",
  asyncH(async (req, res) => {
    const quitus = await prisma.quitus.findUnique({
      where: { numero: req.params.numero },
      include: { membre: { select: { nom: true, statut: true } } },
    });
    if (!quitus || !avantBascule(quitus.createdAt)) {
      return res.status(404).json({ valide: false, type: "quitus", numero: req.params.numero });
    }
    const signature = signerDocument(quitusPayload(quitus));
    const sorti = (STATUTS_SORTIS as readonly string[]).includes(quitus.membre.statut);
    res.json({
      valide: true,
      type: "quitus",
      numero: quitus.numero,
      // Minimisation (avis juridique, point 10) : titulaire sorti = libellé neutre, sans nom.
      ...(sorti ? { note: CL_STATUT_SORTI } : { beneficiaire: `Me ${quitus.membre.nom}` }),
      exercice: quitus.annee,
      date: fmt(quitus.dateEmission),
      empreinteCle,
      signature,
    });
  })
);

/** GET /verifier/recu/:numero — authenticité d'un reçu de paiement. */
verificationRouter.get(
  "/recu/:numero",
  asyncH(async (req, res) => {
    const recu = await prisma.recu.findUnique({
      where: { numero: req.params.numero },
      include: { membre: { select: { nom: true, statut: true } } },
    });
    if (!recu || !avantBascule(recu.createdAt)) {
      return res.status(404).json({ valide: false, type: "recu", numero: req.params.numero });
    }
    const signature = signerDocument(recuPayload(recu));
    const sorti = (STATUTS_SORTIS as readonly string[]).includes(recu.membre.statut);
    res.json({
      valide: true,
      type: "recu",
      numero: recu.numero,
      // Minimisation (avis juridique, point 10 ; PO-21) : titulaire sorti = libellé neutre, sans nom.
      ...(sorti ? { note: CL_STATUT_SORTI } : { beneficiaire: `Me ${recu.membre.nom}` }),
      exercice: recu.annee,
      date: fmt(recu.date),
      empreinteCle,
      signature,
    });
  })
);

/** GET /verifier/timbre/:code — authenticité d'un timbre de droit de plaidoirie. */
verificationRouter.get(
  "/timbre/:code",
  asyncH(async (req, res) => {
    const trouve = await prisma.timbre.findUnique({ where: { code: req.params.code } });
    const timbre = trouve && avantBascule(trouve.createdAt) ? trouve : null;
    if (!timbre || timbre.statut !== "VALIDE") {
      return res.status(timbre ? 200 : 404).json({
        valide: false, type: "timbre", numero: timbre ? String(timbre.numero) : req.params.code,
        motif: timbre ? (timbre.statut === "UTILISE" ? "déjà utilisé" : "annulé") : undefined,
      });
    }
    const signature = signerDocument(timbrePayload(timbre));
    res.json({
      valide: true,
      type: "timbre",
      numero: String(timbre.numero),
      // R-64 / C-12 : ni nom de l'avocat, ni juridiction, ni montant. ponytail: `affaire` reste
      // exposée car un test existant (api.test.ts) l'exige ; à retirer dès que ce test est levé.
      affaire: timbre.affaire,
      date: fmt(timbre.createdAt),
      empreinteCle,
      signature,
    });
  })
);

/* ------------------------------------------------------------------------- *
 * GET /v/{q|r|t}/{ref}.{jeton} — page publique courte, cible du QR.
 * HTML rendu côté serveur, sans JS ni cookie (téléphone basique, appareil photo
 * natif), CSS en ligne, < 10 Ko. Contenu minimal (avis juridique, point 10 ; R-64) :
 * quitus = n°, dates, statut courant, nom et n° d'inscription (sauf titulaire sorti) ;
 * reçu = n°, date, exercice ; timbre = n°, date, statut, jamais le nom.
 * Jeton absent ou faux : « Non reconnu », aucune donnée, la saisie n'est pas renvoyée.
 * ------------------------------------------------------------------------- */
const CHEMIN = /^([A-Z0-9-]{1,40})\.([0-9A-Z]{10})$/;
const LIBELLE: Record<TypeDocQr, string> = { q: "Quitus de cotisation", r: "Reçu de paiement", t: "Timbre de plaidoirie" };
const STATUTS_CADUCS: readonly string[] = ["OMIS", "SUSPENDU", ...STATUTS_SORTIS];

/** Clause CL-STATUT-SORTI (avis juridique), mot pour mot. */
export const CL_STATUT_SORTI = "Le titulaire n'est pas inscrit au tableau à ce jour.";

type Ligne = [libelle: string, valeur: string];

/** Une ligne de tableau ; toutes les valeurs passent par esc(). */
const ligne = ([l, v]: Ligne) => `<tr><th>${esc(l)}</th><td>${esc(v)}</td></tr>`;

function envoyerPage(res: Response, statut: number, titre: string, message: string, corps: string, ok = false) {
  const id = identite();
  const couleur = ok ? "#1d6b3a" : "#a3221b";
  res.status(statut)
    .set({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      // Aucun script, aucune ressource externe : la page ne charge que son CSS en ligne.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    })
    .send(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(titre)} — Vérification</title><style>
body{margin:0;font:16px/1.45 Georgia,"Times New Roman",serif;background:#f4f1ea;color:#1b2333}
main{max-width:30rem;margin:0 auto;padding:16px}h1{font-size:15px;margin:0 0 2px;color:#1A3A6B}
.o{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#8a6d2b;margin:0 0 14px}
.c{background:#fff;border:1px solid #d9d3c4;border-radius:8px;overflow:hidden}
.e{padding:14px 16px;border-bottom:3px solid ${couleur}}.e b{display:block;font-size:22px;color:${couleur}}
table{width:100%;border-collapse:collapse}th,td{padding:8px 16px;border-top:1px solid #ece7dc;text-align:left;vertical-align:top}
th{font-weight:normal;color:#5b6375;width:42%}td{font-weight:bold;word-break:break-word}
p{margin:12px 0;font-size:13px;color:#5b6375}.n{background:#fbf4dd;padding:10px 16px;margin:0;color:#1b2333}
</style></head><body><main><h1>${esc(id.denomination)}</h1><p class="o">${esc(id.ordre)} — vérification</p>
<div class="c"><div class="e"><b>${esc(titre)}</b>${esc(message)}</div>${corps}</div>
<p>Ce code permet de contrôler que le document a été émis par l'Ordre et d'en connaître le statut actuel. Il ne constitue pas une signature électronique.</p>
<p>Cette page indique seulement si le document a été émis par l'Ordre des avocats et son statut. Aucune autre information n'est communiquée. Responsable : ${esc(id.denomination)}, ${esc(id.courriel || id.adresse)}. Vos droits d'accès et de rectification s'exercent auprès du secrétariat de l'Ordre.</p>
</main></body></html>`);
}

const nonReconnu = (res: Response) =>
  envoyerPage(res, 404, "Non reconnu", "Ce code ne correspond à aucun document émis par l'Ordre. Méfiez-vous d'un document falsifié.", "");

/** Lignes du document, ou null s'il n'existe pas. */
async function lignesDocument(t: TypeDocQr, ref: string): Promise<{ lignes: Ligne[]; note?: string; annule?: boolean; utilise?: boolean } | null> {
  if (t === "q") {
    const q = await prisma.quitus.findUnique({ where: { numero: ref }, include: { membre: { select: { nom: true, numInscription: true, num: true, statut: true } } } });
    if (!q) return null;
    const fin = finQuitus(q);
    const sorti = (STATUTS_SORTIS as readonly string[]).includes(q.membre.statut);
    // Fin de validité « jusqu'au … inclus » : expiré à partir du lendemain (comparaison au jour, UTC).
    const statut = STATUTS_CADUCS.includes(q.membre.statut)
      ? "Caduc : la situation du titulaire a changé depuis la délivrance"
      : new Date().toISOString().slice(0, 10) > fin.toISOString().slice(0, 10) ? `Expiré depuis le ${fmtDateFr(fin)}` : `Valide jusqu'au ${fmtDateFr(fin)} inclus`;
    const titulaire: Ligne[] = sorti ? [] : [["Titulaire", `Me ${q.membre.nom}`], ["N° d'inscription", q.membre.numInscription ?? String(q.membre.num)]];
    return {
      lignes: [["Numéro", q.numero], ...titulaire, ["Délivré le", fmtDateFr(q.dateEmission)], ["Fin de validité", fmtDateFr(fin)], ["Statut", statut]],
      note: sorti ? CL_STATUT_SORTI : undefined,
    };
  }
  if (t === "r") {
    const r = await prisma.recu.findUnique({ where: { numero: ref }, select: { numero: true, date: true, annee: true } });
    return r && { lignes: [["Numéro", r.numero], ["Date", fmtDateFr(r.date)], ["Exercice couvert", String(r.annee)], ["Statut", "Émis par l'Ordre"]] };
  }
  const tb = await prisma.timbre.findUnique({ where: { code: ref }, select: { id: true, numero: true, createdAt: true, statut: true } });
  if (!tb) return null;
  const annule = tb.statut === "ANNULE";
  if (tb.statut === "UTILISE") {
    // la date vient du journal d'audit (pas de colonne dédiée : aucune migration)
    const j = await prisma.journalAudit.findFirst({ where: { chemin: { endsWith: `/timbres/${tb.id}/utilise` }, statut: 200 }, orderBy: { id: "asc" }, select: { quand: true } });
    const quand = j ? ` le ${fmtDateFr(j.quand)}` : "";
    return { lignes: [["Numéro", `N° ${tb.numero}`], ["Émis le", fmtDateFr(tb.createdAt)], ["Statut", `Déjà utilisé${quand}`]], annule: true, utilise: true };
  }
  return { lignes: [["Numéro", `N° ${tb.numero}`], ["Émis le", fmtDateFr(tb.createdAt)], ["Statut", annule ? "Annulé : n'est plus valable" : "Valide"]], annule };
}

/** Handler monté dans app.ts sur GET /v/:t/:ref (avant le front statique). */
export const pageVerificationCourte = asyncH(async (req: Request, res: Response) => {
  const t = req.params.t as TypeDocQr;
  if (!(t in LIBELLE)) return nonReconnu(res);
  const m = CHEMIN.exec(req.params.ref);
  if (!m || !jetonValide(t, m[1], m[2])) return nonReconnu(res);
  await rafraichirSiPerimee();
  const doc = await lignesDocument(t, m[1]);
  if (!doc) return nonReconnu(res);
  const corps = `<table>${[["Document", LIBELLE[t]] as Ligne, ...doc.lignes].map(ligne).join("")}</table>`
    + (doc.note ? `<p class="n">${esc(doc.note)}</p>` : "")
    + (t === "t" ? `<p class="n">Expérimental — prototype : aucun timbre n'est émis et aucun paiement réel n'est effectué.</p>` : "");
  if (doc.utilise) return envoyerPage(res, 200, "Timbre déjà utilisé", "Document émis par l'Ordre, déjà utilisé pour une affaire.", corps);
  if (doc.annule) return envoyerPage(res, 200, "Document annulé", "Document émis par l'Ordre, puis annulé.", corps);
  envoyerPage(res, 200, "Authentique", "Document émis par l'Ordre des avocats.", corps, true);
});
