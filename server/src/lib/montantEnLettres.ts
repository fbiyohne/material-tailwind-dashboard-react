/**
 * Conversion d'un montant entier en toutes lettres (français), pour les reçus
 * officiels (FR-REC-03 / CDC §2.6). Gère « quatre-vingts », « cent(s) »,
 * l'accord pluriel des millions et « et un ». Port serveur de l'utilitaire front.
 */

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit",
  "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];

const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

function dizaineEnLettres(n: number, final: boolean): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 7) return u === 1 ? "soixante et onze" : `soixante-${UNITES[10 + u]}`;
  if (d === 9) return `quatre-vingt-${UNITES[10 + u]}`;
  if (d === 8) return u === 0 ? (final ? "quatre-vingts" : "quatre-vingt") : `quatre-vingt-${UNITES[u]}`;
  if (u === 0) return DIZAINES[d];
  if (u === 1) return `${DIZAINES[d]} et un`;
  return `${DIZAINES[d]}-${UNITES[u]}`;
}

function centaineEnLettres(n: number, final: boolean): string {
  const c = Math.floor(n / 100);
  const reste = n % 100;
  let mots = "";
  if (c > 0) {
    mots += c > 1 ? `${UNITES[c]} cent` : "cent";
    if (c > 1 && reste === 0 && final) mots += "s";
    if (reste > 0) mots += " ";
  }
  if (reste > 0) mots += dizaineEnLettres(reste, final);
  return mots.trim();
}

export function nombreEnLettres(montant: number): string {
  const n = Math.round(Math.abs(montant));
  if (n === 0) return "zéro";
  const millions = Math.floor(n / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1000);
  const reste = n % 1000;
  const parts: string[] = [];
  if (millions > 0) {
    const prefixe = millions === 1 ? "un" : centaineEnLettres(millions, false);
    parts.push(`${prefixe} million${millions > 1 ? "s" : ""}`);
  }
  if (milliers > 0) parts.push(milliers === 1 ? "mille" : `${centaineEnLettres(milliers, false)} mille`);
  if (reste > 0) parts.push(centaineEnLettres(reste, true));
  return parts.join(" ");
}

/** Montant en lettres suffixé pour un reçu (« … francs CFA »). */
export function montantEnLettresFCFA(montant: number): string {
  const lettres = nombreEnLettres(montant);
  const mot = `${lettres} franc${Math.round(Math.abs(montant)) > 1 ? "s" : ""} CFA`;
  return mot.charAt(0).toUpperCase() + mot.slice(1);
}
