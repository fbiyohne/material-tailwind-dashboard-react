import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";

/** Erreur HTTP applicative. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Enrobe un handler async pour propager les erreurs au middleware. */
export const asyncH =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

/** Middleware centralisé de gestion des erreurs. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ erreur: "Données invalides", details: err.flatten() });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ erreur: err.message });
  }
  // Erreur non maîtrisée : journalisée avec l'id de corrélation de la requête.
  (req.log ?? logger).error({ err }, "Erreur interne non gérée");
  return res.status(500).json({ erreur: "Erreur interne du serveur" });
}
