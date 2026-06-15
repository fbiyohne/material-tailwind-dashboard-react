/**
 * Règles dérivées des membres (badges, qualité, stage).
 * NB : les montants/statuts de cotisation sont désormais calculés et servis par
 * l'API (source de vérité serveur) ; les pages lisent directement `cotisations[]`.
 */

/** Libellé + ton de badge par statut de cotisation (accessibilité : jamais la couleur seule). */
export const STATUT_META = {
  ajour: { label: "À jour", ton: "vert" },
  partiel: { label: "Partiel", ton: "or" },
  retard: { label: "En retard", ton: "rouge" },
  exonere: { label: "Exonéré", ton: "gris" },
};

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

