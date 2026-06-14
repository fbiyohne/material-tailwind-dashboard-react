import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { emettrePaire, rafraichir, revoquer } from "../lib/tokens.js";

export const authRouter = Router();

// Anti-brute-force sur la connexion (10 tentatives / 15 min / IP).
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { erreur: "Trop de tentatives, réessayez plus tard." } });

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post(
  "/login",
  loginLimiter,
  asyncH(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
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
    await prisma.demandeAcces.create({
      data: { nom: data.nom.trim(), email: data.email.trim().toLowerCase(), motif: data.motif.trim(), numInscription: vide(data.numInscription), cabinet: vide(data.cabinet) },
    });
    res.status(201).json({ ok: true });
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
