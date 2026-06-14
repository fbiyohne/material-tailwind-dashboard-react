import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";

/**
 * Gestion des comptes utilisateurs (CDC §5.1, table `users`).
 * Réservé au Secrétaire Général et à l'Administrateur. Les secrets
 * (passwordHash) ne sont jamais renvoyés.
 */
export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "ADMIN"));

const SELECT = { id: true, nom: true, email: true, role: true, actif: true, createdAt: true } as const;
const ROLES = ["SECRETAIRE_GENERAL", "BATONNIER", "TRESORIERE", "ADMIN"] as const;

usersRouter.get(
  "/",
  asyncH(async (_req, res) => {
    res.json(await prisma.user.findMany({ select: SELECT, orderBy: { id: "asc" } }));
  })
);

const creerSchema = z.object({
  nom: z.string().min(1),
  email: z.string().email(),
  role: z.enum(ROLES),
  password: z.string().min(6),
});

usersRouter.post(
  "/",
  asyncH(async (req, res) => {
    const data = creerSchema.parse(req.body);
    const existe = await prisma.user.findUnique({ where: { email: data.email } });
    if (existe) throw new HttpError(409, "Un compte existe déjà avec cet email");
    const user = await prisma.user.create({
      data: { nom: data.nom, email: data.email, role: data.role, passwordHash: bcrypt.hashSync(data.password, 10) },
      select: SELECT,
    });
    res.status(201).json(user);
  })
);

const patchSchema = z.object({
  nom: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(ROLES).optional(),
  actif: z.boolean().optional(),
});

usersRouter.patch(
  "/:id",
  asyncH(async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const data = patchSchema.parse(req.body);
    // Garde-fou : ne pas se désactiver ni se rétrograder soi-même.
    if (id === req.user!.id && (data.actif === false || (data.role && data.role !== req.user!.role))) {
      throw new HttpError(400, "Vous ne pouvez pas modifier votre propre rôle ou statut");
    }
    if (!(await prisma.user.findUnique({ where: { id } }))) throw new HttpError(404, "Compte introuvable");
    const user = await prisma.user.update({ where: { id }, data, select: SELECT });
    res.json(user);
  })
);

const passwordSchema = z.object({ password: z.string().min(6) });

usersRouter.post(
  "/:id/password",
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const { password } = passwordSchema.parse(req.body);
    if (!(await prisma.user.findUnique({ where: { id } }))) throw new HttpError(404, "Compte introuvable");
    await prisma.user.update({ where: { id }, data: { passwordHash: bcrypt.hashSync(password, 10) } });
    res.json({ ok: true });
  })
);
