import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import type { Prisma, StatutMembre } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, requirePermission, type AuthRequest } from "../middleware/auth.js";
import { prochainNumInscription, prochainNumeroAttestation, archiver, avecRejeuUnicite, STATUTS_HORS_TABLEAU } from "../lib/business.js";
import { enregistrerFichier } from "../lib/storage.js";
import { envoyerPdf, htmlVersPdf } from "../lib/pdf.js";
import { attestationHtml, listeAvocatsHtml, STATUT_FR, QUALITE_FR } from "../lib/templates.js";
import { appliquerCycleVie } from "../lib/cycleVie.js";
import { provisionnerAccesEspace, synchroniserAccesAuStatut } from "../lib/acces.js";

export const membresRouter = Router();
membresRouter.use(requireAuth);

const TRI_AUTORISE = new Set(["num", "nom", "cabinet", "statut"]);

/** Filtres communs à la liste et à l'export PDF. Une valeur hors énum est ignorée
 *  (→ undefined) plutôt que transmise à Prisma, qui lèverait une 500. */
function whereMembres(query: Record<string, unknown>): Prisma.MembreWhereInput {
  const q = String(query.q ?? "").trim();
  const QUALITES = ["AVOCAT", "STAGIAIRE", "HONORAIRE"];
  const STATUTS = ["INSCRIT", "SUSPENDU", "RADIE", "OMIS", "HONORAIRE", "STAGIAIRE", "DECEDE"];
  const dansEnum = (v: unknown, set: string[]) => (typeof v === "string" && set.includes(v) ? v : undefined);
  const qualite = dansEnum(query.qualite, QUALITES);
  const qualiteNot = dansEnum(query.qualiteNot, QUALITES);
  const statut = dansEnum(query.statut, STATUTS);
  return {
    ...(qualite ? { qualite: qualite as any } : {}),
    ...(qualiteNot ? { qualite: { not: qualiteNot as any } } : {}),
    ...(statut ? { statut: statut as any } : {}),
    ...(q ? { OR: [{ nom: { contains: q, mode: "insensitive" } }, { cabinet: { contains: q, mode: "insensitive" } }] } : {}),
  };
}

/** GET /membres — liste filtrée, triée et paginée côté serveur (FR-AV-02/03). */
membresRouter.get(
  "/",
  asyncH(async (req, res) => {
    const where = whereMembres(req.query);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 20)));
    const sort = String(req.query.sort ?? "num");
    const order = req.query.order === "desc" ? "desc" : "asc";

    const orderBy = { [TRI_AUTORISE.has(sort) ? sort : "num"]: order } as Prisma.MembreOrderByWithRelationInput;

    // Projection « annuaire » : la liste est largement accessible (requireAuth),
    // on n'y expose donc pas les données personnelles sensibles (adresse, date de
    // naissance, RCCM, CNSS, observations) — celles-ci ne sont servies que par la
    // fiche GET /:id, réservée à SG/Bâtonnier (RG-15).
    const selectAnnuaire = {
      id: true, num: true, numInscription: true, nom: true, qualite: true,
      statut: true, sexe: true, cabinet: true, tel: true, email: true, dateInscription: true,
      dateServment: true, dureeMois: true, maitreStage: true,
      // Dates de radiation/décès : exportables. motifRadiation : donnée disciplinaire
      // (loi 29-2019 art. 16, RG-13), servie uniquement par la fiche GET /:id.
      dateRadiation: true, dateDeces: true,
    } satisfies Prisma.MembreSelect;

    const [items, total] = await Promise.all([
      prisma.membre.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, select: selectAnnuaire }),
      prisma.membre.count({ where }),
    ]);
    res.json({ items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  })
);

const exportPdfQuery = z.object({
  q: z.string().max(100).optional(),
  statut: z.string().max(20).optional(),
  qualite: z.string().max(20).optional(),
  qualiteNot: z.string().max(20).optional(),
  ids: z.string().regex(/^\d{1,9}(,\d{1,9})*$/).refine((v) => v.split(",").length <= 200, "200 identifiants maximum").optional(),
});

