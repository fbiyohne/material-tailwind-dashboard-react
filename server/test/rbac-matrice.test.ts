import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { writeFileSync } from "node:fs";

/**
 * T8 (M-20261016) — matrice RBAC attendue × réelle, prouvée par requêtes HTTP.
 *
 * - MATRICE : une ligne [méthode, chemin, rôles attendus, action] par route Express ; le test
 *   de couverture parcourt app._router.stack et échoue si une route n'a pas de ligne.
 * - Matrice RÉELLE (statique) : les gardes requireRole / requirePermission sont étiquetées par
 *   le vi.mock ci-dessous (aucun code de production modifié), puis évaluées pour chaque rôle.
 * - HTTP : 401 sans jeton ; 403 pour un rôle non autorisé ; rôle autorisé ≠ 401/403 sur les GET
 *   SEULEMENT. Une écriture n'est envoyée que si les gardes la refusent avant le gestionnaire
 *   (aucun effet de bord) ; DELETE, reinitialiser-donnees, tester/:canal, paiements et webhook
 *   ne reçoivent jamais le jeton d'un rôle qui passe les gardes.
 * - ADMIN = tous les modules et toutes les actions (décision du 16/10/2026) ; ses lectures de contenu sont tracées.
 * - ECARTS : écarts connus (rapport docs/audits/m20261016/rbac-matrice.md) en it.fails ou it.todo.
 *
 * Base barreau_pn_test uniquement (test/setup.ts). Comptes et données marqués « E2E T8 »,
 * supprimés en afterAll ; RolePermission ramenée aux défauts puis restaurée et vérifiée.
 */

// Étiquette chaque garde avec ses paramètres (lecture de la matrice réelle sans toucher au code).
vi.mock("../src/middleware/auth.js", async (orig) => {
  const m = await orig<typeof import("../src/middleware/auth.js")>();
  return {
    ...m,
    requireRole: (...r: Parameters<typeof m.requireRole>) => Object.assign(m.requireRole(...r), { garde: { type: "role", valeurs: r as string[] } }),
    requirePermission: (p: string) => Object.assign(m.requirePermission(p), { garde: { type: "perm", valeurs: [p] } }),
  };
});

import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { requireAuth, requireAvocat } from "../src/middleware/auth.js";
import { aLaPermission, amorcerMatriceSiVide, rafraichirMatrice } from "../src/lib/rbac.js";

// ── Rôles (8 de l'enum + la qualité Stagiaire, portée par un compte AVOCAT) ──────────
const SG = "SECRETAIRE_GENERAL", BAT = "BATONNIER", TRES = "TRESORIERE", ADM = "ADMIN";
const SA = "SECRETAIRE_ADJOINT", CONS = "CONSULTATION", ACC = "ACCUEIL", AV = "AVOCAT", STAG = "STAGIAIRE";
const ROLES = [SG, BAT, TRES, ADM, SA, CONS, ACC, AV, STAG];
const roleReel = (r: string) => (r === STAG ? AV : r);

// ── Groupes de la matrice ATTENDUE (H7 corrigée par l'avis juridique ; RolePermission fait foi par module) ──
const PUBLIC = ["PUBLIC"];
const INTERNES = [SG, BAT, TRES, ADM, SA, CONS, ACC];
const ESPACE = [AV, STAG];
const CONNECTES = [...INTERNES, ...ESPACE];
const M_MEMBRES = [SG, ADM, BAT, SA, CONS, ACC];
const M_FIN = [SG, ADM, TRES];
const M_REU = [SG, ADM, BAT, SA];
const M_DISC = [SG, ADM, BAT, SA];
const M_ELEC = [SG, ADM, BAT, SA];
const M_MSG = [SG, ADM, BAT, TRES, SA];
const M_DOC = [SG, ADM, BAT, SA, CONS, ACC];
const M_CE = [SG, ADM, BAT, SA, CONS];
const M_AUDIT = [SG, ADM, BAT, SA, CONS];
const SYS = [SG, ADM]; // paramètres techniques, utilisateurs, rbac
const ECR = [SG, ADM, SA]; // écriture de gestion courante (SA comme le SG, hors système et suppressions)
const SUPPR = [SG, ADM];
const ADMIN_SEUL = [ADM];

type Action = "L" | "C" | "M" | "S" | "V";
type Ligne = { m: string; c: string; ok: string[]; a: Action; handler?: string; corps?: object; lourd?: boolean };
const l = (m: string, c: string, ok: string[], a: Action, o: Partial<Ligne> = {}): Ligne => ({ m, c, ok, a, ...o });

