import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncH } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { emailEnSimulation, modeSimulationSms } from "../lib/notifications.js";

/**
 * Journal des notifications émises (email / SMS) — traçabilité (RG-16).
 * Réservé au Secrétaire Général et à l'Administrateur. Expose aussi l'état de
 * configuration des canaux (simulation tant que les identifiants manquent).
 */
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "ADMIN"));

notificationsRouter.get(
  "/",
  asyncH(async (_req, res) => {
    const journal = await prisma.journalNotification.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    res.json({ emailSimulation: await emailEnSimulation(), smsSimulation: modeSimulationSms, journal });
  })
);
