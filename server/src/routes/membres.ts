import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { StatutMembre, type Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, requirePermission, REFUS, type AuthRequest } from "../middleware/auth.js";
import { prochainNumInscription, prochainNumeroAttestation, archiver, avecRejeuUnicite, STATUTS_HORS_TABLEAU, STATUTS_SORTIS, peutAttesterInscription, tarifsActuels, cotisationDue, statutCotisation } from "../lib/business.js";
import { aLaPermission } from "../lib/rbac.js";
import { enregistrerFichier } from "../lib/storage.js";
import { envoyerPdf, htmlVersPdf } from "../lib/pdf.js";
import { attestationHtml, attestationSortieHtml, listeAvocatsHtml, STATUT_FR, QUALITE_FR } from "../lib/templates.js";
import { appliquerCycleVie, changerSituation, dossierRadiation, ficheModifiee, reconcilierAcces } from "../lib/cycleVie.js";
import { reglesActuelles } from "../lib/regles.js";
import { urlVerif } from "../lib/signature.js";
import { realtimeTous } from "../lib/realtime.js";
import { provisionnerAccesEspace } from "../lib/acces.js";

export const membresRouter = Router();
membresRouter.use(requireAuth);

const TRI_AUTORISE = new Set(["num", "nom", "cabinet", "statut", "dateInscription"]);

/** Auteur d'un changement de situation (dénormalisé dans EvenementSituation). */
const acteurDe = (req: AuthRequest) => ({ id: req.user?.id ?? null, nom: req.user?.nom ?? null });

/** Filtres communs à la liste et à l'export PDF. Une valeur hors énum est ignorée
 *  (→ undefined) plutôt que transmise à Prisma, qui lèverait une 500. */
function whereMembres(query: Record<string, unknown>): Prisma.MembreWhereInput {
  const q = String(query.q ?? "").trim();
  const QUALITES = ["AVOCAT", "STAGIAIRE", "HONORAIRE"];
  const STATUTS: string[] = Object.values(StatutMembre); // dérivé de l'enum Prisma, jamais dupliqué (D6)
  const dansEnum = (v: unknown, set: string[]) => (typeof v === "string" && set.includes(v) ? v : undefined);
  const qualite = dansEnum(query.qualite, QUALITES);
  const qualiteNot = dansEnum(query.qualiteNot, QUALITES);
  const statut = dansEnum(query.statut, STATUTS);
  // O1 : un statut explicite s'applique tel quel ; sortis=1 = registre des anciens membres ;
  // sinon les sortis sont exclus (une sélection explicite par ids de l'export reste servie).
  const registre = estRegistre(query);
  const motif = dansEnum(query.motif, SORTIS);
  const plage = { ...(jourQuery(query.du) ? { gte: jourQuery(query.du) } : {}), ...(jourQuery(query.au, true) ? { lte: jourQuery(query.au, true) } : {}) };
  const filtreStatut = statut ? { statut: statut as any } : registre ? { statut: (motif ?? { in: SORTIS }) as any } : query.ids ? {} : { statut: { notIn: SORTIS as any } };
  // Période sur la date d'effet du (dernier) événement de sortie ; repli sur dateRadiation /
  // dateDeces pour les fiches importées sans événement.
  // ponytail: « some » teste toute sortie dans la plage, pas seulement la dernière (sorties multiples rares).
  const periode = registre && Object.keys(plage).length
    ? { AND: [{ OR: [
      { evenements: { some: { statutApres: { in: SORTIS as any }, dateEffet: plage } } },
      { evenements: { none: { statutApres: { in: SORTIS as any } } }, OR: [{ dateRadiation: plage }, { dateDeces: plage }] },
    ] }] }
    : {};
  return {
    ...(qualite ? { qualite: qualite as any } : {}),
    ...(qualiteNot ? { qualite: { not: qualiteNot as any } } : {}),
    ...filtreStatut,
    ...periode,
    ...(q ? { OR: [{ nom: { contains: q, mode: "insensitive" } }, { cabinet: { contains: q, mode: "insensitive" } }] } : {}),
  };
}

// ── Anciens membres (O1) ──
const SORTIS: string[] = [...STATUTS_SORTIS];
/** Motif de sortie dérivé du statut ; « Sortie du tableau » remplace la radiation sans permission discipline (R-62). */
const MOTIF_SORTIE: Record<string, string> = { RADIE: "Radiation", DECEDE: "Décès", DEMISSIONNAIRE: "Démission", RETRAITE: "Retraite", CESSATION: "Cessation d'activité" };
const estRegistre = (query: Record<string, unknown>) => (query.sortis === "1" || query.sortis === "true") && !query.statut;
/** Date AAAA-MM-JJ d'un filtre (fin de journée si `fin`) ; toute autre valeur est ignorée. */
const jourQuery = (v: unknown, fin = false) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? new Date(`${v}T${fin ? "23:59:59.999" : "00:00:00.000"}Z`) : undefined;
/** Dernier événement de sortie, joint à la projection du registre. */
const derniereSortie = { evenements: { where: { statutApres: { in: SORTIS as any } }, orderBy: [{ dateEffet: "desc" }, { id: "desc" }], take: 1, select: { dateEffet: true } } } satisfies Prisma.MembreSelect;

/** Sorties masquées sans discipline (tout sauf le décès, PO-21) : filtrer sur l'une d'elles permettrait de déduire les radiés par élimination. */
const SORTIES_MASQUEES = ["RADIE", "DEMISSIONNAIRE", "RETRAITE", "CESSATION"];
/** R-62 : lister ces sorties (statut ou motif) exige la permission discipline — liste, registre et export (T27, R1-4). */
function gardeRadies(req: AuthRequest, query: Record<string, unknown>): void {
  if ((SORTIES_MASQUEES.includes(String(query.statut)) || SORTIES_MASQUEES.includes(String(query.motif))) && !aLaPermission(req.user!.role, "discipline"))
    throw new HttpError(403, "Le motif disciplinaire est réservé aux personnes habilitées");
}

/** Registre : permission « membres » exigée. Renvoie le droit « discipline » (masquage R-62 des lignes). */
function droitDiscipline(req: AuthRequest): boolean {
  if (!aLaPermission(req.user!.role, "membres")) throw new HttpError(403, REFUS);
  return aLaPermission(req.user!.role, "discipline");
}

/** Ligne du registre : motif et date de sortie ; radiation masquée sans permission discipline. */
function ligneSortie<T extends { statut: string; dateRadiation: Date | null; dateDeces: Date | null; evenements: { dateEffet: Date }[] }>(m: T, voitDiscipline: boolean) {
  const { evenements, ...reste } = m;
  const dateSortie = evenements[0]?.dateEffet ?? m.dateRadiation ?? m.dateDeces ?? null;
  // Radié, démissionnaire, retraité et cessation partagent le même libellé : la radiation ne se déduit pas par élimination (R-62). Le décès reste « Décès », sans cause.
  if (SORTIES_MASQUEES.includes(m.statut) && !voitDiscipline) return { ...reste, statut: null, dateRadiation: null, motifSortie: "Sortie du tableau", dateSortie };
  return { ...reste, motifSortie: MOTIF_SORTIE[m.statut], dateSortie };
}

