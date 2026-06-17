import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { envoyerPdf } from "../lib/pdf.js";
import { tableauOrdreHtml } from "../lib/templates.js";
import { archiver } from "../lib/business.js";

/**
 * Tableau de l'Ordre (RG-04..06) — registre officiel des membres, dressé par
 * ordre d'ancienneté (date d'inscription) et regroupé par qualité. Consultation
 * SG / Bâtonnier ; l'arrêté (publication datée) est réservé au SG.
 */
export const tableauRouter = Router();
tableauRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "BATONNIER"));

const ORDRE_QUALITES = ["AVOCAT", "STAGIAIRE", "HONORAIRE"] as const;

/** Compose le tableau : membres non radiés, triés par ancienneté, en sections. */
async function composer() {
  const membres = await prisma.membre.findMany({
    where: { statut: { not: "RADIE" } },
    orderBy: [{ dateInscription: "asc" }, { num: "asc" }],
    select: { id: true, num: true, numInscription: true, nom: true, qualite: true, statut: true, cabinet: true, dateInscription: true },
  });
  const sections = ORDRE_QUALITES.map((q) => ({
    qualite: q,
    membres: membres.filter((m) => m.qualite === q).map((m, i) => ({ ...m, rang: i + 1 })),
  })).filter((s) => s.membres.length > 0);
  return { total: membres.length, sections };
}

/** GET /tableau — tableau de l'Ordre (données). */
tableauRouter.get(
  "/",
  asyncH(async (_req, res) => {
    const { total, sections } = await composer();
    res.json({ genereLe: new Date(), total, sections });
  })
);

/** GET /tableau/pdf — tableau officiel en PDF. */
tableauRouter.get(
  "/pdf",
  asyncH(async (_req, res) => {
    const { sections } = await composer();
    await envoyerPdf(res, tableauOrdreHtml(sections, new Date()), `Tableau-de-l-Ordre-${new Date().toISOString().slice(0, 10)}.pdf`);
  })
);

/** POST /tableau/publier — arrête et archive le tableau à la date du jour (SG). */
tableauRouter.post(
  "/publier",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (_req, res) => {
    const jour = new Date().toISOString().slice(0, 10);
    const reference = `TABLEAU-${jour}`;
    await archiver({ categorie: "Tableau de l'Ordre", titre: `Tableau de l'Ordre arrêté au ${jour}`, reference, date: new Date() });
    res.status(201).json({ ok: true, reference });
  })
);