/** Matrice attendue : une ligne par route. a = action (Lecture, Création, Modification, Suppression, Validation). */
const MATRICE: Ligne[] = [
  l("GET", "/api/health", PUBLIC, "L"),
  l("GET", "/api/installation/etat", PUBLIC, "L"),
  l("POST", "/api/installation", PUBLIC, "C"), // 409 une fois installé (installation.ts:42)
  l("POST", "/api/installation/test-email", PUBLIC, "C"), // 409 une fois installé (installation.ts:83)
  l("GET", "/api/auth/identite", PUBLIC, "L"),
  l("POST", "/api/auth/login", PUBLIC, "C"),
  l("POST", "/api/auth/demande-acces", PUBLIC, "C"),
  l("GET", "/api/auth/activation/:token", PUBLIC, "L"),
  l("POST", "/api/auth/activer", PUBLIC, "M"),
  l("POST", "/api/auth/forgot-password", PUBLIC, "C"),
  l("GET", "/api/auth/reset/:token", PUBLIC, "L"),
  l("POST", "/api/auth/reset", PUBLIC, "M"),
  l("POST", "/api/auth/refresh", PUBLIC, "C"),
  l("POST", "/api/auth/logout", PUBLIC, "S"),
  l("GET", "/api/auth/me", CONNECTES, "L"),
  l("POST", "/api/auth/password", CONNECTES, "M"),

  // Membres (annuaire largement accessible : projection minimisée, membres.ts:115)
  l("GET", "/api/membres", INTERNES, "L"),
  l("GET", "/api/membres/export/pdf", M_MEMBRES, "L", { lourd: true }),
  l("POST", "/api/membres/export", M_MEMBRES, "L"),
  l("GET", "/api/membres/:id", M_MEMBRES, "L"),
  l("GET", "/api/membres/:id/pieces", [SG, BAT, ADM], "L"), // casier : Bâtonnier et SG (R-62) ; métadonnées seules
  l("POST", "/api/membres/:id/pieces", [SG, ADM, SA, ACC], "C"), // ACCUEIL : dépôt de pièces (H7)
  l("POST", "/api/membres", ECR, "C"),
  l("POST", "/api/membres/import", ECR, "C"),
  l("PATCH", "/api/membres/:id", ECR, "M"),
  l("POST", "/api/membres/:id/radier", [BAT, ADM], "V"),
  l("POST", "/api/membres/:id/deces", ECR, "M"),
  l("GET", "/api/membres/:id/evenements", [SG, BAT, ADM], "L"), // contient les radiations (donnée disciplinaire)
  // Garde dans le gestionnaire (membres.ts:801), AVANT toute lecture ou écriture : type de sortie volontaire → SG seul.
  l("POST", "/api/membres/:id/evenements", [SG, ADM, BAT, TRES, SA], "V", { handler: "membres.ts:801", corps: { type: "DEMISSIONNAIRE" } }),
  l("POST", "/api/membres/admission-directe", [SG, BAT, ADM], "V"),
  l("GET", "/api/membres/:id/rapports", M_MEMBRES, "L"),
  l("POST", "/api/membres/:id/rapports", ECR, "C"),
  l("DELETE", "/api/membres/:id/rapports/:rid", SUPPR, "S"),
  l("POST", "/api/membres/:id/valider-stage", [BAT, ADM], "V"),
  l("DELETE", "/api/membres/:id", ADMIN_SEUL, "S"),
  l("POST", "/api/membres/:id/acces", [SG, ADM], "M"), // lien d'activation renvoyé à l'opérateur (ADMIN autorisé, tracé)
  l("POST", "/api/membres/:id/attestation", ECR, "C"),
  l("GET", "/api/membres/:id/attestation/pdf", ECR, "L"),
  l("POST", "/api/membres/:id/attestation/apercu", ECR, "L"), // HTML d'aperçu, ni numéro ni archive
  l("GET", "/api/membres/:id/attestation-sortie/pdf", ECR, "L"),

  l("GET", "/api/users", SYS, "L"),
  l("POST", "/api/users", SYS, "C"),
  l("PATCH", "/api/users/:id", SYS, "M"),
  l("DELETE", "/api/users/:id", ADMIN_SEUL, "S"),
  l("POST", "/api/users/:id/password", SYS, "M"),
  l("GET", "/api/demandes-acces", SYS, "L"),
  l("POST", "/api/demandes-acces/:id/approuver", SYS, "V"),
  l("POST", "/api/demandes-acces/:id/approuver-espace", [SG, ADM], "V"),
  l("POST", "/api/demandes-acces/:id/refuser", SYS, "V"),

  l("GET", "/api/pieces", [SG, BAT, ADM], "L"),
  l("GET", "/api/pieces/:id/fichier", [SG, BAT, ADM], "L"), // contenu d'une pièce : ADMIN autorisé, lecture tracée dans JournalAudit
  l("POST", "/api/pieces/:id/verifier", [SG, ADM], "V"),
  l("POST", "/api/pieces/:id/rejeter", [SG, ADM], "V"),
  l("DELETE", "/api/pieces/:id", SUPPR, "S"),

  l("GET", "/api/notifications", SYS, "L"),
  l("GET", "/api/mes-notifications", INTERNES, "L"),
  l("POST", "/api/mes-notifications/lu-tout", INTERNES, "M"),
  l("POST", "/api/mes-notifications/:id/lu", INTERNES, "M"),
  l("GET", "/api/rbac", SYS, "L"),
  l("PUT", "/api/rbac", SYS, "M"),

  l("POST", "/api/paiements/webhook", PUBLIC, "V"), // signature HMAC de la passerelle
  l("POST", "/api/paiements/initier", M_FIN, "C"),
  l("GET", "/api/paiements/:ref", M_FIN, "L"),
  l("POST", "/api/paiements/:ref/confirmer-sandbox", M_FIN, "V"),
  l("POST", "/api/cotisations/relances", M_FIN, "C"),
  l("GET", "/api/cotisations", M_FIN, "L"),
  l("POST", "/api/cotisations/generer", M_FIN, "C"),
  l("POST", "/api/cotisations/paiement", M_FIN, "C"),
  l("DELETE", "/api/cotisations/:membreId/:annee", ADMIN_SEUL, "S"),
  l("POST", "/api/cotisations/:membreId/valider", [TRES, ADM], "V"),
  l("GET", "/api/recus/:id/pdf", M_FIN, "L"),
  l("POST", "/api/recus/apercu", M_FIN, "L"), // HTML d'aperçu, aucune écriture
  l("POST", "/api/etats/pdf", [...M_MEMBRES, TRES], "L"), // mise en page des lignes affichées ; jamais un avocat
  l("GET", "/api/recus", M_FIN, "L"),
  l("DELETE", "/api/recus/:id", M_FIN, "S"), // annulation motivée (statut ANNULE), pas une suppression physique
  l("GET", "/api/quitus/:id/pdf", M_FIN, "L"),
  l("POST", "/api/quitus/apercu", M_FIN, "L"),
  l("GET", "/api/quitus/eligibles", M_FIN, "L"),
  l("GET", "/api/quitus/:id/signature", M_FIN, "L"),
  l("GET", "/api/quitus", M_FIN, "L"),
  l("POST", "/api/quitus", M_FIN, "C"),
  l("POST", "/api/quitus/lot", M_FIN, "C"),
  l("DELETE", "/api/quitus/:id", ADMIN_SEUL, "S"),
  l("POST", "/api/droits/relances", M_FIN, "C"),
  l("GET", "/api/droits", M_FIN, "L"),
  l("POST", "/api/droits/paiement", M_FIN, "C"),
  l("DELETE", "/api/droits/:membreId/:annee", ADMIN_SEUL, "S"),
  l("POST", "/api/timbres", M_FIN, "C"),
  l("POST", "/api/timbres/externes", M_FIN, "C"),
  l("GET", "/api/timbres/stats", M_FIN, "L"),
  l("GET", "/api/timbres", M_FIN, "L"),
  l("GET", "/api/timbres/:id", M_FIN, "L"),
  l("POST", "/api/timbres/:id/annuler", ADMIN_SEUL, "S"),

  // Discipline : réservée aux organes habilités ; TRESORIERE, ACCUEIL, CONSULTATION en 403 (R-62)
  l("GET", "/api/discipline", M_DISC, "L"),
  l("GET", "/api/discipline/journal", M_DISC, "L"),
  l("GET", "/api/discipline/:id", M_DISC, "L"),
  l("POST", "/api/discipline", [SG, BAT, ADM], "C"),
  l("PATCH", "/api/discipline/:id", [SG, BAT, ADM], "M"), // instruction : mêmes titulaires que la saisine
  l("POST", "/api/discipline/:id/decision", [BAT, ADM], "V"),
  l("POST", "/api/discipline/:id/reformation", [BAT, ADM], "V"),
  l("DELETE", "/api/discipline/:id", ADMIN_SEUL, "S"),
  l("GET", "/api/discipline/:id/convocation/pdf", M_DISC, "L"),
  l("GET", "/api/discipline/:id/decision/pdf", M_DISC, "L"),

  l("GET", "/api/reunions/:id/convocation/pdf", M_REU, "L"),
  l("POST", "/api/reunions/:id/convoquer", ECR, "C"),
  l("GET", "/api/reunions/:id/feuille-presence/pdf", M_REU, "L"),
  l("GET", "/api/reunions/:id/pv/pdf", M_REU, "L"),
  l("GET", "/api/reunions", M_REU, "L"),
  l("GET", "/api/reunions/:id", M_REU, "L"),
  l("POST", "/api/reunions", ECR, "C"),
  l("PATCH", "/api/reunions/:id", ECR, "M"),
  l("DELETE", "/api/reunions/:id", SUPPR, "S"),
  l("GET", "/api/assemblees/:id/convocation/pdf", M_REU, "L"),
  l("POST", "/api/assemblees/:id/convoquer", ECR, "C"),
  l("GET", "/api/assemblees/:id/pv/pdf", M_REU, "L"),
  l("GET", "/api/assemblees", M_REU, "L"),
  l("GET", "/api/assemblees/:id", M_REU, "L"),
  l("POST", "/api/assemblees", ECR, "C"),
  l("PATCH", "/api/assemblees/:id", ECR, "M"),
  l("DELETE", "/api/assemblees/:id", SUPPR, "S"),

  l("POST", "/api/publications/lettre/generer", [SG, BAT, ADM, SA], "C"),
  l("GET", "/api/publications", M_DOC, "L"),
  l("GET", "/api/publications/:id", M_DOC, "L"),
  l("POST", "/api/publications/apercu", M_DOC, "L"), // HTML d'aperçu, aucune écriture
  l("GET", "/api/publications/:id/pdf", M_DOC, "L"),
  l("POST", "/api/publications", ECR, "C"),
  l("PATCH", "/api/publications/:id", ECR, "M"),
  l("POST", "/api/publications/:id/statut", [SG, BAT, ADM], "V"),
  l("DELETE", "/api/publications/:id", SUPPR, "S"),
  l("POST", "/api/archives", [SG, ADM, SA, BAT], "C"), // BAT : archivage de la Lettre (LettreBatonnier.jsx:68, :88) — E6 reclassé
  l("GET", "/api/archives", M_DOC, "L"),
  l("DELETE", "/api/archives/:id", SUPPR, "S"),

  l("GET", "/api/parametres", INTERNES, "L"), // vue filtrée : sections sensibles retirées sans « parametres » (parametres.ts:71)
  l("PUT", "/api/parametres", [SG, BAT, ADM], "M"), // BAT : règles de décision (discipline_decider) ; sections techniques refusées (parametres.ts:182)
  l("POST", "/api/parametres/tester/:canal", SYS, "M"),
  l("POST", "/api/parametres/reinitialiser-donnees", ADMIN_SEUL, "S"),
  l("GET", "/api/corps-electoral", M_CE, "L"),
  l("GET", "/api/dashboard", INTERNES, "L"), // indicateurs filtrés par rôle (dashboard.ts:77)
  l("GET", "/api/dashboard/agenda", INTERNES, "L"),
  l("GET", "/api/dashboard/journal", M_AUDIT, "L"), // extrait du journal d'audit
  l("GET", "/api/audit", M_AUDIT, "L"),
  l("GET", "/api/tableau", M_MEMBRES, "L"),
  l("GET", "/api/tableau/pdf", M_MEMBRES, "L", { lourd: true }),
  l("POST", "/api/tableau/publier", ECR, "V"),

  l("GET", "/api/scrutins", M_ELEC, "L"),
  l("GET", "/api/scrutins/:id", M_ELEC, "L"),
  l("POST", "/api/scrutins", ECR, "C"),
  l("PATCH", "/api/scrutins/:id", ECR, "M"),
  l("DELETE", "/api/scrutins/:id", SUPPR, "S"),
  l("GET", "/api/scrutins/:id/pv/pdf", M_ELEC, "L"),
  l("POST", "/api/scrutins/:id/candidats", ECR, "C"),
  l("DELETE", "/api/scrutins/:id/candidats/:cid", SUPPR, "S"),
  l("POST", "/api/scrutins/:id/ouvrir", ECR, "V"),
  l("POST", "/api/scrutins/:id/voix", ECR, "M"),
  l("POST", "/api/scrutins/:id/clore", ECR, "V"),
  l("POST", "/api/scrutins/:id/publier", [SG, ADM, SA, BAT], "V"), // H7 : le Bâtonnier valide la publication des résultats
  l("GET", "/api/signatures/cle-publique", INTERNES, "L"),
  l("POST", "/api/signatures/verifier", INTERNES, "L"),
  l("GET", "/api/conseil", M_ELEC, "L"),
  l("POST", "/api/conseil", ECR, "C"),
  l("PATCH", "/api/conseil/:id", ECR, "M"),
  l("DELETE", "/api/conseil/:id", SUPPR, "S"),
  l("GET", "/api/cabinets", M_MEMBRES, "L"),
  l("POST", "/api/cabinets", ECR, "C"),
  l("PATCH", "/api/cabinets/:id", ECR, "M"),
  l("DELETE", "/api/cabinets/:id", SUPPR, "S"),
  l("POST", "/api/cabinets/:id/membres/:membreId", ECR, "M"),
  l("DELETE", "/api/cabinets/:id/membres/:membreId", SUPPR, "S"),
  l("POST", "/api/cabinets/purge", SUPPR, "S"),
  l("GET", "/api/calendrier-editorial", M_DOC, "L"),
  l("PATCH", "/api/calendrier-editorial/:mois", [SG, ADM, SA, BAT], "M"),

  // Espace avocat : AVOCAT (et stagiaire) seulement, cloisonné sur le membreId du jeton ; l'ADMIN n'y entre pas.
  ...([
    ["GET", "/moi", "L"], ["PATCH", "/moi", "M"], ["GET", "/parcours", "L"], ["GET", "/attestation/inscription/pdf", "L"], ["GET", "/attestation/non-redevance/pdf", "L"],
    ["GET", "/timbres", "L"], ["POST", "/timbres", "C"], ["POST", "/timbres/:id/usage", "M"], ["POST", "/timbres/:id/utilise", "M"],
    ["GET", "/notifications", "L"], ["POST", "/notifications/lu-tout", "M"], ["POST", "/notifications/:id/lu", "M"], ["GET", "/documents", "L"],
    ["POST", "/paiement", "C"], ["POST", "/paiement/:ref/confirmer-sandbox", "V"], ["GET", "/recus/:id/pdf", "L"], ["GET", "/quitus/:id/pdf", "L"],
    ["GET", "/annuaire", "L"], ["GET", "/assemblees", "L"], ["GET", "/assemblees/:id", "L"], ["GET", "/assemblees/:id/convocation/pdf", "L"],
    ["GET", "/assemblees/:id/pv/pdf", "L"], ["GET", "/discipline", "L"], ["GET", "/discipline/:id", "L"], ["GET", "/discipline/:id/decision/pdf", "L"],
    ["GET", "/pieces", "L"], ["POST", "/pieces", "C"], ["GET", "/pieces/:id/fichier", "L"], ["DELETE", "/pieces/:id", "S"],
    ["GET", "/archives", "L"], ["GET", "/publications", "L"], ["GET", "/publications/:id", "L"], ["GET", "/messagerie", "L"],
    ["GET", "/messagerie/non-lus", "L"], ["GET", "/messagerie/:id", "L"], ["GET", "/messagerie/messages/:id/piece", "L"],
    ["GET", "/messagerie/messages/:id/accuse/pdf", "L"], ["POST", "/messagerie", "C"], ["POST", "/attestations/demandes", "C"],
    ["POST", "/messagerie/:id", "C"], ["GET", "/scrutins", "L"], ["POST", "/scrutins/:id/voter", "V"],
  ] as [string, string, Action][]).map(([m, c, a]) => l(m, "/api/espace" + c, ESPACE, a)),

  l("GET", "/api/messagerie/non-lus", M_MSG, "L"),
  l("GET", "/api/messagerie", M_MSG, "L"), // aperçu du corps (140 car.) : contenu
  l("GET", "/api/messagerie/messages/:id/piece", M_MSG, "L"),
  l("GET", "/api/messagerie/messages/:id/accuse/pdf", M_MSG, "L"), // métadonnées et empreinte, sans le corps
  l("GET", "/api/messagerie/:id", M_MSG, "L"),
  l("POST", "/api/messagerie", M_MSG, "C"),
  l("POST", "/api/messagerie/:id", M_MSG, "C"),
  l("POST", "/api/messagerie/:id/attestation", M_MSG, "C"),
  l("GET", "/api/verifier/quitus/:numero", PUBLIC, "L"),
  l("GET", "/api/verifier/recu/:numero", PUBLIC, "L"),
  l("GET", "/api/verifier/timbre/:code", PUBLIC, "L"),
  l("GET", "/v/:t/:ref", PUBLIC, "L"),
];

