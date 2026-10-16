import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, type AuthRequest, requirePermission } from "../middleware/auth.js";
import { tracerLectureAdmin } from "../middleware/audit.js";
import { notifierNouveauMessage, emailsMembres, telephonesMembres } from "../lib/messagerieNotif.js";
import { MESSAGE_DE_AVOCAT, compterNonLusParFil, totalNonLus, jamaisLu, pieceSchema, envoyerMessage, accuser, messageAvecFil, pieceDto, envoyerPiece, htmlAccuse } from "../lib/messagerie.js";
import { realtimeMembres } from "../lib/realtime.js";
import { envoyerPdf, htmlVersPdf } from "../lib/pdf.js";
import { STATUTS_SORTIS, peutAttesterInscription, prochainNumeroAttestation, archiver, cotisationDue, tarifsActuels } from "../lib/business.js";
import { attestationHtml, attestationNonRedevanceHtml } from "../lib/templates.js";

/**
 * Messagerie — côté administration (Secrétariat). Boîte partagée des officiers
 * de l'Ordre : seuls les fils adressés à l'administration (avecAdministration)
 * sont visibles ici. Les échanges entre confrères restent privés (jamais exposés
 * à l'administration), pièces jointes et accusés compris.
 * L'ADMIN lit et écrit les fils de l'administration : accès ADMIN autorisé (décision
 * du 16/10/2026), chaque lecture tracée dans JournalAudit (middleware/audit.ts).
 */
export const messagerieRouter = Router();
messagerieRouter.use(requireAuth, requirePermission("messagerie"));

/** Nom lisible de l'agent connecté, figé sur le message émis. */
async function monNomAdmin(req: AuthRequest) {
  const u = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { nom: true } });
  return u?.nom ?? "Secrétariat";
}

