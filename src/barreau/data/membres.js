/**
 * Membres du Barreau — échantillon représentatif des 139 inscrits, donné dans
 * l'ORDRE DU TABLEAU (non alphabétique, cf. FR-REC-01). Sera remplacé par
 * l'API / la base PostgreSQL en V2 (import depuis TABLEAU_DU_SUIVI.xlsx).
 *
 * `paiements` : montant déjà encaissé par exercice. Le montant dû et le statut
 * sont dérivés (voir derivations.js) selon les règles BR-07 / BR-08 / RG-07/08.
 * `stage` (stagiaires) : date de serment, durée et maître de stage (FR-ST-*).
 */

/** Montant de référence de la cotisation annuelle (BR-07 / RG-07). */
export const TARIFS = {
  avocat: 150_000,
  stagiaire: 75_000,
  honoraire: 0, // exonéré (BR-08 / RG-08)
};

// Helper : exercices entièrement réglés (historique « à jour »).
const regle = (annees, montant, mode = "Virement") =>
  Object.fromEntries(
    annees.map((a) => [a, { paye: montant, date: `${a}-03-15`, mode, ref: `REG-${a}` }])
  );

export const membres = [
  {
    id: 1, num: 1, nom: "ABIRA Armel Symphorien", qualite: "avocat", statut: "inscrit",
    cabinet: "Cabinet ABIRA & Associés", tel: "+242 06 000 00 01", email: "abira@barreau-pn.cg",
    dateInscription: "2012-01-18", rccm: "CG-PNR-12-A-1042",
    paiements: { ...regle([2020, 2021, 2022, 2023], 150_000) },
  },
  {
    id: 2, num: 2, nom: "BAKALA Thomas", qualite: "avocat", statut: "inscrit",
    cabinet: "SCPA Loango", tel: "+242 06 000 00 02", email: "bakala@barreau-pn.cg",
    dateInscription: "2009-11-05", rccm: "CG-PNR-09-A-0788",
    paiements: { ...regle([2020, 2021, 2022, 2023, 2024, 2025], 150_000),
      2026: { paye: 150_000, date: "2026-01-20", mode: "Virement", ref: "VIR-2026-014" } },
  },
  {
    id: 3, num: 3, nom: "BIKINDOU Audrey Séverin", qualite: "avocat", statut: "inscrit",
    cabinet: "Cabinet du Bâtonnier", tel: "+242 06 000 00 03", email: "batonnier@barreau-pn.cg",
    dateInscription: "2004-03-12", rccm: "CG-PNR-04-A-0203",
    paiements: { ...regle([2020, 2021, 2022, 2023, 2024, 2025, 2026], 150_000) },
  },
  {
    id: 4, num: 4, nom: "ONDZE BOYA Armelle Laure Carine", qualite: "avocat", statut: "inscrit",
    cabinet: "Cabinet ONDZE BOYA", tel: "+242 06 000 00 04", email: "tresoriere@barreau-pn.cg",
    dateInscription: "2007-06-22", rccm: "CG-PNR-07-A-0451",
    paiements: { ...regle([2020, 2021, 2022, 2023, 2024, 2025, 2026], 150_000) },
  },
  {
    id: 5, num: 5, nom: "GANGA Prince Aurélien", qualite: "avocat", statut: "inscrit",
    cabinet: "Cabinet Ponton", tel: "+242 06 000 00 05", email: "ganga@barreau-pn.cg",
    dateInscription: "2015-09-30",
    paiements: { ...regle([2020, 2021, 2022, 2023, 2024], 150_000) },
  },
  {
    id: 6, num: 6, nom: "KIMBEMBE Sylvie", qualite: "avocat", statut: "inscrit",
    cabinet: "SCPA Atlantique", tel: "+242 06 000 00 06", email: "kimbembe@barreau-pn.cg",
    dateInscription: "2014-02-14",
    paiements: { ...regle([2021, 2022, 2023, 2024, 2025], 150_000),
      2026: { paye: 75_000, date: "2026-03-02", mode: "Espèces", ref: "ESP-2026-031" } },
  },
  {
    id: 7, num: 7, nom: "LOEMBA Daniel", qualite: "honoraire", statut: "honoraire",
    cabinet: "—", tel: "+242 06 000 00 07", email: "loemba@barreau-pn.cg",
    dateInscription: "1996-10-01",
    paiements: {},
  },
  {
    id: 8, num: 8, nom: "MAVOUNGOU Chris", qualite: "avocat", statut: "suspendu",
    cabinet: "Cabinet Tié-Tié", tel: "+242 06 000 00 08", email: "mavoungou@barreau-pn.cg",
    dateInscription: "2016-04-19",
    paiements: { ...regle([2020, 2021], 150_000) },
  },
  {
    id: 9, num: 9, nom: "NGOMA Patricia", qualite: "avocat", statut: "inscrit",
    cabinet: "Cabinet Ngoma", tel: "+242 06 000 00 09", email: "ngoma@barreau-pn.cg",
    dateInscription: "2010-07-08", rccm: "CG-PNR-10-A-0903",
    paiements: { ...regle([2020, 2021, 2022, 2023, 2024, 2025, 2026], 150_000) },
  },
  {
    id: 10, num: 10, nom: "KALINA-MENGA Lionel", qualite: "avocat", statut: "inscrit",
    cabinet: "Cabinet Kalina-Menga", tel: "+242 06 000 00 10", email: "sg@barreau-pn.cg",
    dateInscription: "2011-05-16", rccm: "CG-PNR-11-A-0987",
    paiements: { ...regle([2020, 2021, 2022, 2023, 2024, 2025], 150_000),
      2026: { paye: 150_000, date: "2026-02-10", mode: "Virement", ref: "VIR-2026-021" } },
  },
  {
    id: 11, num: 11, nom: "TATY Bernard", qualite: "avocat", statut: "omis",
    cabinet: "Cabinet Taty", tel: "+242 06 000 00 11", email: "taty@barreau-pn.cg",
    dateInscription: "2013-12-03",
    paiements: { ...regle([2020, 2021, 2022], 150_000) },
  },
  {
    id: 12, num: 12, nom: "MOUKOUEKE Iris", qualite: "avocat", statut: "inscrit",
    cabinet: "Cabinet Moukoueke", tel: "+242 06 000 00 12", email: "moukoueke@barreau-pn.cg",
    dateInscription: "2018-01-25",
    paiements: { ...regle([2020, 2021, 2022, 2023, 2024, 2025], 150_000),
      2026: { paye: 75_000, date: "2026-04-15", mode: "Mobile Money", ref: "MOM-2026-044" } },
  },

  // ─── Avocats stagiaires (liste de stage) ──────────────────────────────────
  {
    id: 13, num: 13, nom: "SAMBA Rolande", qualite: "stagiaire", statut: "stagiaire",
    cabinet: "SCPA Loango", tel: "+242 06 000 00 13", email: "samba@barreau-pn.cg",
    stage: { dateServment: "2025-02-15", dureeMois: 24, maitreStage: "Me BAKALA Thomas" },
    paiements: { 2025: { paye: 75_000, date: "2025-05-10", mode: "Espèces", ref: "ESP-2025-088" },
      2026: { paye: 75_000, date: "2026-02-28", mode: "Espèces", ref: "ESP-2026-019" } },
  },
  {
    id: 14, num: 14, nom: "POATY Gildas", qualite: "stagiaire", statut: "stagiaire",
    cabinet: "Cabinet ABIRA & Associés", tel: "+242 06 000 00 14", email: "poaty@barreau-pn.cg",
    stage: { dateServment: "2024-06-01", dureeMois: 24, maitreStage: "Me ABIRA Armel Symphorien" },
    paiements: { 2025: { paye: 75_000, date: "2025-06-01", mode: "Espèces", ref: "ESP-2025-101" } },
  },
  {
    id: 15, num: 15, nom: "NKOUNKOU Lévi", qualite: "stagiaire", statut: "stagiaire",
    cabinet: "Cabinet Ngoma", tel: "+242 06 000 00 15", email: "nkounkou@barreau-pn.cg",
    stage: { dateServment: "2024-01-10", dureeMois: 24, maitreStage: "Me NGOMA Patricia" },
    paiements: { 2025: { paye: 75_000, date: "2025-03-12", mode: "Espèces", ref: "ESP-2025-040" } },
  },
  {
    id: 16, num: 16, nom: "BANTSIMBA Aïcha", qualite: "stagiaire", statut: "stagiaire",
    cabinet: "Cabinet Kalina-Menga", tel: "+242 06 000 00 16", email: "bantsimba@barreau-pn.cg",
    stage: { dateServment: "2023-03-20", dureeMois: 24, maitreStage: "Me KALINA-MENGA Lionel" },
    paiements: { 2024: { paye: 75_000, date: "2024-04-02", mode: "Espèces", ref: "ESP-2024-061" } },
  },
  {
    id: 17, num: 17, nom: "MABIALA Junior", qualite: "stagiaire", statut: "stagiaire",
    cabinet: "SCPA Atlantique", tel: "+242 06 000 00 17", email: "mabiala@barreau-pn.cg",
    stage: { dateServment: "2025-09-05", dureeMois: 24, maitreStage: "Me KIMBEMBE Sylvie" },
    paiements: { 2026: { paye: 75_000, date: "2026-01-15", mode: "Mobile Money", ref: "MOM-2026-008" } },
  },
  {
    id: 18, num: 18, nom: "OBA Sylvana", qualite: "stagiaire", statut: "stagiaire",
    cabinet: "Cabinet Ponton", tel: "+242 06 000 00 18", email: "oba@barreau-pn.cg",
    stage: { dateServment: "2024-11-15", dureeMois: 24, maitreStage: "Me GANGA Prince Aurélien" },
    paiements: {},
  },
  {
    id: 19, num: 19, nom: "TCHICAYA Brel", qualite: "stagiaire", statut: "stagiaire",
    cabinet: "Cabinet Moukoueke", tel: "+242 06 000 00 19", email: "tchicaya@barreau-pn.cg",
    stage: { dateServment: "2023-01-30", dureeMois: 24, maitreStage: "Me MOUKOUEKE Iris" },
    paiements: { 2024: { paye: 75_000, date: "2024-02-20", mode: "Espèces", ref: "ESP-2024-022" } },
  },
  {
    id: 20, num: 20, nom: "LOUBOTA Mercia", qualite: "stagiaire", statut: "stagiaire",
    cabinet: "Cabinet Ngoma", tel: "+242 06 000 00 20", email: "loubota@barreau-pn.cg",
    stage: { dateServment: "2025-04-22", dureeMois: 24, maitreStage: "Me NGOMA Patricia" },
    paiements: { 2026: { paye: 75_000, date: "2026-05-03", mode: "Espèces", ref: "ESP-2026-052" } },
  },
];

export default membres;
