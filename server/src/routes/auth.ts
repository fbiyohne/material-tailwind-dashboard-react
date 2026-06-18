import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import crypto from "node:crypto";
import { env } from "../env.js";
import { emettrePaire, rafraichir, revoquer, revoquerTousLesJetons } from "../lib/tokens.js";
import { envoyerEmail } from "../lib/notifications.js";

export const authRouter = Router();

// Anti-brute-force sur la connexion (10 tentatives / 15 min / IP). Désactivé en
// test (NODE_ENV=test) où la suite enchaîne de nombreuses connexions légitimes.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { erreur: "Trop de tentatives, réessayez plus tard." }, skip: () => process.env.NODE_ENV === "test" });

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post(
  "/login",
  loginLimiter,
  asyncH(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    // Connexion insensible à la casse (gère les comptes existants stockés en casse
    // mixte sans migration ; les nouveaux comptes sont normalisés en minuscules).
    const user = await prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: "insensitive" } } });
    if (!user || !user.actif || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, "Identifiants invalides");
    }
    res.json(await emettrePaire(user));
  })
);

// Anti-spam sur les demandes d'accès publiques (5 demandes / heure / IP).
const demandeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { erreur: "Trop de demandes envoyées, réessayez plus tard." } });

const vide = (s?: string) => (s && s.trim() ? s.trim() : undefined);
const demandeSchema = z.object({
  nom: z.string().min(2, "Nom requis").max(120),
  email: z.string().email("Email invalide"),
  numInscription: z.string().max(40).optional(),
  cabinet: z.string().max(160).optional(),
  motif: z.string().min(10, "Motif trop court").max(2000),
});

/**
 * POST /auth/demande-acces — demande d'accès publique (page « Demander un accès »).
 * Ne crée aucun compte : la demande est enregistrée EN_ATTENTE pour validation
 * par le SG/Admin (cloisonnement RBAC). Réponse volontairement minimale.
 */
authRouter.post(
  "/demande-acces",
  demandeLimiter,
  asyncH(async (req, res) => {
    const data = demandeSchema.parse(req.body);
    const email = data.email.trim().toLowerCase();
    await prisma.demandeAcces.create({
      data: { nom: data.nom.trim(), email, motif: data.motif.trim(), numInscription: vide(data.numInscription), cabinet: vide(data.cabinet) },
    });
    // Accusé de réception (n'échoue jamais la demande si l'envoi échoue).
    void envoyerEmail({
      to: email,
      subject: "Demande d'accès reçue · Barreau de Pointe-Noire",
      text: `Bonjour ${data.nom.trim()},\n\nNous accusons réception de votre demande d'accès à l'application du Secrétariat Général du Barreau de Pointe-Noire.\nElle sera examinée par le Secrétariat Général ; vous serez recontacté(e) à cette adresse.\n\nLe Secrétariat Général du Barreau de Pointe-Noire.`,
      evenement: "DEMANDE_ACCUSE",
    });
    res.status(201).json({ ok: true });
  })
);

/**
 * GET /auth/activation/:token — vérifie un lien d'activation d'espace avocat et
 * renvoie un minimum d'informations (nom/email) pour la page de définition du
 * mot de passe. Public : le token (aléatoire, à durée limitée) fait foi.
 */
authRouter.get(
  "/activation/:token",
  asyncH(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { activationToken: req.params.token } });
    if (!user || !user.activationExpire || user.activationExpire < new Date()) {
      throw new HttpError(404, "Lien d'activation invalide ou expiré");
    }
    res.json({ nom: user.nom, email: user.email });
  })
);

const activerSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });

/**
 * POST /auth/activer — l'avocat définit son mot de passe et active son compte.
 * Consomme le token (usage unique) et rend le compte actif.
 */