/** Prévient l'avocat (e-mail best-effort + temps réel) d'un message de l'administration. */
function notifierAvocat(membreIds: number[], conversationId: number, auteurNom: string, sujet: string, corps: string, titre: string, intro: string) {
  void notifierNouveauMessage(() => emailsMembres(membreIds), () => telephonesMembres(membreIds)); // contenu neutre (CL-NOTIF-EXTERNE)
  realtimeMembres(membreIds, { type: "messagerie", conversationId });
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
  asyncH(async (req: AuthRequest, res) => {
    const convs = await prisma.conversation.findMany({
      where: { avecAdministration: true },
      orderBy: { updatedAt: "desc" },
      include: {
        participants: { include: { membre: { select: { id: true, nom: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    // Charger la boîte vaut réception des messages des avocats (posé une seule fois).
    await accuser("recuAt", { conversationId: { in: convs.map((c) => c.id) }, ...MESSAGE_DE_AVOCAT });
    const seuils = convs.map((c) => ({ conversationId: c.id, depuis: c.adminLastReadAt ?? jamaisLu() }));
    const nonLusParFil = await compterNonLusParFil(MESSAGE_DE_AVOCAT, seuils);
    const result = convs.map((c) => {
      const avocat = c.participants[0]?.membre ?? null;
      const dernier = c.messages[0];
      return {
        id: c.id,
        sujet: c.sujet,
        expediteur: avocat ? `Me ${avocat.nom}` : "Avocat",
        membreId: avocat?.id ?? null,
        attestationType: c.attestationType,
        attestationNumero: c.attestationNumero,
        updatedAt: c.updatedAt,
        apercu: dernier ? { corps: dernier.corps.slice(0, 140), auteurNom: dernier.auteurNom, estAdministration: dernier.estAdministration, createdAt: dernier.createdAt } : null,
        nonLus: nonLusParFil.get(c.id) ?? 0,
      };
    });
    await tracerLectureAdmin(req, res); // l'aperçu porte le début du corps
    res.json(result);
  })
);

/** Message d'un fil adressé à l'administration ; un fil entre confrères répond 404, comme s'il n'existait pas (R-58). */
async function messageAdministration(req: AuthRequest) {
  const m = await messageAvecFil(Number(req.params.id));
  if (!m.conversation.avecAdministration) throw new HttpError(404, "Message introuvable");
  return m;
}

/** GET /messagerie/messages/:id/piece — pièce jointe d'un message d'un fil avec l'administration. */
messagerieRouter.get(
  "/messages/:id/piece",
  asyncH(async (req: AuthRequest, res) => {
    const m = await messageAdministration(req);
    if (m.pieceFichier) await tracerLectureAdmin(req, res);
    envoyerPiece(res, m);
  })
);

/** GET /messagerie/messages/:id/accuse/pdf — accusé de lecture (métadonnées + empreinte, sans le corps). */
messagerieRouter.get(
  "/messages/:id/accuse/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const m = await messageAdministration(req);
    await envoyerPdf(res, htmlAccuse(m), `Accuse-lecture-${m.id}.pdf`);
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
    await tracerLectureAdmin(req, res); // avant tout marquage « lu » : un 503 ne marque rien
    // Ouvrir le fil vaut première lecture des messages de l'avocat (posé une seule fois) ; fil administration seulement.
    await accuser("luAt", { conversationId: id, conversation: { avecAdministration: true }, ...MESSAGE_DE_AVOCAT });
    await prisma.conversation.update({ where: { id }, data: { adminLastReadAt: new Date() } });
    const avocat = conv.participants[0]?.membre ?? null;
    res.json({
      id: conv.id,
      sujet: conv.sujet,
      expediteur: avocat ? `Me ${avocat.nom}` : "Avocat",
      membreId: avocat?.id ?? null,
      attestationType: conv.attestationType,
      attestationNumero: conv.attestationNumero,
      messages: conv.messages.map((m) => ({
        id: m.id,
        corps: m.corps,
        auteurNom: m.auteurNom,
        estAdministration: m.estAdministration,
        createdAt: m.createdAt,
        empreinte: m.empreinte,
        recuAt: m.recuAt,
        luAt: m.luAt,
        piece: pieceDto(m),
      })),
    });
  })
);

const contacterSchema = z.object({
  membreId: z.number().int().positive(),
  sujet: z.string().trim().min(1).max(160),
  corps: z.string().trim().min(1).max(5000),
  piece: pieceSchema,
});

/** POST /messagerie — « Contacter » depuis la fiche d'un avocat : l'administration ouvre un fil vers ce membre. */
messagerieRouter.post(
  "/",
  asyncH(async (req: AuthRequest, res) => {
    const { membreId, sujet, corps, piece } = contacterSchema.parse(req.body);
    const membre = await prisma.membre.findUnique({ where: { id: membreId }, select: { id: true, statut: true } });
    if (!membre) throw new HttpError(404, "Membre introuvable");
    // Un sorti (radié, décédé, démissionnaire…) n'a plus d'accès à l'espace : le fil ne lui parviendrait jamais.
    if ((STATUTS_SORTIS as readonly string[]).includes(membre.statut)) throw new HttpError(409, "Ce membre n'a plus accès à l'espace avocat.");
    const auteurNom = await monNomAdmin(req);
    const conv = await envoyerMessage(corps, piece, (data) =>
      prisma.conversation.create({
        data: {
          sujet,
          avecAdministration: true,
          adminLastReadAt: new Date(),
          participants: { create: [{ membreId }] },
          messages: { create: { ...data, auteurMembreId: null, auteurNom, estAdministration: true } },
        },
        include: { messages: { select: { id: true } } },
      })
    );
    // Journal d'audit : identifiant seulement, jamais le corps (CA10).
    res.locals.auditDetail = `message #${conv.messages[0]?.id}`;
    notifierAvocat([membreId], conv.id, auteurNom, sujet, corps, "message de l'administration", `L'administration du Barreau (${auteurNom}) vous a adressé un message.`);
    res.status(201).json({ id: conv.id });
  })
);

const repondreSchema = z.object({ corps: z.string().trim().min(1).max(5000), piece: pieceSchema });

/** POST /messagerie/:id — réponse de l'administration dans un fil. */
messagerieRouter.post(
  "/:id",
  asyncH(async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const { corps, piece } = repondreSchema.parse(req.body);
    const conv = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true, sujet: true, avecAdministration: true, participants: { select: { membreId: true } } },
    });
    if (!conv || !conv.avecAdministration) throw new HttpError(404, "Conversation introuvable");
    const auteurNom = await monNomAdmin(req);
    const message = await envoyerMessage(corps, piece, (data) =>
      prisma.message.create({ data: { ...data, conversationId: id, auteurMembreId: null, auteurNom, estAdministration: true } })
    );
    // Journal d'audit : identifiant seulement, jamais le corps (CA10).
    res.locals.auditDetail = `message #${message.id}`;
    await prisma.conversation.update({ where: { id }, data: { updatedAt: new Date(), adminLastReadAt: new Date() } });
    // Symétrie des notifications : on prévient l'avocat de la réponse (non bloquant).
    notifierAvocat(conv.participants.map((p) => p.membreId), id, auteurNom, conv.sujet, corps, "réponse de l'administration", `L'administration du Barreau (${auteurNom}) a répondu à votre message.`);
    res.status(201).json({ id: message.id });
  })
);

/**
 * POST /messagerie/:id/attestation — délivre l'attestation demandée dans le fil :
 * numéro ATT continu, PDF joint comme réponse de l'administration, archive créée.
 * Tout se fait dans UNE transaction : verrou du fil (une seule délivrance, 409 ensuite),
 * numéro ATT, PDF, message, archive. Tout échec (PDF, base) annule l'ensemble, compteur
 * compris : ni PDF envoyé sans numéro, ni second numéro, ni trou dans la numérotation.
 * ponytail: verrous fil + compteur ATT tenus pendant la génération du PDF (~1-2 s) ; générer
 * hors transaction si le volume de délivrances simultanées le justifie.
 */
messagerieRouter.post(
  "/:id/attestation",
  asyncH(async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const conv = await prisma.conversation.findUnique({ where: { id }, include: { participants: { select: { membreId: true } } } });
    if (!conv || !conv.avecAdministration || !conv.attestationType) throw new HttpError(404, "Demande d'attestation introuvable");
    const membre = await prisma.membre.findUnique({ where: { id: conv.participants[0]?.membreId ?? 0 } });
    if (!membre) throw new HttpError(404, "Membre introuvable");
    if ((STATUTS_SORTIS as readonly string[]).includes(membre.statut)) throw new HttpError(409, "Attestation impossible : membre radié, décédé ou sorti du tableau");
    if (conv.attestationType === "INSCRIPTION" && !peutAttesterInscription(membre.statut)) throw new HttpError(409, "Attestation impossible : membre non inscrit au tableau (radié, décédé, sorti ou omis)");
    const annee = new Date().getFullYear();
    const inscription = conv.attestationType === "INSCRIPTION";
    if (!inscription) {
      const [tarifs, cot] = await Promise.all([tarifsActuels(), prisma.cotisation.findUnique({ where: { membreId_annee: { membreId: membre.id, annee } } })]);
      if (cotisationDue(cot, tarifs, membre.qualite) - (cot?.montantPaye ?? 0) > 0) throw new HttpError(409, "Attestation impossible : cotisation de l'exercice non soldée.");
    }
    const auteurNom = await monNomAdmin(req);
    const { numero, corps, message } = await prisma.$transaction(async (tx) => {
      // Verrou de ligne : une délivrance concurrente attend, puis voit le numéro posé → 409.
      const reserve = await tx.conversation.updateMany({ where: { id, attestationNumero: null }, data: { attestationNumero: "EN_COURS" } });
      if (reserve.count === 0) throw new HttpError(409, "Attestation déjà délivrée pour cette demande.");
      const numero = await prochainNumeroAttestation(tx);
      const date = new Date();
      const pdf = await htmlVersPdf(inscription ? attestationHtml(membre, numero, date) : attestationNonRedevanceHtml(membre, numero, annee, date));
      const corps = `Veuillez trouver ci-joint votre attestation ${inscription ? "d'inscription" : "de non-redevance"} n° ${numero}.`;
      // envoyerMessage retire le fichier stocké si l'écriture échoue.
      const message = await envoyerMessage(corps, { nomFichier: `Attestation-${numero}.pdf`, donnees: Buffer.from(pdf).toString("base64") /* puppeteer renvoie un Uint8Array */ }, async (data) => {
        const m = await tx.message.create({ data: { ...data, conversationId: id, auteurMembreId: null, auteurNom, estAdministration: true } });
        await archiver({
          categorie: inscription ? "Attestation d'inscription" : "Attestation de non-redevance",
          titre: `Attestation ${numero} — Me ${membre.nom}`, reference: numero, date, membreNom: membre.nom,
        }, tx);
        await tx.conversation.update({ where: { id }, data: { attestationNumero: numero, updatedAt: new Date(), adminLastReadAt: new Date() } });
        return m;
      });
      return { numero, corps, message };
    }, { timeout: 60000, maxWait: 60000 });
    res.locals.auditDetail = `message #${message.id}`;
    notifierAvocat([membre.id], id, auteurNom, conv.sujet, corps, "réponse de l'administration", `L'administration du Barreau (${auteurNom}) a répondu à votre demande d'attestation.`);
    res.status(201).json({ numero, messageId: message.id });
  })
);
