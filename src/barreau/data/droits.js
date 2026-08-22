import { config } from "./config";

/**
 * Droits de plaidoirie (FR-DROITS / module 2.8 du CDC).
 * Contribution annuelle distincte de la cotisation ordinale. Le montant de
 * référence provient de la configuration (Paramètres). Encaissements simulés.
 */
export function droitDu(membre) {
  return membre.qualite === "avocat" ? config.tarifs.droitsPlaidoirie : 0;
}

/** Encaissement simulé déterministe (0 / partiel / complet) selon le membre. */
export function droitPaye(membre, annee) {
  const du = droitDu(membre);
  if (du === 0) return 0;
  return [0, Math.round(du / 2), du][(membre.id + annee) % 3];
}

export function ligneDroit(membre, annee) {
  const du = droitDu(membre);
  const paye = Math.min(du, droitPaye(membre, annee));
  const statut =
    du === 0 ? "exonere" : paye >= du ? "ajour" : paye > 0 ? "partiel" : "retard";
  return { membre, du, paye, solde: Math.max(0, du - paye), statut };
}
