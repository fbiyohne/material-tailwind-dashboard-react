import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./env.js";
import { errorHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { membresRouter } from "./routes/membres.js";
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

export function creerApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json());
  // Limiteur global (protection DoS basique).
  app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "barreau-pn-api" }));

  app.use("/api/auth", authRouter);
  app.use("/api/membres", membresRouter);
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

  app.use((_req, res) => res.status(404).json({ erreur: "Ressource introuvable" }));
  app.use(errorHandler);
  return app;
}
