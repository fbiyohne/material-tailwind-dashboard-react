import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { urlVerif, hotePublic, qrDocument } from "../lib/signature.js";
import { envoyerDocumentPdf } from "../lib/pdf.js";
import { recuRicheHtml } from "../lib/documentsRiches.js";
import { estRecuDroit } from "../lib/business.js";

export const recusRouter = Router();
// Données financières restreintes (RG-15) : SG, Trésorière, Admin.
recusRouter.use(requireAuth, requirePermission("finances"));

/** GET /recus/:id/pdf — reçu officiel en PDF vectoriel (Puppeteer). */
recusRouter.get(
  "/:id/pdf",
  asyncH(async (req, res) => {
    const recu = await prisma.recu.findUnique({ where: { id: Number(req.params.id) }, include: { membre: true } });
    if (!recu) throw new HttpError(404, "Reçu introuvable");
    if (recu.statut === "ANNULE") throw new HttpError(409, "Reçu annulé : il n'est plus délivrable");
    const qr = await qrDocument("r", recu.numero);
    await envoyerDocumentPdf(res, recuRicheHtml(recu, recu.membre, qr, hotePublic()), `Recu-${recu.numero}.pdf`);
  })
);

/** GET /recus — registre des reçus émis. */
recusRouter.get(
  "/",
  asyncH(async (req, res) => {
    const annee = req.query.annee ? Number(req.query.annee) : undefined;
    const recus = await prisma.recu.findMany({
      where: annee ? { annee } : undefined,
      orderBy: { id: "desc" },
      include: { membre: { select: { nom: true, num: true } } },
    });
    res.json(recus.map((r) => ({ ...r, verif: urlVerif("r", r.numero) })));
  })
);

/**
 * DELETE /recus/:id — annulation LOGIQUE d'un reçu émis par erreur (R2-5) : le reçu
 * reste en base au statut ANNULE (date, motif, acteur) et son archive est marquée,
 * jamais effacés (pièce comptable, numérotation continue sans trou). Réversion
 * transactionnelle du paiement lié (cotisation ou droit de plaidoirie selon l'objet),
 * une seule fois : un second appel répond sans rien changer (idempotent).
 * Réservé aux profils finances (SG/Trésorière/Admin via le routeur).
 */
recusRouter.delete(
  "/:id",
  asyncH(async (req: AuthRequest, res) => {
    const recu = await prisma.recu.findUnique({ where: { id: Number(req.params.id) } });
    if (!recu) throw new HttpError(404, "Reçu introuvable");
    const motif = typeof req.body?.motif === "string" && req.body.motif.trim() ? req.body.motif.trim().slice(0, 500) : "Reçu émis par erreur (correction comptable)";
    const estDroit = estRecuDroit(recu.objet);
    const where = { membreId_annee: { membreId: recu.membreId, annee: recu.annee } };
    const fait = await prisma.$transaction(async (tx) => {
      // Garde atomique : seul l'appel qui fait passer EMIS → ANNULE décrémente le paiement.
      const { count } = await tx.recu.updateMany({
        where: { id: recu.id, statut: "EMIS" },
        data: { statut: "ANNULE", annuleLe: new Date(), motifAnnulation: motif, annuleParId: req.user?.id ?? null },
      });
      if (!count) return false;
      if (estDroit) {
        const d = await tx.droitPlaidoirie.findUnique({ where });
        if (d) await tx.droitPlaidoirie.update({ where, data: { montantPaye: Math.max(0, d.montantPaye - recu.montant) } });
      } else {
        const c = await tx.cotisation.findUnique({ where });
        if (c) await tx.cotisation.update({ where, data: { montantPaye: Math.max(0, c.montantPaye - recu.montant), valideTresoriere: false } });
        // L'avocat n'est plus à jour : révoquer tout quitus déjà émis pour cet
        // exercice (BR-01) et son archive — sinon un certificat de non-redevance
        // resterait valide et vérifiable publiquement pour un membre redevenu débiteur.
        // shortcut: le quitus est encore supprimé (attestation, pas pièce comptable) car
        // @@unique([membreId, annee]) bloquerait sa réémission après régularisation ;
        // annulation logique du quitus = remplacer cette contrainte par un index partiel.
        const quitusEmis = await tx.quitus.findMany({ where: { membreId: recu.membreId, annee: recu.annee }, select: { numero: true } });
        if (quitusEmis.length) {
          await tx.quitus.deleteMany({ where: { membreId: recu.membreId, annee: recu.annee } });
          await tx.archive.deleteMany({ where: { categorie: "Quitus", reference: { in: quitusEmis.map((q) => q.numero) } } });
        }
      }
      const archives = await tx.archive.findMany({ where: { categorie: "Reçu de paiement", reference: recu.numero }, select: { id: true, titre: true } });
      for (const a of archives) await tx.archive.update({ where: { id: a.id }, data: { titre: `${a.titre} (annulé)` } });
      return true;
    });
    res.json({ ok: true, annule: recu.numero, ...(fait ? {} : { dejaAnnule: true }) });
  })
);
