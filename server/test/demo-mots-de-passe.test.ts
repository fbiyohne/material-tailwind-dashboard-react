import { describe, it, expect, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import bcrypt from "bcryptjs";
import { prisma } from "../src/prisma.js";

/**
 * Revue R1-4 : mots de passe des comptes de démonstration.
 * --mots-de-passe-aleatoires (ou --identite=demonstration seule) retire le mot de passe public
 * « barreau » des 5 comptes ; --mots-de-passe-defaut (ou --identite=pointe-noire seule) le rétablit,
 * ce qu'attend le reste de la suite. Ne tourne que sur barreau_pn_test (garde du script).
 */
const url = process.env.DATABASE_URL!;
const surBaseDemo = new URL(url).pathname === "/barreau_pn_test";
const tsx = path.resolve("node_modules/tsx/dist/cli.mjs");
const COMPTES = ["batonnier@barreau-pn.cg", "sg@barreau-pn.cg", "tresoriere@barreau-pn.cg", "admin@barreau-pn.cg", "avocat.demo@demo.invalid"];

function demo(...args: string[]) {
  const r = spawnSync(process.execPath, [tsx, "prisma/demo.ts", ...args], { env: { ...process.env, DATABASE_URL: url }, encoding: "utf8", timeout: 120_000 });
  expect(r.status, r.stderr).toBe(0);
  return r.stdout;
}

/** Pour chaque compte : le mot de passe donné est-il accepté ? */
async function accepte(mdp: (email: string) => string) {
  const users = await prisma.user.findMany({ where: { email: { in: COMPTES } } });
  expect(users).toHaveLength(COMPTES.length);
  return Object.fromEntries(users.map((u) => [u.email, bcrypt.compareSync(mdp(u.email), u.passwordHash)]));
}
const tous = (v: boolean) => Object.fromEntries(COMPTES.map((e) => [e, v]));

/** Mots de passe affichés par le script, une ligne « email  mot-de-passe » par compte. */
const affiches = (sortie: string) => {
  const lignes = sortie.split(/\r?\n/).map((l) => l.trim().split(/ +/));
  return Object.fromEntries(COMPTES.map((e) => [e, lignes.find((l) => l[0] === e)?.[1] ?? ""]));
};

describe.skipIf(!surBaseDemo)("npm run demo : mots de passe des comptes de démonstration (R1-4)", () => {
  let parametresAvant: unknown;

  afterAll(async () => {
    // Toujours rendre la base à la suite : mot de passe par défaut et Paramètres d'origine.
    if (!surBaseDemo) return;
    spawnSync(process.execPath, [tsx, "prisma/demo.ts", "--mots-de-passe-defaut"], { env: { ...process.env, DATABASE_URL: url }, timeout: 120_000 });
    if (parametresAvant !== undefined) await prisma.parametres.update({ where: { id: 1 }, data: { data: parametresAvant as object } });
  }, 240_000);

  it("--mots-de-passe-aleatoires retire « barreau », --mots-de-passe-defaut le rétablit", async () => {
    const sortie = demo("--mots-de-passe-aleatoires");
    const mdp = affiches(sortie);
    expect(new Set(Object.values(mdp)).size).toBe(COMPTES.length); // 5 mots de passe distincts et non vides
    expect(Object.values(mdp)).not.toContain("");
    expect(Object.values(mdp)).not.toContain("barreau");
    expect(await accepte(() => "barreau")).toEqual(tous(false));
    expect(await accepte((e) => mdp[e])).toEqual(tous(true));

    const sortie2 = demo("--mots-de-passe-defaut");
    expect(Object.values(affiches(sortie2))).toEqual(COMPTES.map(() => "")); // aucun mot de passe affiché
    expect(await accepte(() => "barreau")).toEqual(tous(true));
  }, 240_000);

  it("--identite=demonstration seule impose des mots de passe aléatoires ; --identite=pointe-noire rétablit le défaut", async () => {
    parametresAvant = (await prisma.parametres.findUnique({ where: { id: 1 } }))?.data;
    demo("--identite=demonstration");
    expect(await accepte(() => "barreau")).toEqual(tous(false));
    demo("--identite=pointe-noire");
    expect(await accepte(() => "barreau")).toEqual(tous(true));
  }, 240_000);
});

describe("npm run demo : options de mot de passe incompatibles (R1-4)", () => {
  it("refuse les deux options ensemble, avant toute connexion", () => {
    const r = spawnSync(process.execPath, [tsx, "prisma/demo.ts", "--mots-de-passe-aleatoires", "--mots-de-passe-defaut"], {
      env: { ...process.env, DATABASE_URL: "postgresql://x:y@127.0.0.1:1/barreau_pn?schema=public" }, encoding: "utf8", timeout: 60_000,
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("incompatibles");
  });
});