/**
 * Écrit (et attend) la ligne d'audit d'un export : pas de trace, pas d'export (C-04).
 * Pose auditFait pour que le middleware générique n'écrive pas de doublon.
 */
async function tracerExport(req: AuthRequest, methode: string, chemin: string, detail: string) {
  (req.res as { locals: Record<string, unknown> }).locals.auditFait = true;
  await prisma.journalAudit.create({
    data: {
      action: "Export de la liste des avocats", cible: detail.slice(0, 250), methode, chemin, statut: methode === "GET" ? 200 : 204,
      ip: (req.ip ?? "").replace(/^::ffff:/, "") || null, userId: req.user?.id ?? null, userNom: req.user?.nom ?? null,
    },
  });
}

/**
 * GET /membres/export/pdf — liste (filtrée ou sélection par ids) en PDF.
 * Extraction en masse : permission « membres » (l'AVOCAT est déjà bloqué par
 * confinementAvocat) ; projection annuaire sans motifRadiation ; journalisée (C-04).
 */
membresRouter.get(
  "/export/pdf",
  requirePermission("membres"),
  asyncH(async (req: AuthRequest, res) => {
    const p = exportPdfQuery.safeParse(req.query);
    if (!p.success) throw new HttpError(400, "Paramètres d'export invalides");
    const ids = p.data.ids?.split(",").map(Number);
    const where: Prisma.MembreWhereInput = { ...whereMembres(p.data), ...(ids ? { id: { in: ids } } : {}) };
    const membres = await prisma.membre.findMany({
      where, orderBy: { num: "asc" },
      select: { num: true, numInscription: true, nom: true, qualite: true, statut: true, cabinet: true, tel: true, email: true, dateInscription: true, dateRadiation: true, dateDeces: true },
    });
    const filtre = [
      ids ? `sélection de ${ids.length}` : "",
      p.data.statut ? `statut ${STATUT_FR[p.data.statut] ?? p.data.statut}` : "",
      p.data.qualite ? `qualité ${QUALITE_FR[p.data.qualite] ?? p.data.qualite}` : "",
      p.data.q ? `recherche « ${p.data.q} »` : "",
    ].filter(Boolean).join(", ") || "tous";
    // Rendu puis audit AVANT l'envoi : si l'audit échoue, aucune donnée nominative
    // n'est livrée (traçabilité C-04) et le gestionnaire d'erreur répond en 500.
    const pdf = await htmlVersPdf(listeAvocatsHtml(membres, filtre, new Date()));
    await tracerExport(req, "GET", "/api/membres/export/pdf", `format=pdf; filtre=${filtre}; lignes=${membres.length}`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Avocats-${new Date().toISOString().slice(0, 10)}.pdf"`);
    res.end(pdf);
  })
);

/**
 * POST /membres/export — trace un export généré côté client (CSV/XLSX/TXT, ou PDF
 * de repli) : le fichier est produit dans le navigateur, seule la journalisation
 * passe par le serveur (loi 29-2019 art. 63-64, avis C-04). La ligne d'audit est écrite
 * (et attendue) avant la réponse 204 : si elle échoue, 500 et aucun fichier côté client.
 */
const exportJournalSchema = z.object({
  format: z.enum(["csv", "xlsx", "txt", "pdf-local"]),
  filtre: z.string().trim().max(200),
  lignes: z.number().int().min(0).max(100000),
});
membresRouter.post(
  "/export",
  requirePermission("membres"),
  asyncH(async (req: AuthRequest, res) => {
    const { format, filtre, lignes } = exportJournalSchema.parse(req.body);
    await tracerExport(req, "POST", "/api/membres/export", `format=${format}; filtre=${filtre || "tous"}; lignes=${lignes}`);
    res.status(204).end();
  })
);

/**
 * GET /membres/:id — fiche complète (cotisations/reçus/quitus imbriqués).
 * Données nominatives + financières : réservé à l'institutionnel (SG/Bâtonnier),
 * contrairement à la liste `GET /` qui alimente l'annuaire ouvert. Cf. RG-15.
 */
membresRouter.get(
  "/:id",
  requireRole("SECRETAIRE_GENERAL", "BATONNIER"),
  asyncH(async (req, res) => {
    const membre = await prisma.membre.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        cotisations: { orderBy: { annee: "desc" } },
        recus: { orderBy: { date: "desc" } },
        quitus: { orderBy: { dateEmission: "desc" } },
      },
    });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    res.json(membre);
  })
);