// ── Écarts connus (numérotation du rapport). envoyer=false : écriture non envoyée → it.todo ──
// T9 : E1 à E5 et E7 (permissifs) corrigés côté serveur et retirés ; E6 reclassé (parcours légitime du Bâtonnier).
// Restent les écarts restrictifs, non élargis (D17) : front T10 et décision de Fabrice.
type Ecart = { id: string; sens: "permissif" | "restrictif"; roles: string[]; routes: string[]; statut: string; envoyer?: boolean; handler?: boolean };
const ECARTS: Ecart[] = [
  { id: "E8", sens: "restrictif", statut: "front T10 + à valider Fabrice", roles: [SA, CONS, ACC], routes: ["GET /api/membres/:id", "GET /api/membres/:id/rapports"] },
  {
    id: "E9", sens: "restrictif", statut: "à valider Fabrice", roles: [SA], routes: [
      "POST /api/membres/:id/pieces", "POST /api/membres", "POST /api/membres/import", "PATCH /api/membres/:id", "POST /api/membres/:id/deces",
      "POST /api/membres/:id/rapports", "POST /api/membres/:id/attestation", "GET /api/membres/:id/attestation/pdf", "POST /api/membres/:id/attestation/apercu", "GET /api/membres/:id/attestation-sortie/pdf",
      "POST /api/reunions/:id/convoquer", "POST /api/reunions", "PATCH /api/reunions/:id", "POST /api/assemblees/:id/convoquer", "POST /api/assemblees",
      "PATCH /api/assemblees/:id", "POST /api/publications/lettre/generer", "POST /api/publications", "PATCH /api/publications/:id", "POST /api/tableau/publier",
      "POST /api/scrutins", "PATCH /api/scrutins/:id", "POST /api/scrutins/:id/candidats", "POST /api/scrutins/:id/ouvrir", "POST /api/scrutins/:id/voix",
      "POST /api/scrutins/:id/clore", "POST /api/scrutins/:id/publier", "POST /api/conseil", "PATCH /api/conseil/:id", "POST /api/cabinets",
      "PATCH /api/cabinets/:id", "POST /api/cabinets/:id/membres/:membreId",
    ],
  },
  { id: "E10", sens: "restrictif", statut: "à valider Fabrice", roles: [SA], handler: true, routes: ["POST /api/membres/:id/evenements"] },
  { id: "E11", sens: "restrictif", statut: "à valider Fabrice", roles: [ACC], routes: ["POST /api/membres/:id/pieces"] },
  { id: "E12", sens: "restrictif", statut: "à valider Fabrice", roles: [TRES], routes: ["POST /api/quitus", "POST /api/quitus/lot"] },
  { id: "E13", sens: "restrictif", statut: "à valider Fabrice", roles: [BAT], routes: ["POST /api/scrutins/:id/publier"] },
];

