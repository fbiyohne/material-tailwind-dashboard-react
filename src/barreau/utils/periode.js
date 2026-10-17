/**
 * Périodes pour les états financiers (CDC 2.5 — états mensuels et trimestriels).
 * Une période restreint les lignes aux paiements dont la date tombe dans la
 * fenêtre choisie (mois ou trimestre). « Année entière » ne filtre pas.
 */
const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export const PERIODES = [
  { value: "annee", label: "Année entière" },
  { value: "T1", label: "1er trimestre" },
  { value: "T2", label: "2e trimestre" },
  { value: "T3", label: "3e trimestre" },
  { value: "T4", label: "4e trimestre" },
  ...MOIS.map((m, i) => ({ value: String(i + 1).padStart(2, "0"), label: m })),
];

/** Renvoie l'ensemble des mois (1–12) couverts par une période, ou null pour l'année. */
export function moisDePeriode(p) {
  if (!p || p === "annee") return null;
  if (p.startsWith("T")) {
    const t = Number(p[1]);
    return [t * 3 - 2, t * 3 - 1, t * 3];
  }
  return [Number(p)];
}

/** Vrai si la date ISO tombe dans la période (toujours vrai pour l'année entière). */
export function dansPeriode(dateIso, p) {
  const mois = moisDePeriode(p);
  if (!mois) return true;
  if (!dateIso) return false;
  return mois.includes(new Date(dateIso).getMonth() + 1);
}

export function libellePeriode(p) {
  return PERIODES.find((x) => x.value === p)?.label ?? "Année entière";
}
