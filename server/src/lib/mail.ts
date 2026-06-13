import nodemailer from "nodemailer";

/**
 * Service d'envoi d'emails (relances, convocations…). Utilise un SMTP réel si
 * configuré (SMTP_HOST…), sinon un transport de simulation qui journalise le
 * message — utile en développement.
 */
const smtpConfigure = Boolean(process.env.SMTP_HOST);

const transport = smtpConfigure
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

export const modeSimulation = !smtpConfigure;

export async function envoyerMail(opts: { to: string; subject: string; text: string }) {
  const info = await transport.sendMail({
    from: process.env.MAIL_FROM || "secretariat@barreau-pn.cg",
    ...opts,
  });
  if (modeSimulation) console.log(`[mail:simulation] → ${opts.to} : ${opts.subject}`);
  return info;
}