// Écarts permissifs corrigés par T9 : chaque couple route × rôle reste prouvé en 403 (non-régression).
const CORRIGES: { id: string; roles: string[]; routes: string[] }[] = [
  { id: "E3", roles: [TRES, ACC], routes: ["GET /api/dashboard/journal"] },
  { id: "E4", roles: [SA], routes: ["PATCH /api/discipline/:id"] },
  { id: "E5", roles: [CONS, ACC], routes: ["POST /api/archives", "PATCH /api/calendrier-editorial/:mois"] },
  { id: "E7", roles: [BAT], routes: ["POST /api/parametres/tester/:canal"] },
];

// ── Lecture de la matrice réelle depuis la pile Express ───────────────────────────────
type Garde = { type: "auth" | "avocat" | "role" | "perm"; valeurs?: string[] };
type Fn = { garde?: Garde };
const cle = (x: { m: string; c: string }) => `${x.m} ${x.c}`;

function routesExpress(app: unknown): Map<string, Garde[]> {
  const gardeDe = (h: unknown): Garde | null =>
    h === requireAuth ? { type: "auth" } : h === requireAvocat ? { type: "avocat" } : (h as Fn).garde ?? null;
  const out = new Map<string, Garde[]>();
  const ajouter = (route: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] }, prefixe: string, herite: Garde[]) => {
    const g = [...herite, ...route.stack.map((s) => gardeDe(s.handle)).filter((x): x is Garde => !!x)];
    for (const m of Object.keys(route.methods)) out.set(`${m.toUpperCase()} ${prefixe}${route.path === "/" && prefixe ? "" : route.path}`, g);
  };
  for (const couche of (app as { _router: { stack: any[] } })._router.stack) {
    if (couche.route) ajouter(couche.route, "", []);
    else if (couche.name === "router") {
      const prefixe = String(couche.regexp.source).replace(/^\^/, "").replace(/\\\/\?\(\?=\\\/\|\$\)$/, "").replace(/\\\//g, "/");
      const herite: Garde[] = [];
      for (const s of couche.handle.stack) {
        if (s.route) ajouter(s.route, prefixe, herite);
        else if (s.regexp?.fast_slash) { const g = gardeDe(s.handle); if (g) herite.push(g); }
        else throw new Error(`Middleware de routeur monté sur un sous-chemin (${prefixe}) : non géré par l'audit`);
      }
    }
  }
  return out;
}