/** Description du filtre du registre pour le journal (jamais de valeur disciplinaire au-delà du code demandé). */
const filtreRegistre = (query: Record<string, unknown>) =>
  [`motif=${typeof query.motif === "string" && SORTIS.includes(query.motif) ? query.motif : "tous"}`, jourQuery(query.du) ? `du=${query.du}` : "", jourQuery(query.au) ? `au=${query.au}` : ""].filter(Boolean).join("; ");

/** GET /membres — liste filtrée, triée et paginée côté serveur (FR-AV-02/03). */
membresRouter.get(
  "/",
  asyncH(async (req, res) => {
    gardeRadies(req as AuthRequest, req.query);
    const where = whereMembres({ ...req.query, ids: undefined }); // « ids » ne vaut que pour l'export
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 20)));
    const sort = String(req.query.sort ?? "num");
    const order = req.query.order === "desc" ? "desc" : "asc";

    const champ = TRI_AUTORISE.has(sort) ? sort : "num";
    // Date d'inscription facultative : sans « nulls last », PostgreSQL place les fiches non datées en tête
    // du tri décroissant et masque les inscriptions les plus récentes (parcours 2 du §5).
    const orderBy = { [champ]: champ === "dateInscription" ? { sort: order, nulls: "last" } : order } as Prisma.MembreOrderByWithRelationInput;

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

    const totalPages = (total: number) => Math.max(1, Math.ceil(total / pageSize));
    if (estRegistre(req.query)) {
      // Registre des anciens membres (O1) : motif et date de sortie, consultation tracée (avant envoi, C-04).
      const voit = droitDiscipline(req as AuthRequest);
      const [lignes, total] = await Promise.all([
        prisma.membre.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, select: { ...selectAnnuaire, ...derniereSortie } }),
        prisma.membre.count({ where }),
      ]);
      await tracerExport(req as AuthRequest, "GET", "/api/membres", `${filtreRegistre(req.query)}; lignes=${total}`, "Consultation des anciens membres");
      return res.json({ items: lignes.map((m) => ligneSortie(m, voit)), total, page, pageSize, totalPages: totalPages(total) });
    }
    const [items, total] = await Promise.all([
      prisma.membre.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, select: selectAnnuaire }),
      prisma.membre.count({ where }),
    ]);
    res.json({ items, total, page, pageSize, totalPages: totalPages(total) });
  })
);

const exportPdfQuery = z.object({
  q: z.string().max(100).optional(),
  statut: z.string().max(20).optional(),
  qualite: z.string().max(20).optional(),
  qualiteNot: z.string().max(20).optional(),
  ids: z.string().regex(/^\d{1,9}(,\d{1,9})*$/).refine((v) => v.split(",").length <= 200, "200 identifiants maximum").optional(),
  sortis: z.enum(["1", "true"]).optional(),
  motif: z.string().max(20).optional(),
  du: z.string().max(10).optional(),
  au: z.string().max(10).optional(),
});

/**
 * Écrit (et attend) la ligne d'audit d'un export : pas de trace, pas d'export (C-04).
 * Pose auditFait pour que le middleware générique n'écrive pas de doublon.
 */
