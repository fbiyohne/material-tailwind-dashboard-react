import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Cachets officiels de rôle (Bâtonnier / Trésorière / Secrétaire Général) apposés
 * au bloc signature des documents générés. Images figées (assets partagés avec le
 * front), chargées une fois en data URI. Repli gracieux : si un fichier manque,
 * la chaîne vide est renvoyée et le document est simplement rendu sans cachet.
 *
 * Note : l'emblème/logo d'en-tête reste géré séparément (Paramètres → identité).
 */
// Copie serveur-locale (toujours présente au runtime, indépendante du front),
// avec repli sur les assets partagés du front en développement.
const DOSSIERS = [
  path.resolve(process.cwd(), "assets/cachets"),
  path.resolve(process.cwd(), "../src/barreau/assets/cachets"),
];

function charger(fichier: string): string {
  for (const d of DOSSIERS) {
    try {
      return `data:image/png;base64,${readFileSync(path.join(d, fichier)).toString("base64")}`;
    } catch {
      /* essaie le dossier suivant */
    }
  }
  return "";
}

const CACHETS: Record<"batonnier" | "tresoriere" | "sg", string> = {
  batonnier: charger("batonnier.png"),
  tresoriere: charger("tresoriere.png"),
  sg: charger("sg.png"),
};

/** Cachet approprié au signataire, déduit de son rôle (repli : Bâtonnier). */
export function cachetPourRole(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("trésor") || r.includes("tresor")) return CACHETS.tresoriere;
  if (r.includes("secrétaire") || r.includes("secretaire")) return CACHETS.sg;
  return CACHETS.batonnier;
}

export const cachetBatonnier = CACHETS.batonnier;
export const cachetTresoriere = CACHETS.tresoriere;
export const cachetSg = CACHETS.sg;
