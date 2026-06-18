import { PrismaClient } from "@prisma/client";
import { logger } from "./lib/logger.js";

/** Client Prisma partagé (singleton), avec journalisation des avertissements/erreurs. */
export const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "warn" },
    { emit: "event", level: "error" },
  ],
});
prisma.$on("warn", (e) => logger.warn({ cible: e.target }, e.message));
prisma.$on("error", (e) => logger.error({ cible: e.target }, e.message));
