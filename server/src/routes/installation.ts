import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { wizardActif } from "../lib/installation.js";

export const installationRouter = Router();

/** GET /installation/etat — l'assistant doit-il s'afficher ? (VPS uniquement). */
installationRouter.get("/etat", asyncH(async (_req, res) => {
  res.json({ actif: await wizardActif() });
}));

const smtpSchema = z.object({
  host: z.string().trim().min(1),
  port: z.coerce.number().int().positive(),
  user: z.string().optional().default(""),
  pass: z.string().optional().default(""),
  from: z.string().trim().min(1),
  secure: z.boolean().optional().default(false),
});

const installSchema = z.object({
  admin: z.object({ nom: z.string().trim().min(1), email: z.string().email(), motDePasse: z.string().min(8) }),
  identite: z.object({
    denomination: z.string().trim().min(1), ordre: z.string().trim().min(1),
    batonnier: z.string().trim().min(1), tresoriere: z.string().trim().min(1),
    secretaireGeneral: z.string().trim().min(1), adresse: z.string().trim().min(1),
  }),
  tarifs: z.object({ avocat: z.number().int().nonnegative(), stagiaire: z.number().int().nonnegative(), droitsPlaidoirie: z.number().int().nonnegative() }),
  exerciceCourant: z.number().int(),
  premierExercice: z.number().int(),
  smtp: smtpSchema.nullable().optional(),
});

/** POST /installation — crée le 1er admin + écrit la config (transaction). */
installationRouter.post("/", asyncH(async (req, res) => {
  if (!(await wizardActif())) throw new HttpError(409, "Application déjà installée.");
  const d = installSchema.parse(req.body);
  await prisma.$transaction(async (tx) => {
    await tx.user.create({ data: { nom: d.admin.nom, email: d.admin.email.toLowerCase(), role: "ADMIN", passwordHash: bcrypt.hashSync(d.admin.motDePasse, 10) } });
    const row = await tx.parametres.findUnique({ where: { id: 1 } });
    const base = (row?.data as object) ?? {};
    const data = {
      ...base,
      identite: d.identite,
      tarifs: d.tarifs,
      exerciceCourant: d.exerciceCourant,
      exercices: { premier: d.premierExercice },
      ...(d.smtp ? { smtp: d.smtp } : {}),
      installe: true,
    };
    await tx.parametres.upsert({ where: { id: 1 }, create: { id: 1, data }, update: { data } });
  });
  res.status(201).json({ ok: true });
}));

/** POST /installation/test-email — test d'envoi avec le SMTP saisi (non persisté). */
installationRouter.post("/test-email", asyncH(async (req, res) => {
  if (!(await wizardActif())) throw new HttpError(409, "Application déjà installée.");
  const s = smtpSchema.extend({ to: z.string().email() }).parse(req.body);
  const transport = nodemailer.createTransport({ host: s.host, port: s.port, secure: s.secure, auth: s.user ? { user: s.user, pass: s.pass } : undefined });
  await transport.sendMail({ from: s.from, to: s.to, subject: "Test — Barreau de Pointe-Noire", text: "Votre configuration SMTP fonctionne." });
  res.json({ ok: true });
}));
