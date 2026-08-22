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

/** Permissions effectives d'un rôle (ADMIN = tout ; repli sur les défauts). */
export function permissionsDeRole(role: string): string[] {
  if (role === "ADMIN" || role === "SECRETAIRE_GENERAL") return [...TOUT];
  const set = cache[role];
  if (set && set.size) return [...set];
  return DEFAUTS[role] ?? [];
}

/** Vrai si le rôle possède la permission (ADMIN toujours). */
export function aLaPermission(role: string, permission: string): boolean {
  if (role === "ADMIN" || role === "SECRETAIRE_GENERAL") return true;
  const set = cache[role];
  if (set && set.size) return set.has(permission);
  return (DEFAUTS[role] ?? []).includes(permission);
}
