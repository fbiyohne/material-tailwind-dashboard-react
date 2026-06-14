import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

/**
 * Calendrier éditorial mensuel de la Lettre du Bâtonnier (FR-BAT).
 * Module Documents (institutionnel) : lecture SG/Bâtonnier.
 */
export const calendrierEditorialRouter = Router();
calendrierEditorialRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "BATONNIER"));

/** GET /calendrier-editorial — entrées du calendrier, ordonnées. */
calendrierEditorialRouter.get(
  "/",
  asyncH(async (_req, res) => {
    const entrees = await prisma.calendrierEditorial.findMany({ orderBy: { ordre: "asc" } });
    res.json(entrees);
  })
);
