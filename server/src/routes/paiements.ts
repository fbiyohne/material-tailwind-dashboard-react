import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth.js";
import { finaliserPaiement } from "../lib/encaissement.js";
import { CANAUX, modeSandbox, nouvelleReference, initierPaiement, verifierSignatureWebhook } from "../lib/paiement.js";

/**
 * Paiements en ligne (passerelle). En sandbox, le cycle est simulé via
 * `/:ref/confirmer-sandbox`. En réel, la passerelle notifie `/webhook`.
 * À la réussite, le flux d'encaissement unifié (BR-03) émet le reçu et met à
 * jour la situation — idempotent (recuNumero).
 */
export const paiementsRouter = Router();

/** POST /paiements/webhook — notification de la passerelle (réel), signée. */
paiementsRouter.post(
  "/webhook",
  asyncH(async (req, res) => {
    // La signature porte sur le corps brut (octets exacts reçus de la passerelle),
    // capturé par `express.json({ verify })` ; une re-sérialisation via
    // JSON.stringify changerait l'ordre des clés/les espaces et invaliderait toute
    // signature légitime.
    const brut = (req as unknown as { rawBody?: Buffer }).rawBody;
    const corps = brut ? brut.toString("utf8") : JSON.stringify(req.body ?? {});
    if (!verifierSignatureWebhook(corps, req.header("x-signature"))) {
      throw new HttpError(401, "Signature de webhook invalide");
    }
    const ref = String(req.body?.ref ?? "");
    const p = await prisma.paiement.findUnique({ where: { ref } });
    if (!p) throw new HttpError(404, "Paiement introuvable");
    if (req.body?.statut === "REUSSI") await finaliserPaiement(p.id);
    else if (p.statut !== "REUSSI") await prisma.paiement.update({ where: { id: p.id }, data: { statut: "ECHEC" } });
    res.json({ ok: true });
  })
);

// ── Routes authentifiées (SG / Trésorière) ──────────────────────────────────
paiementsRouter.use(requireAuth, requirePermission("finances"));

const initierSchema = z.object({
  membreId: z.number().int(),
  annee: z.number().int(),
  montant: z.number().int().positive(),
  type: z.enum(["cotisation", "droit"]),
  canal: z.enum(CANAUX),
});

/** POST /paiements/initier — initie un paiement en ligne. */
paiementsRouter.post(
  "/initier",
  asyncH(async (req, res) => {
    const data = initierSchema.parse(req.body);
    const membre = await prisma.membre.findUnique({ where: { id: data.membreId } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    const ref = nouvelleReference();
    const passerelle = await initierPaiement({ ref, canal: data.canal, montant: data.montant, tel: membre.tel ?? undefined });
    const paiement = await prisma.paiement.create({
      data: { ref, canal: data.canal, type: data.type, membreId: data.membreId, annee: data.annee, montant: data.montant, statut: "EN_ATTENTE" },
    });
    res.status(201).json({ paiement, sandbox: modeSandbox, ...passerelle });
  })
);

/** GET /paiements/:ref — état d'un paiement. */
paiementsRouter.get(
  "/:ref",
  asyncH(async (req, res) => {
    const p = await prisma.paiement.findUnique({ where: { ref: req.params.ref } });
    if (!p) throw new HttpError(404, "Paiement introuvable");
    res.json(p);
  })
);

const confirmerSchema = z.object({ succes: z.boolean().default(true) });

/** POST /paiements/:ref/confirmer-sandbox — simule le retour passerelle (sandbox). */
paiementsRouter.post(
  "/:ref/confirmer-sandbox",
  asyncH(async (req, res) => {
    if (!modeSandbox) throw new HttpError(400, "Indisponible : une passerelle réelle est configurée.");
    const { succes } = confirmerSchema.parse(req.body ?? {});
    const p = await prisma.paiement.findUnique({ where: { ref: req.params.ref } });
    if (!p) throw new HttpError(404, "Paiement introuvable");
    if (succes) return res.json(await finaliserPaiement(p.id));
    res.json(await prisma.paiement.update({ where: { id: p.id }, data: { statut: "ECHEC" } }));
  })
);
