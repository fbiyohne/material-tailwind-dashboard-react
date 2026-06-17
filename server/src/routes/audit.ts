import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

/**
 * Journal d'audit (RG-16 / NFR-09) — consultation filtrable et paginée des
 * actions sensibles. Réservé au Secrétaire Général / Bâtonnier (et Admin).
 */
export const auditRouter = Router();
auditRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "BATONNIER"));

/** GET /audit — recherche (action/chemin/cible/acteur) + plage de dates + pagination. */
auditRouter.get(
  "/",
  asyncH(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const page = Math.max(1, Math.trunc(Number(req.query.page) || 1));
    const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(req.query.pageSize) || 25)));
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const valide = (d?: Date) => d && !Number.isNaN(d.getTime());

    const where: Prisma.JournalAuditWhereInput = {
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: "insensitive" } },
              { chemin: { contains: q, mode: "insensitive" } },
              { cible: { contains: q, mode: "insensitive" } },
              { userNom: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(valide(from) || valide(to)
        ? {
            quand: {
              ...(valide(from) ? { gte: from } : {}),
              // `to` inclusif jusqu'à la fin de journée.
              ...(valide(to) ? { lte: new Date(to!.getTime() + 86_399_999) } : {}),
            },
          }
        : {}),
    };

    const [total, entries] = await Promise.all([
      prisma.journalAudit.count({ where }),
      prisma.journalAudit.findMany({ where, orderBy: { id: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);

    const ids = [...new Set(entries.map((e) => e.userId).filter((v): v is number => v != null))];
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nom: true } }) : [];
    const nomParId = new Map(users.map((u) => [u.id, u.nom]));

    res.json({
      total,
      page,
      pageSize,
      items: entries.map((e) => ({
        id: e.id,
        action: e.action,
        cible: e.cible,
        methode: e.methode,
        chemin: e.chemin,
        statut: e.statut,
        acteur: e.userNom ?? (e.userId != null ? nomParId.get(e.userId) ?? "Utilisateur" : "Système"),
        quand: e.quand,
      })),
    });
  })
);
