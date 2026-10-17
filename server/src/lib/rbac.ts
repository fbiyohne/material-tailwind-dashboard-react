import type { Role } from "@prisma/client";
import { prisma } from "../prisma.js";

/**
 * Matrice de contrôle d'accès (rôle × module), éditable en base et mise en cache.
 * - Le catalogue de permissions (modules) est défini en code (stable).
 * - L'attribution des permissions aux rôles est éditable (table RolePermission).
 * - Les DÉFAUTS reproduisent exactement l'accès historique (aucune régression) et
 *   servent au premier amorçage et de repli pour un rôle sans ligne en base.
 * - L'ADMIN dispose implicitement de toutes les permissions.
 */

export interface ModulePermission { cle: string; libelle: string; description: string }

export const PERMISSIONS: ModulePermission[] = [
  { cle: "membres", libelle: "Membres", description: "Avocats, stagiaires, cabinets, tableau de l'Ordre, pièces." },
  { cle: "corps_electoral", libelle: "Corps électoral", description: "Liste électorale et exclusions." },
  { cle: "finances", libelle: "Finances", description: "Cotisations, droits, reçus, quitus, timbres, paiements." },
  { cle: "reunions_assemblees", libelle: "Réunions & Assemblées", description: "Conseil de l'Ordre et assemblées générales." },
  { cle: "discipline", libelle: "Discipline", description: "Dossiers disciplinaires (accès confidentiel, RG-13)." },
  { cle: "elections", libelle: "Élections", description: "Scrutins et composition du Conseil." },
  { cle: "messagerie", libelle: "Messagerie", description: "Messagerie interne avec les avocats." },
  { cle: "documents", libelle: "Documents", description: "Archives, publications, lettre du Bâtonnier." },
  { cle: "parametres", libelle: "Paramètres", description: "Configuration de l'application et journaux techniques." },
  { cle: "utilisateurs", libelle: "Utilisateurs", description: "Comptes, rôles et demandes d'accès." },
  { cle: "audit", libelle: "Journal d'audit", description: "Traçabilité des actions sensibles (RG-16)." },
];
export const PERMISSION_CLES = PERMISSIONS.map((p) => p.cle);

/**
 * Actions d'enregistrement (R-42, provisoire) : distinctes des modules, elles
 * séparent le bâtonnier du secrétaire général. Le logiciel ENREGISTRE les
 * décisions des organes compétents, il ne les prononce pas.
 */
export const ACTIONS: ModulePermission[] = [
  { cle: "discipline_decider", libelle: "Enregistrer une décision disciplinaire", description: "Sanction du conseil de discipline, radiation comprise (bâtonnier par défaut)." },
  { cle: "discipline_saisir", libelle: "Enregistrer une saisine disciplinaire", description: "Ouverture et instruction d'un dossier (SG et bâtonnier par défaut)." },
  { cle: "stage_valider", libelle: "Valider un stage", description: "Enregistrement du certificat de fin de stage et passage au tableau (bâtonnier par défaut)." },
  { cle: "omission_prononcer", libelle: "Enregistrer une omission", description: "Omission et réinscription décidées par le Conseil national (bâtonnier par défaut)." },
  { cle: "admission_directe", libelle: "Admission directe", description: "Inscription directe au tableau sans stage (SG et bâtonnier par défaut)." },
];
export const ACTION_CLES = ACTIONS.map((a) => a.cle);

/**
 * Rôles pilotables par la matrice. SG et ADMIN gardent un accès complet non
 * modifiable (invariant de sûreté : on ne peut pas se verrouiller soi-même) ;
 * l'AVOCAT relève de l'espace cloisonné, hors matrice.
 */
export const ROLES_MATRICE: Role[] = ["BATONNIER", "TRESORIERE", "SECRETAIRE_ADJOINT", "CONSULTATION", "ACCUEIL"];
export const ROLES_COMPLET: Role[] = ["SECRETAIRE_GENERAL", "ADMIN"];

export const ROLE_LABELS: Record<string, string> = {
  SECRETAIRE_GENERAL: "Secrétaire Général",
  BATONNIER: "Bâtonnier",
  TRESORIERE: "Trésorière",
  ADMIN: "Administrateur",
  AVOCAT: "Avocat",
  SECRETAIRE_ADJOINT: "Secrétaire adjoint",
  CONSULTATION: "Consultation (lecture)",
  ACCUEIL: "Agent d'accueil",
};

