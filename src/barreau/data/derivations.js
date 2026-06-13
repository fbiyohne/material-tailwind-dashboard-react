import { config } from "./config";

/**
 * Règles dérivées des cotisations (BR-07, BR-08, RG-07/08).
 * Fonctions pures : montant dû, montant payé, solde et statut d'un membre
 * pour un exercice donné. Les tarifs proviennent de la configuration (Paramètres).
 */

export function montantDu(membre) {
  return config.tarifs[membre.qualite] ?? config.tarifs.avocat;
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

/** Statut administratif du membre — libellé + ton de badge. */
export const STATUT_MEMBRE_META = {
  inscrit: { label: "Inscrit", ton: "vert" },
  suspendu: { label: "Suspendu", ton: "rouge" },
  radie: { label: "Radié", ton: "rouge" },
  omis: { label: "Omis", ton: "gris" },
  honoraire: { label: "Honoraire", ton: "or" },
  stagiaire: { label: "Stagiaire", ton: "bleu" },
};

// ─── Stage des avocats stagiaires (FR-ST-02/03) ─────────────────────────────
export const STAGE_DUREE_MOIS = 24;

/** Progression et statut du stage à partir de la date de prestation de serment. */
export function infoStage(membre, aujourdhui = new Date()) {
  const s = membre.stage;
  if (!s?.dateServment) return null;
  const debut = new Date(s.dateServment);
  const duree = s.dureeMois ?? STAGE_DUREE_MOIS;
  const fin = new Date(debut);
  fin.setMonth(fin.getMonth() + duree);
  const ecoulesMois =
    (aujourdhui.getFullYear() - debut.getFullYear()) * 12 +
    (aujourdhui.getMonth() - debut.getMonth());
  const progression = Math.min(100, Math.max(0, Math.round((ecoulesMois / duree) * 100)));
  return {
    debut,
    fin,
    dureeMois: duree,
    progression,
    termine: aujourdhui >= fin,
    maitreStage: s.maitreStage ?? "—",
  };
}

// ─── Corps électoral (RG-04, RG-05, RG-06) ──────────────────────────────────
/**
 * Éligibilité au corps électoral pour un exercice donné. Renvoie le motif
 * d'exclusion le cas échéant : "honoraire" | "stagiaire" | "statut" | "cotisation".
 */
export function eligibiliteElectorale(membre, exercice) {
  if (membre.qualite === "honoraire") return { eligible: false, raison: "honoraire" };
  if (membre.qualite === "stagiaire") return { eligible: false, raison: "stagiaire" };
  if (["suspendu", "radie", "omis"].includes(membre.statut))
    return { eligible: false, raison: "statut" }; // RG-04
  if (statutCotisation(membre, exercice) !== "ajour")
    return { eligible: false, raison: "cotisation" }; // RG-05
  return { eligible: true, raison: null };
}

