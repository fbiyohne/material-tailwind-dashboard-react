/**
 * Formatage monétaire institutionnel — Franc CFA.
 * Sépare les milliers par une espace fine insécable, comme sur les
 * documents officiels du Barreau (ex. « 1 500 000 FCFA »).
 */
export function formatFCFA(montant) {
  if (montant === null || montant === undefined) return "—";
  const formate = Math.round(montant)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${formate} FCFA`;
}

/** Variante compacte pour les graphes (ex. « 7,65 M »). */
export function formatFCFACompact(montant) {
  if (!montant) return "0";
  if (montant >= 1_000_000) {
    return `${(montant / 1_000_000).toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    })} M`;
  }
  if (montant >= 1_000) {
    return `${(montant / 1_000).toLocaleString("fr-FR", {
      maximumFractionDigits: 0,
    })} k`;
  }
  return montant.toString();
}

/** Pourcentage borné [0,100] pour les barres de progression. */
export function ratioPct(part, total) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((part / total) * 100)));
}

/**
 * Formate une date en français long, ex. « 15 juin 2026 ».
 * Source unique pour l'affichage des dates — remplace les `slice(0,10)` ISO.
 */
export function formatDate(valeur) {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  const d = valeur instanceof Date ? valeur : new Date(valeur);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
