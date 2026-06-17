import { Router } from "express";
import { prisma } from "../prisma.js";
import { anneeDeRequete } from "../lib/requete.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { montantDuAvec, statutCotisation, tarifsActuels } from "../lib/business.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

/** GET /dashboard?annee= — indicateurs clés (FR-DB-01 → 07). */
dashboardRouter.get(
  "/",
  asyncH(async (req, res) => {
    const annee = anneeDeRequete(req);
    const [tarifs, membres] = await Promise.all([
      tarifsActuels(),
      prisma.membre.findMany({ include: { cotisations: { where: { annee } } } }),
    ]);

    let inscrits = 0;
    let stagiaires = 0;
    let aJour = 0;
    let enRetard = 0;
    let payees = 0;
    let du = 0;

    for (const m of membres) {
      if (m.qualite === "AVOCAT") inscrits += 1;
      if (m.qualite === "STAGIAIRE") stagiaires += 1;
      const montantDuM = m.cotisations[0]?.montantDu ?? montantDuAvec(tarifs, m.qualite);
      const paye = m.cotisations[0]?.montantPaye ?? 0;
      du += montantDuM;
      payees += paye;
      const st = statutCotisation(montantDuM, paye);
      if (st === "ajour") aJour += 1;
      else if (st === "retard" || st === "partiel") enRetard += 1;
    }

    // RG-15 : les montants financiers ne sont servis qu'aux profils finances ;
    // le Bâtonnier reçoit la composition des membres mais pas les finances.
    const role = (req as AuthRequest).user?.role;
    const voitFinances = role === "SECRETAIRE_GENERAL" || role === "TRESORIERE" || role === "ADMIN";
    res.json({
      annee,
      membres: { inscrits, stagiaires, aJour, enRetard },
      ...(voitFinances ? { finances: { payees, impayees: du - payees, solde: du - payees } } : {}),
    });
  })
);

/**
 * GET /dashboard/agenda — prochaines échéances institutionnelles (réunions + AG).
 * Ouvert à tout utilisateur authentifié : l'agenda alimente le tableau de bord et
 * les notifications de tous les rôles, alors que les modules détaillés sont restreints.
 */
dashboardRouter.get(
  "/agenda",
  asyncH(async (_req, res) => {
    const auj = new Date();
    auj.setHours(0, 0, 0, 0);
    const [reunions, assemblees] = await Promise.all([
      prisma.reunion.findMany({ where: { date: { gte: auj } }, orderBy: { date: "asc" }, take: 5 }),
      prisma.assemblee.findMany({ where: { date: { gte: auj } }, orderBy: { date: "asc" }, take: 5 }),
    ]);
    const items = [
      ...reunions.map((r) => ({ date: r.date, libelle: `Réunion du Conseil${r.lieu ? ` — ${r.lieu}` : ""}` })),
      ...assemblees.map((a) => ({ date: a.date, libelle: a.type === "AGE" ? "Assemblée Générale Extraordinaire" : "Assemblée Générale Ordinaire" })),
    ]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(0, 5);
    res.json(items);
  })
);

/** GET /dashboard/journal — dernières actions effectuées (journal d'audit, FR-DB-10). */
dashboardRouter.get(
  "/journal",
  asyncH(async (req, res) => {
    const limitBrut = Number(req.query.limit ?? 12);
    const take = Number.isFinite(limitBrut) ? Math.min(50, Math.max(1, Math.trunc(limitBrut))) : 12;
    // Le fil d'activité privilégie les actions institutionnelles : on écarte le
    // bruit des connexions/déconnexions (le journal d'audit complet les conserve).
    const entries = await prisma.journalAudit.findMany({
      where: { NOT: { chemin: { contains: "/api/auth/" } } },
      orderBy: { id: "desc" },
      take,
    });
    const userIds = [...new Set(entries.map((e) => e.userId).filter((v): v is number => v != null))];
    const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nom: true } }) : [];
    const nomParId = new Map(users.map((u) => [u.id, u.nom]));
    res.json(
      entries.map((e) => ({
        id: e.id,
        action: e.action,
        cible: e.cible,
        acteur: e.userNom ?? (e.userId != null ? nomParId.get(e.userId) ?? "Utilisateur" : "Système"),
        quand: e.quand,
      }))
    );
  })
);
