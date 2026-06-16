import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireAvocat, type AuthRequest } from "../middleware/auth.js";
import { montantDuAvec, droitDuAvec, statutCotisation, tarifsActuels } from "../lib/business.js";
import { finaliserPaiement } from "../lib/encaissement.js";
import { CANAUX, modeSandbox, nouvelleReference, initierPaiement } from "../lib/paiement.js";
import { envoyerPdf } from "../lib/pdf.js";
import { recuHtml, quitusHtml, convocationAgHtml, pvAssembleeHtml, decisionDisciplineHtml } from "../lib/templates.js";
import { signerDocument, quitusPayload } from "../lib/signature.js";
import { notifierNouveauMessage, emailsAdministration, emailsMembres } from "../lib/messagerieNotif.js";
import { messageNonDeMoi, compterNonLusParFil, totalNonLus, JAMAIS_LU } from "../lib/messagerie.js";

/**
 * Espace avocat — surface en libre-service, strictement cloisonnée.
 * Toutes les routes exigent le rôle AVOCAT et dérivent le `membreId` DU JETON
 * (jamais d'un paramètre client) : un avocat ne peut consulter que ses propres
 * données. Le middleware global `confinementAvocat` interdit par ailleurs à ce
 * rôle toute route hors de cet espace.
 */
export const espaceRouter = Router();
espaceRouter.use(requireAuth, requireAvocat);

/** Identifiant de la fiche de l'avocat connecté (garanti par requireAvocat). */
const monMembreId = (req: AuthRequest) => req.user!.membreId as number;

const dateCourte = (v: Date | null | undefined) => (v ? v.toISOString().slice(0, 10) : null);

/**
 * GET /espace/moi — fiche de l'avocat connecté et synthèse de sa situation
 * (cotisation et droit de plaidoirie de l'exercice courant) + historiques.
 */
espaceRouter.get(
  "/moi",
  asyncH(async (req: AuthRequest, res) => {
    const id = monMembreId(req);
    const annee = new Date().getFullYear();
    const [membre, tarifs] = await Promise.all([
      prisma.membre.findUnique({
        where: { id },
        include: {
          cotisations: { orderBy: { annee: "desc" } },
          droitsPlaidoirie: { orderBy: { annee: "desc" } },
        },
      }),
      tarifsActuels(),
    ]);
    if (!membre) throw new HttpError(404, "Fiche introuvable");

    const cot = membre.cotisations.find((c) => c.annee === annee);
    const cotDu = cot?.montantDu ?? montantDuAvec(tarifs, membre.qualite);
    const cotPaye = cot?.montantPaye ?? 0;
    const droit = membre.droitsPlaidoirie.find((d) => d.annee === annee);
    const estAvocat = membre.qualite === "AVOCAT";
    const droitDu = estAvocat ? droit?.montantDu ?? droitDuAvec(tarifs, membre.qualite) : 0;
    const droitPaye = droit?.montantPaye ?? 0;

    res.json({
      membre: {
        id: membre.id,
        num: membre.num,
        numInscription: membre.numInscription,
        nom: membre.nom,
        qualite: membre.qualite.toLowerCase(),
        statut: membre.statut.toLowerCase(),
        cabinet: membre.cabinet,
        tel: membre.tel,
        email: membre.email,
        adresse: membre.adresse,
        dateInscription: dateCourte(membre.dateInscription),
      },
      annee,
      situation: {
        cotisation: { du: cotDu, paye: cotPaye, solde: Math.max(0, cotDu - cotPaye), valideTresoriere: cot?.valideTresoriere ?? false, statut: statutCotisation(cotDu, cotPaye) },
        droit: estAvocat ? { du: droitDu, paye: droitPaye, solde: Math.max(0, droitDu - droitPaye), statut: statutCotisation(droitDu, droitPaye) } : null,
      },
      cotisations: membre.cotisations.map((c) => ({ annee: c.annee, du: c.montantDu, paye: c.montantPaye, datePaiement: dateCourte(c.datePaiement), valideTresoriere: c.valideTresoriere, statut: statutCotisation(c.montantDu, c.montantPaye) })),
      droits: membre.droitsPlaidoirie.map((d) => ({ annee: d.annee, du: d.montantDu, paye: d.montantPaye, datePaiement: dateCourte(d.datePaiement), statut: statutCotisation(d.montantDu, d.montantPaye) })),
    });
  })
);

