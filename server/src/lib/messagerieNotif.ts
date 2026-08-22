import { prisma } from "../prisma.js";
import { envoyerEmail } from "./notifications.js";

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

interface OptionsNotif {
  titre: string;
  intro: string;
  cta: string;
  auteurNom: string;
  sujet: string;
  corps: string;
}

/**
 * Envoie une notification e-mail pour un nouveau message. Best-effort et
 * NON bloquant : la résolution des destinataires et l'envoi SMTP s'exécutent en
 * tâche de fond (`void`), sans retarder la réponse HTTP. Toute erreur est avalée
 * (l'échec d'une notification ne doit jamais faire échouer l'envoi du message).
 */
export function notifierNouveauMessage(resoudreDestinataires: () => Promise<string[]>, opts: OptionsNotif): void {
  void (async () => {
    try {
      const to = (await resoudreDestinataires()).join(", ");
      if (!to) return;
      await envoyerEmail({
        to,
        subject: `Messagerie — ${opts.titre}`,
        text: `${opts.intro}\n\nObjet : ${opts.sujet}\n\n« ${opts.corps} »\n\n${opts.cta}`,
        evenement: "MESSAGE",
      });
    } catch {
      /* notification best-effort */
    }
  })();
}