async function tracerExport(req: AuthRequest, methode: string, chemin: string, detail: string, action = "Export de la liste des avocats") {
  (req.res as { locals: Record<string, unknown> }).locals.auditFait = true;
  await prisma.journalAudit.create({
    data: {
      action, cible: detail.slice(0, 250), methode, chemin, statut: methode === "GET" ? 200 : 204,
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
    gardeRadies(req, p.data);
    const ids = p.data.ids?.split(",").map(Number);
    const where: Prisma.MembreWhereInput = { ...whereMembres(p.data), ...(ids ? { id: { in: ids } } : {}) };
    const registre = estRegistre(p.data);
    const voit = registre && droitDiscipline(req);
    const lignes = await prisma.membre.findMany({
      where, orderBy: { num: "asc" },
      select: { num: true, numInscription: true, nom: true, qualite: true, statut: true, cabinet: true, tel: true, email: true, dateInscription: true, dateRadiation: true, dateDeces: true, ...derniereSortie },
    });
    // Registre : la colonne « statut » porte le motif de sortie (masqué selon R-62).
    // T27 (R-62) : hors registre, une sélection par ids ne révèle pas non plus la radiation.
    const voitHorsRegistre = registre || aLaPermission(req.user!.role, "discipline");
    const membres = lignes.map(({ evenements, ...m }) => {
      if (!registre) return SORTIES_MASQUEES.includes(m.statut) && !voitHorsRegistre ? { ...m, statut: "Sortie du tableau", dateRadiation: null } : m;
      const l = ligneSortie({ ...m, evenements }, voit);
      return { ...l, statut: l.motifSortie };
    });
    const filtre = [
      registre ? `anciens membres (${filtreRegistre(p.data)})` : "",
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
        recus: { where: { statut: "EMIS" }, orderBy: { date: "desc" } },
        quitus: { orderBy: { dateEmission: "desc" } },
      },
    });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    // `verif` : chemin signé de la page /v (lien « Vérifier » de la fiche, T10).
    res.json({
      ...membre,
      recus: membre.recus.map((r) => ({ ...r, verif: urlVerif("r", r.numero) })),
      quitus: membre.quitus.map((q) => ({ ...q, verif: urlVerif("q", q.numero) })),
    });
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
  // Absent : STAGIAIRE pour un stagiaire, INSCRIT sinon (un stagiaire n'est jamais créé au tableau).
  statut: z.nativeEnum(StatutMembre).optional(),
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

/**
 * O11 — garde de création unique, partagée par POST /membres et la branche création de l'import
 * (même message des deux côtés). L'inscription, l'omission et les sanctions relèvent des organes de
 * l'Ordre (loi 026-92 art. 8, 35, 36) : aucun membre n'est créé directement omis, suspendu, sorti,
 * ni stagiaire au tableau. Renvoie le motif du refus, ou null si la création est permise.
 */
export function refusCreation(statut: StatutMembre, qualite: string): string | null {
  if ((STATUTS_SORTIS as readonly string[]).includes(statut))
    return "Statut de sortie (radié, décédé, démissionnaire, retraité, cessation) interdit à l'import comme à l'inscription : inscrivez l'avocat, puis enregistrez sa sortie depuis sa fiche (la radiation, par décision disciplinaire ; le décès, par sa déclaration).";
  if (statut === "OMIS")
    return "Création d'un membre omis interdite : l'omission suit le circuit de la fiche de l'avocat (onglet Situation), avec son historique.";
  if (statut === "SUSPENDU")
    return "Création d'un membre suspendu interdite : la suspension s'enregistre par la décision du dossier disciplinaire.";
  if (qualite === "STAGIAIRE" && (statut === "INSCRIT" || statut === "HONORAIRE"))
    return "Stagiaire au tableau interdit à la création (qualité stagiaire, statut inscrit ou honoraire) : inscrivez-le en stagiaire, puis utilisez « Valider la fin de stage » (fiche, onglet Stage).";
  return null;
}

/** POST /membres — inscription d'un avocat (FR-AV-01). SG/Admin. */
membresRouter.post(
  "/",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const parse = inscriptionSchema.parse(req.body);
    const data = { ...parse, statut: parse.statut ?? (parse.qualite === "STAGIAIRE" ? "STAGIAIRE" : "INSCRIT") };
    const refus = refusCreation(data.statut, data.qualite);
    // 400 conservé pour radié/décédé (acte daté obligatoire : /radier, /deces) ; 409 pour les autres.
    if (refus) throw new HttpError(data.statut === "RADIE" || data.statut === "DECEDE" ? 400 : 409, refus);
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
  demissionnaire: "DEMISSIONNAIRE", "démissionnaire": "DEMISSIONNAIRE",
  retraite: "RETRAITE", "retraité": "RETRAITE", "retraitée": "RETRAITE", retraitee: "RETRAITE",
  cessation: "CESSATION", "cessation d'activité": "CESSATION", "cessation d'activite": "CESSATION",
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

/** Nom comparable : sans casse, accents ni ponctuation, mots triés (« Jean DUPONT » = « Dupont, Jean »). */
const nomNorm = (n: string) => n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").sort().join(" ");
const COLONNES_IMPORT = Object.keys(importRowSchema.shape);

membresRouter.post(
  "/import",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req: AuthRequest, res) => {
    // ?simulation=1 : même validation, aucune écriture (aperçu avant confirmation, F-08).
    const simulation = req.query.simulation === "1";
    // Plafond sur le lot ; chaque ligne est validée à part : une ligne invalide (ex. num non numérique) est rapportée dans erreurs[] sans bloquer les autres.
    const rows = z.array(z.unknown()).max(2000).parse(req.body?.membres ?? []);
    // Qualité par défaut des lignes sans colonne « qualité » explicite. Permet à la
    // page « Avocats stagiaires » d'importer directement des stagiaires ; défaut
    // « AVOCAT » (rétro-compatible avec la page « Avocats inscrits »).
    const qualiteDefaut = z.enum(["AVOCAT", "STAGIAIRE", "HONORAIRE"]).catch("AVOCAT").parse(req.body?.qualiteDefaut);
    let crees = 0;
    let maj = 0;
    const erreurs: { ligne: number; message: string }[] = [];
    // Colonnes : une colonne obligatoire absente de tout le fichier est nommée ; les inconnues sont signalées.
    const cles = new Set(rows.flatMap((r) => (r && typeof r === "object" ? Object.keys(r) : [])));
    const manquantes = rows.length ? ["num", "nom"].filter((c) => !cles.has(c)) : [];
    const inconnues = [...cles].filter((c) => !COLONNES_IMPORT.includes(c));
    for (const c of manquantes) erreurs.push({ ligne: 0, message: `Colonne obligatoire manquante : « ${c} »` });
    // Doublons : numéro répété dans le fichier ; nom identique (normalisé) dans le fichier ou face à la base.
    const doublons: { ligne: number; type: "num" | "nom"; avec: "fichier" | "base"; num: number; nom: string; autreNum?: number }[] = [];
    const base = await prisma.membre.findMany({ select: { num: true, nom: true } });
    const baseParNom = new Map(base.map((m) => [nomNorm(m.nom), m.num]));
    const baseParNum = new Map(base.map((m) => [m.num, m.nom]));
    const vuNum = new Set<number>();
    const vuNom = new Map<string, number>();
    rows.forEach((raw, i) => {
      const v = importRowSchema.safeParse(raw);
      if (!v.success) return;
      const { num, nom } = v.data;
      const n = nomNorm(nom);
      if (vuNum.has(num)) doublons.push({ ligne: i + 1, type: "num", avec: "fichier", num, nom });
      // Numéro déjà en base sous un autre nom : collision suspecte (même nom = simple mise à jour).
      else if (baseParNum.has(num) && nomNorm(baseParNum.get(num)!) !== n) doublons.push({ ligne: i + 1, type: "num", avec: "base", num, nom });
      const autre = vuNom.get(n) ?? baseParNom.get(n);
      if (autre !== undefined && autre !== num) doublons.push({ ligne: i + 1, type: "nom", avec: vuNom.has(n) ? "fichier" : "base", num, nom, autreNum: autre });
      vuNum.add(num);
      if (!vuNom.has(n)) vuNom.set(n, num);
    });
    const creesSim = new Set<number>(); // simulation : une ligne créée plus haut rend la suivante « mise à jour »
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
        // O11 : création (ligne nouvelle) soumise à la même garde que POST /membres.
        const refus = existant ? null : refusCreation(statut, qualite);
        if (refus) {
          erreurs.push({ ligne: i + 1, message: refus });
          continue;
        }
        // Les statuts de sortie (radié, décédé, démissionnaire, retraité, cessation) ne s'obtiennent
        // (ni ne se quittent) par import : seuls /radier, /deces, /evenements et PATCH valident la date
        // d'acte et laissent une trace d'audit individuelle. Même statut = aller-retour autorisé.
        const sorti = (s: StatutMembre) => (STATUTS_SORTIS as readonly string[]).includes(s);
        if (r.statut?.trim() && (existant ? existant.statut !== statut : true) && (sorti(statut) || (existant && sorti(existant.statut)))) {
          erreurs.push({ ligne: i + 1, message: "Changement de statut vers ou depuis un statut de sortie (radié, décédé, démissionnaire, retraité, cessation) interdit à l'import : utilisez la fiche de l'avocat (Radier / Déclarer le décès / Modifier)." });
          continue;
        }
        // R1-5 : ni omission ni réinscription par import (circuit et permission omission_prononcer),
        // ni création directe d'un omis (l'omission suit le circuit de la fiche, avec son historique).
        if (r.statut?.trim() && (existant ? existant.statut !== statut && (statut === "OMIS" || existant.statut === "OMIS") : statut === "OMIS")) {
          erreurs.push({ ligne: i + 1, message: "Omission ou réinscription interdite à l'import (création d'un membre omis comprise) : utilisez l'onglet Situation de la fiche de l'avocat." });
          continue;
        }
        // R1-1 : ni suspension ni levée de suspension par import (décision disciplinaire enregistrée),
        // et un stagiaire existant ne passe pas au tableau par import (valider-stage, action stage_valider).
        if (existant && r.statut?.trim() && existant.statut !== statut && (statut === "SUSPENDU" || existant.statut === "SUSPENDU")) {
          erreurs.push({ ligne: i + 1, message: "Suspension ou levée de suspension interdite à l'import : la suspension s'enregistre par la décision du dossier disciplinaire, sa levée par la fiche de l'avocat (reprise)." });
          continue;
        }
        // R1-5 : aucun stagiaire au tableau par import. Un stagiaire existant ne reçoit pas d'autre qualité
        // (y compris la qualité par défaut de la page : ligne refusée plutôt que réécrite), et aucune ligne ne
        // produit la paire effective (colonne absente = valeur existante) qualité STAGIAIRE + statut
        // INSCRIT/HONORAIRE, création comprise, sauf aller-retour inchangé.
        const qEff = existant && !r.qualite?.trim() ? existant.qualite : qualite;
        const sEff = existant && !r.statut?.trim() ? existant.statut : statut;
        const stagiaireAuTableau = qEff === "STAGIAIRE" && (sEff === "INSCRIT" || sEff === "HONORAIRE") && !(existant?.qualite === "STAGIAIRE" && existant.statut === sEff);
        if ((existant?.qualite === "STAGIAIRE" && qualite !== "STAGIAIRE") || stagiaireAuTableau) {
          erreurs.push({ ligne: i + 1, message: "Stagiaire au tableau interdit à l'import (qualité ou statut inscrit, honoraire) : utilisez « Valider la fin de stage » (fiche, onglet Stage)." });
          continue;
        }
        if (simulation) {
          if (existant || creesSim.has(r.num)) maj += 1;
          else { creesSim.add(r.num); crees += 1; }
        } else if (existant) {
          // Colonne statut absente du fichier : le statut existant n'est pas écrasé.
          // Aller-retour export → import : l'export écrit le seul jour (AAAA-MM-JJ) ; si le jour est
          // inchangé, l'horodatage existant est conservé (aucune perte de précision).
          const dIns = toDate(r.dateInscription);
          const memeJour = dIns && existant.dateInscription && dIns.toISOString().slice(0, 10) === existant.dateInscription.toISOString().slice(0, 10);
          // Colonne qualité absente : la qualité existante n'est pas écrasée par la qualité par défaut de la page (R1-5).
          const data = { ...base, qualite: r.qualite?.trim() ? qualite : undefined, statut: r.statut?.trim() ? statut : undefined, dateInscription: memeJour ? undefined : dIns };
          // R1-11 : gardes ci-dessus réévaluées sous verrou (409 si la fiche a changé entre-temps) ;
          // l'accès espace suit le statut dans la même transaction (coupé si bloquant, rétabli sinon).
          await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "Membre" WHERE id = ${existant.id} FOR UPDATE`;
            const relu = await tx.membre.findUniqueOrThrow({ where: { id: existant.id }, select: { statut: true } });
            if (relu.statut !== existant.statut) throw ficheModifiee();
            const m = await tx.membre.update({ where: { id: existant.id }, data });
            // D5 : un changement de statut par import laisse une trace (sinon situationADate se trompe).
            if (m.statut !== existant.statut)
              await tx.evenementSituation.create({
                data: { membreId: m.id, type: "CHANGEMENT_STATUT", statutAvant: existant.statut, statutApres: m.statut, dateEffet: new Date(), motif: "Import du tableau", acteurId: req.user?.id ?? null, acteurNom: req.user?.nom ?? null },
              });
            await reconcilierAcces(m.id, existant.statut, m.statut, tx);
          });
          maj += 1;
        } else {
          const dateInscription = toDate(r.dateInscription) ?? new Date();
          await prisma.membre.create({
            data: {
              num: r.num, numInscription: `T${r.num}`, ...base, dateInscription,
              evenements: { create: { type: "INSCRIPTION", statutApres: statut, dateEffet: dateInscription, motif: "Import du tableau", acteurId: req.user?.id ?? null, acteurNom: req.user?.nom ?? null } },
            },
          });
          crees += 1;
        }
      } catch (e) {
        erreurs.push({ ligne: i + 1, message: e instanceof Error ? e.message : "Erreur" });
      }
    }
    // Détail ajouté à la ligne JournalAudit « Import du tableau » (middleware audit, C-05).
    res.locals.auditDetail = `${simulation ? "Simulation : " : ""}${rows.length} ligne(s), ${crees} créé(s), ${maj} mis à jour, ${erreurs.length} erreur(s)`;
    res.json({ total: rows.length, crees, maj, erreurs, doublons, colonnes: { manquantes, inconnues }, simulation });
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

/** PATCH /membres/:id — modification de la fiche (FR-AV-01). SG/Admin ; suspension, radiation et levée de radiation : discipline_decider (R1-1, R1-7). */
membresRouter.patch(
  "/:id",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req: AuthRequest, res) => {
    const { statut, dateRadiation, motifRadiation, dateDeces, ...fiche } = editSchema.parse(req.body);
    const id = Number(req.params.id);
    const actuel = await prisma.membre.findUnique({ where: { id }, select: { statut: true, qualite: true, dateRadiation: true, motifRadiation: true, dateDeces: true } });
    if (!actuel) throw new HttpError(404, "Avocat introuvable");
    // R1-5 : l'omission, la réinscription et le passage au tableau ont leur circuit et leur
    // permission (omission_prononcer, stage_valider) ; PATCH ne peut pas les contourner.
    const change = statut && statut !== actuel.statut;
    // T6 : le décès s'enregistre par /deces, sur pièce justificative (acte ou certificat) ; PATCH ne
    // fait que corriger la date d'un décès déjà déclaré.
    if (change && statut === "DECEDE")
      throw new HttpError(409, "Le décès s'enregistre par « Déclarer le décès » (POST /membres/:id/deces), sur présentation de l'acte ou du certificat de décès.");
    if (change && (statut === "OMIS" || actuel.statut === "OMIS"))
      throw new HttpError(409, statut === "OMIS"
        ? "L'omission s'enregistre depuis l'onglet Situation (POST /membres/:id/evenements : rappel, mise en demeure, transmission, puis décision d'omission)."
        : "La réinscription d'un avocat omis s'enregistre depuis l'onglet Situation (POST /membres/:id/evenements REINSCRIPTION).");
    // Stagiaire → tableau : 403 sans stage_valider ; même avec, la seule voie est valider-stage (409).
    if (actuel.qualite === "STAGIAIRE" && ((fiche.qualite && fiche.qualite !== "STAGIAIRE") || (change && (statut === "INSCRIT" || statut === "HONORAIRE")))) {
      if (!aLaPermission(req.user!.role, "stage_valider")) throw new HttpError(403, "Accès refusé pour votre profil : la fin de stage relève de l'action stage_valider.");
      throw new HttpError(409, "Le passage d'un stagiaire au tableau s'enregistre par « Valider la fin de stage » (fiche, onglet Stage).");
    }
    // R1-1 : un suspendu ne revient pas au tableau par PATCH tant qu'une interdiction temporaire ferme
    // court encore (sanctionFin future) : la levée avant terme relève de discipline_decider.
    if (statut && statut !== actuel.statut && actuel.statut === "SUSPENDU" && !(STATUTS_SORTIS as readonly string[]).includes(statut) && !aLaPermission(req.user!.role, "discipline_decider") &&
      (await prisma.dossierDisciplinaire.findFirst({ where: { membreId: id, sanctionCode: { not: null }, sursis: false, sanctionFin: { gt: new Date() } }, select: { id: true } })))
      throw new HttpError(403, "Interdiction temporaire en cours : seule une décision enregistrée par le titulaire de l'action discipline_decider (bâtonnier par défaut) peut la lever avant son terme.");
    // R1-1 / R1-7 : imposer une suspension ou une radiation, ou lever une radiation (retour au
    // tableau), relève de discipline_decider : la sanction s'enregistre par la décision du dossier
    // disciplinaire (POST /discipline/:id/decision), la radiation aussi par /radier. Le SG corrige
    // la date ou la référence d'un radié (sans changer le statut) et déclare un décès.
    if (change && (statut === "SUSPENDU" || statut === "RADIE" || (actuel.statut === "RADIE" && statut !== "DECEDE")) && !aLaPermission(req.user!.role, "discipline_decider"))
      throw new HttpError(403, "Accès refusé pour votre profil : enregistrer une suspension ou une radiation, ou lever une radiation, relève de l'action discipline_decider (décision du conseil de discipline enregistrée depuis le dossier disciplinaire, bâtonnier par défaut).");
    const donnees = {
      ...fiche,
      dateNaissance: fiche.dateNaissance ? new Date(fiche.dateNaissance) : undefined,
      dateInscription: fiche.dateInscription ? new Date(fiche.dateInscription) : undefined,
      // La date de prestation de serment est reçue en chaîne : convertir en Date
      // (sinon Prisma rejette). Permet de renseigner/corriger le serment d'un
      // stagiaire depuis sa fiche, sans passer par un ré-import.
      dateServment: fiche.dateServment ? new Date(fiche.dateServment) : undefined,
    };
    // Statut et données d'acte passent par la machine à états (cohérence, dates requises).
    const demande = { statut, dateRadiation: versDate(dateRadiation), motifRadiation, dateDeces: versDate(dateDeces) };
    if (statut && statut !== actuel.statut) {
      // Changement de statut : écriture tracée par un EvenementSituation (D5). PATCH ne suit
      // aucun circuit (omission, discipline) : type générique, sauf actes datés.
      const type = statut === "RADIE" ? "RADIATION" : statut === "DECEDE" ? "DECES" : "CHANGEMENT_STATUT";
      const dateEffet = (statut === "RADIE" ? demande.dateRadiation : statut === "DECEDE" ? demande.dateDeces : null) ?? undefined;
      const { membre } = await changerSituation({ membreId: id, type, demande, donnees, dateEffet, reference: statut === "RADIE" ? motifRadiation : null, acteur: acteurDe(req), statutAttendu: actuel.statut });
      return res.json(membre);
    }
    // Statut inchangé (R1-11) : fiche relue sous verrou ; si une transition concurrente a changé le
    // statut depuis la lecture des gardes, 409 au lieu d'écraser (ex. radiation rétablie en INSCRIT).
    // L'accès n'est pas réactivé : un statut bloquant le coupe, sinon le compte reste tel quel.
    const membre = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Membre" WHERE id = ${id} FOR UPDATE`;
      const relu = await tx.membre.findUniqueOrThrow({ where: { id }, select: { statut: true, dateRadiation: true, motifRadiation: true, dateDeces: true } });
      if (relu.statut !== actuel.statut) throw ficheModifiee();
      const m = await tx.membre.update({ where: { id }, data: { ...donnees, ...appliquerCycleVie(relu, demande) } });
      await reconcilierAcces(m.id, relu.statut, m.statut, tx);
      return m;
    });
    res.json(membre);
  })
);