// ─── Pièces du dossier (vérification documentaire — KYC proportionné) ─────────
const TYPES_PIECE = ["IDENTITE", "DIPLOME", "SERMENT", "PHOTO", "CASIER", "AUTRE"] as const;
const MAX_TAILLE = 5 * 1024 * 1024; // 5 Mo

const uploadPieceSchema = z.object({
  type: z.enum(TYPES_PIECE),
  nomFichier: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  donnees: z.string().min(1), // base64 sans préfixe data:
});

/** GET /membres/:id/pieces — pièces du dossier (SG / Bâtonnier). */
membresRouter.get(
  "/:id/pieces",
  requireRole("SECRETAIRE_GENERAL", "BATONNIER"),
  asyncH(async (req, res) => {
    res.json(await prisma.pieceDossier.findMany({ where: { membreId: Number(req.params.id) }, orderBy: { createdAt: "desc" } }));
  })
);

/** POST /membres/:id/pieces — téléversement d'une pièce (SG / Admin). */
membresRouter.post(
  "/:id/pieces",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req: AuthRequest, res) => {
    const membreId = Number(req.params.id);
    const membre = await prisma.membre.findUnique({ where: { id: membreId } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    const data = uploadPieceSchema.parse(req.body);
    const tailleEstimee = Math.floor((data.donnees.length * 3) / 4);
    if (tailleEstimee > MAX_TAILLE) throw new HttpError(413, "Fichier trop volumineux (max 5 Mo).");
    const ext = path.extname(data.nomFichier).slice(0, 12);
    const { chemin, taille } = enregistrerFichier(`pieces/${membreId}`, data.donnees, ext);
    const piece = await prisma.pieceDossier.create({
      data: { membreId, type: data.type, nomFichier: data.nomFichier, fichier: chemin, mimeType: data.mimeType, taille },
    });
    res.status(201).json(piece);
  })
);

const inscriptionSchema = z.object({
  nom: z.string().min(1),
  qualite: z.enum(["AVOCAT", "STAGIAIRE", "HONORAIRE"]).default("AVOCAT"),
  statut: z.enum(["INSCRIT", "SUSPENDU", "RADIE", "OMIS", "HONORAIRE", "STAGIAIRE", "DECEDE"]).default("INSCRIT"),
  sexe: z.enum(["H", "F"]).nullable().optional(),
  cabinet: z.string().optional(),
  tel: z.string().optional(),
  email: z.string().optional(),
  rccm: z.string().optional(),
  cnss: z.string().optional(),
  adresse: z.string().optional(),
  observations: z.string().optional(),
  dateNaissance: z.string().optional(),
  dateInscription: z.string().optional(),
  // Champs de stage (avocats stagiaires).
  dateServment: z.string().optional(),
  maitreStage: z.string().optional(),
  dureeMois: z.coerce.number().int().positive().max(120).optional(),
});

