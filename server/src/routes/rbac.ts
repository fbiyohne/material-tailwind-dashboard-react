import { Router } from "express";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  PERMISSIONS, PERMISSION_CLES, ROLES_MATRICE, ROLES_COMPLET, ROLE_LABELS,
  permissionsDeRole, rafraichirMatrice,
} from "../lib/rbac.js";

/**
 * Matrice de rôles/permissions — consultation et édition (SG/Admin). Le catalogue
 * de modules est fixe ; l'attribution par rôle est éditable. SG et ADMIN gardent
 * un accès complet non modifiable (invariant de sûreté).
 */
export const rbacRouter = Router();
rbacRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "ADMIN"));

/** GET /rbac — catalogue + matrice courante (rôles éditables et rôles pleins). */
rbacRouter.get(
  "/",
  asyncH(async (_req, res) => {
    const matrice = Object.fromEntries(ROLES_MATRICE.map((r) => [r, permissionsDeRole(r)]));
    res.json({
      permissions: PERMISSIONS,
      rolesEditables: ROLES_MATRICE.map((r) => ({ cle: r, libelle: ROLE_LABELS[r] ?? r })),
      rolesComplet: ROLES_COMPLET.map((r) => ({ cle: r, libelle: ROLE_LABELS[r] ?? r })),
      matrice,
    });
  })
);

const majSchema = z.object({
  role: z.string(),
  permissions: z.array(z.string()),
});

/** PUT /rbac — remplace les permissions d'un rôle éditable. */
rbacRouter.put(
  "/",
  asyncH(async (req, res) => {
    const { role, permissions } = majSchema.parse(req.body);
    if (!ROLES_MATRICE.includes(role as Role)) {
      throw new HttpError(400, "Ce rôle n'est pas modifiable dans la matrice.");
    }
    const cles = [...new Set(permissions.filter((p) => PERMISSION_CLES.includes(p)))];
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { role: role as Role } }),
      prisma.rolePermission.createMany({ data: cles.map((permission) => ({ role: role as Role, permission })) }),
    ]);
    await rafraichirMatrice();
    res.json({ ok: true, role, permissions: cles });
  })
);
