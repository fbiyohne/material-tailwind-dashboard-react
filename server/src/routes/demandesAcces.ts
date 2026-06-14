import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

/**
 * Revue des demandes d'accès (page publique « Demander un accès »).
 * Réservé au Secrétaire Général et à l'Administrateur. L'approbation ne crée
 * pas le compte ici : le SG provisionne le compte via le module Utilisateurs
 * (choix du rôle et du mot de passe), puis marque la demande approuvée.
 */
export const demandesAccesRouter = Router();
demandesAccesRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "ADMIN"));

demandesAccesRouter.get(
  "/",
  asyncH(async (req, res) => {
    const statut = typeof req.query.statut === "string" ? req.query.statut : undefined;
    const where = statut ? { statut: statut as "EN_ATTENTE" | "APPROUVEE" | "REFUSEE" } : {};
    res.json(await prisma.demandeAcces.findMany({ where, orderBy: { createdAt: "desc" } }));
  })
);

async function trancher(id: number, statut: "APPROUVEE" | "REFUSEE") {
  const demande = await prisma.demandeAcces.findUnique({ where: { id } });
  if (!demande) throw new HttpError(404, "Demande introuvable");
  return prisma.demandeAcces.update({ where: { id }, data: { statut, traiteeAt: new Date() } });
}

demandesAccesRouter.post("/:id/approuver", asyncH(async (req, res) => {
  res.json(await trancher(Number(req.params.id), "APPROUVEE"));
}));

demandesAccesRouter.post("/:id/refuser", asyncH(async (req, res) => {
  res.json(await trancher(Number(req.params.id), "REFUSEE"));
}));