/** POST /membres — inscription d'un avocat (FR-AV-01). SG/Admin. */
membresRouter.post(
  "/",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const data = inscriptionSchema.parse(req.body);
    // Radiation et décès exigent une date d'acte validée : routes /radier et /deces.
    if (data.statut === "RADIE" || data.statut === "DECEDE")
      throw new HttpError(400, "Création impossible en statut radié ou décédé : utilisez la radiation ou la déclaration de décès.");
    // Rejeu sur collision : deux inscriptions concurrentes calculeraient le même
    // `num` (max+1) ; la contrainte @unique(num) rejette, on recalcule et réessaie.
    const membre = await avecRejeuUnicite(async () => {
      const { num, numInscription } = await prochainNumInscription();
      return prisma.membre.create({
      data: {
        num,
        numInscription,
        nom: data.nom,
        qualite: data.qualite,
        statut: data.statut,
        sexe: data.sexe ?? null,
        cabinet: data.cabinet,
        tel: data.tel,
        email: data.email,
        rccm: data.rccm,
        cnss: data.cnss,
        adresse: data.adresse,
        observations: data.observations,
        dateNaissance: data.dateNaissance ? new Date(data.dateNaissance) : null,
        dateInscription: data.dateInscription ? new Date(data.dateInscription) : new Date(),
        dateServment: data.dateServment ? new Date(data.dateServment) : undefined,
        maitreStage: data.maitreStage,
        dureeMois: data.dureeMois,
      },
      });
    });
    res.status(201).json(membre);
  })
);

/**
 * POST /membres/import — mise à jour du tableau du Barreau par lot (NFR-10).
 * Upsert par numéro d'inscription (num) : met à jour les membres existants,
 * crée les nouveaux. Renvoie un résumé (créés / mis à jour / erreurs par ligne).
 */
const importRowSchema = z.object({
  num: z.coerce.number().int().positive(),
  nom: z.string().min(1),
  qualite: z.string().optional(),
  statut: z.string().optional(),
  sexe: z.string().optional(),
  cabinet: z.string().optional(),
  tel: z.string().optional(),
  email: z.string().optional(),
  rccm: z.string().optional(),
  cnss: z.string().optional(),
  adresse: z.string().optional(),
  observations: z.string().optional(),
  maitreStage: z.string().optional(),
  dateNaissance: z.string().optional(),
  dateInscription: z.string().optional(),
  dateServment: z.string().optional(),
  dateRadiation: z.string().optional(),
  motifRadiation: z.string().optional(),
  dateDeces: z.string().optional(),
});

const QUALITES: Record<string, "AVOCAT" | "STAGIAIRE" | "HONORAIRE"> = { avocat: "AVOCAT", stagiaire: "STAGIAIRE", honoraire: "HONORAIRE" };
// Typé sur l'enum Prisma : toute nouvelle valeur de StatutMembre est acceptée ici sans retouche du type.
const STATUTS: Record<string, StatutMembre> = {
  inscrit: "INSCRIT", suspendu: "SUSPENDU", radie: "RADIE", "radié": "RADIE", "radiée": "RADIE", "radiee": "RADIE",
  suspendue: "SUSPENDU", omis: "OMIS", omise: "OMIS", honoraires: "HONORAIRE", stagiaires: "STAGIAIRE", inscrite: "INSCRIT", honoraire: "HONORAIRE", stagiaire: "STAGIAIRE",
  decede: "DECEDE", "décédé": "DECEDE", "décédée": "DECEDE", "decedee": "DECEDE",
};
// Normalise le sexe importé (« H »/« Homme »/« M »/« Masculin » → H ; « F »/« Femme » → F).
const SEXES: Record<string, "H" | "F"> = { h: "H", homme: "H", m: "H", masculin: "H", f: "F", femme: "F", feminin: "F", "féminin": "F" };
const normSexe = (v?: string): "H" | "F" | undefined => SEXES[(v ?? "").toString().trim().toLowerCase()];
const norm = <T,>(v: string | undefined, map: Record<string, T>, def: T): T => map[(v ?? "").toString().trim().toLowerCase()] ?? def;
// Formats acceptés : AAAA-MM-JJ (suivi éventuel d'une heure ISO) ou JJ/MM/AAAA (Excel FR). Tout autre → ignoré.
// Jamais new Date(chaîne) brut : « 09/10/2026 » serait lu MM/JJ par V8 (inversion silencieuse).
const toDate = (v?: string) => {
  const s = (v ?? "").toString().trim();
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  const iso = fr ? `${fr[3]}-${fr[2]}-${fr[1]}` : s;
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return undefined;
  const d = new Date(iso);
  // Jour inexistant (31/02) : Date déborde sur le mois suivant, on refuse.
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso.slice(0, 10) ? undefined : d;
};