const app = creerApp({ anonyme: 100_000, authentifie: 100_000 });
const GARDES = routesExpress(app);

/** Verdict des gardes middleware (le gestionnaire n'est pas évalué) : "401", "403" ou "passe". */
function reel(x: Ligne, role: string | null): "401" | "403" | "passe" {
  const g = GARDES.get(cle(x)) ?? [];
  if (role === null) return g.length ? "401" : "passe";
  const r = roleReel(role);
  // confinementAvocat (app.ts:134) : un jeton AVOCAT ne sort pas de /api/espace et /api/auth.
  if (r === AV && x.c.startsWith("/api/") && !/^\/api\/(espace|auth)(\/|$)/.test(x.c)) return "403";
  for (const gi of g) {
    if (gi.type === "role" && !(r === ADM || gi.valeurs!.includes(r))) return "403";
    if (gi.type === "perm" && !aLaPermission(r, gi.valeurs![0])) return "403";
    if (gi.type === "avocat" && r !== AV) return "403";
  }
  return "passe";
}

/** Jamais de jeton d'un rôle qui passe les gardes sur ces routes (D15). */
const INTERDIT = (x: Ligne) => x.m === "DELETE" || /reinitialiser-donnees|tester\/:canal|paiement|webhook/.test(x.c);

// ── Comptes, jetons et matrice RolePermission ─────────────────────────────────────────
const SUFFIXE = String(Date.now());
const MARQUE = "E2E T8";
const emailDe = (r: string) => `e2e-t8-${r.toLowerCase()}-${SUFFIXE}@test.cg`;
const jetons: Record<string, string> = {};
let permissionsInitiales: string[] = [];
const lignesRp = async () => (await prisma.rolePermission.findMany()).map((p) => `${p.role}|${p.permission}`).sort();
const membres: Record<"A" | "S" | "B", number> = { A: 0, S: 0, B: 0 };
const fx = { timbre: 0, recu: 0, quitus: 0, piece: 0, dossierA: 0, dossierB: 0, convA: 0, convB: 0, msgB: 0, archA: 0, archB: 0, evtB: 0 };

