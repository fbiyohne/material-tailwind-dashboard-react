import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../src/prisma.js";

/**
 * Congrès (R1-13) : la démonstration se joue dans un schéma PostgreSQL vierge (`demo`) de
 * barreau_pn_test, jamais dans le schéma `public` partagé avec les suites (milliers de fixtures).
 * Ce test rejoue l'installation sur un schéma jetable `demo_vierge` : migrations, puis demo.ts
 * sans seed. Il vérifie que seules les données DEMO s'y trouvent, que les 4 comptes de l'Ordre
 * sont créés avec leur rôle et que la connexion SG fonctionne par l'API.
 */
const url = process.env.DATABASE_URL!;
const surBaseTest = new URL(url).pathname === "/barreau_pn_test";
const SCHEMA = "demo_vierge";
const urlVierge = (() => { const u = new URL(url); u.searchParams.set("schema", SCHEMA); return u.toString(); })();
const tsx = path.resolve("node_modules/tsx/dist/cli.mjs");
const env = { ...process.env, DATABASE_URL: urlVierge };
/** Empreinte des membres du schéma public (nombre, id maximal, md5 des lignes complètes). */
const horsDemo = () =>
  prisma.$queryRawUnsafe(`SELECT count(*)::int AS n, max(id)::int AS max, md5(string_agg(m::text, '|' ORDER BY id)) AS h FROM "Membre" m`);

describe.skipIf(!surBaseTest)("npm run demo sur un schéma vierge, sans seed (R1-13)", () => {
  let vierge: PrismaClient;
  let sortie = "";
  let horsDemoAvant: unknown;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`); // schéma jetable de ce test uniquement
    horsDemoAvant = await horsDemo();
    execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
    const r = spawnSync(process.execPath, [tsx, "prisma/demo.ts", "--identite=demonstration", "--mots-de-passe-defaut"], { env, encoding: "utf8", timeout: 600_000 });
    expect(r.status, r.stderr).toBe(0);
    sortie = r.stdout;
    vierge = new PrismaClient({ datasources: { db: { url: urlVierge } } });
  }, 900_000);

  afterAll(async () => {
    await vierge?.$disconnect();
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  });

  it("le schéma ne contient que les membres DEMO (aucun reste de test, aucun numéro négatif)", async () => {
    expect(await vierge.membre.count({ where: { NOT: { num: { gte: 800001, lte: 800200 } } } })).toBe(0);
    expect(await vierge.membre.count({ where: { qualite: "AVOCAT", statut: "INSCRIT" } })).toBe(64);
    expect(await vierge.membre.count({ where: { qualite: "STAGIAIRE" } })).toBe(15);
    expect(await vierge.cabinet.count()).toBe(10);
    expect(await vierge.timbre.count()).toBe(12);
    expect(sortie).toContain("EFFECTIFS");
    // Le schéma public de barreau_pn_test n'est pas touché par l'installation dans le schéma vierge.
    expect(await horsDemo()).toEqual(horsDemoAvant);
  });

  it("les clés étrangères de EvenementSituation et le trigger du journal existent dans le schéma (migrations rejouées hors public)", async () => {
    const [fk] = await vierge.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM pg_constraint WHERE contype = 'f' AND conrelid = '"${SCHEMA}"."EvenementSituation"'::regclass`);
    expect(fk.n).toBe(3);
    const [tg] = await vierge.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'journal_audit_immuable' AND tgrelid = '"${SCHEMA}"."JournalAudit"'::regclass`);
    expect(tg.n).toBe(1);
  });

  it("crée les 4 comptes de l'Ordre avec leur rôle (upsert create) et l'identité de démonstration", async () => {
    const attendus = { "batonnier@barreau-pn.cg": "BATONNIER", "sg@barreau-pn.cg": "SECRETAIRE_GENERAL", "tresoriere@barreau-pn.cg": "TRESORIERE", "admin@barreau-pn.cg": "ADMIN" };
    for (const [email, role] of Object.entries(attendus)) {
      const u = await vierge.user.findUniqueOrThrow({ where: { email } });
      expect(u, email).toMatchObject({ role, actif: true });
      expect(u.nom).toMatch(/\(démonstration\)$/);
      expect(bcrypt.compareSync("barreau", u.passwordHash), email).toBe(true);
    }
    const p = await vierge.parametres.findUniqueOrThrow({ where: { id: 1 } });
    expect((p.data as { identite?: { denomination?: string } }).identite?.denomination).toBe("Barreau de démonstration");
  });

  it("la connexion SG fonctionne par l'API sur ce schéma", () => {
    const script = `import request from "supertest"; import { creerApp } from "./src/app.ts";
      const r = await request(creerApp()).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" });
      console.log("STATUT", r.status, r.body?.user?.role ?? ""); process.exit(0);`;
    const r = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { env: { ...env, NODE_ENV: "test", JWT_SECRET: "test-secret" }, encoding: "utf8", timeout: 120_000 });
    expect(r.stdout, r.stderr).toMatch(/STATUT 200 SECRETAIRE_GENERAL/);
  });
});
