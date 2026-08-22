import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth.js";
import { envoyerPdf } from "../lib/pdf.js";
import { pvScrutinHtml } from "../lib/templates.js";
import { archiver } from "../lib/business.js";

/**
 * Élections (Conseil de l'Ordre / Bâtonnier) — gestion du scrutin par le
 * Secrétariat. Deux modalités : présentiel (résultats saisis par le SG) ou en
 * ligne (vote des avocats depuis leur espace, dépouillement automatique).
 * Cycle : PRÉPARATION → OUVERT → CLOS → PUBLIÉ.
 */
export const scrutinsRouter = Router();
scrutinsRouter.use(requireAuth, requirePermission("elections"));

async function detail(id: number) {
  const scrutin = await prisma.scrutin.findUnique({
    where: { id },
    include: {
      candidats: { orderBy: [{ voix: "desc" }, { nom: "asc" }] },
      _count: { select: { emargements: true } },
    },
  });
  if (!scrutin) throw new HttpError(404, "Scrutin introuvable");
  // Vote en ligne encore ouvert : le décompte s'incrémente en direct mais reste
  // confidentiel (pas de tableau de bord en temps réel, y compris pour le SG) —
  // on masque voix et on neutralise le tri par voix jusqu'à la clôture.
  if (scrutin.modalite === "EN_LIGNE" && scrutin.statut === "OUVERT") {
    scrutin.candidats = scrutin.candidats
      .map((c) => ({ ...c, voix: 0 }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }
  return scrutin;
}

/** GET /scrutins — liste des scrutins. */
scrutinsRouter.get("/", asyncH(async (_req, res) => {
  res.json(await prisma.scrutin.findMany({ orderBy: { id: "desc" }, include: { _count: { select: { candidats: true, emargements: true } } } }));
}));

/** GET /scrutins/:id — détail + résultats. */
scrutinsRouter.get("/:id", asyncH(async (req, res) => {
  res.json(await detail(Number(req.params.id)));
}));

const creerSchema = z.object({
  titre: z.string().trim().min(1).max(160),
  type: z.enum(["CONSEIL", "BATONNIER", "AUTRE"]),
  modalite: z.enum(["PRESENTIEL", "EN_LIGNE"]),
  nbSieges: z.number().int().positive().max(50).default(1),
});

/** POST /scrutins — crée un scrutin (SG). */
scrutinsRouter.post("/", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  res.status(201).json(await prisma.scrutin.create({ data: creerSchema.parse(req.body) }));
}));

const majSchema = z.object({
  titre: z.string().trim().min(1).max(160).optional(),
  nbSieges: z.number().int().positive().max(50).optional(),
});

/** PATCH /scrutins/:id — modifie l'intitulé / le nombre de sièges (SG, en préparation). */
scrutinsRouter.patch("/:id", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const s = await prisma.scrutin.findUnique({ where: { id }, select: { statut: true } });
  if (!s) throw new HttpError(404, "Scrutin introuvable");
  if (s.statut !== "PREPARATION") throw new HttpError(409, "Modification impossible : le scrutin n'est plus en préparation.");
  const data = majSchema.parse(req.body);
  await prisma.scrutin.update({ where: { id }, data });
  res.json(await detail(id));
}));

/** DELETE /scrutins/:id — supprime un scrutin (SG, uniquement en préparation). */
scrutinsRouter.delete("/:id", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const s = await prisma.scrutin.findUnique({ where: { id }, select: { statut: true } });
  if (!s) throw new HttpError(404, "Scrutin introuvable");
  // On n'autorise la suppression qu'en préparation : un scrutin ouvert/clos/publié
  // porte des émargements (votes exprimés) et une valeur institutionnelle à conserver.
  if (s.statut !== "PREPARATION") throw new HttpError(409, "Suppression impossible : le scrutin a déjà été ouvert au vote.");
  await prisma.$transaction([
    prisma.candidat.deleteMany({ where: { scrutinId: id } }),
    prisma.scrutin.delete({ where: { id } }),
  ]);
  res.status(204).end();
}));

/** GET /scrutins/:id/pv/pdf — procès-verbal des résultats en PDF (SG/Bâtonnier, après clôture). */
scrutinsRouter.get("/:id/pv/pdf", asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const s = await prisma.scrutin.findUnique({
    where: { id },
    include: { candidats: { orderBy: [{ voix: "desc" }, { nom: "asc" }] }, _count: { select: { emargements: true } } },
  });
  if (!s) throw new HttpError(404, "Scrutin introuvable");
  if (s.statut !== "CLOS" && s.statut !== "PUBLIE") throw new HttpError(409, "Le procès-verbal n'est disponible qu'après clôture du scrutin.");
  await archiver({ categorie: "Procès-verbal (élection)", titre: `PV — ${s.titre}`, reference: `SCRUTIN-${s.id}`, date: new Date() });
  await envoyerPdf(res, pvScrutinHtml(s), `PV-scrutin-${s.id}.pdf`);
}));

const candidatSchema = z.object({ nom: z.string().trim().min(1).max(160), membreId: z.number().int().positive().optional() });