async function envoyer(x: Ligne, jeton?: string): Promise<number> {
  const url = x.c.replace(/:[A-Za-z]+/g, "999999999");
  let r = (request(app) as any)[x.m.toLowerCase()](url);
  if (jeton) r = r.set("Authorization", `Bearer ${jeton}`);
  if (x.m !== "GET") r = r.send(x.corps ?? {});
  return (await r).status;
}
const appel = (m: string, url: string, jeton: string, corps?: object) => {
  const r = (request(app) as any)[m.toLowerCase()](url).set("Authorization", `Bearer ${jeton}`);
  return m === "GET" ? r : r.send(corps ?? {});
};
const login = async (email: string) => {
  const r = await request(app).post("/api/auth/login").send({ email, password: "barreau" });
  if (!r.body.token) throw new Error(`Connexion impossible pour ${email} (${r.status})`);
  return r.body.token as string;
};

beforeAll(async () => {
  permissionsInitiales = await lignesRp();
  // Matrice ramenée aux défauts de lib/rbac.ts (amorçage d'une base vide).
  await prisma.rolePermission.deleteMany();
  await amorcerMatriceSiVide();
  await rafraichirMatrice();

  const hash = bcrypt.hashSync("barreau", 4);
  for (const role of [SA, CONS, ACC] as const)
    await prisma.user.create({ data: { nom: `${MARQUE} ${role}`, email: emailDe(role), role, passwordHash: hash, actif: true } });
  const num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 1;
  const creerMembre = async (i: number, nom: string, qualite: "AVOCAT" | "STAGIAIRE") =>
    (await prisma.membre.create({ data: { num: num + i, nom: `${MARQUE} ${nom} ${SUFFIXE}`, qualite, statut: qualite === "AVOCAT" ? "INSCRIT" : "STAGIAIRE" } })).id;
  membres.A = await creerMembre(0, "AVOCAT", "AVOCAT");
  membres.S = await creerMembre(1, "STAGIAIRE", "STAGIAIRE");
  membres.B = await creerMembre(2, "VICTIME", "AVOCAT");
  await prisma.user.create({ data: { nom: `${MARQUE} AVOCAT`, email: emailDe(AV), role: "AVOCAT", passwordHash: hash, actif: true, membreId: membres.A } });
  await prisma.user.create({ data: { nom: `${MARQUE} STAGIAIRE`, email: emailDe(STAG), role: "AVOCAT", passwordHash: hash, actif: true, membreId: membres.S } });

  const seed: Record<string, string> = { [SG]: "sg", [BAT]: "batonnier", [TRES]: "tresoriere", [ADM]: "admin" };
  for (const r of ROLES) jetons[r] = await login(seed[r] ? `${seed[r]}@barreau-pn.cg` : emailDe(r));

  // Fixtures IDOR : objets du membre B (victime) ; A (avocat connecté) ne doit jamais y accéder.
  const B = membres.B, A = membres.A;
  const numTimbre = ((await prisma.timbre.aggregate({ _max: { numero: true } }))._max.numero ?? 0) + 1;
  fx.timbre = (await prisma.timbre.create({ data: { numero: numTimbre, code: `E2ET8${SUFFIXE}`, membreId: B, affaire: MARQUE, montant: 1 } })).id;
  fx.recu = (await prisma.recu.create({ data: { numero: `E2E-T8-R-${SUFFIXE}`, membreId: B, montant: 1, annee: 2099, date: new Date(), objet: MARQUE } })).id;
  fx.quitus = (await prisma.quitus.create({ data: { numero: `E2E-T8-Q-${SUFFIXE}`, membreId: B, annee: 2099, dateEmission: new Date() } })).id;
  fx.piece = (await prisma.pieceDossier.create({ data: { membreId: B, type: "AUTRE", nomFichier: "e2e-t8.pdf", fichier: "e2e/t8-inexistant.pdf", mimeType: "application/pdf", taille: 1 } })).id;
  const dossier = (membreId: number, x: string) => prisma.dossierDisciplinaire.create({ data: { reference: `E2E-T8-D-${x}-${SUFFIXE}`, avocatNom: MARQUE, objet: MARQUE, dateSaisine: new Date(), membreId } });
  fx.dossierA = (await dossier(A, "A")).id;
  fx.dossierB = (await dossier(B, "B")).id;
  const conv = async (membreId: number) =>
    prisma.conversation.create({
      data: { sujet: MARQUE, avecAdministration: true, participants: { create: { membreId } }, messages: { create: { auteurNom: MARQUE, corps: "E2E T8 confidentiel", auteurMembreId: membreId } } },
      include: { messages: true },
    });
  fx.convA = (await conv(A)).id;
  const cb = await conv(B);
  fx.convB = cb.id;
  fx.msgB = cb.messages[0].id;
  const nomDe = async (id: number) => (await prisma.membre.findUniqueOrThrow({ where: { id } })).nom;
  fx.archA = (await prisma.archive.create({ data: { categorie: "Attestation", titre: `${MARQUE} A`, membreNom: await nomDe(A) } })).id;
  fx.archB = (await prisma.archive.create({ data: { categorie: "Attestation", titre: `${MARQUE} B`, membreNom: await nomDe(B) } })).id;
  // Événement de situation de B (supprimé en cascade avec le membre).
  fx.evtB = (await prisma.evenementSituation.create({ data: { membreId: B, type: "RAPPEL", dateEffet: new Date(), annee: 2099, motif: MARQUE } })).id;
}, 120_000);

