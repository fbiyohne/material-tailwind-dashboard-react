import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

/**
 * Composition du Conseil de l'Ordre — alimente les feuilles de présence des
 * réunions (FR-REU). Donnée institutionnelle : lecture SG/Bâtonnier.
 */
export const conseilRouter = Router();
conseilRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "BATONNIER"));

/** GET /conseil — membres actifs du Conseil, ordonnés. */
conseilRouter.get(
  "/",
  asyncH(async (_req, res) => {
    const membres = await prisma.membreConseil.findMany({
      where: { actif: true },
      orderBy: { ordre: "asc" },
    });
    res.json(membres);
  })
);
