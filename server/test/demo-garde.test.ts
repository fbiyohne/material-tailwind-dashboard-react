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
    // TEST_DATABASE_URL vise la vraie base de test : le script ne doit lire que DATABASE_URL.
    env: { ...process.env, DATABASE_URL: url, TEST_DATABASE_URL: base("barreau_pn_test") },
    encoding: "utf8",
    timeout: 60_000,
  });
}

describe("npm run demo : garde-fou de base (CA15)", () => {
  it.each(["barreau_pn", "barreau_pn_test_ci", "barreau_pn_test2", "autre", "postgres"])(
    "refuse la base %s avec un code non nul",
    (nom) => {
      const r = lancer(base(nom));
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("barreau_pn_test");
    },
  );

  it("refuse la production même avec l'ancienne option --base-test (TEST_DATABASE_URL ignoré)", () => {
    const r = lancer(base("barreau_pn"), "--base-test");
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toContain("EFFECTIFS");
  });

  it("accepte la base dédiée au congrès barreau_pn_demo (R1-13, non partagée avec les tests)", () => {
    // Port 1 injoignable : le garde-fou doit laisser passer, puis la connexion échoue sans rien écrire.
    const r = lancer("postgresql://barreau:barreau_dev@127.0.0.1:1/barreau_pn_demo?schema=public");
    expect(r.stderr).not.toContain("est refusée");
    expect(r.stdout).not.toContain("EFFECTIFS");
    expect(r.status).not.toBe(0);
  });

  it("avertit si le scénario du congrès est lancé sur le schéma public partagé de barreau_pn_test (R1-13)", () => {
    const r = lancer("postgresql://barreau:barreau_dev@127.0.0.1:1/barreau_pn_test?schema=public", "--identite=demonstration");
    expect(r.stderr).toContain("AVERTISSEMENT");
    expect(r.stderr).toContain("schema=demo");
    expect(r.stdout).not.toContain("EFFECTIFS");
  });

  it("n'avertit pas sur le schéma vierge demo de barreau_pn_test (congrès, R1-13)", () => {
    const r = lancer("postgresql://barreau:barreau_dev@127.0.0.1:1/barreau_pn_test?schema=demo", "--identite=demonstration");
    expect(r.stderr).not.toContain("AVERTISSEMENT");
    expect(r.stderr).not.toContain("est refusée");
    expect(r.status).not.toBe(0); // port 1 injoignable : rien n'est écrit
  });

  it("refuse un DATABASE_URL absent ou illisible", () => {
    const r = lancer("pas-une-url");
    expect(r.status).not.toBe(0);
  });

  it("refuse une identité inconnue (Brazzaville n'est pas activable)", () => {
    const r = lancer(base("barreau_pn_test"), "--identite=brazzaville");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/identit/i);
  });
});
