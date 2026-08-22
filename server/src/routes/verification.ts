import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { signerDocument, quitusPayload, recuPayload, timbrePayload, empreinteCle } from "../lib/signature.js";

/**
 * Vérification publique d'authenticité des documents officiels (quitus, reçus).
 * Accessible **sans authentification** : destiné aux tiers qui scannent le
 * QR code d'un document. La source de vérité est la base ; une signature
 * RSA-SHA256 du Barreau est jointe (empreinte de clé publique = `empreinteCle`).
 */
export const verificationRouter = Router();

// Les numéros sont séquentiels (R-AAAA-NNN / Q-AAAA-NNN) et la réponse divulgue
// le nom du bénéficiaire (et le montant pour les reçus) : un limiteur dédié borne
// l'énumération massive du registre depuis cet endpoint public (le scan d'un QR
// légitime ne vérifie qu'un numéro connu à la fois).
const verifLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false,
  message: { erreur: "Trop de vérifications, réessayez plus tard." },
  skip: () => process.env.NODE_ENV === "test",
});
verificationRouter.use(verifLimiter);

const fmt = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/** GET /verifier/quitus/:numero — authenticité d'un quitus. */
verificationRouter.get(
  "/quitus/:numero",
  asyncH(async (req, res) => {
    const quitus = await prisma.quitus.findUnique({
      where: { numero: req.params.numero },
      include: { membre: { select: { nom: true } } },
    });
    if (!quitus) {
      return res.status(404).json({ valide: false, type: "quitus", numero: req.params.numero });
    }
    const signature = signerDocument(quitusPayload(quitus));
    res.json({
      valide: true,
      type: "quitus",
      numero: quitus.numero,
      beneficiaire: `Me ${quitus.membre.nom}`,
      exercice: quitus.annee,
      date: fmt(quitus.dateEmission),
      empreinteCle,
      signature,
    });
  })
);

/** GET /verifier/recu/:numero — authenticité d'un reçu de paiement. */
verificationRouter.get(
  "/recu/:numero",
  asyncH(async (req, res) => {
    const recu = await prisma.recu.findUnique({
      where: { numero: req.params.numero },
      include: { membre: { select: { nom: true } } },
    });
    if (!recu) {
      return res.status(404).json({ valide: false, type: "recu", numero: req.params.numero });
    }
    const signature = signerDocument(recuPayload(recu));
    res.json({
      valide: true,
      type: "recu",
      numero: recu.numero,
      beneficiaire: `Me ${recu.membre.nom}`,
      montant: recu.montant,
      objet: recu.objet ?? `Cotisation ordinale ${recu.annee}`,
      exercice: recu.annee,
      date: fmt(recu.date),
      empreinteCle,
      signature,
    });
  })
);

/** GET /verifier/timbre/:code — authenticité d'un timbre de droit de plaidoirie. */
verificationRouter.get(
  "/timbre/:code",
  asyncH(async (req, res) => {
    const timbre = await prisma.timbre.findUnique({
      where: { code: req.params.code },
      include: { membre: { select: { nom: true } } },
    });
    if (!timbre || timbre.statut === "ANNULE") {
      return res.status(timbre ? 200 : 404).json({
        valide: false, type: "timbre", numero: timbre ? String(timbre.numero) : req.params.code,
        motif: timbre ? "annulé" : undefined,
      });
    }
    const signature = signerDocument(timbrePayload(timbre));
    res.json({
      valide: true,
      type: "timbre",
      numero: String(timbre.numero),
      beneficiaire: `Me ${timbre.membre.nom}`,
      affaire: timbre.affaire,
      juridiction: timbre.juridiction ?? "—",
      montant: timbre.montant,
      date: fmt(timbre.createdAt),
      empreinteCle,
      signature,
    });
  })
);
