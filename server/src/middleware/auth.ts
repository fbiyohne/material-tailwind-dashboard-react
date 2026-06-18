import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { HttpError } from "./error.js";

export interface AuthUser {
  id: number;
  role: Role;
  /** Pour un compte de rôle AVOCAT : sa fiche Membre (sert au cloisonnement). */
  membreId?: number | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

/**
 * Vérifie le JWT (Authorization: Bearer …), confirme que le compte existe
 * toujours et reste actif, puis attache req.user (rôle relu en base, donc à
 * jour même après changement). Un compte désactivé perd l'accès immédiatement.
 */
export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "Authentification requise"));
  }
  let payload: { sub: number; role: Role; tv?: number };
  try {
    payload = jwt.verify(header.slice(7), env.jwtSecret, { algorithms: ["HS256"] }) as unknown as { sub: number; role: Role; tv?: number };
  } catch {
    return next(new HttpError(401, "Jeton invalide ou expiré"));
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, actif: true, membreId: true, tokenVersion: true },
    });
    if (!user || !user.actif) {
      return next(new HttpError(401, "Compte introuvable ou désactivé"));
    }
    // Invalidation des jetons d'accès émis avant un changement de mot de passe :
    // la version de session du jeton doit correspondre à celle du compte.
    if ((payload.tv ?? 0) !== user.tokenVersion) {
      return next(new HttpError(401, "Session expirée, veuillez vous reconnecter"));
    }
    req.user = { id: user.id, role: user.role, membreId: user.membreId };
    next();
  } catch (e) {
    next(e);
  }
}

/** Restreint l'accès à certains rôles (l'ADMIN est toujours autorisé). RG-13. */
export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Authentification requise"));
    if (req.user.role === "ADMIN" || roles.includes(req.user.role)) return next();
    next(new HttpError(403, "Accès refusé pour votre profil"));
  };
}

/**
 * Réserve une route à l'espace avocat : exige le rôle AVOCAT ET un membreId
 * rattaché. Contrairement à requireRole, l'ADMIN n'est PAS admis ici (il n'a pas
 * de fiche Membre) : l'espace ne sert que les avocats eux-mêmes.
 */
export function requireAvocat(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Authentification requise"));
  if (req.user.role !== "AVOCAT" || !req.user.membreId) {
    return next(new HttpError(403, "Accès réservé à l'espace avocat"));
  }
  next();
}

/**
 * Cloisonnement global (défense en profondeur) : un jeton de rôle AVOCAT n'est
 * autorisé que sur l'espace (/api/espace/*) et l'authentification (/api/auth/*).
 * Toute autre route du back-office lui est interdite, sans avoir à protéger
 * chaque route individuellement. Monté sur le préfixe « /api » : req.path est
 * donc relatif (ex. « /espace/moi »). Les jetons non-AVOCAT (ou absents) passent
 * et sont traités normalement par requireAuth/requireRole.
 */
export function confinementAvocat(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  let payload: { role?: Role };
  try {
    payload = jwt.verify(header.slice(7), env.jwtSecret, { algorithms: ["HS256"] }) as unknown as { role?: Role };
  } catch {
    return next(); // jeton invalide : laisse requireAuth renvoyer 401
  }
  if (payload.role !== "AVOCAT") return next();
  if (req.path.startsWith("/espace") || req.path.startsWith("/auth")) return next();
  next(new HttpError(403, "Accès réservé à l'espace avocat"));
}
