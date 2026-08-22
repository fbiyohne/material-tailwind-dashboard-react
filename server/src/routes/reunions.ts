import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth.js";
import { envoyerPdf } from "../lib/pdf.js";
import { archiver } from "../lib/business.js";
import { convocationReunionHtml, feuillePresenceHtml, pvReunionHtml } from "../lib/templates.js";
import { envoyerEmail } from "../lib/notifications.js";
import { emailEnSimulation } from "../lib/mail.js";

export const reunionsRouter = Router();
// Module institutionnel : lecture SG/Bâtonnier (l'agenda public passe par /dashboard/agenda).
reunionsRouter.use(requireAuth, requirePermission("reunions_assemblees"));

/** GET /reunions/:id/convocation/pdf — convocation (PDF) + archivage auto (RG-14). */
reunionsRouter.get("/:id/convocation/pdf", asyncH(async (req, res) => {
  const r = await prisma.reunion.findUnique({ where: { id: Number(req.params.id) } });
  if (!r) throw new HttpError(404, "Réunion introuvable");
  const jour = new Date(r.date).toISOString().slice(0, 10);
  await archiver({ categorie: "Convocation", titre: `Convocation réunion du ${jour}`, reference: `CONV-REU-${jour}`, date: new Date() });
  await envoyerPdf(res, convocationReunionHtml(r), `Convocation-reunion-${jour}.pdf`);
}));

/** POST /reunions/:id/convoquer — envoie la convocation par email aux membres du Conseil (SG). */
reunionsRouter.post("/:id/convoquer", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const r = await prisma.reunion.findUnique({ where: { id: Number(req.params.id) } });
  if (!r) throw new HttpError(404, "Réunion introuvable");
  const jour = new Date(r.date).toISOString().slice(0, 10);
  const odj = (r.ordreDuJour ?? []).map((p, i) => `${i + 1}. ${p}`).join("\n");
  // Destinataires : les membres du Conseil en exercice, rattachés à une fiche avec email.
  const sieges = await prisma.membreConseil.findMany({ where: { actif: true, membreId: { not: null } }, select: { membreId: true } });
  const ids = sieges.map((s) => s.membreId!).filter((v) => v != null);
  const membres = await prisma.membre.findMany({ where: { id: { in: ids }, email: { not: null } }, select: { nom: true, email: true } });
  let envoyes = 0;
  for (const m of membres) {
    await envoyerEmail({
      to: m.email!,
      subject: `Convocation — réunion du Conseil de l'Ordre du ${jour} · Barreau de Pointe-Noire`,
      text: `Maître ${m.nom},\n\nLe Bâtonnier convie les membres du Conseil de l'Ordre à la réunion du ${jour}${r.heure ? ` à ${r.heure}` : ""}${r.lieu ? `, au ${r.lieu}` : ""}.\n\nOrdre du jour :\n${odj || "—"}\n\nLe Secrétariat Général du Barreau de Pointe-Noire.`,
      evenement: "CONVOCATION",
    });
    envoyes += 1;
  }
  await archiver({ categorie: "Convocation (Conseil)", titre: `Convocation réunion du ${jour} — envoyée à ${envoyes} membre(s)`, reference: `CONV-REU-${jour}`, date: new Date() });
  res.json({ envoyes, total: membres.length, simulation: await emailEnSimulation() });
}));

reunionsRouter.get("/:id/feuille-presence/pdf", asyncH(async (req, res) => {
  const r = await prisma.reunion.findUnique({ where: { id: Number(req.params.id) } });
  if (!r) throw new HttpError(404, "Réunion introuvable");
  await envoyerPdf(res, feuillePresenceHtml(r), `Feuille-presence-${new Date(r.date).toISOString().slice(0, 10)}.pdf`);
}));

/** GET /reunions/:id/pv/pdf — procès-verbal (PDF) + archivage auto (RG-14). */
reunionsRouter.get("/:id/pv/pdf", asyncH(async (req, res) => {
  const r = await prisma.reunion.findUnique({ where: { id: Number(req.params.id) } });
  if (!r) throw new HttpError(404, "Réunion introuvable");
  const jour = new Date(r.date).toISOString().slice(0, 10);
  await archiver({ categorie: "Procès-verbal", titre: `PV réunion du ${jour}`, reference: `REU-${jour}`, date: new Date() });
  await envoyerPdf(res, pvReunionHtml(r), `PV-reunion-${jour}.pdf`);
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

/** DELETE /reunions/:id — suppression d'une réunion planifiée (jamais une réunion tenue). SG. */
reunionsRouter.delete("/:id", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const r = await prisma.reunion.findUnique({ where: { id: Number(req.params.id) } });
  if (!r) throw new HttpError(404, "Réunion introuvable");
  if (r.statut === "tenue") throw new HttpError(409, "Une réunion tenue ne peut être supprimée (procès-verbal archivé).");
  await prisma.reunion.delete({ where: { id: r.id } });
  res.json({ ok: true });
}));
