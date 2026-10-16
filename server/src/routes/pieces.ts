import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { lireFichier, supprimerFichier } from "../lib/storage.js";
import { tracerLectureAdmin } from "../middleware/audit.js";
import { notifier, userDeMembre } from "../lib/centreNotifications.js";

/**
 * Pièces du dossier d'inscription — actions au niveau de la pièce.
 * Consultation du fichier : SG / Bâtonnier (données personnelles, RG-15) et ADMIN :
 * accès ADMIN autorisé (décision du 16/10/2026), tracé dans JournalAudit (middleware/audit.ts).
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
    await tracerLectureAdmin(req, res);
    // Sécurité : ne rendre « inline » que des types sûrs et connus (PDF/images).
    // Le mimeType est saisi librement à l'upload ; servir un text/html en inline
    // (CSP désactivée en mono-service) exécuterait un script dans l'origine de l'app.
    // Tout le reste est forcé en téléchargement neutre, avec anti-sniffing.
    const INLINE_SUR = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"]);
    const sur = INLINE_SUR.has(piece.mimeType ?? "");
    const nom = piece.nomFichier.replace(/[\r\n"]/g, "");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", sur ? piece.mimeType! : "application/octet-stream");
    res.setHeader("Content-Disposition", `${sur ? "inline" : "attachment"}; filename="${nom}"`);
    res.end(buffer);
  })
);

// Motif obligatoire : l'avocat doit savoir quoi corriger (parcours 9).
const noteSchema = z.object({ note: z.string().trim().min(3).max(500) });

/** Alerte in-app de l'avocat (best-effort : n'échoue jamais l'action). */
function prevenir(membreId: number, type: string, titre: string, message: string) {
  void userDeMembre(membreId)
    .then((uid) => (uid ? notifier([uid], { type, titre, message, lien: "/documents" }) : 0))
    .catch(() => {});
}

/** POST /pieces/:id/verifier — marque la pièce vérifiée (SG / Admin). */
piecesRouter.post(
  "/:id/verifier",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req: AuthRequest, res) => {
    const piece = await trouver(Number(req.params.id));
    const maj = await prisma.pieceDossier.update({
      where: { id: piece.id },
      data: { statut: "VERIFIEE", verifieePar: await nomActeur(req.user!.id), verifieeAt: new Date(), note: null },
    });
    prevenir(piece.membreId, "PIECE_VERIFIEE", "Pièce validée", `Votre pièce « ${piece.nomFichier} » a été validée.`);
    res.json(maj);
  })
);

/** POST /pieces/:id/rejeter — rejette la pièce avec motif (SG / Admin). */
piecesRouter.post(
  "/:id/rejeter",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req: AuthRequest, res) => {
    const { note } = noteSchema.parse(req.body ?? {});
    const piece = await trouver(Number(req.params.id));
    const maj = await prisma.pieceDossier.update({
      where: { id: piece.id },
      data: { statut: "REJETEE", verifieePar: await nomActeur(req.user!.id), verifieeAt: new Date(), note },
    });
    prevenir(piece.membreId, "PIECE_REJETEE", "Pièce rejetée", `Votre pièce « ${piece.nomFichier} » est rejetée. Correction demandée : ${note}`);
    res.json(maj);
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
