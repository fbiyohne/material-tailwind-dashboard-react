import { describe, it, expect, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/prisma.js";

/**
 * T2 / CA14 — migrations de l'audit de conformité : additives, idempotentes,
 * rejouables deux fois de suite sur barreau_pn_test, et journal d'audit
 * non modifiable en base (trigger journal_audit_immuable).
 */
const url = process.env.DATABASE_URL!;
const racine = path.join(__dirname, "..");
const MIGRATIONS = [
  "20261010090000_enums_audit_conformite",
  "20261010090100_audit_conformite",
].map((m) => path.join(__dirname, "..", "prisma", "migrations", m, "migration.sql"));

afterAll(() => prisma.$disconnect());

describe("Migrations audit de conformité (CA14)", () => {
  it("cible exclusivement barreau_pn_test", () => {
    expect(new URL(url).pathname).toBe("/barreau_pn_test");
  });

  it("aucun DROP ni RENAME dans les nouveaux fichiers", () => {
    for (const f of MIGRATIONS) expect(readFileSync(f, "utf8")).not.toMatch(/DROP|RENAME/i);
  });

  it("les deux migrations se rejouent deux fois sans erreur", () => {
    for (let passe = 0; passe < 2; passe++)
      for (const f of MIGRATIONS)
        execSync(`npx prisma db execute --file "${f}" --url "${url}"`, { cwd: racine, stdio: "pipe" });
  }, 120000);

  it("le schéma Prisma correspond à la base après rejeu (aucune dérive)", () => {
    const diff = execSync(
      `npx prisma migrate diff --from-url "${url}" --to-schema-datamodel prisma/schema.prisma --exit-code`,
      { cwd: racine, stdio: "pipe" },
    ).toString();
    expect(diff).toMatch(/No difference|empty migration/i);
  }, 60000);

  it("JournalAudit : UPDATE et DELETE lèvent une exception", async () => {
    const ligne = await prisma.journalAudit.create({
      data: { action: "Test immuabilité (T2)", methode: "TEST", chemin: "/test/migrations", statut: 200 },
    });
    await expect(prisma.journalAudit.update({ where: { id: ligne.id }, data: { action: "falsifié" } })).rejects.toThrow(/non modifiable/);
    await expect(prisma.journalAudit.delete({ where: { id: ligne.id } })).rejects.toThrow(/non modifiable/);
    await expect(prisma.$executeRawUnsafe(`DELETE FROM "JournalAudit" WHERE id = ${ligne.id}`)).rejects.toThrow(/non modifiable/);
    expect((await prisma.journalAudit.findUnique({ where: { id: ligne.id } }))?.action).toBe("Test immuabilité (T2)");
  });

  it("nouvelles valeurs d'enum et nouvelles tables utilisables", async () => {
    await prisma.membre.deleteMany({ where: { num: 979_001 } });
    const m = await prisma.membre.create({ data: { num: 979_001, nom: "T2 Migration", qualite: "AVOCAT", statut: "DEMISSIONNAIRE" } });
    const e = await prisma.evenementSituation.create({
      data: { membreId: m.id, type: "DEMISSIONNAIRE", statutAvant: "INSCRIT", statutApres: "DEMISSIONNAIRE", dateEffet: new Date(), details: { test: true } },
    });
    expect(e.id).toBeGreaterThan(0);
    expect(m.updatedAt).toBeInstanceOf(Date);
    await prisma.membre.delete({ where: { id: m.id } }); // cascade sur EvenementSituation
    expect(await prisma.evenementSituation.count({ where: { id: e.id } })).toBe(0);
    const ref = `T2-TEST-${Date.now()}`;
    await prisma.timbreExterne.create({ data: { reference: ref, date: new Date(), montant: 1000, canal: "MTN" } });
    const r = await prisma.timbreExterne.createMany({ data: [{ reference: ref, date: new Date(), montant: 1000, canal: "MTN" }], skipDuplicates: true });
    expect(r.count).toBe(0); // référence unique : import idempotent
    await prisma.timbreExterne.delete({ where: { reference: ref } });
  });
});
