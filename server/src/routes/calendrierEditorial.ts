import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth.js";

/**
 * Calendrier éditorial mensuel de la Lettre du Bâtonnier (FR-BAT).
 * Module Documents (institutionnel) : lecture SG/Bâtonnier.
 */
export const calendrierEditorialRouter = Router();
calendrierEditorialRouter.use(requireAuth, requirePermission("documents"));

/** GET /calendrier-editorial — entrées du calendrier (thème + article persisté), ordonnées. */
calendrierEditorialRouter.get(
  "/",
  asyncH(async (_req, res) => {
    const entrees = await prisma.calendrierEditorial.findMany({ orderBy: { ordre: "asc" } });
    res.json(entrees);
  })
);

const majSchema = z.object({
  texte: z.string(),
  // "a_rediger" | "redige" | "publie" — l'UI ne persiste que redige/publie.
  statut: z.enum(["a_rediger", "redige", "publie"]).optional(),
  simule: z.boolean().optional(),
});

/**
 * PATCH /calendrier-editorial/:mois — enregistre (ou publie) l'article d'un mois.
 * Persiste le texte amendé par le Bâtonnier pour qu'il survive au rechargement.
 */
calendrierEditorialRouter.patch(
  "/:mois",
  asyncH(async (req, res) => {
    const mois = req.params.mois;
    const data = majSchema.parse(req.body);
    const entree = await prisma.calendrierEditorial.findUnique({ where: { mois } });
    if (!entree) throw new HttpError(404, "Mois introuvable au calendrier éditorial.");
    const maj = await prisma.calendrierEditorial.update({
      where: { mois },
      data: {
        texte: data.texte,
        ...(data.statut ? { statut: data.statut } : {}),
        ...(data.simule !== undefined ? { simule: data.simule } : {}),
        dateMaj: new Date(),
      },
    });
    res.json(maj);
  })
);
