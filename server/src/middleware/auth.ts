import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../env.js";
import { HttpError } from "./error.js";

export interface AuthUser {
  id: number;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

/** Vérifie le JWT (Authorization: Bearer …) et attache req.user. */
export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "Authentification requise"));
  }
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as { sub: number; role: Role };
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new HttpError(401, "Jeton invalide ou expiré"));
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
