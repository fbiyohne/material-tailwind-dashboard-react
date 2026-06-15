import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const archivesRouter = Router();
// Archives institutionnelles (réf. financières + disciplinaires) : SG/Bâtonnier/Admin.
archivesRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "BATONNIER"));

const archiveSchema = z.object({
  categorie: z.string().min(1),
  titre: z.string().min(1),
  reference: z.string().min(1).optional(),
  date: z.coerce.date().optional(), // rejette une date invalide (400) au lieu de stocker Invalid Date
  membreNom: z.string().optional(),
});

/** POST /archives — archive manuelle d'un document généré (RG-14). */
archivesRouter.post(
  "/",
  asyncH(async (req, res) => {
    const { categorie, titre, reference, date, membreNom } = archiveSchema.parse(req.body);
    const a = await prisma.archive.create({
      data: { categorie, titre, reference, date: date ?? new Date(), membreNom },
    });
    res.status(201).json(a);
  })
);

/** GET /archives — recherche par mot-clé et catégorie (FR-ARC). */
archivesRouter.get(
  "/",
  asyncH(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const categorie = req.query.categorie as string | undefined;
    const archives = await prisma.archive.findMany({
      where: {
        ...(categorie && categorie !== "toutes" ? { categorie } : {}),
        ...(q ? { OR: [{ titre: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { archiveLe: "desc" },
    });
    const categories = await prisma.archive.findMany({ distinct: ["categorie"], select: { categorie: true } });
    res.json({ archives, categories: categories.map((c) => c.categorie) });
  })
);

/**
 * DELETE /archives/:id — retire une entrée du registre documentaire. Action
 * sensible réservée au Secrétaire Général ; la suppression est tracée par le
 * journal d'audit transverse (RG-16).
 */
archivesRouter.delete(
  "/:id",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const archive = await prisma.archive.findUnique({ where: { id } });
    if (!archive) throw new HttpError(404, "Archive introuvable");
    await prisma.archive.delete({ where: { id } });
    res.json({ ok: true, reference: archive.reference });
  })
);
