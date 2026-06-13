import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { errorHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { membresRouter } from "./routes/membres.js";
import { cotisationsRouter } from "./routes/cotisations.js";
import { recusRouter } from "./routes/recus.js";
import { quitusRouter } from "./routes/quitus.js";

export function creerApp() {
  const app = express();
  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "barreau-pn-api" }));

  app.use("/api/auth", authRouter);
  app.use("/api/membres", membresRouter);
  app.use("/api/cotisations", cotisationsRouter);
  app.use("/api/recus", recusRouter);
  app.use("/api/quitus", quitusRouter);

  app.use((_req, res) => res.status(404).json({ erreur: "Ressource introuvable" }));
  app.use(errorHandler);
  return app;
}
