/**
 * Droits de plaidoirie (FR-DROITS / module 2.8 du CDC).
 * Contribution annuelle distincte de la cotisation ordinale. Modèle simplifié
 * (montant annuel fixe) avec encaissements simulés — remplacé par l'API en V2.
 */
export const DROIT_ANNUEL = 60_000;

export function droitDu(membre) {
  return membre.qualite === "avocat" ? DROIT_ANNUEL : 0; // stagiaires/honoraires non concernés
}

/** Encaissement simulé déterministe (0 / partiel / complet) selon le membre. */
export function droitPaye(membre, annee) {
  if (droitDu(membre) === 0) return 0;
  return [0, 30_000, 60_000][(membre.id + annee) % 3];
}

export function ligneDroit(membre, annee) {
  const du = droitDu(membre);
  const paye = Math.min(du, droitPaye(membre, annee));
  const statut =
    du === 0 ? "exonere" : paye >= du ? "ajour" : paye > 0 ? "partiel" : "retard";
  return { membre, du, paye, solde: Math.max(0, du - paye), statut };
}
