import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { homedir } from "node:os";

const port = process.env.E2E_PORT ?? "4110";
const baseURL = process.env.E2E_URL ?? `http://localhost:${port}`;

// Chromium déjà présent sur le poste (E2E_CHROMIUM pour en viser un autre) : évite de télécharger un navigateur.
const local = `${homedir()}/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe`;
const executablePath = process.env.E2E_CHROMIUM ?? (existsSync(local) ? local : undefined);

// Instance privée (code courant, base barreau_pn_test) lancée par serveur.mjs ; E2E_URL pour en viser une autre.
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  workers: 1, // un seul worker : les parcours partagent la base de test et le limiteur de connexion
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "rapport", open: "never" }]],
  outputDir: "resultats",
  use: { baseURL, screenshot: "only-on-failure", trace: "retain-on-failure", launchOptions: { executablePath } },
  webServer: process.env.E2E_URL ? undefined : {
    command: "node serveur.mjs",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
