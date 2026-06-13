import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { prochaineReferenceDossier } from "../lib/business.js";
import { htmlVersPdf } from "../lib/pdf.js";
import { convocationDisciplineHtml } from "../lib/templates.js";

export const disciplineRouter = Router();
// Accès restreint SG / Bâtonnier / Admin, journalisé (RG-13).
disciplineRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "BATONNIER"));

const journaliser = (action: string, userId?: number) =>
  prisma.journalDiscipline.create({ data: { action, userId } });

disciplineRouter.get(
  "/",
  asyncH(async (req: AuthRequest, res) => {
    await journaliser("Consultation du module Discipline", req.user!.id);
    res.json(await prisma.dossierDisciplinaire.findMany({ orderBy: { id: "desc" } }));
  })
);

disciplineRouter.get(
  "/journal",
  asyncH(async (_req, res) => {
    res.json(await prisma.journalDiscipline.findMany({ orderBy: { id: "desc" }, take: 50 }));
  })
);

disciplineRouter.get(
  "/:id",
  asyncH(async (req: AuthRequest, res) => {
    const d = await prisma.dossierDisciplinaire.findUnique({ where: { id: Number(req.params.id) } });
    if (!d) throw new HttpError(404, "Dossier introuvable");
    await journaliser(`Consultation du dossier ${d.reference}`, req.user!.id);
    res.json(d);
  })
);

const ouvrirSchema = z.object({
  avocatNom: z.string().min(1),
  objet: z.string().min(1),
  dateSaisine: z.string().optional(),
  membreId: z.number().int().optional(),
});

/** Ouverture d'un dossier — référence unique AAAA-NN (BR-06 / RG-12). */
disciplineRouter.post(
  "/",
  asyncH(async (req: AuthRequest, res) => {
    const data = ouvrirSchema.parse(req.body);
    const reference = await prochaineReferenceDossier(new Date().getFullYear());
    const dossier = await prisma.dossierDisciplinaire.create({
      data: {
        reference,
        avocatNom: data.avocatNom,
        objet: data.objet,
        dateSaisine: data.dateSaisine ? new Date(data.dateSaisine) : new Date(),
        membreId: data.membreId ?? null,
      },
    });
    await journaliser(`Ouverture du dossier ${reference} — ${data.avocatNom}`, req.user!.id);
    res.status(201).json(dossier);
  })
);

const patchSchema = z.object({
  statut: z.enum(["OUVERT", "INSTRUCTION", "AUDIENCE", "DECISION", "CLASSE"]).optional(),
  dateConvocation: z.string().optional(),
  dateAudience: z.string().optional(),
  decision: z.string().optional(),
  sanction: z.string().optional(),
});

disciplineRouter.patch(
  "/:id",
  asyncH(async (req: AuthRequest, res) => {
    const data = patchSchema.parse(req.body);
    const dossier = await prisma.dossierDisciplinaire.update({
      where: { id: Number(req.params.id) },
      data: {
        statut: data.statut,
        decision: data.decision,
        sanction: data.sanction,
        dateConvocation: data.dateConvocation ? new Date(data.dateConvocation) : undefined,
        dateAudience: data.dateAudience ? new Date(data.dateAudience) : undefined,
      },
    });
    await journaliser(`Mise à jour du dossier ${dossier.reference}`, req.user!.id);
    res.json(dossier);
  })
);

/** GET /discipline/:id/convocation/pdf — convocation disciplinaire (PDF), journalisée. */
disciplineRouter.get(
  "/:id/convocation/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const d = await prisma.dossierDisciplinaire.findUnique({ where: { id: Number(req.params.id) } });
    if (!d) throw new HttpError(404, "Dossier introuvable");
    await journaliser(`Génération convocation — dossier ${d.reference}`, req.user!.id);
    const pdf = await htmlVersPdf(convocationDisciplineHtml(d));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Convocation-disciplinaire-${d.reference}.pdf"`);
    res.end(pdf);
  })
);
