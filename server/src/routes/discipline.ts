import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, type AuthRequest, requirePermission } from "../middleware/auth.js";
import { aLaPermission } from "../lib/rbac.js";
import { reglesActuelles } from "../lib/regles.js";
import { changerSituation } from "../lib/cycleVie.js";
import { prochaineReferenceDossier, archiver, avecRejeuUnicite, STATUTS_SORTIS } from "../lib/business.js";
import { envoyerPdf } from "../lib/pdf.js";
import { convocationDisciplineHtml, decisionDisciplineHtml } from "../lib/templates.js";

export const disciplineRouter = Router();
// Accès restreint SG / Bâtonnier / Admin, journalisé (RG-13).
disciplineRouter.use(requireAuth, requirePermission("discipline"));

const journaliser = (action: string, userId?: number) =>
  prisma.journalDiscipline.create({ data: { action, userId } });

disciplineRouter.get(
  "/",
  asyncH(async (req: AuthRequest, res) => {
    // Filtre par membre = consultation du casier disciplinaire d'un avocat :
    // journalisée au même titre que les autres accès (RG-13 — la lecture ciblée
    // du casier est la vue la plus sensible, elle doit être tracée).
    const membreId = req.query.membreId ? Number(req.query.membreId) : undefined;
    if (membreId) {
      await journaliser(`Consultation du casier disciplinaire (membre #${membreId})`, req.user!.id);
      // Trace aussi dans JournalAudit (CA10) : identifiant seul, jamais le contenu.
      res.locals.auditDetail = `casier membre #${membreId}`;
      res.json(await prisma.dossierDisciplinaire.findMany({ where: { membreId }, orderBy: { id: "desc" } }));
      return;
    }
    await journaliser("Consultation du module Discipline", req.user!.id);
    res.json(await prisma.dossierDisciplinaire.findMany({ orderBy: { id: "desc" } }));
  })
);

disciplineRouter.get(
  "/journal",
  asyncH(async (_req, res) => {
    res.json(await prisma.journalDiscipline.findMany({ orderBy: { id: "desc" }, take: 50 }));
  })
);

disciplineRouter.get(
  "/:id",
  asyncH(async (req: AuthRequest, res) => {
    const d = await prisma.dossierDisciplinaire.findUnique({ where: { id: Number(req.params.id) } });
    if (!d) throw new HttpError(404, "Dossier introuvable");
    await journaliser(`Consultation du dossier ${d.reference}`, req.user!.id);
    res.json(d);
  })
);

const ouvrirSchema = z.object({
  avocatNom: z.string().min(1),
  objet: z.string().min(1),
  plaignant: z.string().max(200).optional(),
  rapporteur: z.string().max(200).optional(),
  dateSaisine: z.string().optional(),
  membreId: z.number().int().optional(),
});

/** Ouverture d'un dossier — référence unique AAAA-NN (BR-06 / RG-12). Saisine : SG et bâtonnier par défaut (R-42). */
disciplineRouter.post(
  "/",
  requirePermission("discipline_saisir"),
  asyncH(async (req: AuthRequest, res) => {
    const data = ouvrirSchema.parse(req.body);
    // Rejeu sur collision : deux ouvertures concurrentes la même année calculeraient
    // la même référence AAAA-NN (max+1) ; @unique(reference) rejette → on recalcule.
    const dossier = await avecRejeuUnicite(async () => {
      const reference = await prochaineReferenceDossier(new Date().getFullYear());
      return prisma.dossierDisciplinaire.create({
        data: {
          reference,
          avocatNom: data.avocatNom,
          objet: data.objet,
          plaignant: data.plaignant,
          rapporteur: data.rapporteur,
          dateSaisine: data.dateSaisine ? new Date(data.dateSaisine) : new Date(),
          membreId: data.membreId ?? null,
        },
      });
    });
    await journaliser(`Ouverture du dossier ${dossier.reference} — ${data.avocatNom}`, req.user!.id);
    res.status(201).json(dossier);
  })
);

