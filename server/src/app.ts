import express from "express";
import path from "node:path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error.js";
import { audit } from "./middleware/audit.js";
import { authRouter } from "./routes/auth.js";
import { membresRouter } from "./routes/membres.js";
import { usersRouter } from "./routes/users.js";
import { demandesAccesRouter } from "./routes/demandesAcces.js";
import { piecesRouter } from "./routes/pieces.js";
import { notificationsRouter } from "./routes/notifications.js";
import { paiementsRouter } from "./routes/paiements.js";
import { cotisationsRouter } from "./routes/cotisations.js";
import { recusRouter } from "./routes/recus.js";
import { quitusRouter } from "./routes/quitus.js";
import { droitsRouter } from "./routes/droits.js";
import { disciplineRouter } from "./routes/discipline.js";
import { reunionsRouter } from "./routes/reunions.js";
import { assembleesRouter } from "./routes/assemblees.js";
import { publicationsRouter } from "./routes/publications.js";
import { archivesRouter } from "./routes/archives.js";
import { parametresRouter } from "./routes/parametres.js";
import { corpsElectoralRouter } from "./routes/corpsElectoral.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { signaturesRouter } from "./routes/signatures.js";
import { conseilRouter } from "./routes/conseil.js";
import { calendrierEditorialRouter } from "./routes/calendrierEditorial.js";
import { verificationRouter } from "./routes/verification.js";

export function creerApp() {
  const app = express();
  app.set("trust proxy", 1);
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
  app.use(express.json({ limit: "8mb" }));
  // Journal d'audit transverse des mutations (RG-16 / NFR-09).
  app.use("/api", audit);
  // Limiteur global (protection DoS basique).
  app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "barreau-pn-api" }));

  app.use("/api/auth", authRouter);
  app.use("/api/membres", membresRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/demandes-acces", demandesAccesRouter);
  app.use("/api/pieces", piecesRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/paiements", paiementsRouter);
  app.use("/api/cotisations", cotisationsRouter);
  app.use("/api/recus", recusRouter);
  app.use("/api/quitus", quitusRouter);
  app.use("/api/droits", droitsRouter);
  app.use("/api/discipline", disciplineRouter);
  app.use("/api/reunions", reunionsRouter);
  app.use("/api/assemblees", assembleesRouter);
  app.use("/api/publications", publicationsRouter);
  app.use("/api/archives", archivesRouter);
  app.use("/api/parametres", parametresRouter);
  app.use("/api/corps-electoral", corpsElectoralRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/signatures", signaturesRouter);
  app.use("/api/conseil", conseilRouter);
  app.use("/api/calendrier-editorial", calendrierEditorialRouter);
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
