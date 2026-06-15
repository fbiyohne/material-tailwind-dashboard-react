import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { eligibleQuitus, prochainNumeroQuitus } from "../lib/business.js";
import { htmlVersPdf } from "../lib/pdf.js";
import { quitusHtml } from "../lib/templates.js";
import { signerDocument, quitusPayload } from "../lib/signature.js";

export const quitusRouter = Router();
// Données financières restreintes (RG-15) : SG, Trésorière, Admin.
quitusRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "TRESORIERE"));

/** GET /quitus/:id/pdf — quitus officiel signé en PDF vectoriel (Puppeteer). */
quitusRouter.get(
  "/:id/pdf",
  asyncH(async (req, res) => {
    const quitus = await prisma.quitus.findUnique({ where: { id: Number(req.params.id) }, include: { membre: true } });
    if (!quitus) throw new HttpError(404, "Quitus introuvable");
    const signature = signerDocument(quitusPayload(quitus));
    const pdf = await htmlVersPdf(quitusHtml(quitus, quitus.membre, signature));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Quitus-${quitus.numero}.pdf"`);
    res.end(pdf);
  })
);

/** GET /quitus/eligibles?annee= — avocats éligibles (à jour ET validés). BR-01. */
quitusRouter.get(
  "/eligibles",
  asyncH(async (req, res) => {
    const annee = Number(req.query.annee ?? new Date().getFullYear());
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

/** POST /quitus — génère un quitus si éligible (BR-01). SG/Admin. */
quitusRouter.post(
  "/",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const { membreId, annee } = genSchema.parse(req.body);
    const dateEmission = new Date();

    // Numérotation atomique (rejoue sur collision @unique) + re-vérification de
    // l'éligibilité DANS la transaction (BR-01) : interdit l'émission pour un
    // avocat redevenu débiteur entre le contrôle et l'écriture (TOCTOU, ex.
    // annulation de reçu concurrente).
    const MAX_TENTATIVES = 5;
    let quitus;
    for (let tentative = 1; ; tentative++) {
      const numero = await prochainNumeroQuitus(annee);
      try {
        quitus = await prisma.$transaction(async (tx) => {
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
        break;
      } catch (e) {
        const collisionNumero =
          e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && tentative < MAX_TENTATIVES;
        if (!collisionNumero) throw e;
      }
    }
    res.status(201).json(quitus);
  })
);
