import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { envoyerEmail } from "../lib/notifications.js";

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
  // Seule une demande en attente peut être tranchée : empêche de ré-approuver
  // une demande déjà refusée (et de renvoyer un email de décision contradictoire).
  if (demande.statut !== "EN_ATTENTE") {
    throw new HttpError(409, "Cette demande a déjà été traitée.");
  }
  const maj = await prisma.demandeAcces.update({ where: { id }, data: { statut, traiteeAt: new Date() } });
  // Notification de la décision au demandeur.
  const texte = statut === "APPROUVEE"
    ? `Bonjour ${demande.nom},\n\nVotre demande d'accès a été approuvée par le Secrétariat Général du Barreau de Pointe-Noire. Vos identifiants de connexion vous seront communiqués séparément.\n\nLe Secrétariat Général.`
    : `Bonjour ${demande.nom},\n\nAprès examen, votre demande d'accès à l'application du Barreau de Pointe-Noire n'a pas été retenue. Pour toute précision, rapprochez-vous du Secrétariat Général.\n\nLe Secrétariat Général.`;
  void envoyerEmail({ to: demande.email, subject: "Suite à votre demande d'accès · Barreau de Pointe-Noire", text: texte, evenement: "DEMANDE_DECISION" });
  return maj;
}

demandesAccesRouter.post("/:id/approuver", asyncH(async (req, res) => {
  res.json(await trancher(Number(req.params.id), "APPROUVEE"));
}));

demandesAccesRouter.post("/:id/refuser", asyncH(async (req, res) => {
  res.json(await trancher(Number(req.params.id), "REFUSEE"));
}));