membresRouter.post(
  "/import",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    // Plafond sur le lot ; chaque ligne est validée à part : une ligne invalide (ex. num non numérique) est rapportée dans erreurs[] sans bloquer les autres.
    const rows = z.array(z.unknown()).max(2000).parse(req.body?.membres ?? []);
    // Qualité par défaut des lignes sans colonne « qualité » explicite. Permet à la
    // page « Avocats stagiaires » d'importer directement des stagiaires ; défaut
    // « AVOCAT » (rétro-compatible avec la page « Avocats inscrits »).
    const qualiteDefaut = z.enum(["AVOCAT", "STAGIAIRE", "HONORAIRE"]).catch("AVOCAT").parse(req.body?.qualiteDefaut);
    let crees = 0;
    let maj = 0;
    const erreurs: { ligne: number; message: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const valide = importRowSchema.safeParse(rows[i]);
      if (!valide.success) {
        erreurs.push({ ligne: i + 1, message: valide.error.issues.map((x) => `${x.path.join(".")} : ${x.message}`).join(" ; ") });
        continue;
      }
      const r = valide.data;
      try {
        // Statut présent mais inconnu (faute de frappe) : erreur de ligne, jamais de retour silencieux à INSCRIT.
        if (r.statut?.trim() && !STATUTS[r.statut.trim().toLowerCase()]) {
          erreurs.push({ ligne: i + 1, message: `Statut inconnu : ${r.statut}` });
          continue;
        }
        const qualite = norm(r.qualite, QUALITES, qualiteDefaut);
        const statut = norm(r.statut, STATUTS, qualite === "STAGIAIRE" ? "STAGIAIRE" : qualite === "HONORAIRE" ? "HONORAIRE" : "INSCRIT");
        const base = {
          nom: r.nom, qualite, statut, sexe: normSexe(r.sexe),
          cabinet: r.cabinet, tel: r.tel, email: r.email, rccm: r.rccm, cnss: r.cnss,
          adresse: r.adresse, observations: r.observations, maitreStage: r.maitreStage,
          dateNaissance: toDate(r.dateNaissance), dateServment: toDate(r.dateServment),
          // dateRadiation / motifRadiation / dateDeces ne sont jamais écrits par import (colonnes lues
          // et ignorées) : les actes passent par /radier, /deces ou PATCH (machine à états cycleVie).
        };
        const existant = await prisma.membre.findUnique({ where: { num: r.num } });
        // RADIE/DECEDE ne s'obtiennent (ni ne se quittent) par import : seuls /radier, /deces et PATCH
        // valident la date d'acte et laissent une trace d'audit individuelle. Même statut = aller-retour autorisé.
        const horsTableau = (s: StatutMembre) => (STATUTS_HORS_TABLEAU as readonly string[]).includes(s);
        if (r.statut?.trim() && (existant ? existant.statut !== statut : true) && (horsTableau(statut) || (existant && horsTableau(existant.statut)))) {
          erreurs.push({ ligne: i + 1, message: "Changement de statut vers ou depuis radié/décédé interdit à l'import : utilisez la fiche de l'avocat (Radier / Déclarer le décès / Modifier)." });
          continue;
        }
        if (existant) {
          // Colonne statut absente du fichier : le statut existant n'est pas écrasé.
          // Aller-retour export → import : l'export écrit le seul jour (AAAA-MM-JJ) ; si le jour est
          // inchangé, l'horodatage existant est conservé (aucune perte de précision).
          const dIns = toDate(r.dateInscription);
          const memeJour = dIns && existant.dateInscription && dIns.toISOString().slice(0, 10) === existant.dateInscription.toISOString().slice(0, 10);
          const data = { ...base, statut: r.statut?.trim() ? statut : undefined, dateInscription: memeJour ? undefined : dIns };
          const m = await prisma.membre.update({ where: { num: r.num }, data });
          // Cohérence de l'espace avocat (décédé/radié → compte coupé ; rétabli sinon).
          if (m.statut !== existant.statut) await synchroniserAccesAuStatut(m.id, m.statut);
          maj += 1;
        } else {
          await prisma.membre.create({
            data: { num: r.num, numInscription: `T${r.num}`, ...base, dateInscription: toDate(r.dateInscription) ?? new Date() },
          });
          crees += 1;
        }
      } catch (e) {
        erreurs.push({ ligne: i + 1, message: e instanceof Error ? e.message : "Erreur" });
      }
    }
    // Détail ajouté à la ligne JournalAudit « Import du tableau » (middleware audit, C-05).
    res.locals.auditDetail = `${rows.length} ligne(s), ${crees} créé(s), ${maj} mis à jour, ${erreurs.length} erreur(s)`;
    res.json({ total: rows.length, crees, maj, erreurs });
  })
);

