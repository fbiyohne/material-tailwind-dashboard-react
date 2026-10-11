import express from "express";
import path from "node:path";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import jwt from "jsonwebtoken";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import { env } from "./env.js";
import { rafraichirSiPerimee } from "./lib/identiteDocuments.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error.js";
import { audit } from "./middleware/audit.js";
import { confinementAvocat } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { membresRouter } from "./routes/membres.js";
import { usersRouter } from "./routes/users.js";
import { demandesAccesRouter } from "./routes/demandesAcces.js";
import { piecesRouter } from "./routes/pieces.js";
import { notificationsRouter } from "./routes/notifications.js";
import { mesNotificationsRouter } from "./routes/mesNotifications.js";
import { rbacRouter } from "./routes/rbac.js";
import { paiementsRouter } from "./routes/paiements.js";
import { cotisationsRouter } from "./routes/cotisations.js";
import { recusRouter } from "./routes/recus.js";
import { quitusRouter } from "./routes/quitus.js";
import { droitsRouter } from "./routes/droits.js";
import { timbresRouter } from "./routes/timbres.js";
import { disciplineRouter } from "./routes/discipline.js";
import { reunionsRouter } from "./routes/reunions.js";
import { assembleesRouter } from "./routes/assemblees.js";
import { publicationsRouter } from "./routes/publications.js";
import { archivesRouter } from "./routes/archives.js";
import { parametresRouter } from "./routes/parametres.js";
import { corpsElectoralRouter } from "./routes/corpsElectoral.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { auditRouter } from "./routes/audit.js";
import { tableauRouter } from "./routes/tableau.js";
import { scrutinsRouter } from "./routes/scrutins.js";
import { signaturesRouter } from "./routes/signatures.js";
import { conseilRouter } from "./routes/conseil.js";
import { cabinetsRouter } from "./routes/cabinets.js";
import { calendrierEditorialRouter } from "./routes/calendrierEditorial.js";
import { verificationRouter } from "./routes/verification.js";
import { espaceRouter } from "./routes/espace.js";
import { messagerieRouter } from "./routes/messagerie.js";
import { installationRouter } from "./routes/installation.js";

/** Identifiant (sub) du JWT authentique de l'en-tête Authorization, sinon null (un jeton bidon ne relève pas la limite).
 *  R2-13 : l'expiration est ignorée ICI SEULEMENT (la signature reste vérifiée ; requireAuth refuse ensuite en 401).
 *  Sans cela, un jeton expiré tombait sur le budget anonyme de l'IP et recevait 429 au lieu de 401 :
 *  le SPA ne rafraîchissait jamais sa session et toute l'API restait bloquée jusqu'à la fin de la fenêtre. */
function utilisateurDuJeton(req: express.Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try {
    const p = jwt.verify(h.slice(7), env.jwtSecret, { algorithms: ["HS256"], ignoreExpiration: true });
    return typeof p === "object" && p.sub != null ? String(p.sub) : "?";
  } catch {
    return null;
  }
}

