/**
 * Publications institutionnelles (FR-PUB) et calendrier de la Lettre du
 * Bâtonnier (FR-BAT). Remplacés par l'API en V2.
 */

export const STATUT_PUBLICATION_META = {
  brouillon: { label: "Brouillon", ton: "gris" },
  a_valider: { label: "À valider", ton: "or" },
  valide: { label: "Validé", ton: "bleu" },
  publie: { label: "Publié", ton: "vert" },
};

export const publicationsInitiales = [
  {
    id: 1,
    titre: "Avis de fermeture du Secrétariat — congés annuels",
    type: "Avis",
    contenu:
      "Le Secrétariat de l'Ordre sera fermé du 1er au 15 août 2026 à l'occasion des congés annuels.",
    statut: "publie",
    date: "2026-06-01",
  },
  {
    id: 2,
    titre: "Communiqué — Rentrée solennelle du Barreau",
    type: "Communiqué",
    contenu:
      "Le Bâtonnier a l'honneur d'annoncer la tenue de la rentrée solennelle du Barreau de Pointe-Noire.",
    statut: "a_valider",
    date: "2026-06-10",
  },
];

/**
 * Le calendrier éditorial de la Lettre du Bâtonnier est désormais servi par
 * l'API (`GET /calendrier-editorial`) — voir resources.js → getCalendrierEditorial.
 */

/** Génère un projet d'article (gabarit). Repli client si l'IA serveur est injoignable. */
export function genererBrouillonArticle(mois, theme) {
  return (
    `Lettre du Bâtonnier — ${mois}\n\n` +
    `Thème : ${theme}.\n\n` +
    `Chères Consœurs, chers Confrères,\n\n` +
    `Le thème de ce mois, « ${theme} », nous invite à une réflexion collective sur ` +
    `notre responsabilité au sein du Barreau de Pointe-Noire. En tant qu'auxiliaires de ` +
    `justice, nous portons une exigence particulière d'exemplarité et d'engagement.\n\n` +
    `[Développement à compléter par le Bâtonnier.]\n\n` +
    `Confraternellement,\nLe Bâtonnier`
  );
}