/** GET /espace/documents — reçus et quitus délivrés à l'avocat connecté. */
espaceRouter.get(
  "/documents",
  asyncH(async (req: AuthRequest, res) => {
    const membreId = monMembreId(req);
    const [recus, quitus] = await Promise.all([
      prisma.recu.findMany({ where: { membreId }, orderBy: { date: "desc" } }),
      prisma.quitus.findMany({ where: { membreId }, orderBy: { dateEmission: "desc" } }),
    ]);
    res.json({
      recus: recus.map((r) => ({ id: r.id, numero: r.numero, montant: r.montant, annee: r.annee, date: dateCourte(r.date), objet: r.objet })),
      quitus: quitus.map((q) => ({ id: q.id, numero: q.numero, annee: q.annee, date: dateCourte(q.dateEmission) })),
    });
  })
);

// ── Paiement en ligne de SA propre situation (phase 2) ──────────────────────

/** Solde restant dû de l'avocat connecté pour un type/exercice donné. */
async function soldeDe(membreId: number, type: "cotisation" | "droit", annee: number) {
  const membre = await prisma.membre.findUnique({ where: { id: membreId } });
  if (!membre) throw new HttpError(404, "Fiche introuvable");
  const tarifs = await tarifsActuels();
  if (type === "droit" && membre.qualite !== "AVOCAT") {
    throw new HttpError(400, "Le droit de plaidoirie ne concerne que les avocats inscrits.");
  }
  if (type === "droit") {
    const d = await prisma.droitPlaidoirie.findUnique({ where: { membreId_annee: { membreId, annee } } });
    const du = d?.montantDu ?? droitDuAvec(tarifs, membre.qualite);
    return { membre, du, paye: d?.montantPaye ?? 0, solde: Math.max(0, du - (d?.montantPaye ?? 0)) };
  }
  const c = await prisma.cotisation.findUnique({ where: { membreId_annee: { membreId, annee } } });
  const du = c?.montantDu ?? montantDuAvec(tarifs, membre.qualite);
  return { membre, du, paye: c?.montantPaye ?? 0, solde: Math.max(0, du - (c?.montantPaye ?? 0)) };
}

const paiementSchema = z.object({
  annee: z.number().int(),
  type: z.enum(["cotisation", "droit"]),
  canal: z.enum(CANAUX),
  montant: z.number().int().positive().optional(),
});

/**
 * POST /espace/paiement — l'avocat initie le paiement en ligne de SA situation.
 * Le `membreId` provient du jeton ; le montant est plafonné au solde restant dû.
 */
espaceRouter.post(
  "/paiement",
  asyncH(async (req: AuthRequest, res) => {
    const membreId = monMembreId(req);
    const { annee, type, canal, montant } = paiementSchema.parse(req.body);
    const { membre, solde } = await soldeDe(membreId, type, annee);
    if (solde <= 0) throw new HttpError(400, "Aucun solde à régler pour cet exercice.");
    const aPayer = montant ?? solde;
    if (aPayer > solde) throw new HttpError(400, `Montant supérieur au solde dû (${solde} FCFA).`);

    const ref = nouvelleReference();
    const passerelle = await initierPaiement({ ref, canal, montant: aPayer, tel: membre.tel ?? undefined });
    const paiement = await prisma.paiement.create({
      data: { ref, canal, type, membreId, annee, montant: aPayer, statut: "EN_ATTENTE" },
    });
    res.status(201).json({ paiement, sandbox: modeSandbox, ...passerelle });
  })
);

const confirmerSchema = z.object({ succes: z.boolean().default(true) });

