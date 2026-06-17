import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { HttpError } from "../middleware/error.js";
import { envoyerEmail } from "./notifications.js";
import { revoquerTousLesJetons } from "./tokens.js";

/** Statuts pour lesquels l'accès à l'espace avocat est suspendu. */
const STATUTS_BLOQUANTS = ["SUSPENDU", "RADIE", "OMIS"];

/**
 * Synchronise l'activation du compte espace avec le statut du membre : un avocat
 * suspendu / radié / omis perd l'accès (et ses sessions sont coupées) ; il le
 * retrouve automatiquement au retour à un statut régulier. Les comptes encore en
 * attente d'activation ne sont pas touchés (le flux d'activation s'en charge).
 */
export async function synchroniserAccesAuStatut(membreId: number, statut: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { membreId }, select: { id: true, actif: true, activationToken: true } });
  if (!user || user.activationToken) return;
  const doitEtreActif = !STATUTS_BLOQUANTS.includes(statut);
  if (user.actif === doitEtreActif) return;
  await prisma.user.update({ where: { id: user.id }, data: { actif: doitEtreActif } });
  if (!doitEtreActif) await revoquerTousLesJetons(user.id);
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
    subject: "Activez votre espace avocat · Barreau de Pointe-Noire",
    text: `Maître ${membre.nom},\n\nLe Secrétariat Général vous ouvre l'accès à votre espace personnel.\nPour définir votre mot de passe et activer votre compte, ouvrez le lien suivant (valable 7 jours) :\n${lien}\n\nLe Secrétariat Général du Barreau de Pointe-Noire.`,
    evenement: "ACCES_AVOCAT",
  });
  return { email: membre.email, lien, renvoi: !!existant };
}
