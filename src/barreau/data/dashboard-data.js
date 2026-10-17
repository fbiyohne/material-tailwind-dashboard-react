/**
 * Référentiel des exercices (années) du tableau de bord et des filtres associés.
 *
 * La plage d'exercices et l'exercice courant proviennent désormais des
 * Paramètres (centralisés, éditables) : `EXERCICES` est recalculé à chaque
 * mise à jour de configuration, et `EXERCICE_COURANT` suit l'exercice courant.
 * Les composants lisant ces exports au rendu reflètent la configuration en
 * vigueur (chargée au démarrage avant l'affichage de l'application).
 */
import { config, onConfigChange, exercices } from "./config";

/** Liste des exercices (mutée en place pour préserver la référence importée). */
export const EXERCICES = [];

/** Exercice par défaut (le plus récent) — suit `config.exerciceCourant`. */
export let EXERCICE_COURANT = config.exerciceCourant;

onConfigChange(() => {
  const liste = exercices();
  EXERCICES.splice(0, EXERCICES.length, ...liste);
  EXERCICE_COURANT = config.exerciceCourant ?? liste[0];
});
