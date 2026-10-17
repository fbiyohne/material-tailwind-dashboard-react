// Lance une instance PRIVÉE de l'application (code courant, base de test, front construit) pour les
// parcours bout en bout. Jamais la base de production : DATABASE_URL est forcée sur TEST_DATABASE_URL.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(resolve(racine, "server/.env"), "utf8");
const test = env.match(/^TEST_DATABASE_URL="?([^"\r\n]+)"?/m)?.[1];
if (!test || !/barreau_pn_test/.test(test)) {
  console.error("TEST_DATABASE_URL (barreau_pn_test) introuvable dans server/.env : arrêt par sécurité.");
  process.exit(1);
}
const port = process.env.E2E_PORT ?? "4110";
const enfant = spawn("npx", ["tsx", "src/server.ts"], {
  cwd: resolve(racine, "server"),
  shell: true,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: test, PORT: port, STATIC_DIR: resolve(racine, "dist") },
});
enfant.on("exit", (c) => process.exit(c ?? 0));
process.on("SIGTERM", () => enfant.kill());
