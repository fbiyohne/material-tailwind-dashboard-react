import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth } from "../middleware/auth.js";

export const archivesRouter = Router();
archivesRouter.use(requireAuth);

/** GET /archives — recherche par mot-clé et catégorie (FR-ARC). */
archivesRouter.get(
  "/",
  asyncH(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const categorie = req.query.categorie as string | undefined;
    const archives = await prisma.archive.findMany({
      where: {
        ...(categorie && categorie !== "toutes" ? { categorie } : {}),
        ...(q ? { OR: [{ titre: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { archiveLe: "desc" },
    });
    const categories = await prisma.archive.findMany({ distinct: ["categorie"], select: { categorie: true } });
    res.json({ archives, categories: categories.map((c) => c.categorie) });
  })
);
