import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/** T12 : la copie ou le téléchargement d'un timbre est journalisé, pour son propriétaire seul. */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
let num = 0;
const membres: number[] = [];
const users: number[] = [];
let timbreId = 0;
let jetons: string[] = [];

beforeAll(async () => {
  num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 1;
  for (const i of [0, 1]) {
    const m = await prisma.membre.create({ data: { num: num + i, nom: `TEST COPIE ${num + i}`, qualite: "AVOCAT", statut: "INSCRIT" } as never });
    membres.push(m.id);
    const u = await prisma.user.create({ data: { nom: m.nom, email: `copie${num + i}@test.cg`, role: "AVOCAT", passwordHash: bcrypt.hashSync("barreau", 4), actif: true, membreId: m.id } });
    users.push(u.id);
    jetons.push((await request(app).post("/api/auth/login").send({ email: u.email, password: "barreau" })).body.token);
  }
  const numero = ((await prisma.timbre.aggregate({ _max: { numero: true } }))._max.numero ?? 0) + 1;
  timbreId = (await prisma.timbre.create({ data: { numero, code: `COPIE${num}`, membreId: membres[0], affaire: "A", montant: 15000 } })).id;
});

afterAll(async () => {
  await prisma.timbre.deleteMany({ where: { id: timbreId } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.membre.deleteMany({ where: { id: { in: membres } } });
});

describe("POST /espace/timbres/:id/usage", () => {
  it("le propriétaire crée une ligne JournalAudit", async () => {
    const avant = (await prisma.journalAudit.aggregate({ _max: { id: true } }))._max.id ?? 0;
    const r = await request(app).post(`/api/espace/timbres/${timbreId}/usage`).set(...bearer(jetons[0])).send({ mode: "copie" });
    expect(r.status).toBe(200);
    let l = null;
    for (let i = 0; i < 20 && !l; i++) {
      l = await prisma.journalAudit.findFirst({ where: { id: { gt: avant }, chemin: `/api/espace/timbres/${timbreId}/usage` } });
      if (!l) await new Promise((r) => setTimeout(r, 50));
    }
    expect(l?.action).toContain("copie");
  });
  it("un autre avocat reçoit 403 ; mode inconnu 400", async () => {
    expect((await request(app).post(`/api/espace/timbres/${timbreId}/usage`).set(...bearer(jetons[1])).send({ mode: "png" })).status).toBe(403);
    expect((await request(app).post(`/api/espace/timbres/${timbreId}/usage`).set(...bearer(jetons[0])).send({ mode: "x" })).status).toBe(400);
  });
});
