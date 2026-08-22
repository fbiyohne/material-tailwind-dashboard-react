import type { Request } from "express";
import { HttpError } from "../middleware/error.js";

/**
 * Année d'exercice lue depuis la query string, avec repli sur l'année courante.
 * Rejette une valeur non entière (ex. `?annee=abc` → NaN) par un 400 propre, au
 * lieu de la laisser se propager jusqu'à Prisma (filtre vide en lecture, ou pire,
 * ligne `annee: NaN` persistée par une génération en lot).
 */
export function anneeDeRequete(req: Request): number {
  const brut = req.query.annee;
  if (brut === undefined || brut === "") return new Date().getFullYear();
  const n = Number(brut);
  if (!Number.isInteger(n) || n < 2000 || n > 2200) {
    throw new HttpError(400, "Paramètre « annee » invalide.");
  }
  return n;
}
