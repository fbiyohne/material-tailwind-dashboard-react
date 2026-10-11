import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * R1-7 (revue, D1, CA6) — POST /membres/:id/radier enregistre une radiation : il exige
 * l'action discipline_decider (bâtonnier par défaut, ADMIN). Le SG, qui saisit et
 * instruit, reçoit 403 et la fiche ne change pas.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const login = async (email: string) =>
  (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;
const PREFIXE = "E2E R17";
let sg = "", bat = "", admin = "";
let num = 0, n = 0;

beforeAll(async () => {
  [sg, bat, admin] = await Promise.all(["sg@barreau-pn.cg", "batonnier@barreau-pn.cg", "admin@barreau-pn.cg"].map(login));
  num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 10;
});
afterAll(async () => {
  await prisma.membre.deleteMany({ where: { nom: { startsWith: PREFIXE } } });
});

const creer = () => prisma.membre.create({ data: { num: num + ++n, nom: `${PREFIXE} ${n}`, qualite: "AVOCAT", statut: "INSCRIT" } as never });
const radier = (id: number, jeton: string) =>
  request(app).post(`/api/membres/${id}/radier`).set(...bearer(jeton)).send({ dateRadiation: "2026-10-01", motifRadiation: "Décision du Conseil n° 17" });

describe("R1-7 — /radier réservé à discipline_decider", () => {
  it("SG sans discipline_decider : 403, statut inchangé, aucun événement", async () => {
    const m = await creer();
    expect((await radier(m.id, sg)).status).toBe(403);
    expect((await prisma.membre.findUnique({ where: { id: m.id } }))?.statut).toBe("INSCRIT");
    expect(await prisma.evenementSituation.count({ where: { membreId: m.id } })).toBe(0);
  });

  it("bâtonnier (discipline_decider) : 200, fiche en RADIE avec date et référence", async () => {
    const m = await creer();
    const r = await radier(m.id, bat);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ statut: "RADIE", motifRadiation: "Décision du Conseil n° 17" });
  });

  it("ADMIN : 200", async () => {
    const m = await creer();
    expect((await radier(m.id, admin)).status).toBe(200);
  });
});