/** Date « AAAA-MM-JJ » qui ne peut pas être postérieure à aujourd'hui (décision notifiée, acte de décès). */
const datePassee = z.string().date().refine((d) => new Date(d) <= new Date(), "La date ne peut pas être postérieure à aujourd'hui");

/** Date d'acte « AAAA-MM-JJ » passée, optionnelle et effaçable (null) : correction d'une saisie par le SG. */
const dateNullable = datePassee.nullable().optional();
// Référence/objet de la décision du Conseil (loi 026-92, art. 36-39), pas un récit des faits.
const motifRadiation = z.string().trim().max(300);
const editSchema = inscriptionSchema.partial().extend({
  dateRadiation: dateNullable,
  motifRadiation: motifRadiation.nullable().optional(),
  dateDeces: dateNullable,
});
/** undefined → champ non touché ; null → effacé ; chaîne → Date. */
const versDate = (v: string | null | undefined) => (v == null ? v : new Date(v));

/** PATCH /membres/:id — modification de la fiche (FR-AV-01). SG/Admin. */
membresRouter.patch(
  "/:id",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const data = editSchema.parse(req.body);
    const id = Number(req.params.id);
    const actuel = await prisma.membre.findUnique({ where: { id }, select: { statut: true, dateRadiation: true, motifRadiation: true, dateDeces: true } });
    if (!actuel) throw new HttpError(404, "Avocat introuvable");
    // Statut et données d'acte passent par la machine à états (cohérence, dates requises).
    const cycle = appliquerCycleVie(actuel, {
      statut: data.statut, dateRadiation: versDate(data.dateRadiation), motifRadiation: data.motifRadiation, dateDeces: versDate(data.dateDeces),
    });
    const membre = await prisma.membre.update({
      where: { id },
      data: {
        ...data,
        dateNaissance: data.dateNaissance ? new Date(data.dateNaissance) : undefined,
        dateInscription: data.dateInscription ? new Date(data.dateInscription) : undefined,
        // La date de prestation de serment est reçue en chaîne : convertir en Date
        // (sinon Prisma rejette). Permet de renseigner/corriger le serment d'un
        // stagiaire depuis sa fiche, sans passer par un ré-import.
        dateServment: data.dateServment ? new Date(data.dateServment) : undefined,
        ...cycle,
      },
    });
    // L'accès espace suit le statut (suspendu/radié/omis/décédé → coupé ; régulier → rétabli).
    await synchroniserAccesAuStatut(membre.id, membre.statut);
    res.json(membre);
  })
);

const radiationSchema = z.object({
  dateRadiation: datePassee.optional(),
  motifRadiation: motifRadiation.optional(),
});

/**
 * POST /membres/:id/radier — enregistre une radiation prononcée par le Conseil
 * (l'outil n'est qu'un registre d'exécution). Corps optionnel : date (défaut :
 * aujourd'hui) et référence de la décision. SG/Admin.
 */
