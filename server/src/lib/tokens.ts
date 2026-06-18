import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Role, User } from "@prisma/client";
import { prisma } from "../prisma.js";
import { env } from "../env.js";

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** Jeton d'accès court (JWT). `tv` = version de session : un changement de mot
 *  de passe l'incrémente et invalide les jetons d'accès déjà émis (cf. requireAuth). */
export function signerAccessToken(user: { id: number; role: Role; tokenVersion: number }) {
  return jwt.sign(
    { sub: user.id, role: user.role, tv: user.tokenVersion },
    env.jwtSecret,
    { expiresIn: env.accessTtl, algorithm: "HS256" } as jwt.SignOptions
  );
}

/** Crée et stocke (haché) un refresh token opaque ; renvoie le jeton en clair. */
export async function creerRefreshToken(userId: number) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + env.refreshTtlDays * 86_400_000);
  await prisma.refreshToken.create({ data: { tokenHash: hash(token), userId, expiresAt } });
  return token;
}

/** Émet la paire access + refresh pour un utilisateur. */
export async function emettrePaire(user: User) {
  return {
    token: signerAccessToken(user),
    refreshToken: await creerRefreshToken(user.id),
    user: { id: user.id, nom: user.nom, email: user.email, role: user.role },
  };
}

/** Échange un refresh valide contre une nouvelle paire (rotation). */
export async function rafraichir(rawRefresh: string) {
  const stocke = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(rawRefresh) }, include: { user: true } });
  if (!stocke) return null;
  // Détection de rejeu d'un refresh DÉJÀ révoqué (déjà tourné ou déconnecté).
  // Un rejeu QUASI IMMÉDIAT (< 30 s) est presque toujours bénin — retry réseau,
  // double soumission, requête hors-ligne rejouée — on rejette sans punir.
  // Un rejeu TARDIF signale un jeton volé → on révoque TOUTE la famille
  // (invalide aussi la session de l'attaquant) sans déconnecter tous les
  // appareils sur une simple répétition légitime.
  if (stocke.revoked) {
    const FENETRE_GRACE_MS = 30_000;
    const rejeuRecent = stocke.revokedAt != null && Date.now() - stocke.revokedAt.getTime() < FENETRE_GRACE_MS;
    if (!rejeuRecent) await revoquerTousLesJetons(stocke.userId);
    return null;
  }
  if (stocke.expiresAt < new Date() || !stocke.user.actif) return null;
  // Rotation : on révoque l'ancien (horodaté) et on en émet un nouveau.
  await prisma.refreshToken.update({ where: { id: stocke.id }, data: { revoked: true, revokedAt: new Date() } });
  return emettrePaire(stocke.user);
}

/** Révoque un refresh token (déconnexion). */
export async function revoquer(rawRefresh: string) {
  await prisma.refreshToken.updateMany({ where: { tokenHash: hash(rawRefresh) }, data: { revoked: true, revokedAt: new Date() } });
}

/** Révoque tous les refresh tokens d'un utilisateur (reset de mot de passe, désactivation). */
export async function revoquerTousLesJetons(userId: number) {
  await prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true, revokedAt: new Date() } });
}
