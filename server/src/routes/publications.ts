import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { genererArticleLettre, iaDisponible } from "../lib/ia.js";

export const publicationsRouter = Router();
publicationsRouter.use(requireAuth);

/** POST /publications/lettre/generer — projet d'article IA (FR-BAT-01 / CDC §2.15). */
const lettreSchema = z.object({ mois: z.string().min(1), theme: z.string().min(1) });
publicationsRouter.post(
  "/lettre/generer",
  requireRole("SECRETAIRE_GENERAL", "BATONNIER"),
  asyncH(async (req, res) => {
    const { mois, theme } = lettreSchema.parse(req.body);
    const resultat = await genererArticleLettre(mois, theme);
    res.json({ ...resultat, iaDisponible });
  })
);

publicationsRouter.get("/", asyncH(async (_req, res) => {
  res.json(await prisma.publication.findMany({ orderBy: { id: "desc" } }));
}));

publicationsRouter.get("/:id", asyncH(async (req, res) => {
  const p = await prisma.publication.findUnique({ where: { id: Number(req.params.id) } });
  if (!p) throw new HttpError(404, "Publication introuvable");
  res.json(p);
}));

const creerSchema = z.object({ titre: z.string().min(1), type: z.string(), contenu: z.string().optional() });

publicationsRouter.post("/", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const data = creerSchema.parse(req.body);
  const p = await prisma.publication.create({ data: { ...data, statut: "A_VALIDER" } });
  res.status(201).json(p);
}));

publicationsRouter.patch("/:id", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const data = creerSchema.partial().parse(req.body);
  const p = await prisma.publication.update({ where: { id: Number(req.params.id) }, data });
  res.json(p);
}));

const statutSchema = z.object({ statut: z.enum(["BROUILLON", "A_VALIDER", "VALIDE", "PUBLIE"]) });

/** Workflow de validation : transition réservée SG/Bâtonnier ; VALIDE requiert le Bâtonnier. */
publicationsRouter.post("/:id/statut", requireRole("SECRETAIRE_GENERAL", "BATONNIER"), asyncH(async (req, res) => {
  const { statut } = statutSchema.parse(req.body);
  const role = (req as any).user?.role;
  if (statut === "VALIDE" && role !== "BATONNIER" && role !== "ADMIN") {
    throw new HttpError(403, "Seul le Bâtonnier peut valider une publication");
  }
  const p = await prisma.publication.update({ where: { id: Number(req.params.id) }, data: { statut } });
  res.json(p);
}));
