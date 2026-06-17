import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { lireFichier, supprimerFichier } from "../lib/storage.js";

/**
 * Pièces du dossier d'inscription — actions au niveau de la pièce.
 * Consultation du fichier : SG / Bâtonnier (données personnelles, RG-15).
 * Vérification / rejet / suppression : SG / Admin.
 */
export const piecesRouter = Router();
piecesRouter.use(requireAuth);

async function trouver(id: number) {
  const piece = await prisma.pieceDossier.findUnique({ where: { id } });
  if (!piece) throw new HttpError(404, "Pièce introuvable");
  return piece;
}

async function nomActeur(userId: number) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { nom: true } });
  return u?.nom ?? null;
}

const STATUTS_PIECE = ["A_VERIFIER", "VERIFIEE", "REJETEE"] as const;

/**
 * GET /pieces — file d'attente de vérification documentaire : toutes les pièces
 * (filtrables par statut), avec le membre rattaché. SG / Bâtonnier (RG-15).
 */
piecesRouter.get(
  "/",
  requireRole("SECRETAIRE_GENERAL", "BATONNIER"),
  asyncH(async (req, res) => {
    const statut = typeof req.query.statut === "string" ? req.query.statut : undefined;
    const where = statut && (STATUTS_PIECE as readonly string[]).includes(statut)
      ? { statut: statut as (typeof STATUTS_PIECE)[number] }
      : {};
    const pieces = await prisma.pieceDossier.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { membre: { select: { id: true, num: true, nom: true, qualite: true } } },
    });
    res.json(pieces);
  })
);

/** GET /pieces/:id/fichier — flux du fichier (consultation cloisonnée). */
piecesRouter.get(
  "/:id/fichier",
  requireRole("SECRETAIRE_GENERAL", "BATONNIER"),
  asyncH(async (req, res) => {
    const piece = await trouver(Number(req.params.id));
    const buffer = lireFichier(piece.fichier);
    res.setHeader("Content-Type", piece.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${piece.nomFichier.replace(/"/g, "")}"`);
    res.end(buffer);
  })
);

const noteSchema = z.object({ note: z.string().max(500).optional() });

/** POST /pieces/:id/verifier — marque la pièce vérifiée (SG / Admin). */
piecesRouter.post(
  "/:id/verifier",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req: AuthRequest, res) => {
    const piece = await trouver(Number(req.params.id));
    res.json(await prisma.pieceDossier.update({
      where: { id: piece.id },
      data: { statut: "VERIFIEE", verifieePar: await nomActeur(req.user!.id), verifieeAt: new Date(), note: null },
    }));
  })
);

/** POST /pieces/:id/rejeter — rejette la pièce avec motif (SG / Admin). */
piecesRouter.post(
  "/:id/rejeter",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req: AuthRequest, res) => {
    const { note } = noteSchema.parse(req.body ?? {});
    const piece = await trouver(Number(req.params.id));
    res.json(await prisma.pieceDossier.update({
      where: { id: piece.id },
      data: { statut: "REJETEE", verifieePar: await nomActeur(req.user!.id), verifieeAt: new Date(), note: note ?? null },
    }));
  })
);

/** DELETE /pieces/:id — supprime la pièce et son fichier (SG / Admin). */
piecesRouter.delete(
  "/:id",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const piece = await trouver(Number(req.params.id));
    supprimerFichier(piece.fichier);
    await prisma.pieceDossier.delete({ where: { id: piece.id } });
    res.status(204).end();
  })
);