const patchSchema = z.object({
  statut: z.enum(["OUVERT", "INSTRUCTION", "AUDIENCE", "DECISION", "CLASSE"]).optional(),
  plaignant: z.string().max(200).optional(),
  rapporteur: z.string().max(200).optional(),
  dateConvocation: z.string().optional(),
  dateAudience: z.string().optional(),
  decision: z.string().optional(),
  sanction: z.string().optional(),
  recours: z.string().max(500).optional(),
  dateRecours: z.string().optional(),
  pieces: z.array(z.string()).optional(),
  // Procédure (art. 37 à 39) : instruite par le SG, sans effet sur la situation de l'avocat.
  origine: z.string().max(200).optional(),
  dateDesignationRapporteur: z.string().optional(),
  dateRapport: z.string().optional(),
  conclusionRapport: z.string().max(5000).optional(),
  orientation: z.enum(["CLASSEMENT", "POURSUITE"]).optional(),
  juridiction: z.string().max(200).optional(),
  dateNotification: z.string().optional(),
});
const date = (v?: string) => (v ? new Date(v) : undefined);

disciplineRouter.patch(
  "/:id",
  asyncH(async (req: AuthRequest, res) => {
    const data = patchSchema.parse(req.body);
    const actuel = await prisma.dossierDisciplinaire.findUnique({ where: { id: Number(req.params.id) } });
    if (!actuel) throw new HttpError(404, "Dossier introuvable");
    // X-02 : la décision (texte, sanction, passage en DECISION) relève de l'action
    // discipline_decider. Le formulaire renvoie les champs à l'identique : seule une
    // valeur modifiée est refusée, pour que le SG continue d'instruire le dossier.
    const toucheDecision =
      (data.decision !== undefined && data.decision !== (actuel.decision ?? "")) ||
      (data.sanction !== undefined && data.sanction !== (actuel.sanction ?? "")) ||
      (data.statut === "DECISION" && actuel.statut !== "DECISION");
    if (toucheDecision && !aLaPermission(req.user!.role, "discipline_decider"))
      throw new HttpError(403, "L'enregistrement de la décision est réservé au titulaire de l'action « discipline_decider » (bâtonnier par défaut).");
    const dossier = await prisma.dossierDisciplinaire.update({
      where: { id: actuel.id },
      data: {
        statut: data.statut,
        plaignant: data.plaignant,
        rapporteur: data.rapporteur,
        decision: data.decision,
        sanction: data.sanction,
        recours: data.recours,
        pieces: data.pieces,
        origine: data.origine,
        conclusionRapport: data.conclusionRapport,
        orientation: data.orientation,
        juridiction: data.juridiction,
        dateConvocation: date(data.dateConvocation),
        dateAudience: date(data.dateAudience),
        dateRecours: date(data.dateRecours),
        dateDesignationRapporteur: date(data.dateDesignationRapporteur),
        dateRapport: date(data.dateRapport),
        dateNotification: date(data.dateNotification),
      },
    });
    await journaliser(`Mise à jour du dossier ${dossier.reference}`, req.user!.id);
    res.json(dossier);
  })
);

const decisionSchema = z.object({
  sanctionCode: z.string().trim().min(1).max(40),
  dureeMois: z.number().int().positive().max(120).optional(),
  sursis: z.boolean().default(false),
  peineAccessoireMois: z.number().int().positive().max(120).optional(),
  motivation: z.string().trim().min(10).max(5000),
  decision: z.string().max(20000).optional(),
  reference: z.string().trim().max(100).optional(),
  decidePar: z.string().trim().min(1).max(200).optional(),
  dateDecision: z.string().optional(),
  dateNotification: z.string().optional(),
});
const ajouterMois = (d: Date, n: number) => { const r = new Date(d); r.setUTCMonth(r.getUTCMonth() + n); return r; };

/**
 * POST /discipline/:id/decision — enregistrement de la décision du conseil de
 * discipline (art. 36, loi n° 026-92). Le logiciel ENREGISTRE la décision, il ne
 * la prononce pas. Action discipline_decider (bâtonnier par défaut, R-42).
 * La sanction est contrôlée contre le catalogue paramétré (lib/regles.ts) ; son
 * effet sur la situation de l'avocat passe par changerSituation (historique, tableau).
 */
