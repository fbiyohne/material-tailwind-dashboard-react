import { Router } from "express";
import { prisma } from "../prisma.js";
import { anneeDeRequete } from "../lib/requete.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { cotisationDue, statutCotisation, tarifsActuels } from "../lib/business.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

/** GET /dashboard?annee= — indicateurs clés (FR-DB-01 → 07). */
dashboardRouter.get(
  "/",
  asyncH(async (req, res) => {
    const annee = anneeDeRequete(req);
    const [tarifs, membres, cabinets] = await Promise.all([
      tarifsActuels(),
      prisma.membre.findMany({ include: { cotisations: { where: { annee } } } }),
      prisma.cabinet.findMany({ where: { statut: "actif" }, include: { membres: { select: { statut: true } } } }),
    ]);

    // Principaux cabinets par effectif actif (personnes morales).
    const topCabinets = cabinets
      .map((c) => ({ nom: c.nom, effectif: c.membres.filter((m) => m.statut === "INSCRIT").length }))
      .filter((c) => c.effectif > 0)
      .sort((a, b) => b.effectif - a.effectif)
      .slice(0, 8);

    let inscrits = 0;
    let stagiaires = 0;
    let aJour = 0;
    let enRetard = 0;
    let payees = 0;
    let du = 0;

    // Répartitions démographiques (non financières) — servies à tous les rôles.
    const parQualite: Record<string, number> = {};
    const parStatut: Record<string, number> = {};
    const parDecennieMap: Record<number, number> = {};
    const parite = { H: 0, F: 0, nr: 0 };

    for (const m of membres) {
      if (m.qualite === "AVOCAT") inscrits += 1;
      if (m.qualite === "STAGIAIRE") stagiaires += 1;
      parQualite[m.qualite] = (parQualite[m.qualite] ?? 0) + 1;
      parStatut[m.statut] = (parStatut[m.statut] ?? 0) + 1;
      if (m.sexe === "H") parite.H += 1;
      else if (m.sexe === "F") parite.F += 1;
      else parite.nr += 1;
      if (m.dateServment) {
        const dec = Math.floor(m.dateServment.getFullYear() / 10) * 10;
        parDecennieMap[dec] = (parDecennieMap[dec] ?? 0) + 1;
      }
      const montantDuM = cotisationDue(m.cotisations[0], tarifs, m.qualite);
      const paye = m.cotisations[0]?.montantPaye ?? 0;
      du += montantDuM;
      payees += paye;
      const st = statutCotisation(montantDuM, paye);
      if (st === "ajour") aJour += 1;
      else if (st === "retard" || st === "partiel") enRetard += 1;
    }

    const parDecennie = Object.entries(parDecennieMap)
      .map(([decennie, n]) => ({ decennie: Number(decennie), n }))
      .sort((a, b) => a.decennie - b.decennie);

    // RG-15 : les montants financiers ne sont servis qu'aux profils finances ;
    // le Bâtonnier reçoit la composition des membres mais pas les finances.
    const role = (req as AuthRequest).user?.role;
    const voitFinances = role === "SECRETAIRE_GENERAL" || role === "TRESORIERE" || role === "ADMIN";
    const voitInstitutionnel = role === "SECRETAIRE_GENERAL" || role === "BATONNIER" || role === "ADMIN";
    const voitSysteme = role === "SECRETAIRE_GENERAL" || role === "ADMIN";

    // Indicateurs institutionnels/système, servis selon le rôle (RG-13 / RG-15).
    const [disciplineEnCours, sanctionsAnnee, demandesEnAttente, timbresAnnee] = await Promise.all([
      voitInstitutionnel ? prisma.dossierDisciplinaire.count({ where: { statut: { not: "CLASSE" } } }) : Promise.resolve(0),
      voitInstitutionnel ? prisma.dossierDisciplinaire.count({ where: { sanction: { not: null }, dateSaisine: { gte: new Date(annee, 0, 1), lt: new Date(annee + 1, 0, 1) } } }) : Promise.resolve(0),
      voitSysteme ? prisma.demandeAcces.count({ where: { statut: "EN_ATTENTE" } }) : Promise.resolve(0),
      voitFinances ? prisma.timbre.count({ where: { statut: "VALIDE", createdAt: { gte: new Date(annee, 0, 1), lt: new Date(annee + 1, 0, 1) } } }) : Promise.resolve(0),
    ]);

    res.json({
      annee,
      membres: { inscrits, stagiaires, aJour, enRetard },
      demographie: { parQualite, parStatut, parDecennie, parite, topCabinets, total: membres.length },
      ...(voitInstitutionnel ? { discipline: { enCours: disciplineEnCours, sanctionsAnnee } } : {}),
      ...(voitSysteme ? { demandesEnAttente } : {}),
      ...(voitFinances ? { finances: { payees, impayees: du - payees, solde: du - payees, timbresAnnee } } : {}),
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