afterAll(async () => {
  const ids = Object.values(membres).filter(Boolean);
  await prisma.conversation.deleteMany({ where: { id: { in: [fx.convA, fx.convB] } } });
  await prisma.archive.deleteMany({ where: { id: { in: [fx.archA, fx.archB] } } });
  await prisma.dossierDisciplinaire.deleteMany({ where: { id: { in: [fx.dossierA, fx.dossierB] } } });
  await prisma.timbre.deleteMany({ where: { membreId: { in: ids } } });
  await prisma.recu.deleteMany({ where: { membreId: { in: ids } } });
  await prisma.quitus.deleteMany({ where: { membreId: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "e2e-t8-", endsWith: `-${SUFFIXE}@test.cg` } } });
  await prisma.membre.deleteMany({ where: { id: { in: ids } } });
  await prisma.rolePermission.deleteMany();
  if (permissionsInitiales.length)
    await prisma.rolePermission.createMany({ data: permissionsInitiales.map((x) => { const [role, permission] = x.split("|"); return { role: role as never, permission }; }) });
  await rafraichirMatrice();
  // Contrôles de remise en état : aucun compte E2E restant, matrice identique à l'état initial.
  expect(await prisma.user.count({ where: { email: { startsWith: "e2e-t8-" } } })).toBe(0);
  expect(await prisma.membre.count({ where: { id: { in: ids } } })).toBe(0);
  expect(await lignesRp()).toEqual(permissionsInitiales);
}, 120_000);

// ── Tests ─────────────────────────────────────────────────────────────────────────────
describe("RBAC T8 — couverture et cohérence de la matrice", () => {
  it("chaque route Express a une ligne dans la matrice, et chaque ligne une route", () => {
    const declarees = MATRICE.map(cle);
    expect(new Set(declarees).size, "lignes en double").toBe(declarees.length);
    const reelles = [...GARDES.keys()];
    expect(reelles.filter((k) => !declarees.includes(k)), "routes sans ligne dans la matrice").toEqual([]);
    expect(declarees.filter((k) => !reelles.includes(k)), "lignes sans route").toEqual([]);
  });

  it("les écarts des gardes middleware sont exactement ceux répertoriés dans ECARTS", () => {
    const calcules: string[] = [];
    for (const x of MATRICE) {
      if (x.ok === PUBLIC || x.handler) continue;
      for (const r of ROLES) if ((reel(x, r) === "passe") !== x.ok.includes(r)) calcules.push(`${cle(x)} ${r}`);
    }
    const declares = ECARTS.filter((e) => !e.handler).flatMap((e) => e.routes.flatMap((rt) => e.roles.map((r) => `${rt} ${r}`)));
    expect(calcules.sort()).toEqual([...new Set(declares)].sort());
  });

  it("chaque route d'écriture non publique exige l'authentification (aucune écriture anonyme hors /auth, /installation, webhook)", () => {
    expect(MATRICE.filter((x) => x.ok !== PUBLIC && reel(x, null) !== "401").map(cle)).toEqual([]);
  });

  it.runIf(!!process.env.MATRICE_JSON)("export de la matrice réelle pour le rapport (MATRICE_JSON)", () => {
    const lignes = MATRICE.map((x) => ({
      ...x, gardes: GARDES.get(cle(x)), reel: Object.fromEntries(ROLES.map((r) => [r, reel(x, r)])), anonyme: reel(x, null),
    }));
    writeFileSync(process.env.MATRICE_JSON!, JSON.stringify({ lignes, ecarts: ECARTS }, null, 1));
  });
});

const ecartsDe = (x: Ligne) => new Map(ECARTS.flatMap((e) => (e.routes.includes(cle(x)) ? e.roles.map((r) => [r, e] as const) : [])));

describe("RBAC T8 — 401 / 403 / accès autorisé par route et par rôle", () => {
  for (const x of MATRICE) {
    const ecarts = ecartsDe(x);
    it(cle(x), async () => {
      if (x.ok === PUBLIC) {
        if (x.m === "GET") expect([401, 403], "anonyme").not.toContain(await envoyer(x));
        return; // écritures publiques (connexion, webhook…) : non envoyées
      }
      expect(await envoyer(x), "sans jeton").toBe(401);
      for (const r of ROLES) {
        if (ecarts.has(r)) continue;
        if (x.ok.includes(r)) {
          if (x.m === "GET" && (!x.lourd || r === SG)) expect([401, 403], r).not.toContain(await envoyer(x, jetons[r]));
        } else {
          if (reel(x, r) === "passe" && !x.handler) throw new Error(`${r} passe les gardes de ${cle(x)} : écart non répertorié (requête non envoyée)`);
          expect(await envoyer(x, jetons[r]), r).toBe(403);
        }
      }
    }, 120_000);
    for (const [r, e] of ecarts) {
      const admisAttendu = x.ok.includes(r);
      const nom = `${e.id} (${e.sens}, ${e.statut}) — ${r} ${admisAttendu ? "devrait être admis" : "devrait recevoir 403"} sur ${cle(x)}`;
      const sur = x.m === "GET" || (!INTERDIT(x) && (admisAttendu ? reel(x, r) === "403" || !!x.handler : !!e.envoyer));
      if (!sur) { it.todo(nom + " (écriture non envoyée)"); continue; }
      it.fails(nom, async () => {
        const s = await envoyer(x, jetons[r]);
        if (admisAttendu) expect([401, 403]).not.toContain(s);
        else expect(s).toBe(403);
      }, 120_000);
    }
  }
});

