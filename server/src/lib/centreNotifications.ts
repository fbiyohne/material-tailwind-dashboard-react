import type { Role } from "@prisma/client";
import { prisma } from "../prisma.js";
import { realtimeMembres, realtimeAdministration } from "./realtime.js";

/** Réveille en temps réel les avocats destinataires (adressage par membreId). */
async function reveillerAvocats(userIds: number[]): Promise<void> {
  if (userIds.length === 0) return;
  const comptes = await prisma.user.findMany({ where: { id: { in: userIds }, membreId: { not: null } }, select: { membreId: true } });
  const membreIds = comptes.map((c) => c.membreId!).filter((id): id is number => id != null);
  if (membreIds.length) realtimeMembres(membreIds, { type: "notification" });
}

/**
 * Centre de notifications in-app. `notifier` crée une alerte par destinataire ;
 * les résolveurs ci-dessous traduisent une cible métier (administration, un
 * avocat, tous les avocats) en identifiants d'utilisateurs. Best-effort : une
 * notification ne doit jamais faire échouer l'action métier qui la déclenche —
 * les appelants utilisent `void notifier(...).catch(() => {})`.
 */

export interface EntreeNotification {
  type: string;
  titre: string;
  message: string;
  lien?: string;
}

/** Crée la notification pour chaque utilisateur destinataire (dédupliqués). */
export async function notifier(userIds: number[], entree: EntreeNotification): Promise<number> {
  const cibles = [...new Set(userIds.filter((id) => Number.isInteger(id)))];
  if (cibles.length === 0) return 0;
  await prisma.notification.createMany({
    data: cibles.map((userId) => ({ userId, type: entree.type, titre: entree.titre, message: entree.message, lien: entree.lien ?? null })),
  });
  // Réveil temps réel des surfaces concernées (la cloche rafraîchit son compteur) ;
  // le sondage HTTP côté client reste le filet de sécurité.
  realtimeAdministration({ type: "notification" });
  await reveillerAvocats(cibles);
  return cibles.length;
}

/** Utilisateurs actifs du back-office portant l'un des rôles indiqués. */
export async function usersParRole(roles: Role[]): Promise<number[]> {
  const users = await prisma.user.findMany({ where: { role: { in: roles }, actif: true }, select: { id: true } });
  return users.map((u) => u.id);
}

/** Administration destinataire des demandes entrantes : SG + Admin. */
export const usersSecretariat = () => usersParRole(["SECRETAIRE_GENERAL", "ADMIN"]);

/** Compte d'espace (rôle AVOCAT) rattaché à une fiche membre, s'il est actif. */
export async function userDeMembre(membreId: number): Promise<number | null> {
  const compte = await prisma.user.findFirst({ where: { membreId, role: "AVOCAT", actif: true }, select: { id: true } });
  return compte?.id ?? null;
}

/** Tous les comptes d'espace avocat actifs (diffusion à l'ensemble du barreau). */
export async function usersAvocats(): Promise<number[]> {
  const users = await prisma.user.findMany({ where: { role: "AVOCAT", actif: true }, select: { id: true } });
  return users.map((u) => u.id);
}

// — Consultation / marquage (partagés par les surfaces back-office et espace) —

/** Dernières notifications d'un utilisateur (plus récentes d'abord). */
export function listerNotifications(userId: number, limit = 20) {
  const take = Math.min(50, Math.max(1, Math.trunc(limit)));
  return prisma.notification.findMany({ where: { userId }, orderBy: { id: "desc" }, take });
}

/** Nombre de notifications non lues d'un utilisateur. */
export function compterNonLus(userId: number) {
  return prisma.notification.count({ where: { userId, lu: false } });
}

/** Marque une notification comme lue (uniquement si elle appartient à l'utilisateur). */
export async function marquerLu(userId: number, id: number): Promise<boolean> {
  const r = await prisma.notification.updateMany({ where: { id, userId }, data: { lu: true } });
  return r.count > 0;
}

/** Marque toutes les notifications de l'utilisateur comme lues. */
export async function marquerToutLu(userId: number): Promise<number> {
  const r = await prisma.notification.updateMany({ where: { userId, lu: false }, data: { lu: true } });
  return r.count;
}
