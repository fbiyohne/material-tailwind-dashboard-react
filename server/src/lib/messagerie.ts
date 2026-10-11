import type { Prisma, Message } from "@prisma/client";
import type { Response } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";
import { enregistrerFichier, lireFichier, supprimerFichier, typeReel, type TypePiece } from "./storage.js";
import { accuseReceptionHtml } from "./templates.js";

/**
 * Lecture / décompte des messages non lus, mutualisé entre l'espace avocat et
 * le back-office. Une seule définition du « non écrit par moi » : on évite ainsi
 * la régression NULL (la négation SQL « <> moi » exclut à tort auteurMembreId
 * NULL, c.-à-d. les messages de l'administration).
 */

/** Borne basse (fabrique) quand un fil n'a jamais été ouvert — évite une Date partagée mutable. */
export const jamaisLu = () => new Date(0);

/** Message « non écrit par l'avocat `moi` » — inclut l'administration (auteurMembreId NULL). */
export function messageNonDeMoi(moi: number): Prisma.MessageWhereInput {
  return { OR: [{ auteurMembreId: null }, { auteurMembreId: { not: moi } }] };
}

/** Message émis par un avocat (vu côté administration). */
export const MESSAGE_DE_AVOCAT: Prisma.MessageWhereInput = { estAdministration: false };

/** Seuil de lecture d'un fil : messages postérieurs = non lus. */
export interface SeuilLecture {
  conversationId: number;
  depuis: Date;
}

/** Where combinant « expéditeur » et les seuils de lecture par fil (une seule requête). */
function whereNonLus(expediteur: Prisma.MessageWhereInput, seuils: SeuilLecture[]): Prisma.MessageWhereInput {
  return {
    AND: [
      expediteur,
      { OR: seuils.map((s) => ({ conversationId: s.conversationId, createdAt: { gt: s.depuis } })) },
    ],
  };
}

/**
 * Décompte des non-lus par conversation, en UNE seule requête (au lieu d'un
 * count par fil). Renvoie une Map conversationId → nombre de messages non lus.
 */
export async function compterNonLusParFil(expediteur: Prisma.MessageWhereInput, seuils: SeuilLecture[]): Promise<Map<number, number>> {
  const compte = new Map<number, number>();
  if (seuils.length === 0) return compte;
  const groupes = await prisma.message.groupBy({
    by: ["conversationId"],
    where: whereNonLus(expediteur, seuils),
    _count: { _all: true },
  });
  for (const g of groupes) compte.set(g.conversationId, g._count._all);
  return compte;
}

/** Total des non-lus sur l'ensemble des fils, en UNE seule requête. */
export async function totalNonLus(expediteur: Prisma.MessageWhereInput, seuils: SeuilLecture[]): Promise<number> {
  if (seuils.length === 0) return 0;
  return prisma.message.count({ where: whereNonLus(expediteur, seuils) });
}

// ── Pièce jointe, empreinte, accusés (T13) ──────────────────────────────────

/** Une pièce par message, 5 Mo au plus (la limite JSON globale de 8 Mo reste suffisante en base64). */
export const PIECE_MAX = 5 * 1024 * 1024;
/** Pièce jointe telle que reçue du client : nom + base64 sans préfixe data:. Le type n'est jamais déclaré, il est lu dans les octets. */
export const pieceSchema = z.object({ nomFichier: z.string().trim().min(1).max(200), donnees: z.string().min(1) }).optional();
type PieceEntree = z.infer<typeof pieceSchema>;

const EXTENSION: Record<TypePiece, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};
/** Formats affichables dans le navigateur ; le DOCX est toujours téléchargé. */
const INLINE = new Set<string>(["application/pdf", "image/jpeg", "image/png"]);

/** Colonnes du modèle Message alimentées à l'envoi. */
export interface DonneesMessage {
  corps: string;
  empreinte: string;
  pieceNom?: string;
  pieceFichier?: string;
  pieceMime?: string;
  pieceTaille?: number;
}

/**
 * Décode et contrôle une pièce AVANT toute écriture : taille estimée puis réelle
 * (413), type réel par les octets de signature (400 — un exécutable renommé en
 * .pdf est refusé). Le nom est assaini (pas de guillemet, de retour à la ligne
 * ni de séparateur de chemin). Renvoie le tampon, sans rien enregistrer.
 */