const radiationSchema = z.object({
  dateRadiation: datePassee.optional(),
  motifRadiation: motifRadiation.optional(),
  // Dossier disciplinaire dont la décision de radiation est rendue exécutoire (effetRadiation = EXPIRATION_RECOURS).
  dossierId: z.coerce.number().int().positive().max(2_147_483_647).optional(),
});

/**
 * POST /membres/:id/radier — enregistre une radiation décidée par le Conseil siégeant
 * en conseil de discipline (art. 36 loi n° 026-92 ; l'outil n'est qu'un registre
 * d'exécution). Corps optionnel : date (défaut : aujourd'hui) et référence de la
 * décision. Action discipline_decider (bâtonnier par défaut, ADMIN) : le SG saisit
 * et instruit mais n'enregistre pas la décision (D1, R-42, CA6) → 403.
 */
membresRouter.post(
  "/:id/radier",
  requirePermission("discipline_decider"),
  asyncH(async (req: AuthRequest, res) => {
    const data = radiationSchema.parse(req.body ?? {});
    const id = Number(req.params.id);
    const actuel = await prisma.membre.findUnique({ where: { id }, select: { statut: true, dateRadiation: true, motifRadiation: true, dateDeces: true } });
    if (!actuel) throw new HttpError(404, "Avocat introuvable");
    if (actuel.statut === "RADIE") throw new HttpError(409, "Cet avocat est déjà radié : corrigez la date ou la référence par « Modifier ».");
    const dateRadiation = data.dateRadiation ? new Date(data.dateRadiation) : new Date();
    // Rattachement au dossier : décision de radiation non réformée de cet avocat (400 / 409 sinon).
    const fondement = data.dossierId ? await dossierRadiation(data.dossierId, id) : null;
    const reference = data.motifRadiation ?? fondement?.reference ?? null;
    const { membre } = await changerSituation({
      membreId: id, type: "RADIATION", dateEffet: dateRadiation, reference, acteur: acteurDe(req), statutAttendu: actuel.statut, // « déjà radié » revérifié sous verrou
      demande: { statut: "RADIE", dateRadiation, motifRadiation: data.motifRadiation ?? (fondement ? `${fondement.dossier.sanction ?? "Radiation"} — ${reference}` : null) },
      dossierId: fondement?.dossier.id ?? null,
      details: fondement ? { decidePar: fondement.dossier.decidePar, execution: "Radiation rendue exécutoire" } : undefined,
    });
    res.json(membre);
  })
);

