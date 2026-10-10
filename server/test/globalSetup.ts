import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Applique le schéma (migrations Prisma) à la base de test AVANT la suite, pour
 * qu'elle reste à jour sans intervention manuelle après l'ajout d'une migration.
 *
 * La base barreau_pn_test est partagée (plusieurs sessions lancent la suite en même
 * temps) : deux exécutions concurrentes se polluent (comptages du tableau de bord,
 * jetons invalidés, num en doublon). Un verrou consultatif PostgreSQL, tenu par une
 * connexion unique pendant toute l'exécution, sérialise donc les suites : la
 * seconde attend la fin de la première. Le verrou tombe avec la connexion, même
 * si le processus est tué.
 */
const url =
  process.env.TEST_DATABASE_URL ||
  "postgresql://barreau:barreau_dev@127.0.0.1:5432/barreau_pn_test?schema=public";

const VERROU = 2026101015; // clé arbitraire propre à la suite serveur

export default async function setup() {
  const verrou = new PrismaClient({ datasources: { db: { url: `${url}${url.includes("?") ? "&" : "?"}connection_limit=1` } } });
  await verrou.$queryRawUnsafe(`SELECT pg_advisory_lock(${VERROU})::text`);
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
  return async () => {
    await verrou.$queryRawUnsafe(`SELECT pg_advisory_unlock(${VERROU})::text`);
    await verrou.$disconnect();
  };
}
