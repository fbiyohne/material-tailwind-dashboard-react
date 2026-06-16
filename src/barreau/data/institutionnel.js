/**
 * Données institutionnelles — Réunions du Conseil, Assemblées générales et
 * dossiers disciplinaires. Remplacées par l'API / PostgreSQL en V2.
 */
import { config, onConfigChange } from "./config";

export const reunionsInitiales = [
  {
    id: 1,
    date: "2026-06-18",
    heure: "15:00",
    lieu: "Maison de l'Avocat — Pointe-Noire",
    ordreDuJour: [
      "Approbation du procès-verbal de la précédente réunion",
      "Point sur le recouvrement des cotisations 2026",
      "Préparation de l'Assemblée Générale Ordinaire",
      "Questions diverses",
    ],
    statut: "planifiee",
    pv: null,
  },
  {
    id: 2,
    date: "2026-05-14",
    heure: "15:00",
    lieu: "Maison de l'Avocat — Pointe-Noire",
    ordreDuJour: ["Admissions sur la liste de stage", "Questions diverses"],
    statut: "tenue",
    pv: "Le Conseil, après délibération, a admis deux nouveaux stagiaires sur la liste de stage.",
  },
];

export const assembleesInitiales = [
  {
    id: 1,
    type: "AGO",
    date: "2026-07-15",
    lieu: "Palais de Justice — Pointe-Noire",
    ordreDuJour: [
      "Rapport moral du Bâtonnier",
      "Rapport financier de la Trésorière",
      "Renouvellement du Conseil de l'Ordre",
    ],
    quorumPresent: 0,
    statut: "convoquee",
    decisions: [],
  },
];

/** Statut administratif d'un dossier disciplinaire (libellés surchargeables). */
const STATUT_DOSSIER_META_DEFAUT = {
  ouvert: { label: "Ouvert", ton: "gris" },
  instruction: { label: "Instruction", ton: "or" },
  audience: { label: "Audience fixée", ton: "bleu" },
  decision: { label: "Décision rendue", ton: "vert" },
  classe: { label: "Classé", ton: "gris" },
};
export const STATUT_DOSSIER_META = structuredClone(STATUT_DOSSIER_META_DEFAUT);
export const STATUT_DOSSIER_META_CLES = STATUT_DOSSIER_META_DEFAUT;
onConfigChange(() => {
  const surcharges = config.libellesStatuts?.dossier ?? {};
  for (const cle of Object.keys(STATUT_DOSSIER_META)) {
    STATUT_DOSSIER_META[cle].label = surcharges[cle] || STATUT_DOSSIER_META_DEFAUT[cle].label;
  }
});

export const dossiersInitiaux = [
  {
    id: 1,
    reference: "2026-03",
    avocatNom: "MAVOUNGOU Chris",
    objet: "Manquement présumé aux règles déontologiques",
    dateSaisine: "2026-03-10",
    dateConvocation: "2026-03-25",
    dateAudience: "2026-04-15",
    decision: "",
    sanction: "",
    statut: "instruction",
  },
  {
    id: 2,
    reference: "2026-04",
    avocatNom: "Confidentiel",
    objet: "Plainte d'un justiciable",
    dateSaisine: "2026-05-02",
    dateConvocation: null,
    dateAudience: null,
    decision: "",
    sanction: "",
    statut: "ouvert",
  },
];