/**
 * Déclaration de décès (T6) : date d'effet et pièce justificative (acte ou certificat de décès,
 * avec sa référence) obligatoires. Schéma strict : toute autre clé (cause, motif, détails) est
 * refusée en 400 — aucune donnée de santé (loi n° 29-2019, art. 17 ; R-15).
 */
const decesSchema = z.object({
  dateDeces: datePassee,
  piece: z.string().trim().min(1, "Indiquez la pièce justificative (acte ou certificat de décès et sa référence).").max(160),
}).strict();

/**
 * POST /membres/:id/deces — déclaration de décès sur présentation de l'acte.
 * Date obligatoire, non future, et pièce justificative. Statut DECEDE : compte espace
 * désactivé et jetons révoqués (synchroniserAccesAuStatut). SG/Admin.
 */
membresRouter.post(
  "/:id/deces",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req: AuthRequest, res) => {
    const { dateDeces, piece } = decesSchema.parse(req.body ?? {});
    const id = Number(req.params.id);
    const actuel = await prisma.membre.findUnique({ where: { id }, select: { statut: true, dateRadiation: true, motifRadiation: true, dateDeces: true } });
    if (!actuel) throw new HttpError(404, "Avocat introuvable");
    if (actuel.statut === "DECEDE") throw new HttpError(409, "Le décès de cet avocat est déjà enregistré : corrigez la date par « Modifier ».");
    // Aucun motif ni détail : donnée de santé (loi n° 29-2019, art. 17). La pièce est la référence de l'événement.
    const date = new Date(dateDeces);
    const { membre } = await changerSituation({ membreId: id, type: "DECES", demande: { statut: "DECEDE", dateDeces: date }, dateEffet: date, reference: piece, acteur: acteurDe(req), statutAttendu: actuel.statut });
    res.json(membre);
  })
);

