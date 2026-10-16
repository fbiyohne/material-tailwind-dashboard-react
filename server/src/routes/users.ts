import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole, type AuthRequest, requirePermission } from "../middleware/auth.js";
import { notifier, usersParRole } from "../lib/centreNotifications.js";
import { aLaPermission } from "../lib/rbac.js";
import { envoyerEmail } from "../lib/notifications.js";

/**
 * Gestion des comptes utilisateurs (CDC §5.1, table `users`).
 * Réservé au Secrétaire Général et à l'Administrateur. Les secrets
 * (passwordHash) ne sont jamais renvoyés.
 */
export const usersRouter = Router();
usersRouter.use(requireAuth, requirePermission("utilisateurs"));

const SELECT = { id: true, nom: true, email: true, role: true, actif: true, createdAt: true } as const;
const ROLES = ["SECRETAIRE_GENERAL", "BATONNIER", "TRESORIERE", "ADMIN", "SECRETAIRE_ADJOINT", "CONSULTATION", "ACCUEIL"] as const;

/**
 * Empêche l'escalade de privilège : seul un ADMIN peut attribuer le rôle ADMIN
 * ou agir sur un compte ADMIN existant (création, promotion, reset de mot de passe).
 * Un Secrétaire Général gère ainsi les comptes métier sans pouvoir se hisser ADMIN.
 */
function interdireEscaladeAdmin(acteur: Role, roleCible?: Role | null) {
  if (roleCible === "ADMIN" && acteur !== "ADMIN") {
    throw new HttpError(403, "Seul un administrateur peut gérer les comptes administrateur");
  }
  // Le rôle BATONNIER détient les actions de décision (R-42) : le SG ne peut pas s'en octroyer l'usage.
  // Succession : un Bâtonnier doté de « utilisateurs » crée le compte de son successeur.
  if (roleCible === "BATONNIER" && acteur !== "ADMIN" && acteur !== "BATONNIER") {
    throw new HttpError(403, "Seuls l'administrateur et le Bâtonnier peuvent gérer un compte bâtonnier");
  }
  // F1 (M-20261016) : le SG a tous les modules sans restriction possible ; un rôle éditable à qui
  // l'on aurait accordé « utilisateurs » ne doit ni créer ni promouvoir ni reprendre un compte SG.
  if (roleCible === "SECRETAIRE_GENERAL" && acteur !== "ADMIN" && acteur !== "SECRETAIRE_GENERAL") {
    throw new HttpError(403, "Seuls l'administrateur et le Secrétaire général peuvent gérer un compte Secrétaire général");
  }
}

/**
 * Comptes habilités : ceux qui accèdent au contenu des messages ou des pièces (SG, Bâtonnier, AVOCAT,
 * tout rôle titulaire de « messagerie »). Accès ADMIN autorisé (décision du 16/10/2026), tracé dans
 * JournalAudit ; ce que l'ADMIN fait sur un tel compte est en outre signalé au titulaire et au SG.
 */
const roleHabilite = (role: Role) =>
  role !== "ADMIN" && (role === "SECRETAIRE_GENERAL" || role === "BATONNIER" || role === "AVOCAT" || aLaPermission(role, "messagerie"));
/** Défense en profondeur (prise de compte) : alerte sans blocage ; `ancienRole` couvre une rétrogradation. */
async function alerterPrivilege(acteur: { id: number; role: Role; nom?: string }, cible: { id: number; nom: string; role: Role }, action: string, ancienRole = cible.role, emailAvant?: string) {
  if (acteur.role !== "ADMIN" || !(roleHabilite(cible.role) || roleHabilite(ancienRole))) return;
  const sg = await usersParRole(["SECRETAIRE_GENERAL"]);
  await notifier([cible.id, ...sg], {
    type: "securite",
    titre: "Compte à rôle habilité modifié par un administrateur",
    message: `${action} : compte « ${cible.nom} » (${cible.role}), par l'administrateur technique. Si ce n'est pas attendu, contactez le Secrétaire général.`,
  }).catch(() => {});
  // L'alerte in-app n'est pas fiable si l'ADMIN contrôle la session du titulaire : copie par email à l'adresse d'avant modification.
  if (emailAvant) {
    const texte = `${action} : votre compte « ${cible.nom} » a été modifié par l'administrateur technique. Si ce n'est pas attendu, contactez le Secrétaire général.`;
    await envoyerEmail({ to: emailAvant, subject: "Compte modifié par un administrateur", text: texte, evenement: "ALERTE_PRIVILEGE" }).catch(() => {});
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
    // Email normalisé en minuscules : unicité et connexion insensibles à la casse.
    const email = data.email.trim().toLowerCase();
    const existe = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (existe) throw new HttpError(409, "Un compte existe déjà avec cet email");
    const user = await prisma.user.create({
      data: { nom: data.nom, email, role: data.role, passwordHash: bcrypt.hashSync(data.password, 10) },
      select: SELECT,
    });
    await alerterPrivilege(req.user!, user, "Création du compte");
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
    // Email normalisé en minuscules (cohérence avec la création / la connexion).
    if (data.email) {
      data.email = data.email.trim().toLowerCase();
      // Unicité : un autre compte ne doit pas déjà porter cet email (évite un 500 Prisma).
      const doublon = await prisma.user.findFirst({ where: { email: { equals: data.email, mode: "insensitive" }, id: { not: id } } });
      if (doublon) throw new HttpError(409, "Un compte existe déjà avec cet email");
    }
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
    if (Object.keys(data).some((k) => k !== "actif")) await alerterPrivilege(req.user!, user, "Modification du compte", cible.role, cible.email);
    else if (data.actif !== undefined && data.actif !== cible.actif) {
      await alerterPrivilege(req.user!, user, data.actif ? "Réactivation du compte" : "Désactivation du compte", cible.role, cible.email);
    }
    res.json(user);
  })
);

/**
 * DELETE /users/:id — suppression définitive d'un compte (super-administrateur).
 * Réservé à l'ADMIN. Garde-fous : on ne supprime ni son propre compte, ni le
 * dernier administrateur du système (sinon plus aucun super-admin ne pourrait
 * agir). Les jetons de rafraîchissement sont effacés en cascade (schéma).
 */
usersRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncH(async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    if (id === req.user!.id) throw new HttpError(400, "Vous ne pouvez pas supprimer votre propre compte");
    const cible = await prisma.user.findUnique({ where: { id } });
    if (!cible) throw new HttpError(404, "Compte introuvable");
    if (cible.role === "ADMIN") {
      const admins = await prisma.user.count({ where: { role: "ADMIN" } });
      if (admins <= 1) throw new HttpError(400, "Impossible de supprimer le dernier administrateur");
    }
    await prisma.user.delete({ where: { id } });
    res.json({ ok: true, nom: cible.nom });
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
    await alerterPrivilege(req.user!, cible, "Réinitialisation du mot de passe", cible.role, cible.email);
    res.json({ ok: true });
  })
);
