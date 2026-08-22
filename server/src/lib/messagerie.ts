import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

/**
 * Lecture / décompte des messages non lus, mutualisé entre l'espace avocat et
 * le back-office. Une seule définition du « non écrit par moi » : on évite ainsi
 * la régression NULL (la négation SQL « <> moi » exclut à tort auteurMembreId
 * NULL, c.-à-d. les messages de l'administration).
 */

/** Borne basse (fabrique) quand un fil n'a jamais été ouvert — évite une Date partagée mutable. */
export const jamaisLu = () => new Date(0);

/** Message « non écrit par l'avocat `moi` » — inclut l'administration (auteurMembreId NULL). */
export function messageNonDeMoi(moi: number): Prisma.MessageWhereInput {
  return { OR: [{ auteurMembreId: null }, { auteurMembreId: { not: moi } }] };
}

/** Message émis par un avocat (vu côté administration). */
export const MESSAGE_DE_AVOCAT: Prisma.MessageWhereInput = { estAdministration: false };

/** Seuil de lecture d'un fil : messages postérieurs = non lus. */
export interface SeuilLecture {
  conversationId: number;
  depuis: Date;
}

/** Where combinant « expéditeur » et les seuils de lecture par fil (une seule requête). */
function whereNonLus(expediteur: Prisma.MessageWhereInput, seuils: SeuilLecture[]): Prisma.MessageWhereInput {
  return {
    AND: [
      expediteur,
      { OR: seuils.map((s) => ({ conversationId: s.conversationId, createdAt: { gt: s.depuis } })) },
    ],
  };
}

/**
 * Décompte des non-lus par conversation, en UNE seule requête (au lieu d'un
 * count par fil). Renvoie une Map conversationId → nombre de messages non lus.
 */
export async function compterNonLusParFil(expediteur: Prisma.MessageWhereInput, seuils: SeuilLecture[]): Promise<Map<number, number>> {
  const compte = new Map<number, number>();
  if (seuils.length === 0) return compte;
  const groupes = await prisma.message.groupBy({
    by: ["conversationId"],
    where: whereNonLus(expediteur, seuils),
    _count: { _all: true },
  });
  for (const g of groupes) compte.set(g.conversationId, g._count._all);
  return compte;
}

/** Total des non-lus sur l'ensemble des fils, en UNE seule requête. */
export async function totalNonLus(expediteur: Prisma.MessageWhereInput, seuils: SeuilLecture[]): Promise<number> {
  if (seuils.length === 0) return 0;
  return prisma.message.count({ where: whereNonLus(expediteur, seuils) });
}
