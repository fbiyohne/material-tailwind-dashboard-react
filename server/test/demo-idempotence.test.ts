import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { prisma } from "../src/prisma.js";

/**
 * Jeu de démonstration (T25, CA15) : preuve versionnée de l'idempotence et du
 * cloisonnement. Deux exécutions de prisma/demo.ts donnent la même ligne EFFECTIFS,
 * et les membres hors plage DEMO (num 800001 à 800200) restent identiques, colonne
 * par colonne (empreinte md5 des lignes complètes, avant / après).
 * Ne tourne que si la base de test est exactement barreau_pn_test (seule base
 * acceptée par le garde-fou du script).
 */
const url = process.env.DATABASE_URL!;
const surBaseDemo = new URL(url).pathname === "/barreau_pn_test";
const tsx = path.resolve("node_modules/tsx/dist/cli.mjs");

function demo() {
  const r = spawnSync(process.execPath, [tsx, "prisma/demo.ts"], { env: { ...process.env, DATABASE_URL: url }, encoding: "utf8", timeout: 240_000 });
  expect(r.status, r.stderr).toBe(0);
  const ligne = r.stdout.split("\n").find((l) => l.startsWith("EFFECTIFS "));
  expect(ligne).toBeTruthy();
  return JSON.parse(ligne!.slice("EFFECTIFS ".length));
}

/** Requête de comptage des membres hors DEMO : nombre, id maximal, empreinte des lignes complètes. */
const horsDemo = () =>
  prisma.$queryRawUnsafe<{ n: number; max: number; h: string }[]>(
    `SELECT count(*)::int AS n, max(id)::int AS max, md5(string_agg(m::text, '|' ORDER BY id)) AS h
       FROM "Membre" m WHERE num NOT BETWEEN 800001 AND 800200`,
  );

describe.skipIf(!surBaseDemo)("npm run demo : idempotence et cloisonnement (CA15)", () => {
  it("deux exécutions donnent les mêmes effectifs et ne touchent aucun membre hors DEMO", async () => {
    const avant = await horsDemo();
    const e1 = demo();
    const e2 = demo();
    expect(e2).toEqual(e1);
    expect(await horsDemo()).toEqual(avant);

    // Contenu minimal du cahier (O6).
    const inscrits = e1.membres["AVOCAT/INSCRIT"];
    expect(inscrits).toBeGreaterThanOrEqual(60);
    expect(e1.membres["STAGIAIRE/STAGIAIRE"]).toBeGreaterThanOrEqual(15);
    expect(e1.membres["AVOCAT/RADIE"]).toBe(1);
    expect(e1.cabinets).toBe(10);
    expect(e1.dossiers).toBe(4);
    expect(e1.scrutins).toBe(1);
    expect(e1.fils).toBeGreaterThan(0);
    expect(e1.timbres).toBeGreaterThan(0);
    expect(e1.timbresExternes).toBeGreaterThan(0);
    expect(e1.recus).toBeGreaterThan(0);
  }, 600_000);
});