/** Limites par 15 min : anonyme / jeton valide (surchargeables, utile aux tests). */
export function creerApp(limites: { anonyme?: number; authentifie?: number } = {}) {
  const { anonyme = 600, authentifie = 3000 } = limites;
  const app = express();
  // Nombre de proxys de confiance pour dériver req.ip (rate-limiting par IP).
  // Doit correspondre à la topologie réelle : une valeur trop permissive laisse
  // usurper l'IP via X-Forwarded-For (contournement de l'anti-brute-force).
  // Configurable par TRUST_PROXY (défaut : 1 = un reverse-proxy unique).
  app.set("trust proxy", env.trustProxy);
  // En mono-service (front servi par l'API), la CSP stricte de helmet bloque
  // les styles en ligne de Material Tailwind : on la désactive dans ce mode.
  app.use(helmet({ contentSecurityPolicy: env.staticDir ? false : undefined }));
  app.use(cors({ origin: env.clientOrigin }));
  // Journalisation structurée des requêtes (id de corrélation + durée + statut).
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = (req.headers["x-request-id"] as string) || randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
      // Les PDF passent par le logger ; on évite de journaliser le corps binaire.
      autoLogging: { ignore: (req) => req.url === "/api/health" },
    })
  );
  // Limite relevée pour accepter les pièces téléversées en base64 (max 5 Mo décodé).
  // `verify` conserve le corps brut (octets exacts) pour la vérification de
  // signature HMAC des webhooks de paiement, qui doit porter sur la charge utile
  // d'origine et non sur une re-sérialisation.
  app.use(
    express.json({
      limit: "8mb",
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );
  // Identité du barreau : cache borné dans le temps (jamais plus d'une seconde de retard sur la base).
  app.use("/api", (_req, _res, next) => void rafraichirSiPerimee().then(() => next(), next));
  // Journal d'audit transverse des mutations (RG-16 / NFR-09).
  app.use("/api", audit);
  // Limiteur global (protection DoS basique).
  // Les appels de fond du SPA (notifications, non-lus) et les lectures publiques d identité/installation (R1-14) ne comptent pas ; un jeton présent
  // relève la limite (le SPA enchaîne plusieurs appels par page). Anonyme ou jeton invalide : 600 / 15 min.
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: (req) => (utilisateurDuJeton(req) ? authentifie : anonyme),
      // R2-13 : un jeton valide a son propre budget (salle de congrès derrière un seul NAT) ; sinon l'IP.
      keyGenerator: (req) => {
        const u = utilisateurDuJeton(req);
        return u ? "u:" + u : ipKeyGenerator(req.ip ?? "");
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => /^\/(health|notifications|mes-notifications|auth\/identite|installation\/etat)(\/|$)/.test(req.path),
      handler: (_req, res) => {
        const n = Number(res.getHeader("Retry-After")) || 60;
        res.status(429).json({ erreur: `Trop de requêtes, réessayez dans ${n} s.`, retryAfter: n });
      },
    })
  );
  // Cloisonnement : un jeton AVOCAT est confiné à /api/espace et /api/auth.
  app.use("/api", confinementAvocat);

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "barreau-pn-api" }));

  app.use("/api/installation", installationRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/membres", membresRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/demandes-acces", demandesAccesRouter);
  app.use("/api/pieces", piecesRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/mes-notifications", mesNotificationsRouter);
  app.use("/api/rbac", rbacRouter);
  app.use("/api/paiements", paiementsRouter);
  app.use("/api/cotisations", cotisationsRouter);
  app.use("/api/recus", recusRouter);
  app.use("/api/quitus", quitusRouter);
  app.use("/api/droits", droitsRouter);
  app.use("/api/timbres", timbresRouter);
  app.use("/api/discipline", disciplineRouter);
  app.use("/api/reunions", reunionsRouter);
  app.use("/api/assemblees", assembleesRouter);
  app.use("/api/publications", publicationsRouter);
  app.use("/api/archives", archivesRouter);
  app.use("/api/parametres", parametresRouter);
  app.use("/api/corps-electoral", corpsElectoralRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/audit", auditRouter);
  app.use("/api/tableau", tableauRouter);
  app.use("/api/scrutins", scrutinsRouter);
  app.use("/api/signatures", signaturesRouter);
  app.use("/api/conseil", conseilRouter);
  app.use("/api/cabinets", cabinetsRouter);
  app.use("/api/calendrier-editorial", calendrierEditorialRouter);
  app.use("/api/espace", espaceRouter); // espace avocat (rôle AVOCAT, cloisonné)
  app.use("/api/messagerie", messagerieRouter); // messagerie — côté administration
  app.use("/api/verifier", verificationRouter); // public — vérification d'authenticité (QR)

  // Déploiement mono-service : sert le front compilé (dist) sur la même origine
  // que l'API (pas de CORS). Les routes /api inconnues retombent sur le 404 JSON.
  if (env.staticDir) {
    const dist = path.resolve(env.staticDir);
    app.use(express.static(dist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  app.use((_req, res) => res.status(404).json({ erreur: "Ressource introuvable" }));
  app.use(errorHandler);
  return app;
}
