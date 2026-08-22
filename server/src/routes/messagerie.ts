import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, type AuthRequest, requirePermission } from "../middleware/auth.js";
import { notifierNouveauMessage, emailsMembres } from "../lib/messagerieNotif.js";
import { MESSAGE_DE_AVOCAT, compterNonLusParFil, totalNonLus, jamaisLu } from "../lib/messagerie.js";
import { realtimeMembres } from "../lib/realtime.js";

/**
 * Messagerie — côté administration (Secrétariat). Boîte partagée des officiers
 * de l'Ordre : seuls les fils adressés à l'administration (avecAdministration)
 * sont visibles ici. Les échanges entre confrères restent privés (jamais exposés).
 */
export const messagerieRouter = Router();
messagerieRouter.use(requireAuth, requirePermission("messagerie"));

/** Nom lisible de l'agent connecté, figé sur le message émis. */
async function monNomAdmin(req: AuthRequest) {
  const u = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { nom: true } });
  return u?.nom ?? "Secrétariat";
}

/** GET /messagerie/non-lus — total de messages avocats non lus côté administration. */
messagerieRouter.get(
  "/non-lus",
  asyncH(async (_req, res) => {
    const convs = await prisma.conversation.findMany({
      where: { avecAdministration: true },
      select: { id: true, adminLastReadAt: true },
    });
    const seuils = convs.map((c) => ({ conversationId: c.id, depuis: c.adminLastReadAt ?? jamaisLu() }));
    res.json({ total: await totalNonLus(MESSAGE_DE_AVOCAT, seuils) });
  })
);

/** GET /messagerie — fils adressés à l'administration (synthèse + non-lus). */
messagerieRouter.get(
  "/",
  asyncH(async (_req, res) => {
    const convs = await prisma.conversation.findMany({
      where: { avecAdministration: true },
      orderBy: { updatedAt: "desc" },
      include: {
        participants: { include: { membre: { select: { id: true, nom: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    const seuils = convs.map((c) => ({ conversationId: c.id, depuis: c.adminLastReadAt ?? jamaisLu() }));
    const nonLusParFil = await compterNonLusParFil(MESSAGE_DE_AVOCAT, seuils);
    const result = convs.map((c) => {
      const avocat = c.participants[0]?.membre ?? null;
      const dernier = c.messages[0];
      return {
        id: c.id,
        sujet: c.sujet,
        expediteur: avocat ? `Me ${avocat.nom}` : "Avocat",
        updatedAt: c.updatedAt,
        apercu: dernier ? { corps: dernier.corps.slice(0, 140), auteurNom: dernier.auteurNom, estAdministration: dernier.estAdministration, createdAt: dernier.createdAt } : null,
        nonLus: nonLusParFil.get(c.id) ?? 0,
      };
    });
    res.json(result);
  })
);

/** GET /messagerie/:id — fil détaillé ; marque comme lu côté administration. */
messagerieRouter.get(
  "/:id",
  asyncH(async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { participants: { include: { membre: { select: { id: true, nom: true } } } }, messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conv || !conv.avecAdministration) throw new HttpError(404, "Conversation introuvable");
    await prisma.conversation.update({ where: { id }, data: { adminLastReadAt: new Date() } });
    const avocat = conv.participants[0]?.membre ?? null;
    res.json({
      id: conv.id,
      sujet: conv.sujet,
      expediteur: avocat ? `Me ${avocat.nom}` : "Avocat",
      messages: conv.messages.map((m) => ({
        id: m.id,
        corps: m.corps,
        auteurNom: m.auteurNom,
        estAdministration: m.estAdministration,
        createdAt: m.createdAt,
      })),
    });
  })
);

const repondreSchema = z.object({ corps: z.string().trim().min(1).max(5000) });

/** POST /messagerie/:id — réponse de l'administration dans un fil. */
messagerieRouter.post(
  "/:id",
  asyncH(async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const { corps } = repondreSchema.parse(req.body);
    const conv = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true, sujet: true, avecAdministration: true, participants: { select: { membreId: true } } },
    });
    if (!conv || !conv.avecAdministration) throw new HttpError(404, "Conversation introuvable");
    const auteurNom = await monNomAdmin(req);
    const message = await prisma.message.create({
      data: { conversationId: id, corps, auteurMembreId: null, auteurNom, estAdministration: true },
    });
    await prisma.conversation.update({ where: { id }, data: { updatedAt: new Date(), adminLastReadAt: new Date() } });
    // Symétrie des notifications : on prévient l'avocat de la réponse (non bloquant).
    const membreIds = conv.participants.map((p) => p.membreId);
    notifierNouveauMessage(() => emailsMembres(membreIds), {
      titre: "réponse de l'administration",
      intro: `L'administration du Barreau (${auteurNom}) a répondu à votre message.`,
      cta: "Connectez-vous à votre espace avocat (module « Messagerie ») pour la consulter.",
      auteurNom, sujet: conv.sujet, corps,
    });
    realtimeMembres(membreIds, { type: "messagerie", conversationId: id });
    res.status(201).json({ id: message.id });
  })
);
