import nodemailer from "nodemailer";
import { prisma } from "../prisma.js";
import { logger } from "./logger.js";

export interface SmtpConfig { host: string; port: number; secure: boolean; user?: string; pass?: string; from: string; }

/** Construit un transport nodemailer à partir d'une config SMTP (auth optionnelle). */
export function creerTransport(cfg: Pick<SmtpConfig, "host" | "port" | "secure" | "user" | "pass">) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
  });
}

/**
 * Config SMTP effective : la base (Parametres.smtp, posée par l'assistant
 * d'installation) prime sur les variables d'environnement. null → simulation.
 */
export async function chargerSmtp(): Promise<SmtpConfig | null> {
  try {
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    const s = (row?.data as { smtp?: Partial<SmtpConfig> } | undefined)?.smtp;
    if (s?.host) {
      return { host: s.host, port: Number(s.port) || 587, secure: !!s.secure, user: s.user || undefined, pass: s.pass || undefined, from: s.from || "secretariat@barreau-pn.cg" };
    }
  } catch (err) {
    // Base indisponible (ex. bootstrap avant migration) : on se rabat sur
    // l'environnement. On journalise tout de même : sinon une panne transitoire
    // de la base ferait silencieusement basculer les envois en simulation.
    logger.warn({ err }, "Lecture de la config SMTP en base impossible — repli sur l'environnement");
  }
  if (process.env.SMTP_HOST) {
    return { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587, secure: process.env.SMTP_SECURE === "true", user: process.env.SMTP_USER || undefined, pass: process.env.SMTP_PASS || undefined, from: process.env.MAIL_FROM || "secretariat@barreau-pn.cg" };
  }
  return null;
}

export async function emailEnSimulation(): Promise<boolean> {
  return (await chargerSmtp()) === null;
}

export async function envoyerMail(opts: { to: string; subject: string; text: string }): Promise<{ simulation: boolean }> {
  const cfg = await chargerSmtp();
  if (!cfg) {
    logger.info(`[mail:simulation] → ${opts.to} : ${opts.subject}`);
    return { simulation: true };
  }
  await creerTransport(cfg).sendMail({ from: cfg.from, ...opts });
  return { simulation: false };
}
