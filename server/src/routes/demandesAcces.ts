import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { envoyerEmail } from "../lib/notifications.js";
import { prochainNumInscription } from "../lib/business.js";
import { provisionnerAccesEspace } from "../lib/acces.js";

/**
 * Revue des demandes d'accès (page publique « Demander un accès »).
 * Réservé au Secrétaire Général et à l'Administrateur. Deux façons de traiter
 * une demande, au choix du SG (le rôle n'est jamais déduit automatiquement) :
 *  • compte du personnel : via le module Utilisateurs (rôle + mot de passe),
 *    puis `approuver` marque la demande ;
 *  • accès espace avocat : `approuver-espace` résout/crée la fiche membre et
 *    envoie un lien d'activation (l'avocat choisit son mot de passe).
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

/**
 * POST /demandes-acces/:id/approuver-espace — approuve la demande EN PROVISIONNANT
 * un accès à l'espace avocat : résout la fiche membre par email (ou la crée), puis
 * génère/envoie le lien d'activation. Le provisionnement précède le changement de
 * statut : s'il échoue (email déjà rattaché à un autre compte…), la demande reste
 * EN_ATTENTE.
 */
demandesAccesRouter.post("/:id/approuver-espace", asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const demande = await prisma.demandeAcces.findUnique({ where: { id } });
  if (!demande) throw new HttpError(404, "Demande introuvable");
  if (demande.statut !== "EN_ATTENTE") throw new HttpError(409, "Cette demande a déjà été traitée.");

  // Claim atomique : seule une approbation peut faire passer la demande de
  // EN_ATTENTE à APPROUVEE — empêche deux traitements concurrents de la même
  // demande de créer deux fiches membres.
  const claim = await prisma.demandeAcces.updateMany({
    where: { id, statut: "EN_ATTENTE" },
    data: { statut: "APPROUVEE", traiteeAt: new Date() },
  });
  if (claim.count === 0) throw new HttpError(409, "Cette demande a déjà été traitée.");

  try {
    let membre = await prisma.membre.findFirst({ where: { email: { equals: demande.email, mode: "insensitive" } } });
    if (!membre) {
      // Numéro d'inscription généré (séquentiel, unique) : le n° déclaré dans la
      // demande n'est pas autoritatif et pourrait entrer en collision. Le SG
      // l'ajustera depuis la fiche si nécessaire.
      const { num, numInscription } = await prochainNumInscription();
      membre = await prisma.membre.create({
        data: {
          num,
          numInscription,
          nom: demande.nom,
          qualite: "AVOCAT",
          statut: "INSCRIT",
          email: demande.email,
          cabinet: demande.cabinet ?? undefined,
          dateInscription: new Date(),
        },
      });
    }
    const acces = await provisionnerAccesEspace(membre.id); // envoie le lien d'activation
    res.status(201).json({ ...acces, membreId: membre.id });
  } catch (err) {
    // Le provisionnement a échoué : on relibère la demande pour permettre un nouvel essai.
    await prisma.demandeAcces.update({ where: { id }, data: { statut: "EN_ATTENTE", traiteeAt: null } }).catch(() => {});
    throw err;
  }
}));

demandesAccesRouter.post("/:id/refuser", asyncH(async (req, res) => {
  res.json(await trancher(Number(req.params.id), "REFUSEE"));
}));
