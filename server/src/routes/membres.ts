import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { prochainNumInscription, prochainNumeroAttestation, archiver } from "../lib/business.js";
import { enregistrerFichier } from "../lib/storage.js";
import { envoyerPdf } from "../lib/pdf.js";
import { attestationHtml } from "../lib/templates.js";
import { envoyerEmail } from "../lib/notifications.js";

export const membresRouter = Router();
membresRouter.use(requireAuth);

const TRI_AUTORISE = new Set(["num", "nom", "cabinet", "statut"]);

/** GET /membres — liste filtrée, triée et paginée côté serveur (FR-AV-02/03). */
membresRouter.get(
  "/",
  asyncH(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const qualite = req.query.qualite as string | undefined;
    const qualiteNot = req.query.qualiteNot as string | undefined;
    const statut = req.query.statut as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 20)));
    const sort = String(req.query.sort ?? "num");
    const order = req.query.order === "desc" ? "desc" : "asc";

    const where: Prisma.MembreWhereInput = {
      ...(qualite ? { qualite: qualite as any } : {}),
      ...(qualiteNot ? { qualite: { not: qualiteNot as any } } : {}),
      ...(statut ? { statut: statut as any } : {}),
      ...(q
        ? { OR: [{ nom: { contains: q, mode: "insensitive" } }, { cabinet: { contains: q, mode: "insensitive" } }] }
        : {}),
    };

    const orderBy = { [TRI_AUTORISE.has(sort) ? sort : "num"]: order } as Prisma.MembreOrderByWithRelationInput;

    // Projection « annuaire » : la liste est largement accessible (requireAuth),
    // on n'y expose donc pas les données personnelles sensibles (adresse, date de
    // naissance, RCCM, CNSS, observations) — celles-ci ne sont servies que par la
    // fiche GET /:id, réservée à SG/Bâtonnier (RG-15).
    const selectAnnuaire = {
      id: true, num: true, numInscription: true, nom: true, qualite: true,
      statut: true, cabinet: true, tel: true, email: true, dateInscription: true,
      dateServment: true, dureeMois: true, maitreStage: true,
    } satisfies Prisma.MembreSelect;

    const [items, total] = await Promise.all([
      prisma.membre.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, select: selectAnnuaire }),
      prisma.membre.count({ where }),
    ]);
    res.json({ items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
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
  statut: z.enum(["INSCRIT", "SUSPENDU", "RADIE", "OMIS", "HONORAIRE", "STAGIAIRE"]).default("INSCRIT"),
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
    const { num, numInscription } = await prochainNumInscription();
    const membre = await prisma.membre.create({
      data: {
        num,
        numInscription,
        nom: data.nom,
        qualite: data.qualite,
        statut: data.statut,
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
});

const QUALITES: Record<string, "AVOCAT" | "STAGIAIRE" | "HONORAIRE"> = { avocat: "AVOCAT", stagiaire: "STAGIAIRE", honoraire: "HONORAIRE" };
const STATUTS: Record<string, "INSCRIT" | "SUSPENDU" | "RADIE" | "OMIS" | "HONORAIRE" | "STAGIAIRE"> = {
  inscrit: "INSCRIT", suspendu: "SUSPENDU", radie: "RADIE", "radié": "RADIE", omis: "OMIS", honoraire: "HONORAIRE", stagiaire: "STAGIAIRE",
};
const norm = <T,>(v: string | undefined, map: Record<string, T>, def: T): T => map[(v ?? "").toString().trim().toLowerCase()] ?? def;
const toDate = (v?: string) => { if (!v) return undefined; const d = new Date(v); return Number.isNaN(d.getTime()) ? undefined : d; };

membresRouter.post(
  "/import",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const rows = z.array(importRowSchema).max(2000).parse(req.body?.membres ?? []);
    let crees = 0;
    let maj = 0;
    const erreurs: { ligne: number; message: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const qualite = norm(r.qualite, QUALITES, "AVOCAT");
        const statut = norm(r.statut, STATUTS, qualite === "STAGIAIRE" ? "STAGIAIRE" : qualite === "HONORAIRE" ? "HONORAIRE" : "INSCRIT");
        const base = {
          nom: r.nom, qualite, statut,
          cabinet: r.cabinet, tel: r.tel, email: r.email, rccm: r.rccm, cnss: r.cnss,
          adresse: r.adresse, observations: r.observations, maitreStage: r.maitreStage,
          dateNaissance: toDate(r.dateNaissance), dateServment: toDate(r.dateServment),
        };
        const existant = await prisma.membre.findUnique({ where: { num: r.num } });
        if (existant) {
          await prisma.membre.update({ where: { num: r.num }, data: { ...base, dateInscription: toDate(r.dateInscription) } });
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
    res.json({ total: rows.length, crees, maj, erreurs });
  })
);

const editSchema = inscriptionSchema.partial();

/** PATCH /membres/:id — modification de la fiche (FR-AV-01). SG/Admin. */
membresRouter.patch(
  "/:id",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const data = editSchema.parse(req.body);
    const membre = await prisma.membre.update({
      where: { id: Number(req.params.id) },
      data: {
        ...data,
        dateNaissance: data.dateNaissance ? new Date(data.dateNaissance) : undefined,
        dateInscription: data.dateInscription ? new Date(data.dateInscription) : undefined,
      },
    });
    res.json(membre);
  })
);

/** POST /membres/:id/radier — radiation (action sensible). SG/Admin. */
membresRouter.post(
  "/:id/radier",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const membre = await prisma.membre.update({
      where: { id: Number(req.params.id) },
      data: { statut: "RADIE" },
    });
    res.json(membre);
  })
);