/**
 * POST /espace/paiement/:ref/confirmer-sandbox — simule le retour passerelle
 * (sandbox). Strictement limité au paiement de l'avocat connecté.
 */
espaceRouter.post(
  "/paiement/:ref/confirmer-sandbox",
  asyncH(async (req: AuthRequest, res) => {
    if (!modeSandbox) throw new HttpError(400, "Indisponible : une passerelle réelle est configurée.");
    const { succes } = confirmerSchema.parse(req.body ?? {});
    const p = await prisma.paiement.findUnique({ where: { ref: req.params.ref } });
    if (!p || p.membreId !== monMembreId(req)) throw new HttpError(404, "Paiement introuvable");
    if (succes) return res.json(await finaliserPaiement(p.id));
    res.json(await prisma.paiement.update({ where: { id: p.id }, data: { statut: "ECHEC" } }));
  })
);

/** GET /espace/recus/:id/pdf — reçu officiel de l'avocat connecté (cloisonné). */
espaceRouter.get(
  "/recus/:id/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const recu = await prisma.recu.findUnique({ where: { id: Number(req.params.id) }, include: { membre: true } });
    if (!recu || recu.membreId !== monMembreId(req)) throw new HttpError(404, "Reçu introuvable");
    await envoyerPdf(res, recuHtml(recu, recu.membre), `Recu-${recu.numero}.pdf`);
  })
);

/** GET /espace/quitus/:id/pdf — quitus officiel signé de l'avocat connecté (cloisonné). */
espaceRouter.get(
  "/quitus/:id/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const quitus = await prisma.quitus.findUnique({ where: { id: Number(req.params.id) }, include: { membre: true } });
    if (!quitus || quitus.membreId !== monMembreId(req)) throw new HttpError(404, "Quitus introuvable");
    const signature = signerDocument(quitusPayload(quitus));
    await envoyerPdf(res, quitusHtml(quitus, quitus.membre, signature), `Quitus-${quitus.numero}.pdf`);
  })
);

// ── Annuaire des confrères (lecture seule) ──────────────────────────────────

/**
 * GET /espace/annuaire — annuaire du Barreau accessible à tout membre.
 * Projection professionnelle (nom, cabinet, coordonnées) pour permettre à un
 * avocat de joindre un confrère ; aucune donnée personnelle sensible (adresse,
 * RCCM, CNSS, finances…) n'est exposée.
 */
