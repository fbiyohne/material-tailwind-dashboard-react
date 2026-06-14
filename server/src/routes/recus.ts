import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { htmlVersPdf } from "../lib/pdf.js";
import { recuHtml } from "../lib/templates.js";

export const recusRouter = Router();
// Données financières restreintes (RG-15) : SG, Trésorière, Admin.
recusRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "TRESORIERE"));

/** GET /recus/:id/pdf — reçu officiel en PDF vectoriel (Puppeteer). */
recusRouter.get(
  "/:id/pdf",
  asyncH(async (req, res) => {
    const recu = await prisma.recu.findUnique({ where: { id: Number(req.params.id) }, include: { membre: true } });
    if (!recu) throw new HttpError(404, "Reçu introuvable");
    const pdf = await htmlVersPdf(recuHtml(recu, recu.membre));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Recu-${recu.numero}.pdf"`);
    res.end(pdf);
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
