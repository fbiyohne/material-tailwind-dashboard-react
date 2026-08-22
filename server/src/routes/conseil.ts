import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth.js";

/**
 * Composition du Conseil de l'Ordre — alimente les feuilles de présence des
 * réunions (FR-REU). Lecture SG/Bâtonnier ; gestion (mandats) réservée au SG.
 * La composition est recomposée automatiquement à la publication d'une élection.
 */
export const conseilRouter = Router();
conseilRouter.use(requireAuth, requirePermission("elections"));

/**
 * GET /conseil — membres du Conseil (actifs par défaut ; `?tous=1` pour l'historique).
 * Chaque siège rattaché à un avocat est enrichi de `anciennete` (date de serment),
 * ce qui permet à l'écran de classer les membres par ancienneté.
 */
conseilRouter.get(
  "/",
  asyncH(async (req, res) => {
    const tous = req.query.tous === "1" || req.query.tous === "true";
    const lignes = await prisma.membreConseil.findMany({
      where: tous ? {} : { actif: true },
      orderBy: [{ actif: "desc" }, { ordre: "asc" }],
    });
    const ids = [...new Set(lignes.map((l) => l.membreId).filter((v): v is number => v != null))];
    const serments = ids.length
      ? Object.fromEntries(
          (await prisma.membre.findMany({ where: { id: { in: ids } }, select: { id: true, dateServment: true } }))
            .map((m) => [m.id, m.dateServment]),
        )
      : {};
    res.json(lignes.map((l) => ({ ...l, anciennete: l.membreId != null ? serments[l.membreId] ?? null : null })));
  })
);

const conseilSchema = z.object({
  nom: z.string().trim().min(1).max(160),
  fonction: z.string().trim().min(1).max(120),
  role: z.enum(["batonnier", "bureau", "membre"]).default("membre"),
  sigle: z.string().trim().max(12).nullable().optional(),
  ordre: z.number().int().min(0).default(0),
  motifSortie: z.string().trim().max(200).nullable().optional(),
  membreId: z.number().int().positive().nullable().optional(),
  mandatDebut: z.string().nullable().optional(),
  mandatFin: z.string().nullable().optional(),
});

// undefined → champ inchangé ; null → effacé ; chaîne → date. Permet au
// rétablissement d'un siège sortant d'effacer la date de fin de mandat.
const dateField = (v?: string | null) => (v === undefined ? undefined : v === null ? null : new Date(v));

/** POST /conseil — ajoute un membre du Conseil (SG). */
conseilRouter.post(
  "/",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const d = conseilSchema.parse(req.body);
    res.status(201).json(await prisma.membreConseil.create({
      data: {
        nom: d.nom, fonction: d.fonction, role: d.role,
        sigle: d.role === "bureau" ? d.sigle ?? null : null,
        ordre: d.ordre, membreId: d.membreId ?? null,
        mandatDebut: dateField(d.mandatDebut) ?? null, mandatFin: dateField(d.mandatFin) ?? null,
      },
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
        role: d.role,
        // Le sigle n'a de sens que pour un membre du bureau ; sinon il est effacé.
        sigle: d.role === undefined ? undefined : d.role === "bureau" ? d.sigle ?? null : null,
        ordre: d.ordre,
        actif: d.actif,
        motifSortie: d.motifSortie === undefined ? undefined : d.motifSortie,
        membreId: d.membreId === undefined ? undefined : d.membreId,
        mandatDebut: dateField(d.mandatDebut),
        mandatFin: dateField(d.mandatFin),
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
