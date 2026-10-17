import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { purgerRestesTests } from "../prisma/purger-restes-tests.js";

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
 *
 * Sous ce même verrou, une fois le schéma à jour, les fixtures laissées par les blocs
 * sans afterAll peuvent être purgées (prisma/purger-restes-tests.ts, garde sur le nom de
 * base) : sinon les restes s'accumulent et font échouer C-03, R2-5 et le afterAll de T10.
 * Suppression de données : activée seulement avec PURGER_RESTES_TESTS=1 (validation de
 * Fabrice requise pour la rendre systématique).
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
  const purge = await purgerRestesTests(verrou, process.env.PURGER_RESTES_TESTS === "1");
  if (purge.membres) console.log(`Restes de tests ${process.env.PURGER_RESTES_TESTS === "1" ? "purgés" : "présents (PURGER_RESTES_TESTS=1 pour purger)"} :`, purge);
  return async () => {
    await verrou.$queryRawUnsafe(`SELECT pg_advisory_unlock(${VERROU})::text`);
    await verrou.$disconnect();
  };
}
