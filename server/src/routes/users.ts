import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
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

/**
 * Empêche l'escalade de privilège : seul un ADMIN peut attribuer le rôle ADMIN
 * ou agir sur un compte ADMIN existant (création, promotion, reset de mot de passe).
 * Un Secrétaire Général gère ainsi les comptes métier sans pouvoir se hisser ADMIN.
 */
function interdireEscaladeAdmin(acteur: Role, roleCible?: Role | null) {
  if (acteur !== "ADMIN" && roleCible === "ADMIN") {
    throw new HttpError(403, "Seul un administrateur peut gérer les comptes administrateur");
  }
}

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
  password: z.string().min(8),
});

usersRouter.post(
  "/",
  asyncH(async (req: AuthRequest, res) => {
    const data = creerSchema.parse(req.body);
    interdireEscaladeAdmin(req.user!.role, data.role);
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
    const cible = await prisma.user.findUnique({ where: { id } });
    if (!cible) throw new HttpError(404, "Compte introuvable");
    // Anti-escalade : ni promouvoir vers ADMIN, ni modifier un compte ADMIN, sauf en étant ADMIN.
    interdireEscaladeAdmin(req.user!.role, data.role);
    interdireEscaladeAdmin(req.user!.role, cible.role);
    const user = await prisma.user.update({ where: { id }, data, select: SELECT });
    res.json(user);
  })
);

const passwordSchema = z.object({ password: z.string().min(8) });

usersRouter.post(
  "/:id/password",
  asyncH(async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const { password } = passwordSchema.parse(req.body);
    const cible = await prisma.user.findUnique({ where: { id } });
    if (!cible) throw new HttpError(404, "Compte introuvable");
    interdireEscaladeAdmin(req.user!.role, cible.role);
    await prisma.user.update({ where: { id }, data: { passwordHash: bcrypt.hashSync(password, 10) } });
    res.json({ ok: true });
  })
);