const TOUT = [...PERMISSION_CLES];
// Défauts fidèles à l'enforcement historique (cf. gardes de routeur).
const DEFAUTS: Record<string, string[]> = {
  SECRETAIRE_GENERAL: TOUT,
  ADMIN: TOUT,
  BATONNIER: ["membres", "corps_electoral", "reunions_assemblees", "discipline", "elections", "messagerie", "documents", "audit"],
  TRESORIERE: ["finances", "messagerie"],
  SECRETAIRE_ADJOINT: ["membres", "corps_electoral", "reunions_assemblees", "discipline", "elections", "messagerie", "documents", "audit"],
  CONSULTATION: ["membres", "corps_electoral", "documents", "audit"],
  ACCUEIL: ["membres", "documents"],
  AVOCAT: [],
};
// Défauts des actions (R-42 ajusté, HJ-G) : décider, valider le stage et enregistrer
// l'omission reviennent au bâtonnier ; saisir et admettre directement au SG aussi.
const ACTIONS_DEFAUT: Record<string, string[]> = {
  ADMIN: [...ACTION_CLES],
  BATONNIER: [...ACTION_CLES],
  SECRETAIRE_GENERAL: ["discipline_saisir", "admission_directe"],
};

// Cache mémoire : rôle → ensemble de permissions. Remplacé d'un bloc (lecture sûre).
let cache: Record<string, Set<string>> = {};

/** Amorce la matrice en base si elle est vide (premier démarrage / migration). */
export async function amorcerMatriceSiVide(): Promise<void> {
  try {
    const n = await prisma.rolePermission.count();
    if (n > 0) return;
    const lignes = ROLES_MATRICE.flatMap((role) => (DEFAUTS[role] ?? []).map((permission) => ({ role, permission })));
    if (lignes.length) await prisma.rolePermission.createMany({ data: lignes, skipDuplicates: true });
  } catch {
    /* base indisponible : on garde les défauts en repli */
  }
}

/** Recharge le cache depuis la base (au démarrage et après chaque édition). */
export async function rafraichirMatrice(): Promise<void> {
  try {
    const rows = await prisma.rolePermission.findMany();
    const map: Record<string, Set<string>> = {};
    for (const r of rows) (map[r.role] ??= new Set()).add(r.permission);
    cache = map;
  } catch {
    /* conserve le cache courant */
  }
}

/**
 * Clés effectives d'une catégorie (modules ou actions) : lignes en base si le
 * rôle en a dans cette catégorie, sinon les défauts. Le repli est PAR CATÉGORIE :
 * une base qui ne contient que des lignes de modules ne retire aucune action.
 * Exception : la ligne sentinelle SENTINELLE_ACTIONS (posée par PUT /rbac quand
 * l'ADMIN retire toutes les actions) marque la catégorie comme renseignée et vide.
 */
export const SENTINELLE_ACTIONS = "actions:aucune";
function effectives(role: string, catalogue: string[], defauts: Record<string, string[]>): string[] {
  const set = cache[role];
  const enBase = set ? catalogue.filter((c) => set.has(c)) : [];
  return enBase.length || (catalogue === ACTION_CLES && set?.has(SENTINELLE_ACTIONS)) ? enBase : defauts[role] ?? [];
}

/** Permissions effectives d'un rôle (modules + actions). ADMIN = tout ; le SG a tous les modules et ses actions R-42 fixes. */
export function permissionsDeRole(role: string): string[] {
  if (role === "ADMIN") return [...TOUT, ...ACTION_CLES];
  if (role === "SECRETAIRE_GENERAL") return [...TOUT, ...ACTIONS_DEFAUT.SECRETAIRE_GENERAL];
  return [...effectives(role, PERMISSION_CLES, DEFAUTS), ...effectives(role, ACTION_CLES, ACTIONS_DEFAUT)];
}

/** Vrai si le rôle possède la permission (module ou action). L'ADMIN a toujours tout. */
export function aLaPermission(role: string, permission: string): boolean {
  return permissionsDeRole(role).includes(permission);
}
