import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Garde-fou du jeu de démonstration (T25, CA15) : le script refuse toute base autre
 * que barreau_pn_test, AVANT d'ouvrir la moindre connexion. Ces cas ne se connectent
 * à aucune base : l'URL de production n'est jamais jointe.
 */
const base = (nom: string) => `postgresql://barreau:barreau_dev@127.0.0.1:5432/${nom}?schema=public`;
const tsx = path.resolve("node_modules/tsx/dist/cli.mjs");

function lancer(url: string, ...args: string[]) {
  return spawnSync(process.execPath, [tsx, "prisma/demo.ts", ...args], {
    env: { ...process.env, DATABASE_URL: url, TEST_DATABASE_URL: url },
    encoding: "utf8",
    timeout: 60_000,
  });
}

describe("npm run demo : garde-fou de base (CA15)", () => {
  it.each(["barreau_pn", "barreau_pn_test_ci", "barreau_pn_test2", "autre", "postgres"])(
    "refuse la base %s avec un code non nul",
    (nom) => {
      const r = lancer(base(nom), "--base-test");
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("barreau_pn_test");
    },
  );

  it("refuse aussi sans l'option --base-test quand DATABASE_URL vise la production", () => {
    const r = lancer(base("barreau_pn"));
    expect(r.status).not.toBe(0);
  });

  it("refuse une identité inconnue (Brazzaville n'est pas activable)", () => {
    const r = lancer(base("barreau_pn_test"), "--identite=brazzaville");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/identit/i);
  });
});
