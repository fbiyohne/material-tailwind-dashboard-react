import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { prochainNumInscription, prochainNumeroAttestation, archiver } from "../lib/business.js";

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

    const [items, total] = await Promise.all([
      prisma.membre.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.membre.count({ where }),
    ]);
    res.json({ items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  })
);

/** GET /membres/:id — fiche complète. */
membresRouter.get(
  "/:id",
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

const inscriptionSchema = z.object({
  nom: z.string().min(1),
  qualite: z.enum(["AVOCAT", "STAGIAIRE", "HONORAIRE"]).default("AVOCAT"),
  statut: z.enum(["INSCRIT", "SUSPENDU", "RADIE", "OMIS", "HONORAIRE", "STAGIAIRE"]).default("INSCRIT"),
  cabinet: z.string().optional(),
  tel: z.string().optional(),
  email: z.string().optional(),
  rccm: z.string().optional(),
  dateInscription: z.string().optional(),
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
        dateInscription: data.dateInscription ? new Date(data.dateInscription) : new Date(),
      },
    });
    res.status(201).json(membre);
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
