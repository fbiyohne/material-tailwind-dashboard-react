import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Garde-fou du seed (R2-1) : le seed vide toutes les tables et crée des comptes au mot de passe
 * commun publié dans le dépôt. Il refuse donc NODE_ENV=production et toute base hors du poste
 * local, AVANT la moindre écriture. Les hôtes visés sont injoignables (.invalid, port 1) :
 * même si la garde manquait, rien ne serait écrit.
 */
const tsx = path.resolve("node_modules/tsx/dist/cli.mjs");

function lancer(url: string, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [tsx, "prisma/seed.ts"], {
    env: { ...process.env, NODE_ENV: "test", ...env, DATABASE_URL: url },
    encoding: "utf8",
    timeout: 60_000,
  });
}

describe("npm run seed : garde-fou (R2-1)", () => {
  it("refuse une base distante (production)", () => {
    const r = lancer("postgresql://u:p@base-prod.exemple.invalid:5432/barreau_pn?schema=public");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("seed refusé");
  });

  it("refuse NODE_ENV=production, même sur une base locale", () => {
    const r = lancer("postgresql://barreau:barreau_dev@127.0.0.1:1/barreau_pn_test?schema=public", { NODE_ENV: "production" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("seed refusé");
  });

  it("refuse un DATABASE_URL illisible", () => {
    const r = lancer("pas-une-url");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("seed refusé");
  });

  it("laisse passer une base locale hors production (la connexion échoue ensuite, port 1)", () => {
    const r = lancer("postgresql://barreau:barreau_dev@127.0.0.1:1/barreau_pn_test?schema=public");
    expect(r.stderr).not.toContain("seed refusé");
    expect(r.status).not.toBe(0);
  });
});