authRouter.post(
  "/activer",
  asyncH(async (req, res) => {
    const { token, password } = activerSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { activationToken: token } });
    if (!user || !user.activationExpire || user.activationExpire < new Date()) {
      throw new HttpError(404, "Lien d'activation invalide ou expiré");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: bcrypt.hashSync(password, 10), actif: true, activationToken: null, activationExpire: null },
    });
    res.json({ ok: true, email: user.email });
  })
);

// Anti-abus sur la réinitialisation (5 demandes / heure / IP).
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { erreur: "Trop de demandes envoyées, réessayez plus tard." }, skip: () => process.env.NODE_ENV === "test" });

const forgotSchema = z.object({ email: z.string().email() });

/**
 * POST /auth/forgot-password — déclenche une réinitialisation : envoie un lien
 * à durée limitée si un compte actif correspond. Réponse toujours neutre (pas de
 * divulgation de l'existence d'un compte).
 */
authRouter.post(
  "/forgot-password",
  resetLimiter,
  asyncH(async (req, res) => {
    const { email } = forgotSchema.parse(req.body);
    // Recherche insensible à la casse (cohérence avec la connexion).
    const user = await prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: "insensitive" } } });
    if (user && user.actif) {
      const token = crypto.randomBytes(32).toString("hex");
      const resetExpire = new Date(Date.now() + 3_600_000); // 1 heure
      await prisma.user.update({ where: { id: user.id }, data: { resetToken: token, resetExpire } });
      const lien = `${env.clientOrigin}/reinitialiser/${token}`;
      void envoyerEmail({
        to: user.email,
        subject: "Réinitialisation de votre mot de passe · Barreau de Pointe-Noire",
        text: `Bonjour ${user.nom},\n\nVous avez demandé à réinitialiser votre mot de passe. Ouvrez le lien suivant (valable 1 heure) pour en définir un nouveau :\n${lien}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\nLe Secrétariat Général du Barreau de Pointe-Noire.`,
        evenement: "RESET_MDP",
      });
    }
    res.json({ ok: true });
  })
);

/** GET /auth/reset/:token — vérifie un lien de réinitialisation (page de saisie). */
authRouter.get(
  "/reset/:token",
  asyncH(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { resetToken: req.params.token } });
    if (!user || !user.resetExpire || user.resetExpire < new Date()) {
      throw new HttpError(404, "Lien de réinitialisation invalide ou expiré");
    }
    res.json({ email: user.email });
  })
);

const resetSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });

/**
 * POST /auth/reset — définit un nouveau mot de passe via le token. Consomme le
 * token (usage unique) et révoque toutes les sessions existantes.
 */
authRouter.post(
  "/reset",
  asyncH(async (req, res) => {
    const { token, password } = resetSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { resetToken: token } });
    if (!user || !user.resetExpire || user.resetExpire < new Date()) {
      throw new HttpError(404, "Lien de réinitialisation invalide ou expiré");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: bcrypt.hashSync(password, 10), resetToken: null, resetExpire: null },
    });
    await revoquerTousLesJetons(user.id);
    res.json({ ok: true });
  })
);

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

authRouter.post(
  "/refresh",
  asyncH(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const paire = await rafraichir(refreshToken);
    if (!paire) throw new HttpError(401, "Jeton de rafraîchissement invalide");
    res.json(paire);
  })
);

authRouter.post(
  "/logout",
  asyncH(async (req, res) => {
    if (req.body?.refreshToken) await revoquer(req.body.refreshToken);
    res.status(204).end();
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncH(async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new HttpError(404, "Utilisateur introuvable");
    res.json({ id: user.id, nom: user.nom, email: user.email, role: user.role });
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/** POST /auth/password — changement de mot de passe en libre-service (compte courant). */
authRouter.post(
  "/password",
  requireAuth,
  asyncH(async (req: AuthRequest, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new HttpError(400, "Mot de passe actuel incorrect");
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: bcrypt.hashSync(newPassword, 10) } });
    res.json({ ok: true });
  })
);
