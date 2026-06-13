import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const assembleesRouter = Router();
assembleesRouter.use(requireAuth);

assembleesRouter.get("/", asyncH(async (_req, res) => {
  res.json(await prisma.assemblee.findMany({ orderBy: { date: "desc" } }));
}));

assembleesRouter.get("/:id", asyncH(async (req, res) => {
  const a = await prisma.assemblee.findUnique({ where: { id: Number(req.params.id) } });
  if (!a) throw new HttpError(404, "Assemblée introuvable");
  res.json(a);
}));

const creerSchema = z.object({
  type: z.enum(["AGO", "AGE"]),
  date: z.string(),
  lieu: z.string().optional(),
  ordreDuJour: z.array(z.string()).default([]),
});

assembleesRouter.post("/", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const data = creerSchema.parse(req.body);
  const a = await prisma.assemblee.create({ data: { ...data, date: new Date(data.date) } });
  res.status(201).json(a);
}));

const patchSchema = z.object({
  lieu: z.string().optional(),
  ordreDuJour: z.array(z.string()).optional(),
  quorumPresent: z.number().int().optional(),
  statut: z.string().optional(),
  decisions: z.array(z.string()).optional(),
  pv: z.string().optional(),
});

assembleesRouter.patch("/:id", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const data = patchSchema.parse(req.body);
  const a = await prisma.assemblee.update({ where: { id: Number(req.params.id) }, data });
  res.json(a);
}));
