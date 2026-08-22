import pino from "pino";
import { env } from "../env.js";

/**
 * Journalisation structurée (JSON) centralisée — pino.
 * En développement, sortie lisible via pino-pretty si disponible ;
 * en production, JSON pur (compatible agrégateurs : Loki, Datadog, ELK…).
 * Le niveau se règle par LOG_LEVEL (défaut : info, ou debug hors production).
 */
const niveau = process.env.LOG_LEVEL || (env.nodeEnv === "production" ? "info" : "debug");
const joli = env.nodeEnv !== "production" && process.env.LOG_JSON !== "1";

export const logger = pino({
  level: niveau,
  base: { service: "barreau-pn-api" },
  redact: {
    // Ne jamais journaliser de secrets ni de données d'authentification.
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'req.body.password',
      'req.body.motDePasse',
      'req.body.refreshToken',
    ],
    remove: true,
  },
  ...(joli
    ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname,service" } } }
    : {}),
});
