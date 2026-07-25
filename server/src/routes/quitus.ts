import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { anneeDeRequete } from "../lib/requete.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import QRCode from "qrcode";
import { eligibleQuitus, prochainNumeroQuitus } from "../lib/business.js";
import { envoyerDocumentPdf } from "../lib/pdf.js";
import { quitusRicheHtml } from "../lib/documentsRiches.js";
import { signerDocument, quitusPayload } from "../lib/signature.js";
import { notifier, userDeMembre } from "../lib/centreNotifications.js";

/** Alerte in-app de l'avocat qu'un quitus est disponible (best-effort). */
function notifierQuitus(membreId: number, annee: number): void {
  void userDeMembre(membreId)
    .then((uid) => (uid ? notifier([uid], { type: "QUITUS", titre: "Quitus disponible", message: `Votre quitus de cotisation ${annee} a été délivré.`, lien: "/documents" }) : 0))
    .catch(() => {});
}

export const quitusRouter = Router();
// Données financières restreintes (RG-15) : SG, Trésorière, Admin.
quitusRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "TRESORIERE"));

/** GET /quitus/:id/pdf — quitus officiel signé en PDF vectoriel (Puppeteer). */
quitusRouter.get(
  "/:id/pdf",
  asyncH(async (req, res) => {
    const quitus = await prisma.quitus.findUnique({ where: { id: Number(req.params.id) }, include: { membre: true } });
    if (!quitus) throw new HttpError(404, "Quitus introuvable");
    const host = req.get("host") ?? "";
    const proto = req.get("x-forwarded-proto") ?? req.protocol;
    const qr = await QRCode.toDataURL(`${proto}://${host}/verifier/quitus/${quitus.numero}`, { margin: 1, width: 234, color: { dark: "#1A3A6B", light: "#ffffff" } });
    await envoyerDocumentPdf(res, quitusRicheHtml(quitus, quitus.membre, qr, host), `Quitus-${quitus.numero}.pdf`);
  })
);

/** GET /quitus/eligibles?annee= — avocats éligibles (à jour ET validés). BR-01. */
quitusRouter.get(
  "/eligibles",
  asyncH(async (req, res) => {
    const annee = anneeDeRequete(req);
    const cotisations = await prisma.cotisation.findMany({ where: { annee }, include: { membre: true } });
    const eligibles = cotisations
      .filter((c) => eligibleQuitus(c))
      .map((c) => ({ id: c.membre.id, num: c.membre.num, nom: c.membre.nom }));
    res.json({ annee, eligibles });
  })
);

/** GET /quitus/:id/signature — sceau électronique du quitus (pour vérification). */
quitusRouter.get(
  "/:id/signature",
  asyncH(async (req, res) => {
    const quitus = await prisma.quitus.findUnique({ where: { id: Number(req.params.id) } });
    if (!quitus) throw new HttpError(404, "Quitus introuvable");
    const payload = quitusPayload(quitus);
    res.json({ numero: quitus.numero, payload, signature: signerDocument(payload) });
  })
);

/** GET /quitus — registre des quitus émis. */
quitusRouter.get(
  "/",
  asyncH(async (_req, res) => {
    const quitus = await prisma.quitus.findMany({
      orderBy: { id: "desc" },
      include: { membre: { select: { nom: true } } },
    });
    res.json(quitus);
  })
);

const genSchema = z.object({ membreId: z.number().int(), annee: z.number().int() });

/**
 * Génère un quitus pour un avocat éligible, avec numérotation atomique (rejoue
 * sur collision @unique) et re-vérification de l'éligibilité DANS la transaction
 * (BR-01) : interdit l'émission pour un avocat redevenu débiteur entre le
 * contrôle et l'écriture (TOCTOU, ex. annulation de reçu concurrente).
 */
async function genererQuitus(membreId: number, annee: number) {
  const dateEmission = new Date();
  const MAX_TENTATIVES = 5;
  for (let tentative = 1; ; tentative++) {
    const numero = await prochainNumeroQuitus(annee);
    try {
      return await prisma.$transaction(async (tx) => {
        // Un seul quitus par avocat et par exercice : bloque les doublons
        // (double-clic, appels concurrents) — le registre reste sans redondance.
        const existant = await tx.quitus.findFirst({ where: { membreId, annee } });
        if (existant) {
          throw new HttpError(409, "Un quitus a déjà été émis pour cet avocat au titre de cet exercice.");
        }
        const cotisation = await tx.cotisation.findUnique({ where: { membreId_annee: { membreId, annee } }, include: { membre: true } });
        if (!cotisation || !eligibleQuitus(cotisation)) {
          throw new HttpError(409, "Quitus bloqué : l'avocat doit être à jour ET validé par la Trésorière (BR-01)");
        }
        const q = await tx.quitus.create({ data: { numero, membreId, annee, dateEmission } });
        await tx.archive.create({
          data: { categorie: "Quitus", titre: `Quitus ${numero} — Me ${cotisation.membre.nom}`, reference: numero, date: dateEmission, membreNom: cotisation.membre.nom },
        });
        return q;
      });
    } catch (e) {
      const collisionNumero =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && tentative < MAX_TENTATIVES;
      if (!collisionNumero) throw e;
    }
  }
}

/** POST /quitus — génère un quitus si éligible (BR-01). SG/Admin. */
quitusRouter.post(
  "/",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const { membreId, annee } = genSchema.parse(req.body);
    const quitus = await genererQuitus(membreId, annee);
    notifierQuitus(membreId, annee);
    res.status(201).json(quitus);
  })
);

/**
 * POST /quitus/lot?annee= — génère en une passe les quitus manquants pour tous les
 * avocats éligibles de l'exercice (à jour ET validés). Idempotent : les avocats
 * déjà pourvus sont ignorés silencieusement. SG/Admin.
 */
quitusRouter.post(
  "/lot",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const annee = anneeDeRequete(req);
    const cotisations = await prisma.cotisation.findMany({ where: { annee }, include: { membre: true } });
    const eligibles = cotisations.filter((c) => eligibleQuitus(c));
    // Écarte d'emblée les avocats déjà pourvus (le contrôle transactionnel reste
    // la garde ultime contre les doublons concurrents).
    const dejaEmis = new Set(
      (await prisma.quitus.findMany({ where: { annee }, select: { membreId: true } })).map((q) => q.membreId)
    );
    let crees = 0;
    const numeros: string[] = [];
    for (const c of eligibles) {
      if (dejaEmis.has(c.membreId)) continue;
      try {
        const q = await genererQuitus(c.membreId, annee);
        crees += 1;
        numeros.push(q!.numero);
        notifierQuitus(c.membreId, annee);
      } catch (e) {
        // Un avocat devenu inéligible (course) ou déjà pourvu ne bloque pas le lot.
        if (!(e instanceof HttpError && e.status === 409)) throw e;
      }
    }
    res.json({ annee, crees, ignores: eligibles.length - crees, numeros });
  })
);

/**
 * DELETE /quitus/:id — retire un quitus du registre. Action sensible réservée au
 * super-administrateur (ADMIN) ; la suppression est tracée par le journal d'audit.
 */
quitusRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const quitus = await prisma.quitus.findUnique({ where: { id } });
    if (!quitus) throw new HttpError(404, "Quitus introuvable");
    await prisma.quitus.delete({ where: { id } });
    res.json({ ok: true, numero: quitus.numero });
  })
);