disciplineRouter.post(
  "/:id/decision",
  requirePermission("discipline_decider"),
  asyncH(async (req: AuthRequest, res) => {
    const data = decisionSchema.parse(req.body);
    const d = await prisma.dossierDisciplinaire.findUnique({ where: { id: Number(req.params.id) } });
    if (!d) throw new HttpError(404, "Dossier introuvable");
    if (!d.membreId) throw new HttpError(400, "Le dossier doit être rattaché à un avocat du tableau pour enregistrer une décision.");
    if (d.sanctionCode) throw new HttpError(409, "Une décision est déjà enregistrée sur ce dossier.");
    const regles = await reglesActuelles();
    const s = regles.sanctions.find((x) => x.code === data.sanctionCode);
    if (!s) throw new HttpError(400, `Sanction inconnue du catalogue : ${data.sanctionCode}.`);
    if (s.effet === "SUSPENSION") {
      if (!data.dureeMois) throw new HttpError(400, `La durée (en mois) est obligatoire pour « ${s.libelle} ».`);
      if (s.dureeMaxMois != null && data.dureeMois > s.dureeMaxMois) throw new HttpError(400, `Durée maximale pour « ${s.libelle} » : ${s.dureeMaxMois} mois.`);
    } else if (data.dureeMois) throw new HttpError(400, `« ${s.libelle} » ne comporte pas de durée.`);
    if (data.sursis && (!regles.sursisAutorise || !s.sursisPossible)) throw new HttpError(400, `Le sursis n'est pas autorisé pour « ${s.libelle} ».`);
    if (data.peineAccessoireMois && data.peineAccessoireMois > regles.peineAccessoireMaxMois)
      throw new HttpError(400, `Peine accessoire d'inéligibilité : ${regles.peineAccessoireMaxMois} mois au plus.`);

    const dateDecision = data.dateDecision ? new Date(data.dateDecision) : new Date();
    const ferme = s.effet === "SUSPENSION" && !data.sursis;
    const libelle = `${s.libelle}${data.dureeMois ? ` (${data.dureeMois} mois${data.sursis ? ", avec sursis" : ""})` : ""}`;
    const reference = data.reference ?? d.reference;
    const decidePar = data.decidePar ?? "Conseil de discipline (art. 36, loi n° 026-92)";
    // Effet sur la situation (R-40 : la radiation prend effet à l'enregistrement par défaut).
    const effet = s.effet === "RADIATION" && regles.effetRadiation !== "ENREGISTREMENT" ? "AUCUN" : s.effet;
    const commun = {
      membreId: d.membreId, dossierId: d.id, dateEffet: dateDecision, motif: libelle, reference,
      details: { sanctionCode: s.code, dureeMois: data.dureeMois ?? null, sursis: data.sursis, decidePar },
      acteur: { id: req.user!.id, nom: req.user!.nom ?? null },
    };
    // Atomicité et concurrence : le dossier est réservé (sanctionCode encore nul) et mis à
    // jour dans la transaction de l'effet. Une soumission concurrente attend le verrou de
    // ligne, ne trouve plus de dossier libre (409) et n'écrit rien ; un effet refusé annule tout.
    // R2-9 : la réservation exige aussi le membreId lu ; un dossier réaffecté entre-temps donne 409
    // avant toute écriture sur la situation de l'avocat (changerSituation appelle ce callback en premier).
    const ecrireDossier = async (tx: Prisma.TransactionClient) => {
      const r = await tx.dossierDisciplinaire.updateMany({
        where: { id: d.id, sanctionCode: null, membreId: d.membreId },
        data: {
          sanctionCode: s.code, sanctionDureeMois: data.dureeMois ?? null, sursis: data.sursis,
          sanctionDebut: ferme ? dateDecision : null, sanctionFin: ferme ? ajouterMois(dateDecision, data.dureeMois!) : null,
          peineAccessoireMois: data.peineAccessoireMois ?? null, motivation: data.motivation, decidePar, dateDecision,
          dateNotification: date(data.dateNotification), sanction: libelle, decision: data.decision ?? d.decision, statut: "DECISION",
        },
      });
      if (r.count === 0) throw new HttpError(409, "Une décision est déjà enregistrée sur ce dossier, ou il a été rattaché à un autre avocat : rechargez le dossier.");
    };
    // Statut lu avant la décision, revérifié sous verrou par changerSituation (R1-11) : une radiation ou
    // un décès concurrent donne 409 au lieu d'être écrasé ; une interdiction ferme ne lève jamais une radiation.
    const statutAttendu = (await prisma.membre.findUniqueOrThrow({ where: { id: d.membreId }, select: { statut: true } })).statut;
    if (effet === "SUSPENSION" && ferme) {
      // R2-3 : un avocat omis ou sorti (radié, décédé, démissionnaire, retraité, cessation) n'est pas au
      // tableau ; le passer SUSPENDU l'y ferait revenir et lèverait l'omission hors du circuit (PO-36).
      if (statutAttendu === "OMIS" || (STATUTS_SORTIS as readonly string[]).includes(statutAttendu))
        throw new HttpError(409, "Interdiction temporaire impossible : l'avocat n'est pas au tableau (omis ou sorti).");
      await changerSituation({ ...commun, statutAttendu, type: "SUSPENSION", demande: { statut: "SUSPENDU" } }, ecrireDossier);
    } else if (effet === "RADIATION")
      await changerSituation({ ...commun, statutAttendu, type: "RADIATION", demande: { statut: "RADIE", dateRadiation: dateDecision, motifRadiation: `${libelle} — ${reference}` } }, ecrireDossier);
    else await changerSituation({ ...commun, type: "SANCTION" }, ecrireDossier); // statut inchangé (sursis, avertissement, réprimande)

    const dossier = await prisma.dossierDisciplinaire.findUniqueOrThrow({ where: { id: d.id } });
    await journaliser(`Décision enregistrée — dossier ${d.reference} : ${libelle}`, req.user!.id);
    res.locals.auditDetail = "décision enregistrée";
    res.json(dossier);
  })
);