describe("RBAC T9 — écarts permissifs corrigés (403 avant le gestionnaire)", () => {
  for (const e of CORRIGES)
    for (const rt of e.routes)
      for (const r of e.roles)
        it(`${e.id} corrigé — ${r} reçoit 403 sur ${rt}`, async () => {
          const x = MATRICE.find((y) => cle(y) === rt)!;
          // Garde statique d'abord : la requête n'est envoyée que si le refus précède le gestionnaire.
          expect(reel(x, r)).toBe("403");
          expect(await envoyer(x, jetons[r])).toBe(403);
        }, 120_000);
});

describe("RBAC T8 — cloisonnement de l'espace avocat (IDOR, objets d'un autre membre)", () => {
  const A = () => jetons[AV];
  it("reçu et quitus d'un autre membre : 404", async () => {
    expect((await appel("GET", `/api/espace/recus/${fx.recu}/pdf`, A())).status).toBe(404);
    expect((await appel("GET", `/api/espace/quitus/${fx.quitus}/pdf`, A())).status).toBe(404);
  });
  it("timbre d'un autre membre : 403 (usage et déclaration d'utilisation), statut inchangé", async () => {
    expect((await appel("POST", `/api/espace/timbres/${fx.timbre}/usage`, A(), { mode: "copie" })).status).toBe(403);
    expect((await appel("POST", `/api/espace/timbres/${fx.timbre}/utilise`, A())).status).toBe(403);
    expect((await prisma.timbre.findUniqueOrThrow({ where: { id: fx.timbre } })).statut).toBe("VALIDE");
  });
  it("pièce d'un autre membre : 404 en lecture", async () => {
    expect((await appel("GET", `/api/espace/pieces/${fx.piece}/fichier`, A())).status).toBe(404);
    // DELETE non envoyé (D15 : l'AVOCAT passe les gardes de la route). Preuve par le code :
    // espace.ts:549 `piece.membreId !== monMembreId(req)` → 404 avant toute suppression.
  });
  it("dossier disciplinaire : le sien 200, celui d'un autre 404 (détail et décision)", async () => {
    expect((await appel("GET", `/api/espace/discipline/${fx.dossierA}`, A())).status).toBe(200);
    expect((await appel("GET", `/api/espace/discipline/${fx.dossierB}`, A())).status).toBe(404);
    expect((await appel("GET", `/api/espace/discipline/${fx.dossierB}/decision/pdf`, A())).status).toBe(404);
  });
  it("messagerie : son fil 200 ; fil, réponse, pièce et accusé d'un autre membre refusés, aucun message ajouté", async () => {
    expect((await appel("GET", `/api/espace/messagerie/${fx.convA}`, A())).status).toBe(200);
    const fil = await appel("GET", `/api/espace/messagerie/${fx.convB}`, A());
    expect(fil.status).toBe(404);
    expect(JSON.stringify(fil.body)).not.toContain("confidentiel");
    expect((await appel("POST", `/api/espace/messagerie/${fx.convB}`, A(), { corps: "intrusion" })).status).toBe(404);
    expect([403, 404]).toContain((await appel("GET", `/api/espace/messagerie/messages/${fx.msgB}/piece`, A())).status);
    expect([403, 404]).toContain((await appel("GET", `/api/espace/messagerie/messages/${fx.msgB}/accuse/pdf`, A())).status);
    expect(await prisma.message.count({ where: { conversationId: fx.convB } })).toBe(1);
  });
  it("documents (archives) : ceux de l'avocat visibles, ceux d'un autre membre absents", async () => {
    const r = await appel("GET", "/api/espace/archives", A());
    expect(r.status).toBe(200);
    const ids = (r.body.archives as { id: number }[]).map((a) => a.id);
    expect(ids).toContain(fx.archA);
    expect(ids).not.toContain(fx.archB);
  });
  it("parcours : historique filtré sur le jeton, l'événement d'un autre membre absent", async () => {
    const r = await appel("GET", "/api/espace/parcours", A());
    expect(r.status).toBe(200);
    expect((r.body.evenements as { id: number }[]).map((e) => e.id)).not.toContain(fx.evtB);
  });
  it("scrutin : le vote est lié au jeton (un membreId fourni est ignoré), scrutin inconnu 404", async () => {
    expect((await appel("POST", "/api/espace/scrutins/999999999/voter", A(), { candidatIds: [1], membreId: membres.B })).status).toBe(404);
    expect(await prisma.emargement.count({ where: { membreId: membres.B } })).toBe(0);
  });
  // E1 sur un fil réel (pas un id inexistant) : chemin d'attaque concret, l'ADMIN a droit à tout (décision du 16/10/2026), lecture tracée.
  it("E1 — l'ADMIN lit le corps d'un fil avocat ↔ administration (200)", async () => {
    const r = await appel("GET", `/api/messagerie/${fx.convA}`, jetons[ADM]);
    expect(r.status).toBe(200);
  });
  it("stagiaire : même cloisonnement que l'avocat (espace oui, back-office 403)", async () => {
    expect((await appel("GET", "/api/espace/moi", jetons[STAG])).status).toBe(200);
    expect((await appel("GET", `/api/espace/discipline/${fx.dossierA}`, jetons[STAG])).status).toBe(404);
    expect((await appel("GET", "/api/membres", jetons[STAG])).status).toBe(403);
  });
});