espaceRouter.get(
  "/annuaire",
  asyncH(async (req: AuthRequest, res) => {
    const q = String(req.query.q ?? "").trim();
    const membres = await prisma.membre.findMany({
      // Annuaire des confrères : on exclut sa propre fiche.
      where: {
        id: { not: monMembreId(req) },
        ...(q ? { OR: [{ nom: { contains: q, mode: "insensitive" } }, { cabinet: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { nom: "asc" },
      select: {
        id: true, num: true, numInscription: true, nom: true, qualite: true,
        statut: true, cabinet: true, tel: true, email: true, dateInscription: true,
      },
    });
    res.json(membres.map((m) => ({ ...m, dateInscription: dateCourte(m.dateInscription) })));
  })
);

// ── Assemblées générales (lecture seule — concernent tous les membres) ───────

/** GET /espace/assemblees — liste des assemblées générales (convocations, PV). */
espaceRouter.get(
  "/assemblees",
  asyncH(async (_req, res) => {
    res.json(await prisma.assemblee.findMany({ orderBy: { date: "desc" } }));
  })
);

/** GET /espace/assemblees/:id — détail d'une assemblée générale. */
espaceRouter.get(
  "/assemblees/:id",
  asyncH(async (req: AuthRequest, res) => {
    const a = await prisma.assemblee.findUnique({ where: { id: Number(req.params.id) } });
    if (!a) throw new HttpError(404, "Assemblée introuvable");
    res.json(a);
  })
);

/** GET /espace/assemblees/:id/convocation/pdf — convocation d'AG (PDF). */
espaceRouter.get(
  "/assemblees/:id/convocation/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const a = await prisma.assemblee.findUnique({ where: { id: Number(req.params.id) } });
    if (!a) throw new HttpError(404, "Assemblée introuvable");
    const jour = String(a.date).slice(0, 10);
    await envoyerPdf(res, convocationAgHtml(a), `Convocation-${a.type}-${jour}.pdf`);
  })
);

/** GET /espace/assemblees/:id/pv/pdf — procès-verbal d'AG (PDF), si disponible. */
espaceRouter.get(
  "/assemblees/:id/pv/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const a = await prisma.assemblee.findUnique({ where: { id: Number(req.params.id) } });
    if (!a) throw new HttpError(404, "Assemblée introuvable");
    if (!a.pv) throw new HttpError(404, "Procès-verbal non disponible");
    const jour = String(a.date).slice(0, 10);
    await envoyerPdf(res, pvAssembleeHtml(a), `PV-${a.type}-${jour}.pdf`);
  })
);

// ── Discipline — strictement les dossiers concernant l'avocat connecté ───────

/** GET /espace/discipline — dossiers disciplinaires où l'avocat est mis en cause. */
espaceRouter.get(
  "/discipline",
  asyncH(async (req: AuthRequest, res) => {
    res.json(
      await prisma.dossierDisciplinaire.findMany({
        where: { membreId: monMembreId(req) },
        orderBy: { id: "desc" },
      })
    );
  })
);

/** GET /espace/discipline/:id — détail d'un dossier le concernant. */
espaceRouter.get(
  "/discipline/:id",
  asyncH(async (req: AuthRequest, res) => {
    const d = await prisma.dossierDisciplinaire.findUnique({ where: { id: Number(req.params.id) } });
    if (!d || d.membreId !== monMembreId(req)) throw new HttpError(404, "Dossier introuvable");
    res.json(d);
  })
);

/** GET /espace/discipline/:id/decision/pdf — décision rendue, si disponible. */
espaceRouter.get(
  "/discipline/:id/decision/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const d = await prisma.dossierDisciplinaire.findUnique({ where: { id: Number(req.params.id) } });
    if (!d || d.membreId !== monMembreId(req)) throw new HttpError(404, "Dossier introuvable");
    if (!d.decision) throw new HttpError(404, "Décision non disponible");
    await envoyerPdf(res, decisionDisciplineHtml(d), `Decision-${d.reference}.pdf`);
  })
);

// ── Archives officielles (institutionnelles + concernant l'avocat) ──────────

/** Catégories d'archives confidentielles, jamais exposées dans l'espace avocat. */
const ARCHIVES_EXCLUES = ["Convocation disciplinaire", "Décision disciplinaire"];

/**
 * GET /espace/archives — registre des documents officiels consultables par
 * l'avocat : pièces institutionnelles (membreNom nul) et documents le concernant
 * (son propre nom). Les pièces disciplinaires nominatives en sont exclues.
 */
