import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { HttpError } from "./error.js";

export interface AuthUser {
  id: number;
  role: Role;
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
  let payload: { sub: number; role: Role };
  try {
    payload = jwt.verify(header.slice(7), env.jwtSecret) as unknown as { sub: number; role: Role };
  } catch {
    return next(new HttpError(401, "Jeton invalide ou expiré"));
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, actif: true },
    });
    if (!user || !user.actif) {
      return next(new HttpError(401, "Compte introuvable ou désactivé"));
    }
    req.user = { id: user.id, role: user.role };
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
