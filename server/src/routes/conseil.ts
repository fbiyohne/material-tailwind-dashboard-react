import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

/**
 * Composition du Conseil de l'Ordre — alimente les feuilles de présence des
 * réunions (FR-REU). Lecture SG/Bâtonnier ; gestion (mandats) réservée au SG.
 * La composition est recomposée automatiquement à la publication d'une élection.
 */
export const conseilRouter = Router();
conseilRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "BATONNIER"));

/** GET /conseil — membres du Conseil (actifs par défaut ; `?tous=1` pour l'historique). */
conseilRouter.get(
  "/",
  asyncH(async (req, res) => {
    const tous = req.query.tous === "1" || req.query.tous === "true";
    res.json(await prisma.membreConseil.findMany({ where: tous ? {} : { actif: true }, orderBy: [{ actif: "desc" }, { ordre: "asc" }] }));
  })
);

const conseilSchema = z.object({
  nom: z.string().trim().min(1).max(160),
  fonction: z.string().trim().min(1).max(120),
  ordre: z.number().int().min(0).default(0),
  membreId: z.number().int().positive().nullable().optional(),
  mandatDebut: z.string().optional(),
  mandatFin: z.string().optional(),
});

const dateOpt = (s?: string) => (s ? new Date(s) : undefined);

/** POST /conseil — ajoute un membre du Conseil (SG). */
conseilRouter.post(
  "/",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const d = conseilSchema.parse(req.body);
    res.status(201).json(await prisma.membreConseil.create({
      data: { nom: d.nom, fonction: d.fonction, ordre: d.ordre, membreId: d.membreId ?? null, mandatDebut: dateOpt(d.mandatDebut) ?? null, mandatFin: dateOpt(d.mandatFin) ?? null },
    }));
  })
);

const conseilPatch = conseilSchema.partial().extend({ actif: z.boolean().optional() });

/** PATCH /conseil/:id — met à jour fonction / ordre / mandat / activité (SG). */
conseilRouter.patch(
  "/:id",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const d = conseilPatch.parse(req.body);
    res.json(await prisma.membreConseil.update({
      where: { id: Number(req.params.id) },
      data: {
        nom: d.nom,
        fonction: d.fonction,
        ordre: d.ordre,
        actif: d.actif,
        membreId: d.membreId === undefined ? undefined : d.membreId,
        mandatDebut: dateOpt(d.mandatDebut),
        mandatFin: dateOpt(d.mandatFin),
      },
    }));
  })
);

/** DELETE /conseil/:id — retire un membre du Conseil (SG). */
conseilRouter.delete(
  "/:id",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    await prisma.membreConseil.delete({ where: { id: Number(req.params.id) } });
    res.status(204).end();
  })
);
