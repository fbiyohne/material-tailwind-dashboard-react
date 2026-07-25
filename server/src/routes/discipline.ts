import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { prochaineReferenceDossier, archiver, avecRejeuUnicite } from "../lib/business.js";
import { envoyerPdf } from "../lib/pdf.js";
import { convocationDisciplineHtml, decisionDisciplineHtml } from "../lib/templates.js";

export const disciplineRouter = Router();
// Accès restreint SG / Bâtonnier / Admin, journalisé (RG-13).
disciplineRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "BATONNIER"));

const journaliser = (action: string, userId?: number) =>
  prisma.journalDiscipline.create({ data: { action, userId } });

disciplineRouter.get(
  "/",
  asyncH(async (req: AuthRequest, res) => {
    // Filtre par membre = consultation du casier disciplinaire d'un avocat :
    // journalisée au même titre que les autres accès (RG-13 — la lecture ciblée
    // du casier est la vue la plus sensible, elle doit être tracée).
    const membreId = req.query.membreId ? Number(req.query.membreId) : undefined;
    if (membreId) {
      await journaliser(`Consultation du casier disciplinaire (membre #${membreId})`, req.user!.id);
      res.json(await prisma.dossierDisciplinaire.findMany({ where: { membreId }, orderBy: { id: "desc" } }));
      return;
    }
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
  plaignant: z.string().max(200).optional(),
  rapporteur: z.string().max(200).optional(),
  dateSaisine: z.string().optional(),
  membreId: z.number().int().optional(),
});

/** Ouverture d'un dossier — référence unique AAAA-NN (BR-06 / RG-12). */
disciplineRouter.post(
  "/",
  asyncH(async (req: AuthRequest, res) => {
    const data = ouvrirSchema.parse(req.body);
    // Rejeu sur collision : deux ouvertures concurrentes la même année calculeraient
    // la même référence AAAA-NN (max+1) ; @unique(reference) rejette → on recalcule.
    const dossier = await avecRejeuUnicite(async () => {
      const reference = await prochaineReferenceDossier(new Date().getFullYear());
      return prisma.dossierDisciplinaire.create({
        data: {
          reference,
          avocatNom: data.avocatNom,
          objet: data.objet,
          plaignant: data.plaignant,
          rapporteur: data.rapporteur,
          dateSaisine: data.dateSaisine ? new Date(data.dateSaisine) : new Date(),
          membreId: data.membreId ?? null,
        },
      });
    });
    await journaliser(`Ouverture du dossier ${dossier.reference} — ${data.avocatNom}`, req.user!.id);
    res.status(201).json(dossier);
  })
);

const patchSchema = z.object({
  statut: z.enum(["OUVERT", "INSTRUCTION", "AUDIENCE", "DECISION", "CLASSE"]).optional(),
  plaignant: z.string().max(200).optional(),
  rapporteur: z.string().max(200).optional(),
  dateConvocation: z.string().optional(),
  dateAudience: z.string().optional(),
  decision: z.string().optional(),
  sanction: z.string().optional(),
  recours: z.string().max(500).optional(),
  dateRecours: z.string().optional(),
  pieces: z.array(z.string()).optional(),
});

disciplineRouter.patch(
  "/:id",
  asyncH(async (req: AuthRequest, res) => {
    const data = patchSchema.parse(req.body);
    const dossier = await prisma.dossierDisciplinaire.update({
      where: { id: Number(req.params.id) },
      data: {
        statut: data.statut,
        plaignant: data.plaignant,
        rapporteur: data.rapporteur,
        decision: data.decision,
        sanction: data.sanction,
        recours: data.recours,
        pieces: data.pieces,
        dateConvocation: data.dateConvocation ? new Date(data.dateConvocation) : undefined,
        dateAudience: data.dateAudience ? new Date(data.dateAudience) : undefined,
        dateRecours: data.dateRecours ? new Date(data.dateRecours) : undefined,
      },
    });
    await journaliser(`Mise à jour du dossier ${dossier.reference}`, req.user!.id);
    res.json(dossier);
  })
);

/**
 * DELETE /discipline/:id — suppression définitive d'un dossier disciplinaire.
 * Action sensible réservée au super-administrateur (ADMIN), journalisée.
 */
disciplineRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncH(async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const d = await prisma.dossierDisciplinaire.findUnique({ where: { id } });
    if (!d) throw new HttpError(404, "Dossier introuvable");
    await prisma.dossierDisciplinaire.delete({ where: { id } });
    await journaliser(`Suppression du dossier ${d.reference}`, req.user!.id);
    res.json({ ok: true, reference: d.reference });
  })
);

/** GET /discipline/:id/convocation/pdf — convocation disciplinaire (PDF), journalisée + archivée (RG-14). */
disciplineRouter.get(
  "/:id/convocation/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const d = await prisma.dossierDisciplinaire.findUnique({ where: { id: Number(req.params.id) } });
    if (!d) throw new HttpError(404, "Dossier introuvable");
    await journaliser(`Génération convocation — dossier ${d.reference}`, req.user!.id);
    await archiver({ categorie: "Convocation disciplinaire", titre: `Convocation — dossier ${d.reference}`, reference: d.reference, date: new Date() });
    await envoyerPdf(res, convocationDisciplineHtml(d), `Convocation-disciplinaire-${d.reference}.pdf`);
  })
);

/** GET /discipline/:id/decision/pdf — décision disciplinaire (PDF sécurisé), journalisée + archivée. */
disciplineRouter.get(
  "/:id/decision/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const d = await prisma.dossierDisciplinaire.findUnique({ where: { id: Number(req.params.id) } });
    if (!d) throw new HttpError(404, "Dossier introuvable");
    await journaliser(`Génération décision — dossier ${d.reference}`, req.user!.id);
    await archiver({ categorie: "Décision disciplinaire", titre: `Décision — dossier ${d.reference}`, reference: d.reference, date: new Date() });
    await envoyerPdf(res, decisionDisciplineHtml(d), `Decision-disciplinaire-${d.reference}.pdf`);
  })
);
