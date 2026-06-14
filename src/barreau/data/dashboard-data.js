/**
 * Référentiel des exercices (années) du tableau de bord et des filtres associés.
 *
 * Les indicateurs, l'agenda et le journal d'activité sont désormais servis par
 * l'API REST (`/dashboard`, `/dashboard/agenda`, `/dashboard/journal`) ; les
 * anciennes données mockées de la maquette ont été retirées.
 */

export const EXERCICES = [2026, 2025, 2024, 2023, 2022, 2021, 2020];

/** Exercice par défaut (le plus récent) — source unique pour éviter le « 2026 » en dur. */
export const EXERCICE_COURANT = EXERCICES[0];
