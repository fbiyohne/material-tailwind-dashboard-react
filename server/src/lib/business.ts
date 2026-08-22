import type { Qualite } from "@prisma/client";
import { prisma } from "../prisma.js";

/**
 * Règles métier du Barreau (côté serveur) — miroir des règles du front,
 * désormais source de vérité. Tarifs de référence (BR-07 / BR-08).
 */
export const TARIFS: Record<Qualite, number> = {
  AVOCAT: 150_000,
  STAGIAIRE: 75_000,
  HONORAIRE: 0,
};

export const DROIT_PLAIDOIRIE = 60_000;

export function montantDu(qualite: Qualite): number {
  return TARIFS[qualite] ?? TARIFS.AVOCAT;
}

export type Tarifs = { AVOCAT: number; STAGIAIRE: number; HONORAIRE: number; droitPlaidoirie: number };

/**
 * Tarifs effectifs lus depuis la configuration (module Paramètres), avec repli
 * sur les barèmes de référence. Source de vérité unique pour tous les calculs
 * financiers (cotisations, droits, dashboard) — évite le formulaire « placebo ».
 */
export async function tarifsActuels(): Promise<Tarifs> {
  const row = await prisma.parametres.findUnique({ where: { id: 1 } });
  const t = ((row?.data as any)?.tarifs ?? {}) as Record<string, unknown>;
  // Un tarif configuré à 0 est légitime (exonération) : on ne retombe sur le
  // barème par défaut que pour une valeur absente ou invalide, pas pour 0.
  const n = (v: unknown, defaut: number) => {
    const x = Number(v);
    return v !== undefined && v !== null && v !== "" && Number.isFinite(x) && x >= 0 ? x : defaut;
  };
  return {
    AVOCAT: n(t.avocat, TARIFS.AVOCAT),
    STAGIAIRE: n(t.stagiaire, TARIFS.STAGIAIRE),
    HONORAIRE: 0,
    droitPlaidoirie: n(t.droitsPlaidoirie, DROIT_PLAIDOIRIE),
  };
}

/** Cotisation due selon les tarifs effectifs. */
export function montantDuAvec(tarifs: Tarifs, qualite: Qualite): number {
  return tarifs[qualite] ?? tarifs.AVOCAT;
}

/** Droit de plaidoirie dû selon les tarifs effectifs (seuls les avocats sont redevables). */
export function droitDuAvec(tarifs: Tarifs, qualite: Qualite): number {
  return qualite === "AVOCAT" ? tarifs.droitPlaidoirie : 0;
}

/**
 * Cotisation due EFFECTIVE : une ligne réellement persistée (avec son montant dû
 * figé à l'époque) prime sur le barème en vigueur ; sinon on calcule d'après la
 * qualité et les tarifs courants. Source unique de cette règle, autrefois recopiée
 * dans cotisations/dashboard/espace — la centraliser évite les divergences d'argent.
 */
export function cotisationDue(ligne: { montantDu: number } | null | undefined, tarifs: Tarifs, qualite: Qualite): number {
  return ligne?.montantDu ?? montantDuAvec(tarifs, qualite);
}

/** Droit de plaidoirie dû EFFECTIF : ligne réelle prioritaire, sinon barème (miroir de cotisationDue). */
export function droitDue(ligne: { montantDu: number } | null | undefined, tarifs: Tarifs, qualite: Qualite): number {
  return ligne?.montantDu ?? droitDuAvec(tarifs, qualite);
}

export type StatutCotisation = "ajour" | "partiel" | "retard" | "exonere";

/** Statut dérivé d'une cotisation (BR-07/08). */
export function statutCotisation(montantDu: number, montantPaye: number): StatutCotisation {
  if (montantDu === 0) return "exonere";
  if (montantPaye <= 0) return "retard";
  if (montantPaye >= montantDu) return "ajour";
  return "partiel";
}

/** Éligibilité au quitus (BR-01 / RG-01-02) : à jour ET validé Trésorière. */
export function eligibleQuitus(c: { montantDu: number; montantPaye: number; valideTresoriere: boolean }): boolean {
  return statutCotisation(c.montantDu, c.montantPaye) === "ajour" && c.valideTresoriere;
}

const pad = (n: number, l: number) => String(n).padStart(l, "0");

/**
 * Prochain rang d'une séquence : max des suffixes existants + 1. `segment` est
 * l'index du segment numérique dans une valeur découpée sur « - » (ex. pour
 * « R-2026-007 » → segment 2). Robuste aux valeurs absentes/malformées (→ 0).
 */
function prochainRang(valeurs: string[], segment: number): number {
  const max = valeurs.reduce((m, v) => Math.max(m, parseInt(v.split("-")[segment] ?? "0", 10) || 0), 0);
  return max + 1;
}

