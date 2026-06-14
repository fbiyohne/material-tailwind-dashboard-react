import { prisma } from "../prisma.js";
import { logger } from "./logger.js";
import { envoyerMail, modeSimulation as emailSimule } from "./mail.js";

/**
 * Couche de notifications (NotificationProvider) — abstrait l'email et le SMS
 * derrière une interface unique, journalise chaque envoi, et fonctionne en
 * simulation tant que les identifiants ne sont pas configurés.
 *
 * Email   : voir lib/mail (SMTP_* ; simulation si SMTP_HOST absent).
 * SMS     : adaptateur HTTP générique (SMS_API_URL + SMS_API_KEY) ; à adapter
 *           au fournisseur réel (MTN/Airtel/agrégateur). Simulation sinon.
 */
const smsConfigure = Boolean(process.env.SMS_API_URL && process.env.SMS_API_KEY);

export const modeSimulationEmail = emailSimule;
export const modeSimulationSms = !smsConfigure;

type Canal = "EMAIL" | "SMS";

async function journaliser(canal: Canal, destinataire: string, sujet: string, evenement: string, statut: "ENVOYE" | "ECHEC", simulation: boolean) {
  try {
    await prisma.journalNotification.create({ data: { canal, destinataire, sujet: sujet.slice(0, 180), evenement, statut, simulation } });
  } catch (err) {
    logger.warn({ err }, "Journalisation de notification impossible");
  }
}

/** Envoie un email (via SMTP réel ou simulation) et journalise l'envoi. */
export async function envoyerEmail(opts: { to: string; subject: string; text: string; evenement: string }): Promise<{ statut: "ENVOYE" | "ECHEC"; simulation: boolean }> {
  let statut: "ENVOYE" | "ECHEC" = "ENVOYE";
  try {
    await envoyerMail({ to: opts.to, subject: opts.subject, text: opts.text });
  } catch (err) {
    statut = "ECHEC";
    logger.warn({ err, to: opts.to }, "Échec d'envoi d'email");
  }
  await journaliser("EMAIL", opts.to, opts.subject, opts.evenement, statut, modeSimulationEmail);
  return { statut, simulation: modeSimulationEmail };
}

/** Adaptateur SMS réel (HTTP générique). À adapter selon le fournisseur. */
async function envoyerSmsReel(to: string, message: string): Promise<void> {
  const res = await fetch(process.env.SMS_API_URL as string, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SMS_API_KEY}` },
    body: JSON.stringify({ to, from: process.env.SMS_SENDER || "Barreau-PN", message }),
  });
  if (!res.ok) throw new Error(`Passerelle SMS : ${res.status}`);
}

/** Envoie un SMS (via passerelle réelle ou simulation) et journalise l'envoi. */
export async function envoyerSms(opts: { to: string; message: string; evenement: string }): Promise<{ statut: "ENVOYE" | "ECHEC"; simulation: boolean }> {
  let statut: "ENVOYE" | "ECHEC" = "ENVOYE";
  if (smsConfigure) {
    try {
      await envoyerSmsReel(opts.to, opts.message);
    } catch (err) {
      statut = "ECHEC";
      logger.warn({ err, to: opts.to }, "Échec d'envoi de SMS");
    }
  } else {
    logger.info({ to: opts.to }, `[sms:simulation] ${opts.message.slice(0, 80)}`);
  }
  await journaliser("SMS", opts.to, opts.message, opts.evenement, statut, modeSimulationSms);
  return { statut, simulation: modeSimulationSms };
}
