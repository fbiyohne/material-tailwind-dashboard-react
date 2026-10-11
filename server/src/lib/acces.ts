import { identite } from "./identiteDocuments.js";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { HttpError } from "../middleware/error.js";
import { envoyerEmail } from "./notifications.js";
import { revoquerTousLesJetons } from "./tokens.js";

/** Statuts pour lesquels l'accès à l'espace avocat est suspendu (sorties volontaires comprises, D8). */
const STATUTS_BLOQUANTS = ["SUSPENDU", "RADIE", "OMIS", "DECEDE", "DEMISSIONNAIRE", "RETRAITE", "CESSATION"];

/**
 * Synchronise l'activation du compte espace avec le statut du membre : un avocat
 * suspendu / radié / omis perd l'accès (et ses sessions sont coupées) ; il le
 * retrouve automatiquement au retour à un statut régulier. Un compte en attente
 * d'activation voit son lien invalidé si le statut est bloquant.
 */
export async function synchroniserAccesAuStatut(
  membreId: number,
  statut: string,
  db: Pick<typeof prisma, "user" | "refreshToken"> = prisma // client de transaction : accès écrit avec la transition (R1-11)
): Promise<void> {
  const user = await db.user.findUnique({ where: { membreId }, select: { id: true, actif: true, activationToken: true } });
  if (!user) return;
  const doitEtreActif = !STATUTS_BLOQUANTS.includes(statut);
  // Compte en attente d'activation : un statut bloquant invalide le lien (sinon /auth/activer le contournerait).
  if (user.activationToken) {
    if (!doitEtreActif) await db.user.update({ where: { id: user.id }, data: { activationToken: null, activationExpire: null, actif: false } });
    return;
  }
  if (user.actif === doitEtreActif) return;
  await db.user.update({ where: { id: user.id }, data: { actif: doitEtreActif } });
  if (!doitEtreActif) await revoquerTousLesJetons(user.id, db);
}

export interface AccesProvisionne {
  email: string;
  lien: string;
  renvoi: boolean;
}

/**
 * Provisionne (ou régénère) l'accès à l'espace avocat d'un membre : compte de
 * rôle AVOCAT inactif rattaché à la fiche, avec un lien d'activation à durée
 * limitée envoyé par email. Le secrétariat ne connaît jamais le mot de passe
 * (choisi par l'avocat à l'activation). Mutualisé entre la fiche membre et
 * l'approbation d'une demande d'accès.
 */
export async function provisionnerAccesEspace(membreId: number): Promise<AccesProvisionne> {
  const membre = await prisma.membre.findUnique({ where: { id: membreId } });
  if (!membre) throw new HttpError(404, "Avocat introuvable");
  if (STATUTS_BLOQUANTS.includes(membre.statut)) throw new HttpError(409, "Accès impossible : membre radié, omis, suspendu ou décédé");
  if (!membre.email) throw new HttpError(400, "Renseignez d'abord l'email de l'avocat sur sa fiche");

  const existant = await prisma.user.findUnique({ where: { membreId } });
  if (existant?.actif) throw new HttpError(409, "Un accès actif existe déjà pour cet avocat");
  // L'email doit être libre (ou déjà celui de ce compte avocat en attente).
  const homonyme = await prisma.user.findUnique({ where: { email: membre.email } });
  if (homonyme && homonyme.membreId !== membreId) {
    throw new HttpError(409, "Cet email est déjà utilisé par un autre compte");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const activationExpire = new Date(Date.now() + 7 * 86_400_000); // 7 jours
  if (existant) {
    await prisma.user.update({ where: { id: existant.id }, data: { activationToken: token, activationExpire } });
  } else {
    await prisma.user.create({
      data: {
        nom: `Me ${membre.nom}`,
        email: membre.email,
        role: "AVOCAT",
        membreId,
        actif: false,
        activationToken: token,
        activationExpire,
        passwordHash: bcrypt.hashSync(crypto.randomBytes(24).toString("hex"), 10), // inutilisable avant activation
      },
    });
  }

  const lien = `${env.clientOrigin}/activer/${token}`;
  void envoyerEmail({
    to: membre.email,
    subject: `Activez votre espace avocat · ${identite().denomination}`,
    text: `Maître ${membre.nom},\n\nLe Secrétariat Général vous ouvre l'accès à votre espace personnel.\nPour définir votre mot de passe et activer votre compte, ouvrez le lien suivant (valable 7 jours) :\n${lien}\n\nLe Secrétariat Général du ${identite().denomination}.`,
    evenement: "ACCES_AVOCAT",
  });
  return { email: membre.email, lien, renvoi: !!existant };
}