membresRouter.post(
  "/:id/radier",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const data = radiationSchema.parse(req.body ?? {});
    const id = Number(req.params.id);
    const actuel = await prisma.membre.findUnique({ where: { id }, select: { statut: true, dateRadiation: true, motifRadiation: true, dateDeces: true } });
    if (!actuel) throw new HttpError(404, "Avocat introuvable");
    if (actuel.statut === "RADIE") throw new HttpError(409, "Cet avocat est déjà radié : corrigez la date ou la référence par « Modifier ».");
    const cycle = appliquerCycleVie(actuel, {
      statut: "RADIE", dateRadiation: data.dateRadiation ? new Date(data.dateRadiation) : new Date(), motifRadiation: data.motifRadiation ?? null,
    });
    const membre = await prisma.membre.update({ where: { id }, data: cycle });
    await synchroniserAccesAuStatut(membre.id, membre.statut);
    res.json(membre);
  })
);

/**
 * POST /membres/:id/deces — déclaration de décès sur présentation de l'acte.
 * Date obligatoire, non future. Statut DECEDE : compte espace désactivé et
 * jetons révoqués (synchroniserAccesAuStatut). SG/Admin.
 */
membresRouter.post(
  "/:id/deces",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const { dateDeces } = z.object({ dateDeces: datePassee }).parse(req.body ?? {});
    const id = Number(req.params.id);
    const actuel = await prisma.membre.findUnique({ where: { id }, select: { statut: true, dateRadiation: true, motifRadiation: true, dateDeces: true } });
    if (!actuel) throw new HttpError(404, "Avocat introuvable");
    if (actuel.statut === "DECEDE") throw new HttpError(409, "Le décès de cet avocat est déjà enregistré : corrigez la date par « Modifier ».");
    const membre = await prisma.membre.update({ where: { id }, data: appliquerCycleVie(actuel, { statut: "DECEDE", dateDeces: new Date(dateDeces) }) });
    await synchroniserAccesAuStatut(membre.id, membre.statut);
    res.json(membre);
  })
);

// ── Cycle du stage (avocats stagiaires) ──────────────────────────────────────

/** Nom lisible de l'agent connecté (auteur d'un rapport / validateur). */
async function nomActeur(userId: number) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { nom: true } });
  return u?.nom ?? null;
}

const rapportSchema = z.object({
  periode: z.string().trim().min(1).max(80),
  appreciation: z.string().trim().min(1).max(2000),
  note: z.string().trim().max(120).optional(),
});

/** GET /membres/:id/rapports — rapports/évaluations de stage (SG / Bâtonnier). */
membresRouter.get(
  "/:id/rapports",
  requireRole("SECRETAIRE_GENERAL", "BATONNIER"),
  asyncH(async (req, res) => {
    res.json(await prisma.rapportStage.findMany({ where: { membreId: Number(req.params.id) }, orderBy: { date: "desc" } }));
  })
);

/** POST /membres/:id/rapports — consigne un rapport de stage (SG). */
membresRouter.post(
  "/:id/rapports",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req: AuthRequest, res) => {
    const membreId = Number(req.params.id);
    const membre = await prisma.membre.findUnique({ where: { id: membreId }, select: { qualite: true } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    if (membre.qualite !== "STAGIAIRE") throw new HttpError(400, "Les rapports de stage ne concernent que les avocats stagiaires.");
    const data = rapportSchema.parse(req.body);
    const auteur = await nomActeur(req.user!.id);
    res.status(201).json(await prisma.rapportStage.create({ data: { membreId, ...data, auteur } }));
  })
);

/** DELETE /membres/:id/rapports/:rid — retire un rapport de stage (SG). */
membresRouter.delete(
  "/:id/rapports/:rid",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    await prisma.rapportStage.deleteMany({ where: { id: Number(req.params.rid), membreId: Number(req.params.id) } });
    res.status(204).end();
  })
);

/**
 * POST /membres/:id/valider-stage — validation de fin de stage (Bâtonnier) :
 * l'avocat stagiaire passe au tableau des avocats (qualité AVOCAT, statut INSCRIT).
 */