/** POST /scrutins/:id/candidats — ajoute un candidat (SG, en préparation). */
scrutinsRouter.post("/:id/candidats", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const s = await prisma.scrutin.findUnique({ where: { id }, select: { statut: true } });
  if (!s) throw new HttpError(404, "Scrutin introuvable");
  if (s.statut !== "PREPARATION") throw new HttpError(409, "Les candidatures sont closes (scrutin ouvert).");
  res.status(201).json(await prisma.candidat.create({ data: { scrutinId: id, ...candidatSchema.parse(req.body) } }));
}));

/** DELETE /scrutins/:id/candidats/:cid — retire un candidat (SG, en préparation). */
scrutinsRouter.delete("/:id/candidats/:cid", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const s = await prisma.scrutin.findUnique({ where: { id }, select: { statut: true } });
  if (!s || s.statut !== "PREPARATION") throw new HttpError(409, "Modification impossible (scrutin ouvert).");
  await prisma.candidat.deleteMany({ where: { id: Number(req.params.cid), scrutinId: id } });
  res.status(204).end();
}));

/** POST /scrutins/:id/ouvrir — ouvre le scrutin au vote (SG). */
scrutinsRouter.post("/:id/ouvrir", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const s = await prisma.scrutin.findUnique({ where: { id }, include: { _count: { select: { candidats: true } } } });
  if (!s) throw new HttpError(404, "Scrutin introuvable");
  if (s.statut !== "PREPARATION") throw new HttpError(409, "Le scrutin n'est pas en préparation.");
  if (s._count.candidats < 1) throw new HttpError(400, "Ajoutez au moins un candidat avant d'ouvrir le scrutin.");
  res.json(await prisma.scrutin.update({ where: { id }, data: { statut: "OUVERT", ouvertLe: new Date() } }));
}));

const voixSchema = z.object({ candidatId: z.number().int(), voix: z.number().int().min(0) });

/** POST /scrutins/:id/voix — saisie des résultats (scrutin présentiel) (SG). */
scrutinsRouter.post("/:id/voix", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const s = await prisma.scrutin.findUnique({ where: { id } });
  if (!s) throw new HttpError(404, "Scrutin introuvable");
  if (s.modalite !== "PRESENTIEL") throw new HttpError(409, "La saisie manuelle ne concerne que les scrutins présentiels.");
  if (s.statut === "PUBLIE") throw new HttpError(409, "Scrutin déjà publié.");
  const { candidatId, voix } = voixSchema.parse(req.body);
  await prisma.candidat.updateMany({ where: { id: candidatId, scrutinId: id }, data: { voix } });
  res.json(await detail(id));
}));

/** POST /scrutins/:id/clore — clôture le vote (SG) ; révèle le décompte. */
scrutinsRouter.post("/:id/clore", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const s = await prisma.scrutin.findUnique({ where: { id }, select: { statut: true } });
  if (!s) throw new HttpError(404, "Scrutin introuvable");
  if (s.statut !== "OUVERT") throw new HttpError(409, "Le scrutin n'est pas ouvert.");
  // Le décompte du vote en ligne est déjà à jour (incrémenté à chaque vote) : la
  // clôture le fige simplement en le rendant visible (voir masquage dans `detail`).
  res.json(await prisma.scrutin.update({ where: { id }, data: { statut: "CLOS", closLe: new Date() } }));
}));

/** POST /scrutins/:id/publier — publie les résultats ; pour un CONSEIL, recompose le Conseil (SG). */
scrutinsRouter.post("/:id/publier", requireRole("SECRETAIRE_GENERAL"), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const s = await prisma.scrutin.findUnique({ where: { id }, include: { candidats: { orderBy: { voix: "desc" } } } });
  if (!s) throw new HttpError(404, "Scrutin introuvable");
  if (s.statut !== "CLOS") throw new HttpError(409, "Clôturez le scrutin avant publication.");
  const elus = s.type === "CONSEIL" ? s.candidats.slice(0, s.nbSieges) : [];
  // Publication + recomposition dans UNE transaction avec claim atomique : deux
  // « publier » concurrents ne peuvent pas recomposer le Conseil deux fois (le 2e
  // claim voit un statut ≠ CLOS → 409), et si la recomposition échoue, le passage
  // à PUBLIE est annulé (le scrutin reste rejouable).
  await prisma.$transaction(async (tx) => {
    const claim = await tx.scrutin.updateMany({ where: { id, statut: "CLOS" }, data: { statut: "PUBLIE" } });
    if (claim.count === 0) throw new HttpError(409, "Scrutin déjà publié.");
    if (s.type === "CONSEIL") {
      // Renouvelle les sièges élus (« membre ») par ordre des voix, SANS toucher au
      // Bâtonnier (scrutin distinct) ni au Bureau : on ne clôture que les sièges
      // « membre » en exercice (tracés sortants), puis on installe les élus.
      await tx.membreConseil.updateMany({
        where: { actif: true, role: "membre" },
        data: { actif: false, mandatFin: new Date(), motifSortie: "Fin de mandat (renouvellement du Conseil)" },
      });
      for (let i = 0; i < elus.length; i++) {
        const c = elus[i];
        await tx.membreConseil.create({ data: { nom: c.nom, fonction: "Membre du Conseil", role: "membre", ordre: i + 1, actif: true, membreId: c.membreId ?? null, mandatDebut: new Date() } });
      }
    }
  });
  res.json(await detail(id));
}));
