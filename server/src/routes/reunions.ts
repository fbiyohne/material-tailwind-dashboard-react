import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { htmlVersPdf } from "../lib/pdf.js";
import { convocationReunionHtml, feuillePresenceHtml } from "../lib/templates.js";

export const reunionsRouter = Router();
reunionsRouter.use(requireAuth);

const envoyerPdf = (res: any, pdf: Buffer, filename: string) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.end(pdf);
};

reunionsRouter.get("/:id/convocation/pdf", asyncH(async (req, res) => {
  const r = await prisma.reunion.findUnique({ where: { id: Number(req.params.id) } });
  if (!r) throw new HttpError(404, "Réunion introuvable");
  envoyerPdf(res, await htmlVersPdf(convocationReunionHtml(r)), `Convocation-reunion-${String(r.date).slice(0, 10)}.pdf`);
}));

reunionsRouter.get("/:id/feuille-presence/pdf", asyncH(async (req, res) => {
  const r = await prisma.reunion.findUnique({ where: { id: Number(req.params.id) } });
  if (!r) throw new HttpError(404, "Réunion introuvable");
  envoyerPdf(res, await htmlVersPdf(feuillePresenceHtml(r)), `Feuille-presence-${String(r.date).slice(0, 10)}.pdf`);
}));

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