membresRouter.post(
  "/:id/valider-stage",
  requireRole("BATONNIER"),
  asyncH(async (req: AuthRequest, res) => {
    const membreId = Number(req.params.id);
    const membre = await prisma.membre.findUnique({ where: { id: membreId } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    if (membre.qualite !== "STAGIAIRE") throw new HttpError(409, "Ce membre n'est pas un avocat stagiaire.");
    const acteur = await nomActeur(req.user!.id);
    const maj = await prisma.membre.update({
      where: { id: membreId },
      data: { qualite: "AVOCAT", statut: "INSCRIT", stageValideAt: new Date(), stageValidePar: acteur ?? undefined },
    });
    await archiver({ categorie: "Fin de stage", titre: `Fin de stage validée — Me ${membre.nom}`, reference: `STAGE-${membre.num}`, date: new Date(), membreNom: membre.nom });
    res.json(maj);
  })
);

/**
 * DELETE /membres/:id — suppression définitive d'un membre (avocat/stagiaire),
 * réservée aux erreurs de saisie et doublons. ADMIN seul. Refusée (409) dès
 * qu'une pièce comptable existe (reçu, paiement, quitus) : l'AUDCIF OHADA
 * impose leur conservation 10 ans — la radiation ou le décès sont alors la
 * seule voie. Sans pièce, les relations à cascade déclarée (cotisations,
 * droits de plaidoirie, pièces du dossier) et la mise à NULL des dossiers
 * disciplinaires sont assurées au niveau base par les contraintes FK.
 */
membresRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const membre = await prisma.membre.findUnique({ where: { id } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    const pieces = await Promise.all([
      prisma.recu.count({ where: { membreId: id } }),
      prisma.paiement.count({ where: { membreId: id } }),
      prisma.quitus.count({ where: { membreId: id } }),
    ]);
    if (pieces.some((n) => n > 0)) {
      throw new HttpError(409, "Suppression impossible : pièces comptables à conserver 10 ans (OHADA) ; utilisez radiation ou décès");
    }
    await prisma.membre.delete({ where: { id } });
    res.json({ ok: true, nom: membre.nom });
  })
);

/**
 * POST /membres/:id/acces — provisionne (ou renvoie) l'accès à l'espace avocat
 * pour un membre. Réservé au Secrétariat Général / Admin. Crée un compte de rôle
 * AVOCAT rattaché à la fiche, inactif, avec un lien d'activation à durée limitée :
 * l'avocat choisit lui-même son mot de passe (le secrétariat ne le connaît
 * jamais). Si un accès non encore activé existe, le lien est régénéré (renvoi).
 */
membresRouter.post(
  "/:id/acces",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const acces = await provisionnerAccesEspace(Number(req.params.id));
    res.status(201).json({ ok: true, ...acces });
  })
);

/** POST /membres/:id/attestation — génère + archive l'attestation (FR-AV-05). */
membresRouter.post(
  "/:id/attestation",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const membre = await prisma.membre.findUnique({ where: { id: Number(req.params.id) } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    if ((STATUTS_HORS_TABLEAU as readonly string[]).includes(membre.statut)) throw new HttpError(409, "Attestation impossible : membre radié ou décédé");
    const numero = await prochainNumeroAttestation();
    const date = new Date();
    await archiver({
      categorie: "Attestation d'inscription",
      titre: `Attestation ${numero} — Me ${membre.nom}`,
      reference: numero,
      date,
      membreNom: membre.nom,
    });
    res.status(201).json({ numero, membreNom: membre.nom, date });
  })
);

/** GET /membres/:id/attestation/pdf — génère, archive et renvoie l'attestation en PDF. */
membresRouter.get(
  "/:id/attestation/pdf",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const membre = await prisma.membre.findUnique({ where: { id: Number(req.params.id) } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    if ((STATUTS_HORS_TABLEAU as readonly string[]).includes(membre.statut)) throw new HttpError(409, "Attestation impossible : membre radié ou décédé");
    const numero = await prochainNumeroAttestation();
    const date = new Date();
    await archiver({ categorie: "Attestation d'inscription", titre: `Attestation ${numero} — Me ${membre.nom}`, reference: numero, date, membreNom: membre.nom });
    await envoyerPdf(res, attestationHtml(membre, numero, date), `Attestation-${numero}.pdf`);
  })
);
