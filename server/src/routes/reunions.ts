import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const reunionsRouter = Router();
reunionsRouter.use(requireAuth);

reunionsRouter.get("/", asyncH(async (_req, res) => {
  res.json(await prisma.reunion.findMany({ orderBy: { date: "desc" } }));
}));

reunionsRouter.get("/:id", asyncH(async (req, res) => {
  const r = await prisma.reunion.findUnique({ where: { id: Number(req.params.id) } });
  if (!r) throw new HttpError(404, "Réunion introuvable");
  res.json(r);
}));

const creerSchema = z.object({
  date: z.string(),
  heure: z.string().optional(),
  lieu: z.string().optional(),
  ordreDuJour: z.array(z.string()).default([]),
});

reunionsRouter.post("/", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const data = creerSchema.parse(req.body);
  const r = await prisma.reunion.create({ data: { ...data, date: new Date(data.date) } });
  res.status(201).json(r);
}));

const patchSchema = z.object({
  heure: z.string().optional(),
  lieu: z.string().optional(),
  ordreDuJour: z.array(z.string()).optional(),
  statut: z.string().optional(),
  pv: z.string().optional(),
  presences: z.any().optional(),
});

reunionsRouter.patch("/:id", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const data = patchSchema.parse(req.body);
  const r = await prisma.reunion.update({ where: { id: Number(req.params.id) }, data });
  res.json(r);
}));
