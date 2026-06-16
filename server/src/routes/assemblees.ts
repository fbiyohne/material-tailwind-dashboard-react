import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { envoyerPdf } from "../lib/pdf.js";
import { archiver } from "../lib/business.js";
import { convocationAgHtml, pvAssembleeHtml } from "../lib/templates.js";

export const assembleesRouter = Router();
// Module institutionnel : lecture SG/Bâtonnier (l'agenda public passe par /dashboard/agenda).
assembleesRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "BATONNIER"));

/** GET /assemblees/:id/convocation/pdf — convocation d'AG (PDF) + archivage auto (RG-14). */
assembleesRouter.get("/:id/convocation/pdf", asyncH(async (req, res) => {
  const a = await prisma.assemblee.findUnique({ where: { id: Number(req.params.id) } });
  if (!a) throw new HttpError(404, "Assemblée introuvable");
  const jour = String(a.date).slice(0, 10);
  await archiver({ categorie: "Convocation", titre: `Convocation ${a.type} du ${jour}`, reference: `CONV-${a.type}-${jour}`, date: new Date() });
  await envoyerPdf(res, convocationAgHtml(a), `Convocation-${a.type}-${jour}.pdf`);
}));

/** GET /assemblees/:id/pv/pdf — procès-verbal d'AG (PDF) + archivage auto. */
assembleesRouter.get("/:id/pv/pdf", asyncH(async (req, res) => {
  const a = await prisma.assemblee.findUnique({ where: { id: Number(req.params.id) } });
  if (!a) throw new HttpError(404, "Assemblée introuvable");
  const jour = String(a.date).slice(0, 10);
  await archiver({ categorie: "Procès-verbal", titre: `PV ${a.type} du ${jour}`, reference: `${a.type}-${jour}`, date: new Date() });
  await envoyerPdf(res, pvAssembleeHtml(a), `PV-${a.type}-${jour}.pdf`);
}));

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

/** DELETE /assemblees/:id — suppression d'une assemblée convoquée (jamais une AG tenue). SG. */
assembleesRouter.delete("/:id", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const a = await prisma.assemblee.findUnique({ where: { id: Number(req.params.id) } });
  if (!a) throw new HttpError(404, "Assemblée introuvable");
  if (a.statut === "tenue") throw new HttpError(409, "Une assemblée tenue ne peut être supprimée (procès-verbal archivé).");
  await prisma.assemblee.delete({ where: { id: a.id } });
  res.json({ ok: true });
}));