/**
 * DELETE /discipline/:id — suppression définitive d'un dossier disciplinaire.
 * Action sensible réservée au super-administrateur (ADMIN), journalisée.
 */
disciplineRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncH(async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const d = await prisma.dossierDisciplinaire.findUnique({ where: { id } });
    if (!d) throw new HttpError(404, "Dossier introuvable");
    await prisma.dossierDisciplinaire.delete({ where: { id } });
    await journaliser(`Suppression du dossier ${d.reference}`, req.user!.id);
    res.json({ ok: true, reference: d.reference });
  })
);

/** GET /discipline/:id/convocation/pdf — convocation disciplinaire (PDF), journalisée + archivée (RG-14). */
disciplineRouter.get(
  "/:id/convocation/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const d = await prisma.dossierDisciplinaire.findUnique({ where: { id: Number(req.params.id) } });
    if (!d) throw new HttpError(404, "Dossier introuvable");
    await journaliser(`Génération convocation — dossier ${d.reference}`, req.user!.id);
    await archiver({ categorie: "Convocation disciplinaire", titre: `Convocation — dossier ${d.reference}`, reference: d.reference, date: new Date() });
    await envoyerPdf(res, convocationDisciplineHtml(d), `Convocation-disciplinaire-${d.reference}.pdf`);
  })
);

/** GET /discipline/:id/decision/pdf — décision disciplinaire (PDF sécurisé), journalisée + archivée. */
disciplineRouter.get(
  "/:id/decision/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const d = await prisma.dossierDisciplinaire.findUnique({ where: { id: Number(req.params.id) } });
    if (!d) throw new HttpError(404, "Dossier introuvable");
    await journaliser(`Génération décision — dossier ${d.reference}`, req.user!.id);
    await archiver({ categorie: "Décision disciplinaire", titre: `Décision — dossier ${d.reference}`, reference: d.reference, date: new Date() });
    await envoyerPdf(res, decisionDisciplineHtml(d), `Decision-disciplinaire-${d.reference}.pdf`);
  })
);
