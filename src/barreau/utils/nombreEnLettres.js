/**
 * Conversion d'un montant entier en toutes lettres (français), pour les reçus
 * officiels (FR-REC-03). Gère les particularités : « quatre-vingts », « cent(s) »,
 * accord pluriel des millions, « et un », etc.
 *
 * Ex. : 75000 → « soixante-quinze mille »  ·  150000 → « cent cinquante mille »
 */

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit",
  "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];

const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** 1..99 — `final` indique si le groupe termine le nombre (accords). */
function dizaineEnLettres(n, final) {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;

  if (d === 7) {
    // 70 soixante-dix, 71 soixante et onze, 72 soixante-douze…
    return u === 1 ? "soixante et onze" : `soixante-${UNITES[10 + u]}`;
  }
  if (d === 9) {
    // 90 quatre-vingt-dix, 91 quatre-vingt-onze…
    return `quatre-vingt-${UNITES[10 + u]}`;
  }
  if (d === 8) {
    if (u === 0) return final ? "quatre-vingts" : "quatre-vingt";
    return `quatre-vingt-${UNITES[u]}`;
  }
  // 20..69
  if (u === 0) return DIZAINES[d];
  if (u === 1) return `${DIZAINES[d]} et un`;
  return `${DIZAINES[d]}-${UNITES[u]}`;
}

/** 0..999 — `final` pour l'accord de « cent(s) ». */
function centaineEnLettres(n, final) {
  const c = Math.floor(n / 100);
  const reste = n % 100;
  let mots = "";

  if (c > 0) {
    mots += c > 1 ? `${UNITES[c]} cent` : "cent";
    if (c > 1 && reste === 0 && final) mots += "s"; // deux cents
    if (reste > 0) mots += " ";
  }
  if (reste > 0) mots += dizaineEnLettres(reste, final);
  return mots.trim();
}

export function nombreEnLettres(montant) {
  const n = Math.round(Math.abs(montant));
  if (n === 0) return "zéro";

  const millions = Math.floor(n / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1000);
  const reste = n % 1000;
  const parts = [];

  if (millions > 0) {
    const prefixe = millions === 1 ? "un" : centaineEnLettres(millions, false);
    parts.push(`${prefixe} million${millions > 1 ? "s" : ""}`);
  }
  if (milliers > 0) {
    parts.push(milliers === 1 ? "mille" : `${centaineEnLettres(milliers, false)} mille`);
  }
  if (reste > 0) parts.push(centaineEnLettres(reste, true));

  return parts.join(" ");
}

/** Montant en lettres suffixé pour un reçu (« … francs CFA »). */
export function montantEnLettresFCFA(montant) {
  const lettres = nombreEnLettres(montant);
  return `${lettres} franc${Math.round(Math.abs(montant)) > 1 ? "s" : ""} CFA`;
}

export default nombreEnLettres;
