import { Router } from "express";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { listerNotifications, compterNonLus, marquerLu, marquerToutLu } from "../lib/centreNotifications.js";

/**
 * Centre de notifications in-app du back-office (par utilisateur connecté).
 * Distinct de /notifications (journal des emails/SMS, réservé SG/Admin) : ici
 * chaque officier consulte SES alertes (demandes d'accès, pièces soumises…).
 */
export const mesNotificationsRouter = Router();
mesNotificationsRouter.use(requireAuth);

/** GET /mes-notifications — dernières alertes + compteur de non-lues. */
mesNotificationsRouter.get(
  "/",
  asyncH(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const [items, nonLus] = await Promise.all([listerNotifications(userId), compterNonLus(userId)]);
    res.json({ items, nonLus });
  })
);

/** POST /mes-notifications/lu-tout — marque toutes mes alertes comme lues. */
mesNotificationsRouter.post(
  "/lu-tout",
  asyncH(async (req: AuthRequest, res) => {
    const n = await marquerToutLu(req.user!.id);
    res.json({ ok: true, marquees: n });
  })
);

/** POST /mes-notifications/:id/lu — marque une de mes alertes comme lue. */
mesNotificationsRouter.post(
  "/:id/lu",
  asyncH(async (req: AuthRequest, res) => {
    const ok = await marquerLu(req.user!.id, Number(req.params.id));
    if (!ok) throw new HttpError(404, "Notification introuvable");
    res.json({ ok: true });
  })
);