// ── Circuit d'omission, réinscription, sorties volontaires et reprise (T9, D8) ──

/** Étapes du circuit des impayés, dans l'ordre (R-16, provisoire) ; l'omission les clôt. */
const ETAPES_IMPAYES = ["RAPPEL", "MISE_EN_DEMEURE", "TRANSMISSION", "OMISSION"] as const;
/** Causes légales d'omission codées par article (R-12) ; 35-4° = contribution non acquittée (R-14). */
const CAUSES_OMISSION = ["35-1", "35-2", "35-3", "35-4", "35-5"] as const;
/** Organe qui décide l'omission et la réinscription ; le logiciel enregistre (R-10, R-13). */
const ORGANE_OMISSION = "Conseil de l'Ordre national (loi n° 026-92, art. 8-2° et 35)";
const SORTIES_VOLONTAIRES = ["DEMISSIONNAIRE", "RETRAITE", "CESSATION"] as const;
const JOUR_MS = 86_400_000;

const evenementSchema = z.object({
  type: z.enum([...ETAPES_IMPAYES, "REINSCRIPTION", ...SORTIES_VOLONTAIRES, "REPRISE"]),
  dateEffet: datePassee.optional(),
  annee: z.coerce.number().int().min(2000).max(2100).optional(),
  cause: z.enum(CAUSES_OMISSION).optional(),
  motif: z.string().trim().min(1).max(500).optional(),
  reference: z.string().trim().min(1).max(120).optional(),
  pieceId: z.coerce.number().int().positive().max(2_147_483_647).optional(),
});

/** GET /membres/:id/evenements — historique des situations, le plus récent d'abord (SG / Bâtonnier, comme la fiche). */
membresRouter.get(
  "/:id/evenements",
  requireRole("SECRETAIRE_GENERAL", "BATONNIER"),
  asyncH(async (req, res) => {
    const membreId = Number(req.params.id);
    if (!Number.isInteger(membreId)) throw new HttpError(400, "Identifiant invalide");
    res.json(await prisma.evenementSituation.findMany({ where: { membreId }, orderBy: [{ dateEffet: "desc" }, { id: "desc" }] }));
  })
);

/**
 * POST /membres/:id/evenements — enregistre une étape ou une décision de situation.
 *  - RAPPEL, MISE_EN_DEMEURE, TRANSMISSION (permission finances) : statut inchangé ;
 *    refus (409) si le membre est à jour pour l'exercice ou sorti du tableau ;
 *  - OMISSION, REINSCRIPTION (permission omission_prononcer) : décision du Conseil de
 *    l'Ordre national saisie à la main, référence obligatoire, aucun automatisme.
 *    Cause 35-4° (défaut) : les trois étapes du même exercice, dans l'ordre et avec
 *    les délais de regles.impayes relus à chaque appel, sinon 409 ;
 *  - DEMISSIONNAIRE, RETRAITE, CESSATION, REPRISE (fin de suspension) : SG seul.
 * Chaque étape exige la précédente du même exercice, datée au plus tard de (sa date −
 * délai) et postérieure à la dernière réinscription du membre.
 */