espaceRouter.get(
  "/archives",
  asyncH(async (req: AuthRequest, res) => {
    const moi = await prisma.membre.findUnique({ where: { id: monMembreId(req) }, select: { nom: true } });
    const q = String(req.query.q ?? "").trim();
    const where: Prisma.ArchiveWhereInput = {
      categorie: { notIn: ARCHIVES_EXCLUES },
      OR: [{ membreNom: null }, { membreNom: "" }, ...(moi?.nom ? [{ membreNom: moi.nom }] : [])],
      ...(q
        ? { AND: [{ OR: [{ titre: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] }] }
        : {}),
    };
    const archives = await prisma.archive.findMany({ where, orderBy: { archiveLe: "desc" }, take: 300 });
    const categories = [...new Set(archives.map((a) => a.categorie))].sort();
    res.json({ archives, categories });
  })
);

// ── Publications publiées (lecture seule) ───────────────────────────────────

/** GET /espace/publications — communications officielles publiées du Barreau. */
espaceRouter.get(
  "/publications",
  asyncH(async (_req, res) => {
    res.json(await prisma.publication.findMany({ where: { statut: "PUBLIE" }, orderBy: { date: "desc" } }));
  })
);

/** GET /espace/publications/:id — détail d'une publication publiée. */
espaceRouter.get(
  "/publications/:id",
  asyncH(async (req: AuthRequest, res) => {
    const p = await prisma.publication.findUnique({ where: { id: Number(req.params.id) } });
    if (!p || p.statut !== "PUBLIE") throw new HttpError(404, "Publication introuvable");
    res.json(p);
  })
);

// ── Messagerie interne (avocat ↔ administration ↔ confrères) ─────────────────

/** Nom lisible de l'avocat connecté (pour figer l'auteur d'un message). */
async function monNom(req: AuthRequest) {
  const m = await prisma.membre.findUnique({ where: { id: monMembreId(req) }, select: { nom: true } });
  return m ? `Me ${m.nom}` : "Avocat";
}

/** Notifie l'administration (non bloquant) d'un nouveau message d'avocat. */
function notifierAdministration(sujet: string, auteurNom: string, corps: string) {
  notifierNouveauMessage(emailsAdministration, {
    titre: `nouveau message de ${auteurNom}`,
    intro: `${auteurNom} a adressé un message à l'administration du Barreau.`,
    cta: "Connectez-vous à l'espace d'administration (module « Messagerie ») pour y répondre.",
    auteurNom, sujet, corps,
  });
}

/** Notifie le(s) confrère(s) destinataire(s) (non bloquant) d'un message entre avocats. */
function notifierConfreres(membreIds: number[], sujet: string, auteurNom: string, corps: string) {
  notifierNouveauMessage(() => emailsMembres(membreIds), {
    titre: `nouveau message de ${auteurNom}`,
    intro: `${auteurNom} vous a adressé un message via la messagerie du Barreau.`,
    cta: "Connectez-vous à votre espace avocat (module « Messagerie ») pour y répondre.",
    auteurNom, sujet, corps,
  });
}

/** GET /espace/messagerie — fils de discussion de l'avocat (synthèse + non-lus). */
espaceRouter.get(
  "/messagerie",
  asyncH(async (req: AuthRequest, res) => {
    const moi = monMembreId(req);
    const convs = await prisma.conversation.findMany({
      where: { participants: { some: { membreId: moi } } },
      orderBy: { updatedAt: "desc" },
      include: {
        participants: { include: { membre: { select: { id: true, nom: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    const seuils = convs.map((c) => ({ conversationId: c.id, depuis: c.participants.find((p) => p.membreId === moi)?.lastReadAt ?? JAMAIS_LU }));
    const nonLusParFil = await compterNonLusParFil(messageNonDeMoi(moi), seuils);
    const result = convs.map((c) => {
      const autre = c.avecAdministration ? null : c.participants.find((p) => p.membreId !== moi)?.membre ?? null;
      const dernier = c.messages[0];
      return {
        id: c.id,
        sujet: c.sujet,
        avecAdministration: c.avecAdministration,
        interlocuteur: c.avecAdministration ? "Administration" : autre ? `Me ${autre.nom}` : "Confrère",
        updatedAt: c.updatedAt,
        apercu: dernier ? { corps: dernier.corps.slice(0, 140), auteurNom: dernier.auteurNom, estMoi: dernier.auteurMembreId === moi, createdAt: dernier.createdAt } : null,
        nonLus: nonLusParFil.get(c.id) ?? 0,
      };
    });
    res.json(result);
  })
);

/** GET /espace/messagerie/non-lus — total de messages non lus (pastille de navigation). */
espaceRouter.get(
  "/messagerie/non-lus",
  asyncH(async (req: AuthRequest, res) => {
    const moi = monMembreId(req);
    const parts = await prisma.conversationParticipant.findMany({ where: { membreId: moi } });
    const seuils = parts.map((p) => ({ conversationId: p.conversationId, depuis: p.lastReadAt ?? JAMAIS_LU }));
    res.json({ total: await totalNonLus(messageNonDeMoi(moi), seuils) });
  })
);

/** GET /espace/messagerie/:id — fil détaillé ; marque le fil comme lu. */
espaceRouter.get(
  "/messagerie/:id",
  asyncH(async (req: AuthRequest, res) => {
    const moi = monMembreId(req);
    const id = Number(req.params.id);
    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { participants: { include: { membre: { select: { id: true, nom: true } } } }, messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conv || !conv.participants.some((p) => p.membreId === moi)) throw new HttpError(404, "Conversation introuvable");
    await prisma.conversationParticipant.update({
      where: { conversationId_membreId: { conversationId: id, membreId: moi } },
      data: { lastReadAt: new Date() },
    });
    const autre = conv.avecAdministration ? null : conv.participants.find((p) => p.membreId !== moi)?.membre ?? null;
    res.json({
      id: conv.id,
      sujet: conv.sujet,
      avecAdministration: conv.avecAdministration,
      interlocuteur: conv.avecAdministration ? "Administration" : autre ? `Me ${autre.nom}` : "Confrère",
      messages: conv.messages.map((m) => ({
        id: m.id,
        corps: m.corps,
        auteurNom: m.auteurNom,
        estMoi: m.auteurMembreId === moi,
        estAdministration: m.estAdministration,
        createdAt: m.createdAt,
      })),
    });
  })
);

const nouvelleConvSchema = z.object({
  sujet: z.string().trim().min(1).max(160),
  corps: z.string().trim().min(1).max(5000),
  avecAdministration: z.boolean().default(false),
  destinataireMembreId: z.number().int().positive().optional(),
});

/** POST /espace/messagerie — ouvre un fil (avec l'administration ou un confrère). */
espaceRouter.post(
  "/messagerie",
  asyncH(async (req: AuthRequest, res) => {
    const moi = monMembreId(req);
    const { sujet, corps, avecAdministration, destinataireMembreId } = nouvelleConvSchema.parse(req.body);
    const auteurNom = await monNom(req);

    const participantsData: { membreId: number }[] = [{ membreId: moi }];
    if (!avecAdministration) {
      if (!destinataireMembreId || destinataireMembreId === moi) throw new HttpError(400, "Destinataire invalide.");
      const dest = await prisma.membre.findUnique({ where: { id: destinataireMembreId }, select: { id: true } });
      if (!dest) throw new HttpError(404, "Confrère introuvable.");
      participantsData.push({ membreId: destinataireMembreId });
    }

    const conv = await prisma.conversation.create({
      data: {
        sujet,
        avecAdministration,
        participants: { create: participantsData },
        messages: { create: { corps, auteurMembreId: moi, auteurNom, estAdministration: false } },
      },
    });
    if (avecAdministration) notifierAdministration(sujet, auteurNom, corps);
    else if (destinataireMembreId) notifierConfreres([destinataireMembreId], sujet, auteurNom, corps);
    res.status(201).json({ id: conv.id });
  })
);

const repondreSchema = z.object({ corps: z.string().trim().min(1).max(5000) });

/** POST /espace/messagerie/:id — répond dans un fil dont l'avocat est participant. */
espaceRouter.post(
  "/messagerie/:id",
  asyncH(async (req: AuthRequest, res) => {
    const moi = monMembreId(req);
    const id = Number(req.params.id);
    const { corps } = repondreSchema.parse(req.body);
    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { participants: { select: { membreId: true } } },
    });
    if (!conv || !conv.participants.some((p) => p.membreId === moi)) throw new HttpError(404, "Conversation introuvable");
    const auteurNom = await monNom(req);
    const message = await prisma.message.create({
      data: { conversationId: id, corps, auteurMembreId: moi, auteurNom, estAdministration: false },
    });
    await prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    if (conv.avecAdministration) notifierAdministration(conv.sujet, auteurNom, corps);
    else notifierConfreres(conv.participants.map((p) => p.membreId).filter((mid) => mid !== moi), conv.sujet, auteurNom, corps);
    res.status(201).json({ id: message.id });
  })
);
