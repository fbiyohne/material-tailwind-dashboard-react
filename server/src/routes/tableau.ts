import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { envoyerPdf } from "../lib/pdf.js";
import { tableauOrdreHtml, type ConseilPdf, type CabinetPdf } from "../lib/templates.js";
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

const SIGLE_ORDRE: Record<string, number> = { SGO: 1, SGA: 2, TG: 3, TGA: 4 };

/** Composition du Conseil de l'Ordre en exercice, mise en forme pour l'en-tête du tableau. */
async function composerConseil(): Promise<ConseilPdf> {
  const membres = await prisma.membreConseil.findMany({ where: { actif: true }, orderBy: { ordre: "asc" } });
  const batonnier = membres.find((m) => m.role === "batonnier")?.nom ?? null;
  const bureau = membres
    .filter((m) => m.role === "bureau")
    .sort((a, b) => (SIGLE_ORDRE[a.sigle ?? ""] ?? 9) - (SIGLE_ORDRE[b.sigle ?? ""] ?? 9))
    .map((m) => ({ fonction: m.fonction, sigle: m.sigle, nom: m.nom }));
  const autres = membres.filter((m) => m.role !== "batonnier" && m.role !== "bureau").map((m) => m.nom);
  return { batonnier, bureau, membres: autres };
}

/** Personnes morales (conventions déposées), numérotées C1… par ancienneté. */
async function composerCabinets(): Promise<CabinetPdf[]> {
  const cabinets = await prisma.cabinet.findMany({
    where: { statut: "actif", conventionDeposee: true },
    include: { titulaire: { select: { nom: true } }, membres: { select: { statut: true, dateServment: true } } },
  });
  const anciennete = (c: (typeof cabinets)[number]) => {
    const t = c.membres.map((m) => m.dateServment).filter((d): d is Date => d != null).map((d) => d.getTime());
    return t.length ? Math.min(...t) : Infinity;
  };
  return cabinets
    .slice()
    .sort((a, b) => anciennete(a) - anciennete(b) || a.nom.localeCompare(b.nom))
    .map((c, i) => ({
      num: `C${i + 1}`,
      nom: c.nom,
      forme: c.forme,
      titulaire: c.titulaire?.nom ?? null,
      effectif: c.membres.filter((m) => m.statut === "INSCRIT").length,
    }));
}

/** GET /tableau/pdf — tableau officiel en PDF (Conseil en en-tête, sections, personnes morales, signature). */
tableauRouter.get(
  "/pdf",
  asyncH(async (_req, res) => {
    const [{ sections }, conseil, cabinets] = await Promise.all([composer(), composerConseil(), composerCabinets()]);
    await envoyerPdf(res, tableauOrdreHtml(sections, new Date(), { conseil, cabinets }), `Tableau-de-l-Ordre-${new Date().toISOString().slice(0, 10)}.pdf`);
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
