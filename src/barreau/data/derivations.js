/**
 * Règles dérivées des membres (badges, qualité, stage).
 * NB : les montants/statuts de cotisation sont calculés et servis par l'API ;
 * les pages lisent directement `cotisations[]`. Les libellés de statuts sont
 * surchargeables depuis le module Paramètres (données de référence centralisées).
 */
import { config, onConfigChange, dureeStageMois } from "./config";

// Libellés + tons par défaut. Le « ton » (sémantique d'accessibilité) reste
// fixe ; seul le libellé peut être renommé via Paramètres.
const STATUT_META_DEFAUT = {
  ajour: { label: "À jour", ton: "vert" },
  partiel: { label: "Partiel", ton: "or" },
  retard: { label: "En retard", ton: "rouge" },
  exonere: { label: "Exonéré", ton: "gris" },
};
const STATUT_MEMBRE_META_DEFAUT = {
  inscrit: { label: "Inscrit", ton: "vert" },
  suspendu: { label: "Suspendu", ton: "rouge" },
  radie: { label: "Radié", ton: "rouge" },
  omis: { label: "Omis", ton: "gris" },
  honoraire: { label: "Honoraire", ton: "or" },
  stagiaire: { label: "Stagiaire", ton: "bleu" },
};

/** Libellé + ton de badge par statut de cotisation (jamais la couleur seule). */
export const STATUT_META = structuredClone(STATUT_META_DEFAUT);
/** Statut administratif du membre — libellé + ton de badge. */
export const STATUT_MEMBRE_META = structuredClone(STATUT_MEMBRE_META_DEFAUT);

// Applique les surcharges de libellés (Paramètres) en mutant les objets en place
// pour préserver les références importées par les composants.
const appliquerLibelles = (cible, defaut, domaine) => {
  const surcharges = config.libellesStatuts?.[domaine] ?? {};
  for (const cle of Object.keys(cible)) {
    cible[cle].label = surcharges[cle] || defaut[cle].label;
  }
};
onConfigChange(() => {
  appliquerLibelles(STATUT_META, STATUT_META_DEFAUT, "cotisation");
  appliquerLibelles(STATUT_MEMBRE_META, STATUT_MEMBRE_META_DEFAUT, "membre");
});

/** Clés et libellés par défaut, exposés pour l'éditeur de Paramètres. */
export const STATUT_META_CLES = STATUT_META_DEFAUT;
export const STATUT_MEMBRE_META_CLES = STATUT_MEMBRE_META_DEFAUT;

/** Qualité affichable (colonne « Qualité » du tableau). */
export const QUALITE_LABEL = {
  avocat: "Avocat",
  stagiaire: "Stagiaire",
  honoraire: "Honoraire",
};

// ─── Stage des avocats stagiaires (FR-ST-02/03) ─────────────────────────────
/** Durée de stage par défaut (mois) — configurable en Paramètres. */
export const STAGE_DUREE_MOIS = 24;

/** Progression et statut du stage à partir de la date de prestation de serment. */
export function infoStage(membre, aujourdhui = new Date()) {
  const s = membre.stage;
  if (!s?.dateServment) return null;
  const debut = new Date(s.dateServment);
  const duree = s.dureeMois ?? dureeStageMois();
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