membresRouter.post(
  "/:id/evenements",
  asyncH(async (req: AuthRequest, res) => {
    const membreId = Number(req.params.id);
    if (!Number.isInteger(membreId)) throw new HttpError(400, "Identifiant invalide");
    const c = evenementSchema.parse(req.body ?? {});
    const role = req.user!.role;
    const etape = (ETAPES_IMPAYES as readonly string[]).indexOf(c.type);
    const decision = c.type === "OMISSION" || c.type === "REINSCRIPTION";
    const recouvrement = etape >= 0 && !decision;
    const permis =
      role === "ADMIN" ||
      (decision ? aLaPermission(role, "omission_prononcer") : recouvrement ? aLaPermission(role, "finances") : role === "SECRETAIRE_GENERAL");
    if (!permis) throw new HttpError(403, REFUS);

    const membre = await prisma.membre.findUnique({ where: { id: membreId }, select: { statut: true, qualite: true } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    if (c.pieceId && !(await prisma.pieceDossier.findFirst({ where: { id: c.pieceId, membreId }, select: { id: true } })))
      throw new HttpError(400, "Pièce introuvable dans le dossier de ce membre");
    const dateEffet = c.dateEffet ? new Date(c.dateEffet) : new Date();
    const annee = c.annee ?? dateEffet.getUTCFullYear();
    const sorti = (STATUTS_SORTIS as readonly string[]).includes(membre.statut);
    const cause = c.type === "OMISSION" ? c.cause ?? "35-4" : undefined;

    if (decision && !c.reference) throw new HttpError(400, `La référence de la décision du ${ORGANE_OMISSION} est obligatoire.`);
    // R-15 : une omission pour maladie s'enregistre par son seul code d'article.
    if (cause === "35-1" && c.motif) throw new HttpError(400, "Omission pour maladie ou infirmité : n'inscrivez ici aucune donnée médicale, le code d'article suffit.");
    if (c.type === "REINSCRIPTION" && membre.statut !== "OMIS") throw new HttpError(409, "Seul un avocat omis peut être réinscrit.");
    if (c.type === "REPRISE" && membre.statut !== "SUSPENDU") throw new HttpError(409, "La reprise ne concerne qu'un avocat suspendu.");
    if (c.type === "REPRISE" && (await prisma.dossierDisciplinaire.findFirst({ where: { membreId, sanctionCode: { not: null }, sursis: false, sanctionFin: { gt: dateEffet } }, select: { id: true } })))
      throw new HttpError(409, "Reprise impossible : une interdiction temporaire décidée par le conseil de discipline court encore à cette date.");
    if (c.type === "OMISSION" && (sorti || membre.statut === "OMIS")) throw new HttpError(409, "Omission impossible : membre déjà omis ou sorti du tableau.");
    if ((SORTIES_VOLONTAIRES as readonly string[]).includes(c.type) && sorti) throw new HttpError(409, "Ce membre est déjà sorti du tableau.");

    if (recouvrement) {
      if (sorti) throw new HttpError(409, "Membre sorti du tableau : aucune étape de recouvrement.");
      const [tarifs, ligne] = await Promise.all([tarifsActuels(), prisma.cotisation.findUnique({ where: { membreId_annee: { membreId, annee } } })]);
      const st = statutCotisation(cotisationDue(ligne, tarifs, membre.qualite), ligne?.montantPaye ?? 0);
      if (st === "ajour" || st === "exonere") throw new HttpError(409, `Membre à jour de sa cotisation ${annee} : aucune étape de recouvrement.`);
    }
    if (etape > 0 && (recouvrement || cause === "35-4")) {
      const { impayes } = await reglesActuelles();
      const delais = [impayes.delaiRappelJours, impayes.delaiMiseEnDemeureJours, 0]; // délai entre l'étape k et k+1
      const reinscription = await prisma.evenementSituation.findFirst({ where: { membreId, type: "REINSCRIPTION" }, orderBy: { dateEffet: "desc" } });
      let curseur = dateEffet;
      for (let k = etape - 1; k >= 0; k--) {
        const limite = new Date(curseur.getTime() - delais[k] * JOUR_MS);
        const prec = await prisma.evenementSituation.findFirst({
          where: { membreId, annee, type: ETAPES_IMPAYES[k], dateEffet: { lte: limite, ...(reinscription ? { gt: reinscription.dateEffet } : {}) } },
          orderBy: { dateEffet: "desc" },
        });
        if (!prec)
          throw new HttpError(409, `Étape ${ETAPES_IMPAYES[k]} de l'exercice ${annee} manquante ou trop récente : ${delais[k]} jour(s) au moins avant ${ETAPES_IMPAYES[k + 1]} (règles provisoires, Paramètres).`);
        curseur = prec.dateEffet;
      }
    }

    const acteur = acteurDe(req);
    if (recouvrement) {
      // Étape de recouvrement : la fiche n'est pas modifiée (la date de mise à jour du tableau ne bouge pas).
      const evenement = await prisma.evenementSituation.create({
        data: {
          membreId, type: c.type, statutAvant: membre.statut, statutApres: membre.statut, dateEffet, annee,
          motif: c.motif ?? null, reference: c.reference ?? null, pieceId: c.pieceId ?? null, acteurId: acteur.id, acteurNom: acteur.nom,
        },
      });
      return res.status(201).json({ evenement });
    }
    // REINSCRIPTION et REPRISE rétablissent la situation d'avant la mesure, calculée sous verrou (R2-2).
    const retablir = c.type === "REINSCRIPTION" || c.type === "REPRISE";
    const statut = (c.type === "OMISSION" ? "OMIS" : c.type) as StatutMembre;
    const r = await changerSituation({
      membreId, type: c.type, retablir, demande: retablir ? {} : { statut }, dateEffet, reference: c.reference ?? null, pieceId: c.pieceId ?? null, acteur,
      statutAttendu: membre.statut, // gardes (omis, sorti, suspendu) revérifiées sous verrou
      annee: c.type === "OMISSION" ? annee : null,
      motif: cause ? `Art. ${cause}° loi n° 026-92${c.motif ? ` — ${c.motif}` : ""}` : c.motif ?? null,
      details: decision ? { organe: ORGANE_OMISSION, ...(cause ? { cause } : {}) } : undefined,
    });
    res.status(201).json(r);
  })
);

const admissionSchema = inscriptionSchema
  .pick({ nom: true, sexe: true, cabinet: true, tel: true, email: true, rccm: true, cnss: true, adresse: true, observations: true, dateNaissance: true })
  .extend({
    cas: z.string().trim().min(1).max(40),
    ancienneteAns: z.coerce.number().int().min(0).max(60),
    reference: z.string().trim().min(1).max(120),
    dateDecision: datePassee.optional(),
  });

/**
 * POST /membres/admission-directe — inscription directe au tableau sans stage (F-03,
 * loi n° 026-92, art. 32 ; permission admission_directe, SG et bâtonnier par défaut).
 * Le cas doit figurer dans Paramètres → règles → admission directe et l'ancienneté
 * atteindre son minimum (400 sinon). Le membre et son événement ADMISSION_DIRECTE
 * sont créés ensemble (écriture imbriquée, tout ou rien).
 */
membresRouter.post(
  "/admission-directe",
  requirePermission("admission_directe"),
  asyncH(async (req: AuthRequest, res) => {
    const { cas, ancienneteAns, reference, dateDecision, dateNaissance, ...identite } = admissionSchema.parse(req.body);
    const regle = (await reglesActuelles()).admissionDirecte.cas.find((c) => c.code === cas);
    if (!regle) throw new HttpError(400, `Cas d'admission directe inconnu : ${cas}`);
    if (ancienneteAns < regle.ancienneteMinAns)
      throw new HttpError(400, `Ancienneté insuffisante : ${regle.ancienneteMinAns} ans au moins pour le cas « ${regle.libelle} » (${regle.article}).`);
    const date = dateDecision ? new Date(dateDecision) : new Date();
    const membre = await avecRejeuUnicite(async () => {
      const { num, numInscription } = await prochainNumInscription();
      return prisma.membre.create({
        data: {
          ...identite, num, numInscription, qualite: "AVOCAT", statut: "INSCRIT", sexe: identite.sexe ?? null,
          dateNaissance: dateNaissance ? new Date(dateNaissance) : null, dateInscription: date,
          evenements: {
            create: {
              type: "ADMISSION_DIRECTE", statutApres: "INSCRIT", dateEffet: date, reference,
              details: { cas, libelle: regle.libelle, article: regle.article, ancienneteAns },
              acteurId: req.user?.id ?? null, acteurNom: req.user?.nom ?? null,
            },
          },
        },
      });
    });
    realtimeTous({ type: "tableau" });
    res.status(201).json(membre);
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

const finStageSchema = z.object({
  dateDecision: datePassee.optional(),
  dateDemande: z.string().date().optional(),
  dateCertificat: datePassee.optional(),
  refCertificat: z.string().trim().min(1).max(120).optional(),
});

/** Organe qui délivre le certificat de fin de stage (loi n° 026-92, art. 29). */
const ORGANE_CERTIFICAT = "Bâtonnier national (loi n° 026-92, art. 29)";

/**
 * POST /membres/:id/valider-stage — enregistrement de la fin de stage (permission
 * stage_valider, bâtonnier par défaut) : l'avocat stagiaire passe au tableau
 * (qualité AVOCAT, statut INSCRIT) à la date de la décision (X-04). Corps facultatif :
 * dateDecision (défaut : aujourd'hui), dateDemande, dateCertificat, refCertificat.
 * Règles lues en Paramètres à chaque appel (CA8) : durée du stage depuis le serment
 * (409 si non accomplie) et certificat exigé si certificatObligatoire (400).
 */
membresRouter.post(
  "/:id/valider-stage",
  requirePermission("stage_valider"),
  asyncH(async (req: AuthRequest, res) => {
    const membreId = Number(req.params.id);
    if (!Number.isInteger(membreId)) throw new HttpError(400, "Identifiant invalide");
    const corps = finStageSchema.parse(req.body ?? {});
    const membre = await prisma.membre.findUnique({ where: { id: membreId } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    if (membre.qualite !== "STAGIAIRE") throw new HttpError(409, "Ce membre n'est pas un avocat stagiaire.");
    // Un stagiaire sorti (radié, décédé, démissionnaire, retraité, cessation) ne revient pas au tableau par une validation de stage.
    if ((STATUTS_SORTIS as readonly string[]).includes(membre.statut))
      throw new HttpError(409, "Validation impossible : le stagiaire est sorti du barreau (radié, décédé ou sortie volontaire). Rétablissez d'abord son statut par la fiche.");
    // Un stagiaire suspendu ou omis ne passe pas au tableau : ce serait lever la mesure en silence.
    if (membre.statut !== "STAGIAIRE" && membre.statut !== "INSCRIT")
      throw new HttpError(409, `Validation impossible : le stagiaire est ${membre.statut === "SUSPENDU" ? "suspendu" : membre.statut === "OMIS" ? "omis" : "dans un statut incompatible"}. Levez d'abord la mesure par la fiche.`);
    const { stage } = await reglesActuelles();
    if (stage.certificatObligatoire && !(corps.dateCertificat && corps.refCertificat))
      throw new HttpError(400, `Le certificat de fin de stage (date et référence), délivré par le ${ORGANE_CERTIFICAT}, est obligatoire.`);
    const dateDecision = corps.dateDecision ? new Date(corps.dateDecision) : new Date();
    if (membre.dateServment) {
      const fin = new Date(membre.dateServment);
      fin.setUTCMonth(fin.getUTCMonth() + stage.dureeMois);
      if (fin > dateDecision)
        throw new HttpError(409, `Stage non accompli : ${stage.dureeMois} mois requis depuis la prestation de serment (fin au ${fin.toISOString().slice(0, 10)}).`);
    }
    const acteur = await nomActeur(req.user!.id);
    const { membre: maj } = await changerSituation({
      membreId, type: "PASSAGE_TABLEAU", demande: { statut: "INSCRIT" }, statutAttendu: membre.statut,
      donnees: { qualite: "AVOCAT", dateInscription: dateDecision, stageValideAt: new Date(), stageValidePar: acteur ?? undefined },
      dateEffet: dateDecision, reference: corps.refCertificat ?? null, acteur: { id: req.user!.id, nom: acteur },
      details: { organe: ORGANE_CERTIFICAT, dureeMoisRequise: stage.dureeMois, ...(corps.dateDemande ? { dateDemande: corps.dateDemande } : {}), ...(corps.dateCertificat ? { dateCertificat: corps.dateCertificat } : {}) },
    });
    await archiver({ categorie: "Fin de stage", titre: `Fin de stage validée — Me ${membre.nom}`, reference: `STAGE-${membre.num}`, date: new Date(), membreNom: membre.nom });
    res.json(maj);
  })
);

/**
 * DELETE /membres/:id — suppression définitive d'une fiche créée par erreur (saisie, doublon).
 * ADMIN seul. Refusée (409) dès que la fiche a un historique : événement de parcours, paiement,
 * reçu ou quitus (pièces comptables à conserver, AUDCIF OHADA), timbre émis ou dossier
 * disciplinaire — l'historique est une archive de l'Ordre ; la voie est alors une sortie
 * (démission, cessation…). Sans historique, les relations à cascade déclarée (cotisations,
 * droits de plaidoirie, pièces du dossier) sont supprimées par les contraintes FK.
 */
membresRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const membre = await prisma.membre.findUnique({ where: { id } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    const where = { membreId: id };
    // Contrôle et suppression sous verrou de la fiche : un acte de parcours concurrent
    // (changerSituation verrouille la même ligne) ne peut pas être effacé en cascade.
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Membre" WHERE id = ${id} FOR UPDATE`;
      const historique = await Promise.all([
        // l'INSCRIPTION initiale (import ou création) n'est pas un historique : une fiche importée par erreur reste supprimable
        tx.evenementSituation.count({ where: { ...where, NOT: { type: "INSCRIPTION" } } }),
        tx.paiement.count({ where }),
        tx.recu.count({ where }),
        tx.quitus.count({ where }),
        tx.timbre.count({ where }),
        tx.dossierDisciplinaire.count({ where }),
      ]);
      if (historique.some((n) => n > 0)) {
        throw new HttpError(409, "Suppression impossible : cette fiche a un historique (parcours, paiements, pièces comptables à conserver 10 ans selon l'OHADA, documents émis ou dossier disciplinaire). Enregistrez plutôt sa sortie du tableau (démission, cessation, retraite) depuis le parcours de l'avocat.");
      }
      await tx.membre.delete({ where: { id } });
    });
    res.locals.auditDetail = `fiche créée par erreur, n° ${membre.num}, sans historique`;
    res.json({ ok: true, nom: membre.nom });
  })
);

/**
 * POST /membres/:id/acces — provisionne (ou renvoie) l'accès à l'espace avocat
 * pour un membre. Réservé au Secrétariat Général / Admin. Crée un compte de rôle
 * AVOCAT rattaché à la fiche, inactif, avec un lien d'activation à durée limitée :
 * l'avocat choisit lui-même son mot de passe (le secrétariat ne le connaît
 * jamais). Si un accès non encore activé existe, le lien est régénéré (renvoi).
 * Ouvert à l'ADMIN (décision du 16/10/2026). Un accès déjà activé n'est jamais relancé (409, acces.ts).
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
    if (!peutAttesterInscription(membre.statut)) throw new HttpError(409, "Attestation impossible : membre non inscrit au tableau (radié, décédé, sorti ou omis)");
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

/**
 * POST /membres/:id/attestation/apercu — HTML de l'attestation pour l'aperçu de l'application
 * (même assembleur que le PDF) : inscription, ou sortie du tableau pour un ancien membre.
 * Rien n'est numéroté ni archivé : le numéro est attribué à la génération.
 */
membresRouter.post(
  "/:id/attestation/apercu",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const membre = await prisma.membre.findUnique({ where: { id: Number(req.params.id) }, include: derniereSortie });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    const numero = "attribué à la génération";
    const html = SORTIS.includes(membre.statut)
      ? attestationSortieHtml(membre, numero, new Date(), ligneSortie(membre, false).dateSortie)
      : attestationHtml(membre, numero, new Date());
    res.type("html").send(html);
  })
);

/** GET /membres/:id/attestation/pdf — génère, archive et renvoie l'attestation en PDF. */
membresRouter.get(
  "/:id/attestation/pdf",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const membre = await prisma.membre.findUnique({ where: { id: Number(req.params.id) } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    if (!peutAttesterInscription(membre.statut)) throw new HttpError(409, "Attestation impossible : membre non inscrit au tableau (radié, décédé, sorti ou omis)");
    const numero = await prochainNumeroAttestation();
    const date = new Date();
    await archiver({ categorie: "Attestation d'inscription", titre: `Attestation ${numero} — Me ${membre.nom}`, reference: numero, date, membreNom: membre.nom });
    await envoyerPdf(res, attestationHtml(membre, numero, date), `Attestation-${numero}.pdf`);
  })
);

/**
 * GET /membres/:id/attestation-sortie/pdf — attestation de sortie du tableau, seule
 * attestation délivrable à un ancien membre (T20, H2). Date de sortie : celle du
 * registre des anciens membres (ligneSortie) ; aucun motif dans le texte (R-62).
 */
membresRouter.get(
  "/:id/attestation-sortie/pdf",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const membre = await prisma.membre.findUnique({ where: { id: Number(req.params.id) }, include: derniereSortie });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    if (!SORTIS.includes(membre.statut)) throw new HttpError(409, "Ce membre figure au tableau : délivrez une attestation d'inscription");
    const { dateSortie } = ligneSortie(membre, false);
    const numero = await prochainNumeroAttestation();
    const date = new Date();
    await archiver({ categorie: "Attestation de sortie du tableau", titre: `Attestation ${numero} — Me ${membre.nom}`, reference: numero, date, membreNom: membre.nom });
    await envoyerPdf(res, attestationSortieHtml(membre, numero, date, dateSortie), `Attestation-sortie-${numero}.pdf`);
  })
);
