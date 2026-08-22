import { creerApp } from "./app.js";
import { env, verifierConfigProduction } from "./env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./prisma.js";
import { initRealtime } from "./lib/realtime.js";
import { rafraichirIdentite } from "./lib/identiteDocuments.js";
import { amorcerMatriceSiVide, rafraichirMatrice } from "./lib/rbac.js";

// Rend visibles, au démarrage, les secrets manquants qui dégraderaient en silence.
verifierConfigProduction((msg) => logger.warn(msg));

// Charge l'identité institutionnelle (documents) depuis les Paramètres au démarrage.
void rafraichirIdentite();
// Amorce (si vide) puis charge la matrice de permissions en cache.
void amorcerMatriceSiVide().then(() => rafraichirMatrice());

const server = creerApp().listen(env.port, () => {
  logger.info({ port: env.port, env: env.nodeEnv }, `API Barreau de Pointe-Noire — http://localhost:${env.port}/api`);
});

// Messagerie temps réel (WebSocket /ws) attachée au même serveur HTTP.
initRealtime(server);

// Arrêt propre (conteneur / SIGTERM) : on draine aussi le pool de connexions Prisma.
const arret = (signal: string) => {
  logger.info({ signal }, "Arrêt du serveur…");
  server.close(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  });
};
process.on("SIGTERM", () => arret("SIGTERM"));
process.on("SIGINT", () => arret("SIGINT"));
process.on("unhandledRejection", (raison) => logger.error({ raison }, "Promesse rejetée non gérée"));
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Exception non interceptée");
  process.exit(1);
});