/**
 * N° de reçu R-AAAA-NNN, séquence réinitialisée par exercice (RG-10).
 * Le numéro est unique et jamais réutilisé (contrainte @unique sur Recu.numero).
 */
export async function prochainNumeroRecu(annee: number): Promise<string> {
  const items = await prisma.recu.findMany({ where: { numero: { startsWith: `R-${annee}-` } }, select: { numero: true } });
  return `R-${annee}-${pad(prochainRang(items.map((r) => r.numero), 2), 3)}`;
}

/** N° de quitus Q-AAAA-NNN, séquence par exercice (BR — registre). */
export async function prochainNumeroQuitus(annee: number): Promise<string> {
  const items = await prisma.quitus.findMany({ where: { annee }, select: { numero: true } });
  return `Q-${annee}-${pad(prochainRang(items.map((q) => q.numero), 2), 3)}`;
}

/**
 * Réexécute `fn` en cas de collision d'unicité (P2002) : les numéros calculés en
 * « max+1 » hors verrou (inscription, référence disciplinaire) peuvent entrer en
 * collision sous concurrence — au lieu d'un 500, on recalcule et on réessaie.
 */
export async function avecRejeuUnicite<T>(fn: () => Promise<T>, tentatives = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002" && i < tentatives) continue;
      throw e;
    }
  }
}

/** Référence disciplinaire unique AAAA-NN (BR-06 / RG-12). */
export async function prochaineReferenceDossier(annee: number): Promise<string> {
  const items = await prisma.dossierDisciplinaire.findMany({ where: { reference: { startsWith: `${annee}-` } }, select: { reference: true } });
  return `${annee}-${pad(prochainRang(items.map((d) => d.reference), 1), 2)}`;
}

/** N° d'inscription PN-AAAA-NNN. */
export async function prochainNumInscription(): Promise<{ num: number; numInscription: string }> {
  const dernier = await prisma.membre.findFirst({ orderBy: { num: "desc" } });
  const num = (dernier?.num ?? 0) + 1;
  return { num, numInscription: `PN-${new Date().getFullYear()}-${pad(num, 3)}` };
}

/**
 * N° d'attestation ATT-AAAA-NNN via un compteur atomique par année : sûr sous
 * concurrence (pas de doublon) et monotone (pas de réutilisation d'un numéro après
 * suppression d'archive), contrairement à l'ancien `count+1`.
 */
export async function prochainNumeroAttestation(): Promise<string> {
  const annee = new Date().getFullYear();
  const compteur = await prisma.compteur.upsert({
    where: { cle: `ATT-${annee}` },
    create: { cle: `ATT-${annee}`, valeur: 1 },
    update: { valeur: { increment: 1 } },
  });
  return `ATT-${annee}-${pad(compteur.valeur, 3)}`;
}

/** N° séquentiel de timbre (compteur atomique global, monotone). */
export async function prochainNumeroTimbre(): Promise<number> {
  const compteur = await prisma.compteur.upsert({
    where: { cle: "TIMBRE" },
    create: { cle: "TIMBRE", valeur: 1 },
    update: { valeur: { increment: 1 } },
  });
  return compteur.valeur;
}

// ─── Corps électoral (RG-04, RG-05) ──────────────────────────────────────────
export function eligibiliteElectorale(
  membre: { qualite: Qualite; statut: string },
  cot: { montantDu: number; montantPaye: number } | null,
  tarifs?: Tarifs
): { eligible: boolean; raison: string | null } {
  if (membre.qualite === "HONORAIRE") return { eligible: false, raison: "honoraire" };
  if (membre.qualite === "STAGIAIRE") return { eligible: false, raison: "stagiaire" };
  if (["SUSPENDU", "RADIE", "OMIS"].includes(membre.statut)) return { eligible: false, raison: "statut" };
  // Avec les tarifs courants (Paramètres), le dû d'un membre sans ligne persistée est
  // calculé sur le barème réel via cotisationDue (une exonération à 0 est ainsi respectée) ;
  // à défaut, on retombe sur le barème statique (rétrocompatibilité).
  const du = tarifs ? cotisationDue(cot, tarifs, membre.qualite) : cot?.montantDu ?? montantDu(membre.qualite);
  const paye = cot?.montantPaye ?? 0;
  if (statutCotisation(du, paye) !== "ajour") return { eligible: false, raison: "cotisation" };
  return { eligible: true, raison: null };
}

/** Archive automatiquement un document (BR-05 / RG-14). */
export async function archiver(entree: {
  categorie: string;
  titre: string;
  reference?: string;
  date?: Date;
  membreNom?: string;
}) {
  return prisma.archive.create({ data: entree });
}
