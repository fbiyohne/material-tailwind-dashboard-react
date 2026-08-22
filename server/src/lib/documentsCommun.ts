/**
 * Helpers communs aux gabarits de documents officiels (PDF Puppeteer) —
 * partagés par `documentsRiches.ts` (reçus/quitus riches) et `templates.ts`
 * (actes institutionnels : attestations, PV, convocations, tableau). Source
 * unique pour le formatage et, surtout, l'ÉCHAPPEMENT HTML des champs libres.
 */

/** Échappe les méta-caractères HTML d'une valeur quelconque (anti-injection). */
export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

/** Montant en FCFA avec séparateurs de milliers. */
export const fmtFCFA = (n: number): string =>
  `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;

/** Date en français long (jour mois année) ; null/undefined → « — ». */
export const fmtDateFr = (d?: Date | string | null): string =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—";
