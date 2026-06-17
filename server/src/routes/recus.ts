import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import QRCode from "qrcode";
import { envoyerDocumentPdf } from "../lib/pdf.js";
import { recuRicheHtml } from "../lib/documentsRiches.js";

export const recusRouter = Router();
// Données financières restreintes (RG-15) : SG, Trésorière, Admin.
recusRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "TRESORIERE"));

/** GET /recus/:id/pdf — reçu officiel en PDF vectoriel (Puppeteer). */
recusRouter.get(
  "/:id/pdf",
  asyncH(async (req, res) => {
    const recu = await prisma.recu.findUnique({ where: { id: Number(req.params.id) }, include: { membre: true } });
    if (!recu) throw new HttpError(404, "Reçu introuvable");
    const host = req.get("host") ?? "";
    const proto = req.get("x-forwarded-proto") ?? req.protocol;
    const qr = await QRCode.toDataURL(`${proto}://${host}/verifier/recu/${recu.numero}`, { margin: 1, width: 234, color: { dark: "#1A3A6B", light: "#ffffff" } });
    await envoyerDocumentPdf(res, recuRicheHtml(recu, recu.membre, qr, host), `Recu-${recu.numero}.pdf`);
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
    res.json(recus);
  })
);

/**
 * DELETE /recus/:id — annulation d'un reçu émis par erreur (correction comptable).
 * Réversion transactionnelle : décrémente le paiement lié (cotisation ou droit
 * de plaidoirie selon l'objet), retire l'entrée d'archive, puis supprime le reçu.
 * Réservé aux profils finances (SG/Trésorière/Admin via le routeur).
 */
recusRouter.delete(
  "/:id",
  asyncH(async (req, res) => {
    const recu = await prisma.recu.findUnique({ where: { id: Number(req.params.id) } });
    if (!recu) throw new HttpError(404, "Reçu introuvable");
    const estDroit = (recu.objet ?? "").toLowerCase().includes("droit");
    const where = { membreId_annee: { membreId: recu.membreId, annee: recu.annee } };
    await prisma.$transaction(async (tx) => {
      if (estDroit) {
        const d = await tx.droitPlaidoirie.findUnique({ where });
        if (d) await tx.droitPlaidoirie.update({ where, data: { montantPaye: Math.max(0, d.montantPaye - recu.montant) } });
      } else {
        const c = await tx.cotisation.findUnique({ where });
        if (c) await tx.cotisation.update({ where, data: { montantPaye: Math.max(0, c.montantPaye - recu.montant), valideTresoriere: false } });
        // L'avocat n'est plus à jour : révoquer tout quitus déjà émis pour cet
        // exercice (BR-01) et son archive — sinon un certificat de non-redevance
        // resterait valide et vérifiable publiquement pour un membre redevenu débiteur.
        const quitusEmis = await tx.quitus.findMany({ where: { membreId: recu.membreId, annee: recu.annee }, select: { numero: true } });
        if (quitusEmis.length) {
          await tx.quitus.deleteMany({ where: { membreId: recu.membreId, annee: recu.annee } });
          await tx.archive.deleteMany({ where: { categorie: "Quitus", reference: { in: quitusEmis.map((q) => q.numero) } } });
        }
      }
      await tx.archive.deleteMany({ where: { categorie: "Reçu de paiement", reference: recu.numero } });
      await tx.recu.delete({ where: { id: recu.id } });
    });
    res.json({ ok: true, annule: recu.numero });
  })
);