function decoderPiece(piece: NonNullable<PieceEntree>): { buffer: Buffer; nom: string; mime: TypePiece } {
  if (Math.floor((piece.donnees.length * 3) / 4) > PIECE_MAX) throw new HttpError(413, "Pièce trop volumineuse (5 Mo au plus).");
  const buffer = Buffer.from(piece.donnees, "base64");
  if (buffer.length === 0 || buffer.length > PIECE_MAX) throw new HttpError(413, "Pièce trop volumineuse (5 Mo au plus).");
  const mime = typeReel(buffer);
  if (!mime) throw new HttpError(400, "Format de pièce refusé : PDF, DOCX, JPG ou PNG uniquement (contenu vérifié).");
  const nom = piece.nomFichier.replace(/[\x00-\x1f"\\/]/g, "").trim() || `piece${EXTENSION[mime]}`;
  return { buffer, nom, mime };
}

/** SHA-256 hexadécimal du corps (UTF-8) suivi des octets de la pièce éventuelle. */
export function empreinteMessage(corps: string, piece?: Buffer): string {
  const h = createHash("sha256").update(corps, "utf8");
  if (piece) h.update(piece);
  return h.digest("hex");
}

/**
 * Enregistre un message (et sa pièce) : la pièce est contrôlée puis stockée sous
 * `messagerie/`, l'empreinte calculée, puis `creer` écrit en base. Si l'écriture
 * échoue, le fichier est retiré : pas de pièce orpheline. Un seul point d'entrée
 * pour les quatre routes d'envoi (espace et administration).
 */
export async function envoyerMessage<T>(corps: string, piece: PieceEntree, creer: (data: DonneesMessage) => Promise<T>): Promise<T> {
  if (!piece) return creer({ corps, empreinte: empreinteMessage(corps) });
  const { buffer, nom, mime } = decoderPiece(piece);
  const { chemin, taille } = enregistrerFichier("messagerie", piece.donnees, EXTENSION[mime]);
  try {
    return await creer({ corps, empreinte: empreinteMessage(corps, buffer), pieceNom: nom, pieceFichier: chemin, pieceMime: mime, pieceTaille: taille });
  } catch (err) {
    supprimerFichier(chemin);
    throw err;
  }
}

/**
 * Pose l'accusé « reçu » ou « lu » UNE seule fois (colonne encore NULL) sur les
 * messages reçus qui correspondent à `where` (le filtre « non écrit par moi »
 * est à la charge de l'appelant). Ouvrir un fil vaut aussi réception.
 */
export async function accuser(champ: "recuAt" | "luAt", where: Prisma.MessageWhereInput): Promise<void> {
  const maintenant = new Date();
  await prisma.message.updateMany({ where: { ...where, recuAt: null }, data: { recuAt: maintenant } });
  if (champ === "luAt") await prisma.message.updateMany({ where: { ...where, luAt: null }, data: { luAt: maintenant } });
}

/** Message avec son fil et ses participants, ou 404. */
export async function messageAvecFil(id: number) {
  const m = Number.isInteger(id) && id > 0
    ? await prisma.message.findUnique({ where: { id }, include: { conversation: { include: { participants: { include: { membre: { select: { id: true, nom: true } } } } } } } })
    : null;
  if (!m) throw new HttpError(404, "Message introuvable");
  return m;
}
type MessageAvecFil = Awaited<ReturnType<typeof messageAvecFil>>;

/** Représentation API de la pièce d'un message (jamais le chemin de stockage). */
export const pieceDto = (m: Pick<Message, "pieceNom" | "pieceMime" | "pieceTaille" | "pieceFichier">) =>
  m.pieceFichier ? { nom: m.pieceNom, mime: m.pieceMime, taille: m.pieceTaille } : null;

/** Envoie la pièce d'un message : nosniff, inline pour PDF/images, téléchargement sinon. L'appelant a déjà vérifié la participation. */
export function envoyerPiece(res: Response, m: Message): void {
  if (!m.pieceFichier) throw new HttpError(404, "Ce message n'a pas de pièce jointe.");
  const sur = INLINE.has(m.pieceMime ?? "");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", sur ? m.pieceMime! : "application/octet-stream");
  // filename ASCII de repli + filename* UTF-8 (RFC 6266) : un caractère hors Latin-1 dans un en-tête fait lever Node (500).
  const nom = (m.pieceNom ?? "piece").replace(/[\r\n"]/g, "");
  res.setHeader("Content-Disposition", `${sur ? "inline" : "attachment"}; filename="${nom.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nom)}`);
  res.end(lireFichier(m.pieceFichier));
}

/** HTML de l'accusé de lecture d'un message : métadonnées et empreinte, jamais le corps. */
export function htmlAccuse(m: MessageAvecFil): string {
  const conv = m.conversation;
  const nomDe = (id: number | null | undefined) => {
    const p = conv.participants.find((x) => x.membreId === id)?.membre;
    return p ? `Me ${p.nom}` : "Confrère";
  };
  const destinataire = conv.avecAdministration
    ? m.estAdministration ? nomDe(conv.participants[0]?.membreId) : "Administration du Barreau"
    : nomDe(conv.participants.find((p) => p.membreId !== m.auteurMembreId)?.membreId);
  return accuseReceptionHtml({
    messageId: m.id, sujet: conv.sujet, auteurNom: m.auteurNom, destinataire,
    envoyeLe: m.createdAt, recuLe: m.recuAt, luLe: m.luAt, empreinte: m.empreinte,
    pieceNom: m.pieceNom, pieceTaille: m.pieceTaille,
  });
}
