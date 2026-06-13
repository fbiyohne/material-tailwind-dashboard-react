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
