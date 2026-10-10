import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

/**
 * Journal d'audit (RG-16 / NFR-09) — consultation filtrable et paginée des
 * actions sensibles. Réservé au Secrétaire Général / Bâtonnier (et Admin).
 */
export const auditRouter = Router();
auditRouter.use(requireAuth, requirePermission("audit"));

/**
 * GET /audit — recherche (action/chemin/cible/acteur), filtres userId et action,
 * plage de dates, pagination. Lecture seule : aucune route POST/PUT/PATCH/DELETE
 * n'existe sur ce routeur, et le trigger `journal_audit_immuable` (migration
 * 20261010090100) refuse UPDATE et DELETE en base.
 */
auditRouter.get(
  "/",
  asyncH(async (req, res) => {
    const q = String(req.query.q ?? "").trim().slice(0, 200);
    const action = String(req.query.action ?? "").trim().slice(0, 200);
    const userId = req.query.userId == null || req.query.userId === "" ? undefined : Number(req.query.userId);
    // Borné à INT4 (clé Prisma/PostgreSQL) : hors plage = 400, jamais une erreur Prisma non maîtrisée.
    if (userId !== undefined && (!Number.isInteger(userId) || userId < 1 || userId > 2_147_483_647)) throw new HttpError(400, "userId invalide");
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
              { ip: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
      ...(userId !== undefined ? { userId } : {}),
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

    const [total, entries, groupes] = await Promise.all([
      prisma.journalAudit.count({ where }),
      prisma.journalAudit.findMany({ where, orderBy: { id: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      // Acteurs connus du journal (pour le filtre de l'écran) : GROUP BY en SQL.
      prisma.journalAudit.groupBy({ by: ["userId", "userNom"], where: { userId: { not: null } }, orderBy: { userNom: "asc" } }),
    ]);
    const acteurs = [...new Map(groupes.map((g) => [g.userId as number, { id: g.userId as number, nom: g.userNom ?? "Utilisateur" }])).values()];

    const ids = [...new Set(entries.map((e) => e.userId).filter((v): v is number => v != null))];
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nom: true } }) : [];
    const nomParId = new Map(users.map((u) => [u.id, u.nom]));

    res.json({
      total,
      page,
      pageSize,
      acteurs,
      items: entries.map((e) => ({
        id: e.id,
        userId: e.userId,
        action: e.action,
        cible: e.cible,
        methode: e.methode,
        chemin: e.chemin,
        statut: e.statut,
        ip: e.ip ?? null,
        acteur: e.userNom ?? (e.userId != null ? nomParId.get(e.userId) ?? "Utilisateur" : "Système"),
        quand: e.quand,
      })),
    });
  })
);
