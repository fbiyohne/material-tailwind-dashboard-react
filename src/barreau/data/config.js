/**
 * Configuration applicative centralisée (données de référence éditables dans le
 * module Paramètres) : tarifs, exercice courant, identité, et désormais
 * catégories de documents, types de publication, canaux de paiement, plage des
 * exercices, durée de stage et libellés de statuts.
 *
 * Les dérivations lisent cet objet « vivant ». Au démarrage, l'application
 * charge les paramètres du serveur (GET /parametres) et appelle
 * `appliquerConfig` ; les modules abonnés via `onConfigChange` se recalculent.
 */
export const PARAMETRES_DEFAUT = {
  tarifs: {
    avocat: 150_000, // cotisation ordinale avocat (BR-07)
    stagiaire: 75_000, // cotisation ordinale stagiaire (BR-07)
    honoraire: 0, // exonéré (BR-08)
    droitsPlaidoirie: 60_000, // droit de plaidoirie annuel
  },
  exerciceCourant: 2026,
  exercices: { premier: 2020 }, // borne basse de la plage d'exercices affichée
  identite: {
    denomination: "Barreau de Pointe-Noire",
    ordre: "Ordre National des Avocats du Congo",
    batonnier: "Me BIKINDOU Audrey Séverin",
    tresoriere: "Me ONDZE BOYA Armelle Laure Carine",
    secretaireGeneral: "Me KALINA-MENGA Lionel",
    adresse: "Maison de l'Avocat — Pointe-Noire, République du Congo",
  },
  documents: {
    categoriesArchives: [
      "Attestation d'inscription",
      "Quitus",
      "Reçu de paiement",
      "Procès-verbal (Conseil)",
      "Convocation (Conseil)",
      "Feuille de présence",
      "Procès-verbal (AG)",
      "Convocation (AG)",
      "Convocation disciplinaire",
      "Décision disciplinaire",
      "Lettre du Bâtonnier",
    ],
    typesPublication: ["Avis", "Communiqué"],
  },
  paiement: { canauxActifs: ["MTN", "AIRTEL", "CARTE", "VIREMENT"] },
  stage: { dureeMois: 24 },
  // Fonctions du Conseil de l'Ordre — données de référence éditables, proposées
  // à l'ajout/édition d'un membre du Conseil (au lieu d'une saisie libre).
  conseil: {
    fonctions: ["Bâtonnier", "Vice-Bâtonnier", "Secrétaire Général", "Trésorière", "Membre du Conseil"],
  },
  // Surcharges de libellés d'affichage des statuts (la logique/les clés enum ne
  // changent pas — on ne renomme que ce qui s'affiche). Vide = libellé par défaut.
  libellesStatuts: { membre: {}, cotisation: {}, dossier: {}, publication: {} },
};

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Objet de configuration « vivant » lu par les dérivations. */
export const config = clone(PARAMETRES_DEFAUT);

// Abonnés recalculés à chaque application de configuration (dérivations).
const abonnes = new Set();
/** Enregistre un rappel exécuté après chaque `appliquerConfig` (et une fois tout de suite). */
export function onConfigChange(cb) {
  abonnes.add(cb);
  cb();
  return () => abonnes.delete(cb);
}

/** Applique un patch partiel à la configuration vivante puis notifie les abonnés. */
export function appliquerConfig(patch) {
  if (!patch) return;
  if (patch.tarifs) config.tarifs = { ...config.tarifs, ...patch.tarifs };
  if (patch.exerciceCourant != null) config.exerciceCourant = patch.exerciceCourant;
  if (patch.exercices) config.exercices = { ...config.exercices, ...patch.exercices };
  if (patch.identite) config.identite = { ...config.identite, ...patch.identite };
  if (patch.documents) config.documents = { ...config.documents, ...patch.documents };
  if (patch.paiement) config.paiement = { ...config.paiement, ...patch.paiement };
  if (patch.stage) config.stage = { ...config.stage, ...patch.stage };
  if (patch.conseil) config.conseil = { ...config.conseil, ...patch.conseil };
  if (patch.libellesStatuts) {
    const l = config.libellesStatuts;
    for (const dom of Object.keys(patch.libellesStatuts)) {
      l[dom] = { ...(l[dom] ?? {}), ...patch.libellesStatuts[dom] };
    }
  }
  abonnes.forEach((cb) => { try { cb(); } catch { /* un abonné défaillant n'interrompt pas les autres */ } });
}

// ─── Accesseurs de données de référence (lecture au moment du rendu) ─────────

/** Liste des exercices, du plus récent à la borne basse configurée. */
export function exercices() {
  const courant = config.exerciceCourant ?? PARAMETRES_DEFAUT.exerciceCourant;
  const premier = Math.min(config.exercices?.premier ?? PARAMETRES_DEFAUT.exercices.premier, courant);
  const liste = [];
  for (let a = courant; a >= premier; a--) liste.push(a);
  return liste;
}
export const categoriesArchives = () => config.documents?.categoriesArchives ?? [];
export const typesPublication = () => config.documents?.typesPublication ?? [];
export const canauxActifs = () => config.paiement?.canauxActifs ?? [];
export const dureeStageMois = () => config.stage?.dureeMois ?? PARAMETRES_DEFAUT.stage.dureeMois;
/** Fonctions du Conseil de l'Ordre configurées (données de référence). */
export const fonctionsConseil = () => config.conseil?.fonctions ?? PARAMETRES_DEFAUT.conseil.fonctions;
/** Libellé d'un statut, surchargé en Paramètres ou repli sur le défaut fourni. */
export const libelleStatut = (domaine, cle, defaut) =>
  config.libellesStatuts?.[domaine]?.[cle] || defaut;
