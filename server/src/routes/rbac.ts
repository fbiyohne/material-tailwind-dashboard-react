import { Router } from "express";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import {
  PERMISSIONS, PERMISSION_CLES, ACTIONS, ACTION_CLES, ROLES_MATRICE, ROLES_COMPLET, ROLE_LABELS,
  permissionsDeRole, rafraichirMatrice, SENTINELLE_ACTIONS,
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
      actions: ACTIONS,
      rolesEditables: ROLES_MATRICE.map((r) => ({ cle: r, libelle: ROLE_LABELS[r] ?? r })),
      rolesComplet: ROLES_COMPLET.map((r) => ({ cle: r, libelle: ROLE_LABELS[r] ?? r })),
      // Affiché pour information seulement : l'Avocat reste hors de ROLES_MATRICE (le PUT le refuse).
      rolesLectureSeule: [{ cle: "AVOCAT", libelle: ROLE_LABELS.AVOCAT, lectureSeule: true, mention: "Espace cloisonné" }],
      matrice,
    });
  })
);

const majSchema = z.object({
  role: z.string(),
  permissions: z.array(z.string().max(64)).max(100),
});

const CLES_CONNUES = new Set([...PERMISSION_CLES, ...ACTION_CLES]);

/** PUT /rbac — remplace les permissions (modules et actions) d'un rôle éditable. Clé inconnue : 400. */
rbacRouter.put(
  "/",
  asyncH(async (req: AuthRequest, res) => {
    const { role, permissions } = majSchema.parse(req.body);
    if (!ROLES_MATRICE.includes(role as Role)) {
      throw new HttpError(400, "Ce rôle n'est pas modifiable dans la matrice.");
    }
    const inconnues = permissions.filter((p) => !CLES_CONNUES.has(p));
    if (inconnues.length) throw new HttpError(400, `Permission(s) inconnue(s) : ${inconnues.join(", ")}`);
    const cles = [...new Set(permissions)];
    // Anti-escalade : seules les actions de décision sont réservées à l'ADMIN ; le SG ne peut pas les modifier.
    if (req.user!.role !== "ADMIN") {
      const actuelles = new Set(permissionsDeRole(role as Role).filter((p) => ACTION_CLES.includes(p)));
      const demandees = new Set(cles.filter((p) => ACTION_CLES.includes(p)));
      if (actuelles.size !== demandees.size || [...demandees].some((p) => !actuelles.has(p))) {
        throw new HttpError(403, "Seul un administrateur peut modifier les permissions d'action");
      }
    }
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { role: role as Role } }),
      prisma.rolePermission.createMany({
        // Aucune action cochée : ligne sentinelle, sinon le repli par catégorie rendrait les défauts.
        data: (cles.some((p) => ACTION_CLES.includes(p)) ? cles : [...cles, SENTINELLE_ACTIONS]).map((permission) => ({ role: role as Role, permission })),
      }),
    ]);
    await rafraichirMatrice();
    res.json({ ok: true, role, permissions: cles });
  })
);
