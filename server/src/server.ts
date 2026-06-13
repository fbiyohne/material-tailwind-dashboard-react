import { creerApp } from "./app.js";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";

const server = creerApp().listen(env.port, () => {
  logger.info({ port: env.port, env: env.nodeEnv }, `API Barreau de Pointe-Noire — http://localhost:${env.port}/api`);
});

// Arrêt propre (conteneur / SIGTERM) et journalisation des erreurs fatales.
const arret = (signal: string) => {
  logger.info({ signal }, "Arrêt du serveur…");
  server.close(() => process.exit(0));
};
process.on("SIGTERM", () => arret("SIGTERM"));
process.on("SIGINT", () => arret("SIGINT"));
process.on("unhandledRejection", (raison) => logger.error({ raison }, "Promesse rejetée non gérée"));
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Exception non interceptée");
  process.exit(1);
});
