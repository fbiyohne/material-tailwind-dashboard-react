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

/** N° de reçu séquentiel (0001, 0002…). */
export async function prochainNumeroRecu(): Promise<string> {
  const dernier = await prisma.recu.findFirst({ orderBy: { id: "desc" } });
  const n = dernier ? parseInt(dernier.numero, 10) + 1 : 90;
  return pad(n, 4);
}

/** N° de quitus Q-AAAA-NNN, séquence par exercice (BR — registre). */
export async function prochainNumeroQuitus(annee: number): Promise<string> {
  const items = await prisma.quitus.findMany({ where: { annee }, select: { numero: true } });
  const suffixes = items.map((q) => parseInt(q.numero.split("-")[2] ?? "0", 10));
  const suivant = (suffixes.length ? Math.max(...suffixes) : 0) + 1;
  return `Q-${annee}-${pad(suivant, 3)}`;
}

/** Référence disciplinaire unique AAAA-NN (BR-06 / RG-12). */
export async function prochaineReferenceDossier(annee: number): Promise<string> {
  const items = await prisma.dossierDisciplinaire.findMany({
    where: { reference: { startsWith: `${annee}-` } },
    select: { reference: true },
  });
  const nums = items.map((d) => parseInt(d.reference.split("-")[1] ?? "0", 10));
  const suivant = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${annee}-${pad(suivant, 2)}`;
}

/** N° d'inscription PN-AAAA-NNN. */
export async function prochainNumInscription(): Promise<{ num: number; numInscription: string }> {
  const dernier = await prisma.membre.findFirst({ orderBy: { num: "desc" } });
  const num = (dernier?.num ?? 0) + 1;
  return { num, numInscription: `PN-${new Date().getFullYear()}-${pad(num, 3)}` };
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
