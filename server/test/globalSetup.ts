import { execSync } from "node:child_process";

/**
 * Applique le schéma (migrations Prisma) à la base de test AVANT la suite, pour
 * qu'elle reste à jour sans intervention manuelle après l'ajout d'une migration.
 */
const url =
  process.env.TEST_DATABASE_URL ||
  "postgresql://barreau:barreau_dev@localhost:5432/barreau_pn_test?schema=public";

export default function setup() {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
