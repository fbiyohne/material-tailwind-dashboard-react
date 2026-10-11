import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * R1-6 (revue) — POST /discipline/:id/decision est atomique et protégé contre la concurrence :
 * - deux soumissions simultanées (double clic, deux onglets) : un 200, un 409, un seul événement ;
 * - si l'effet échoue (radiation d'un avocat décédé), rien n'est écrit sur le dossier.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const login = async (email: string) => (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;
const marque = `R16-${Date.now()}`;
let sg = "", bat = "";
const membres: number[] = [];
const dossiers: number[] = [];

const preparer = async (nom: string) => {
  const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `${marque} ${nom}`, qualite: "AVOCAT" });
  expect(m.status).toBe(201);
  membres.push(m.body.id);
  const d = await request(app).post("/api/discipline").set(...bearer(sg)).send({ avocatNom: `Me ${marque}`, objet: "Manquement", membreId: m.body.id });
  expect(d.status).toBe(201);
  dossiers.push(d.body.id);
  return { membreId: m.body.id as number, id: d.body.id as number };
};
const decider = (id: number, corps: Record<string, unknown>) =>
  request(app).post(`/api/discipline/${id}/decision`).set(...bearer(bat)).send({ motivation: "Motivation suffisante de la décision du conseil.", ...corps });

beforeAll(async () => { [sg, bat] = await Promise.all([login("sg@barreau-pn.cg"), login("batonnier@barreau-pn.cg")]); });
afterAll(async () => {
  await prisma.dossierDisciplinaire.deleteMany({ where: { id: { in: dossiers } } });
  await prisma.membre.deleteMany({ where: { id: { in: membres } } });
});

describe("R1-6 — décision disciplinaire atomique", () => {
  it("deux POST /decision simultanés : un 200, un 409, un seul événement", async () => {
    const { membreId, id } = await preparer("Concurrence");
    const corps = { sanctionCode: "INTERDICTION_TEMPORAIRE", dureeMois: 3 };
    const statuts = (await Promise.all([decider(id, corps), decider(id, corps)])).map((r) => r.status).sort();
    expect(statuts).toEqual([200, 409]);
    expect(await prisma.evenementSituation.count({ where: { membreId, dossierId: id } })).toBe(1);
  });

  it("effet refusé (radiation d'un décédé) : 409 et dossier sans décision, resoumission possible", async () => {
    const { membreId, id } = await preparer("Decede");
    expect((await request(app).post(`/api/membres/${membreId}/deces`).set(...bearer(sg)).send({ dateDeces: "2026-01-02" })).status).toBe(200);
    expect((await decider(id, { sanctionCode: "RADIATION" })).status).toBe(409);
    const d = await prisma.dossierDisciplinaire.findUniqueOrThrow({ where: { id } });
    expect(d.sanctionCode).toBeNull();
    expect(d.statut).not.toBe("DECISION");
    expect((await decider(id, { sanctionCode: "AVERTISSEMENT" })).status).toBe(200);
  });
});
