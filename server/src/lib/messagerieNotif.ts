import { prisma } from "../prisma.js";
import { envoyerEmail, envoyerSms } from "./notifications.js";
import { configMessagerie } from "./messagerie.js";

/**
 * Notifications de messagerie interne. Mutualise la résolution des
 * destinataires et l'envoi, partagé par l'espace avocat et le back-office.
 */

/** Emails des officiers de l'administration (SG / Bâtonnier / Trésorière) actifs. */
export async function emailsAdministration(): Promise<string[]> {
  const officiers = await prisma.user.findMany({
    where: { actif: true, role: { in: ["SECRETAIRE_GENERAL", "BATONNIER", "TRESORIERE"] } },
    select: { email: true },
  });
  return officiers.map((o) => o.email).filter((e): e is string => Boolean(e));
}

/** Emails (renseignés) des membres donnés. */
export async function emailsMembres(membreIds: number[]): Promise<string[]> {
  if (membreIds.length === 0) return [];
  const membres = await prisma.membre.findMany({
    where: { id: { in: membreIds }, NOT: { email: null } },
    select: { email: true },
  });
  return membres.map((m) => m.email).filter((e): e is string => Boolean(e));
}

/** Clause CL-NOTIF-EXTERNE : seul texte relayé hors de l'espace (secret professionnel, loi 026-92 art. 52). */
export const CL_NOTIF_EXTERNE = "Ordre des avocats : vous avez un nouveau message ou document sur votre espace. Connectez-vous pour le consulter.";

/** Téléphones (renseignés) des membres donnés. */
export async function telephonesMembres(membreIds: number[]): Promise<string[]> {
  if (membreIds.length === 0) return [];
  const membres = await prisma.membre.findMany({ where: { id: { in: membreIds }, NOT: { tel: null } }, select: { tel: true } });
  return membres.map((m) => m.tel).filter((t): t is string => Boolean(t));
}

/**
 * Relais externe d'un nouveau message. Contenu NEUTRE : uniquement la clause
 * CL-NOTIF-EXTERNE, jamais l'auteur, l'objet, le corps ni une pièce. E-mail et
 * SMS sont activables dans Paramètres > Messagerie (relaisEmail, relaisSms) ;
 * le SMS reste en simulation (aucun envoi réel). Best-effort : l'appelant ne
 * l'attend pas (pas de await), et toute erreur est avalée.
 */
export async function notifierNouveauMessage(resoudreEmails: () => Promise<string[]>, resoudreTels?: () => Promise<string[]>): Promise<void> {
  try {
    const cfg = await configMessagerie();
    if (cfg.relaisEmail) {
      const to = (await resoudreEmails()).join(", ");
      if (to) await envoyerEmail({ to, subject: "Messagerie — nouveau message", text: CL_NOTIF_EXTERNE, evenement: "MESSAGE" });
    }
    if (cfg.relaisSms && resoudreTels) {
      for (const to of await resoudreTels()) await envoyerSms({ to, message: CL_NOTIF_EXTERNE, evenement: "MESSAGE", simulation: true });
    }
  } catch {
    /* notification best-effort */
  }
}