/**
 * DELETE /membres/:id — suppression définitive d'un membre (avocat/stagiaire).
 * Réservé au super-administrateur (ADMIN). Efface en cascade tout l'historique
 * rattaché, en une transaction. Les relations à cascade déclarée (cotisations,
 * droits de plaidoirie, pièces du dossier) et la mise à NULL des dossiers
 * disciplinaires (qui gardent leur valeur probante propre) sont assurées au
 * niveau base par les contraintes FK ; on retire ici manuellement les seules
 * relations en RESTRICT (reçus, quitus, paiements) avant de supprimer la fiche.
 */
membresRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const membre = await prisma.membre.findUnique({ where: { id } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    await prisma.$transaction([
      prisma.recu.deleteMany({ where: { membreId: id } }),
      prisma.quitus.deleteMany({ where: { membreId: id } }),
      prisma.paiement.deleteMany({ where: { membreId: id } }),
      prisma.membre.delete({ where: { id } }),
    ]);
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
    const id = Number(req.params.id);
    const membre = await prisma.membre.findUnique({ where: { id } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
    if (!membre.email) throw new HttpError(400, "Renseignez d'abord l'email de l'avocat sur sa fiche");

    const existant = await prisma.user.findUnique({ where: { membreId: id } });
    if (existant?.actif) throw new HttpError(409, "Un accès actif existe déjà pour cet avocat");
    // L'email doit être libre (ou déjà celui de ce compte avocat en attente).
    const homonyme = await prisma.user.findUnique({ where: { email: membre.email } });
    if (homonyme && homonyme.membreId !== id) {
      throw new HttpError(409, "Cet email est déjà utilisé par un autre compte");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const activationExpire = new Date(Date.now() + 7 * 86_400_000); // 7 jours
    const data = {
      nom: `Me ${membre.nom}`,
      email: membre.email,
      role: "AVOCAT" as const,
      membreId: id,
      actif: false,
      activationToken: token,
      activationExpire,
      passwordHash: bcrypt.hashSync(crypto.randomBytes(24).toString("hex"), 10), // inutilisable avant activation
    };
    if (existant) {
      await prisma.user.update({ where: { id: existant.id }, data: { activationToken: token, activationExpire } });
    } else {
      await prisma.user.create({ data });
    }

    const lien = `${env.clientOrigin}/activer/${token}`;
    void envoyerEmail({
      to: membre.email,
      subject: "Activez votre espace avocat · Barreau de Pointe-Noire",
      text: `Maître ${membre.nom},\n\nLe Secrétariat Général vous ouvre l'accès à votre espace personnel.\nPour définir votre mot de passe et activer votre compte, ouvrez le lien suivant (valable 7 jours) :\n${lien}\n\nLe Secrétariat Général du Barreau de Pointe-Noire.`,
      evenement: "ACCES_AVOCAT",
    });
    res.status(201).json({ ok: true, email: membre.email, lien, renvoi: !!existant });
  })
);

/** POST /membres/:id/attestation — génère + archive l'attestation (FR-AV-05). */
membresRouter.post(
  "/:id/attestation",
  requireRole("SECRETAIRE_GENERAL"),
  asyncH(async (req, res) => {
    const membre = await prisma.membre.findUnique({ where: { id: Number(req.params.id) } });
    if (!membre) throw new HttpError(404, "Avocat introuvable");
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
    const numero = await prochainNumeroAttestation();
    const date = new Date();
    await archiver({ categorie: "Attestation d'inscription", titre: `Attestation ${numero} — Me ${membre.nom}`, reference: numero, date, membreNom: membre.nom });
    await envoyerPdf(res, attestationHtml(membre, numero, date), `Attestation-${numero}.pdf`);
  })
);
