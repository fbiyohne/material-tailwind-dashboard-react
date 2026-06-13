import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post(
  "/login",
  asyncH(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.actif || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, "Identifiants invalides");
    }
    const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: "8h" });
    res.json({ token, user: { id: user.id, nom: user.nom, email: user.email, role: user.role } });
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
