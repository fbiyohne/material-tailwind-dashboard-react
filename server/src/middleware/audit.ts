import type { Response, NextFunction } from "express";
import { prisma } from "../prisma.js";
import { logger } from "../lib/logger.js";
import type { AuthRequest } from "./auth.js";

/** Libellés lisibles par ressource (1er segment après /api). */
const RESSOURCES: Record<string, string> = {
  membres: "Avocat",
  cotisations: "Cotisation",
  recus: "Reçu",
  quitus: "Quitus",
  discipline: "Dossier disciplinaire",
  reunions: "Réunion",
  assemblees: "Assemblée générale",
  publications: "Publication",
  archives: "Archive",
  parametres: "Paramètres",
  auth: "Session",
};

const VERBES: Record<string, string> = { POST: "Création", PATCH: "Mise à jour", PUT: "Mise à jour", DELETE: "Suppression" };

/** Construit un libellé d'action lisible à partir de la méthode et du chemin. */
function libelle(methode: string, chemin: string): { action: string; cible: string | null } {
  const segments = chemin.replace(/^\/api\//, "").split("/").filter(Boolean);
  const ressource = RESSOURCES[segments[0]] ?? segments[0] ?? "Ressource";
  const sousAction = segments.find((s) => ["paiement", "valider", "radier", "relances", "statut", "attestation", "convocation", "pv", "decision", "login", "logout"].includes(s));
  const cibleId = segments[1] && /^\d+$/.test(segments[1]) ? `#${segments[1]}` : null;
  if (sousAction) {
    const map: Record<string, string> = {
      paiement: "Enregistrement d'un paiement", valider: "Validation Trésorière", radier: "Radiation d'un avocat",
      relances: "Lancement des relances", statut: "Changement de statut", attestation: "Génération d'attestation",
      convocation: "Génération de convocation", pv: "Génération de procès-verbal", decision: "Génération de décision",
      login: "Connexion", logout: "Déconnexion",
    };
    return { action: `${map[sousAction]} — ${ressource}`, cible: cibleId };
  }
  return { action: `${VERBES[methode] ?? methode} — ${ressource}`, cible: cibleId };
}

/**
 * Journalise toute action importante (mutation réussie) dans JournalAudit (RG-16 / NFR-09).
 * Écriture asynchrone après envoi de la réponse : n'impacte jamais la latence client.
 */
export function audit(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "OPTIONS" || req.method === "HEAD") return next();
  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    const { action, cible } = libelle(req.method, req.originalUrl.split("?")[0]);
    prisma.journalAudit
      .create({
        data: {
          action, cible, methode: req.method, chemin: req.originalUrl.split("?")[0],
          statut: res.statusCode, userId: req.user?.id ?? null,
        },
      })
      .catch((err) => logger.warn({ err }, "Échec d'écriture du journal d'audit"));
  });
  next();
}
