import nodemailer from "nodemailer";
import { prisma } from "../prisma.js";

interface SmtpConfig { host: string; port: number; secure: boolean; user?: string; pass?: string; from: string; }

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
  } catch { /* base indisponible : repli sur l'environnement */ }
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
    console.log(`[mail:simulation] → ${opts.to} : ${opts.subject}`);
    return { simulation: true };
  }
  const transport = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined });
  await transport.sendMail({ from: cfg.from, ...opts });
  return { simulation: false };
}
