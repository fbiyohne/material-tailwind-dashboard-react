import { TARIFS } from "./membres";

/**
 * Règles dérivées des cotisations (BR-07, BR-08, RG-07/08).
 * Fonctions pures : montant dû, montant payé, solde et statut d'un membre
 * pour un exercice donné.
 */

export function montantDu(membre) {
  return TARIFS[membre.qualite] ?? TARIFS.avocat;
}

export function montantPaye(membre, exercice) {
  return membre.paiements?.[exercice]?.paye ?? 0;
}

/** Clé de statut : "ajour" | "partiel" | "retard" | "exonere". */
export function statutCotisation(membre, exercice) {
  const du = montantDu(membre);
  if (du === 0) return "exonere"; // honoraire
  const paye = montantPaye(membre, exercice);
  if (paye <= 0) return "retard";
  if (paye >= du) return "ajour";
  return "partiel";
}

/** Libellé + ton de badge par statut de cotisation (accessibilité : jamais la couleur seule). */
export const STATUT_META = {
  ajour: { label: "À jour", ton: "vert" },
  partiel: { label: "Partiel", ton: "or" },
  retard: { label: "En retard", ton: "rouge" },
  exonere: { label: "Exonéré", ton: "gris" },
};

/** Ligne consolidée pour le tableau des cotisations d'un exercice. */
export function ligneCotisation(membre, exercice) {
  const du = montantDu(membre);
  const paye = montantPaye(membre, exercice);
  const paiement = membre.paiements?.[exercice] ?? null;
  return {
    membre,
    montantDu: du,
    montantPaye: paye,
    solde: Math.max(0, du - paye),
    statut: statutCotisation(membre, exercice),
    datePaiement: paiement?.date ?? null,
  };
}

/** Qualité affichable (colonne « Qualité » du tableau). */
export const QUALITE_LABEL = {
  avocat: "Avocat",
  stagiaire: "Stagiaire",
  honoraire: "Honoraire",
};
