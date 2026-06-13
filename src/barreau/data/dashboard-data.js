/**
 * Données du tableau de bord — Barreau de Pointe-Noire.
 *
 * ⚠️ Données de référence reprises de la maquette UI/UX (exercice 2025 exact).
 * Elles seront remplacées par l'API REST en V2 (exigences FR-DB-01 → FR-DB-10).
 * Les autres exercices fournissent des valeurs plausibles pour démontrer le
 * filtrage par exercice (FR-DB-08) tant que la base de données n'est pas branchée.
 */

export const EXERCICES = [2026, 2025, 2024, 2023, 2022, 2021, 2020];

export const dashboardParExercice = {
  2026: {
    membres: { inscrits: 127, aJour: 18, enRetard: 96, stagiaires: 14 },
    finances: { payees: 2_700_000, impayees: 16_350_000 },
  },
  2025: {
    // Valeurs exactes de la maquette (« Situation financière 2025 »)
    membres: { inscrits: 125, aJour: 10, enRetard: 51, stagiaires: 9 },
    finances: { payees: 1_500_000, impayees: 7_650_000 },
  },
  2024: {
    membres: { inscrits: 121, aJour: 88, enRetard: 24, stagiaires: 11 },
    finances: { payees: 13_200_000, impayees: 3_600_000 },
  },
  2023: {
    membres: { inscrits: 116, aJour: 92, enRetard: 16, stagiaires: 8 },
    finances: { payees: 13_800_000, impayees: 2_400_000 },
  },
  2022: {
    membres: { inscrits: 108, aJour: 90, enRetard: 12, stagiaires: 7 },
    finances: { payees: 13_500_000, impayees: 1_800_000 },
  },
  2021: {
    membres: { inscrits: 99, aJour: 81, enRetard: 11, stagiaires: 6 },
    finances: { payees: 12_150_000, impayees: 1_650_000 },
  },
  2020: {
    membres: { inscrits: 92, aJour: 76, enRetard: 9, stagiaires: 5 },
    finances: { payees: 11_400_000, impayees: 1_350_000 },
  },
};

/** Agenda institutionnel — prochaines échéances (FR-DB-09). */
export const prochainesEcheances = [
  { date: "18 juin 2026", libelle: "Réunion du Conseil de l'Ordre", type: "reunion" },
  { date: "25 juin 2026", libelle: "Clôture des cotisations — 1er semestre", type: "finance" },
  { date: "02 juil. 2026", libelle: "Audience disciplinaire — dossier 2026-04", type: "discipline" },
  { date: "15 juil. 2026", libelle: "Assemblée Générale Ordinaire", type: "assemblee" },
];

/** Journal des dernières actions (FR-DB-10). */
export const journalActivite = [
  { quand: "Aujourd'hui · 09:42", action: "Reçu N° 0090 émis — Me BAKALA Thomas", acteur: "Secrétaire Général" },
  { quand: "Hier · 16:10", action: "Quitus Q-2026-089 généré et archivé", acteur: "Trésorière" },
  { quand: "Hier · 11:05", action: "Situation financière validée — 4 avocats", acteur: "Trésorière" },
  { quand: "11 juin · 14:30", action: "Dossier disciplinaire 2026-04 ouvert", acteur: "Secrétaire Général" },
];
