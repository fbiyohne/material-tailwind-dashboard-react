import { z } from "zod";
import { prisma } from "../prisma.js";

/**
 * Règles juridiques paramétrables (Paramètres → section `regles`, plus la clé
 * historique `stage`). Seule source des valeurs juridiques du logiciel : les
 * défauts reprennent docs/juridique/regles-reference.md (loi n° 026-92). Les
 * valeurs « provisoires » y sont signalées : elles sont à confirmer par les
 * textes (règlement intérieur) et restent modifiables sans redéploiement.
 */

// Statuts connus, y compris les sorties volontaires ajoutées par la mission (R-24).
const STATUTS = ["INSCRIT", "STAGIAIRE", "HONORAIRE", "SUSPENDU", "OMIS", "RADIE", "DECEDE",
  "DEMISSIONNAIRE", "RETRAITE", "CESSATION"] as const;
const duree = z.number().int().nonnegative();
const code = z.string().trim().min(1).max(40);
const conditionEligibilite = z.object({ ancienneteMinAns: duree.max(60), stricte: z.boolean() }).strict();

export const stageSchema = z.object({
  dureeMois: z.number().int().positive().max(120),
  certificatObligatoire: z.boolean(),
}).strict();

/** Section `regles` : l'objet complet est exigé (la mise à jour des Paramètres est superficielle). */
export const reglesSchema = z.object({
  admissionDirecte: z.object({
    cas: z.array(z.object({ code, libelle: z.string().trim().min(1), ancienneteMinAns: duree.max(60), article: z.string() }).strict()).max(20),
  }).strict(),
  impayes: z.object({ delaiRappelJours: duree.max(365), delaiMiseEnDemeureJours: duree.max(365) }).strict(),
  sanctions: z.array(z.object({
    code,
    libelle: z.string().trim().min(1),
    effet: z.enum(["AUCUN", "SUSPENSION", "RADIATION"]),
    dureeMaxMois: duree.max(120).nullable(),
    sursisPossible: z.boolean(),
  }).strict()).min(1).max(20),
  sursisAutorise: z.boolean(),
  effetRadiation: z.enum(["ENREGISTREMENT", "EXPIRATION_RECOURS"]),
  peineAccessoireMaxMois: duree.max(120),
  electoral: z.object({
    qualites: z.array(z.enum(["AVOCAT", "STAGIAIRE", "HONORAIRE"])).min(1),
    statutsExclus: z.array(z.enum(STATUTS)),
    exigerCotisationAJour: z.boolean(),
    honorairesElecteurs: z.boolean(),
  }).strict(),
  eligibilite: z.object({
    BATONNIER: conditionEligibilite, CONSEIL: conditionEligibilite,
    CONSEIL_BARREAU: conditionEligibilite, AUTRE: conditionEligibilite,
  }).strict(),
  exclurePeineAccessoire: z.boolean(),
  quitus: z.object({ validiteMois: z.number().int().min(1).max(24) }).strict(),
}).strict();

export type Regles = z.infer<typeof reglesSchema> & { stage: z.infer<typeof stageSchema> };

export const REGLES_DEFAUT: Regles = {
  stage: { dureeMois: 24, certificatObligatoire: false }, // R-01 (légal) ; R-03 désactivé par défaut (D4, point ouvert)
  admissionDirecte: { // R-06 à R-09 (légal, liste fermée de l'art. 32)
    cas: [
      { code: "MAGISTRAT", libelle: "Magistrat", ancienneteMinAns: 5, article: "loi n° 026-92, art. 32-1°" },
      { code: "ENSEIGNANT_DROIT", libelle: "Professeur, maître-assistant ou assistant en droit", ancienneteMinAns: 8, article: "loi n° 026-92, art. 32-2°" },
      { code: "NOTAIRE", libelle: "Notaire titulaire d'une maîtrise", ancienneteMinAns: 5, article: "loi n° 026-92, art. 32-2°" },
    ],
  },
  impayes: { delaiRappelJours: 30, delaiMiseEnDemeureJours: 15 }, // R-17, R-18 (provisoire)
  sanctions: [ // R-28 à R-30 (légal, art. 36) ; sursis R-39 (provisoire)
    { code: "AVERTISSEMENT", libelle: "Avertissement", effet: "AUCUN", dureeMaxMois: null, sursisPossible: false },
    { code: "REPRIMANDE", libelle: "Réprimande", effet: "AUCUN", dureeMaxMois: null, sursisPossible: false },
    { code: "INTERDICTION_TEMPORAIRE", libelle: "Interdiction temporaire", effet: "SUSPENSION", dureeMaxMois: 12, sursisPossible: true },
    { code: "RADIATION", libelle: "Radiation", effet: "RADIATION", dureeMaxMois: null, sursisPossible: false },
  ],
  sursisAutorise: true, // R-39 (provisoire)
  effetRadiation: "ENREGISTREMENT", // R-40 (provisoire)
  peineAccessoireMaxMois: 60, // R-31 (légal)
  electoral: { // R-48 (légal), R-50 à R-52 (provisoire)
    qualites: ["AVOCAT"],
    statutsExclus: ["STAGIAIRE", "SUSPENDU", "OMIS", "RADIE", "DECEDE", "DEMISSIONNAIRE", "RETRAITE", "CESSATION"],
    exigerCotisationAJour: true,
    honorairesElecteurs: false,
  },
  eligibilite: { // R-44 (légal, plus de 8 ans), R-54 (provisoire, aucune ancienneté)
    BATONNIER: { ancienneteMinAns: 8, stricte: true },
    CONSEIL: { ancienneteMinAns: 0, stricte: false },
    CONSEIL_BARREAU: { ancienneteMinAns: 0, stricte: false },
    AUTRE: { ancienneteMinAns: 0, stricte: false },
  },
  exclurePeineAccessoire: true, // R-53 (légal)
  quitus: { validiteMois: 3 }, // aucun texte : pratique, provisoire (à confirmer par le Conseil de l'Ordre)
};

/** Défauts de la section `regles` seule (sans la clé `stage`, stockée à part). */
const { stage: _stage, ...sectionDefaut } = REGLES_DEFAUT;
export const REGLES_SECTION_DEFAUT = sectionDefaut;

const objet = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Fusion clé par clé avec les défauts : une règle absente (enregistrement
 * antérieur à son introduction) retombe sur sa valeur par défaut.
 */
export function fusionnerRegles(data: unknown): Regles {
  const d = objet(data);
  const enBase = objet(d.regles);
  const r = structuredClone(REGLES_DEFAUT) as Record<string, unknown>;
  for (const [cle, defaut] of Object.entries(REGLES_SECTION_DEFAUT)) {
    if (!(cle in enBase)) continue;
    const v = enBase[cle];
    r[cle] = typeof defaut === "object" && defaut !== null && !Array.isArray(defaut) ? { ...defaut, ...objet(v) } : v;
  }
  r.stage = { ...REGLES_DEFAUT.stage, ...objet(d.stage) };
  return r as Regles;
}

/** Règles en vigueur, relues en base à chaque appel (aucun cache : effet immédiat d'un PUT). */
export async function reglesActuelles(): Promise<Regles> {
  const row = await prisma.parametres.findUnique({ where: { id: 1 } });
  return fusionnerRegles(row?.data);
}
