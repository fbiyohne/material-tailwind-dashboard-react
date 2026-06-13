import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth } from "../middleware/auth.js";

export const recusRouter = Router();
recusRouter.use(requireAuth);

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
