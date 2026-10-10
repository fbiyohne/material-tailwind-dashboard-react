import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

// T16 — import idempotent des timbres externes (dispositif MTN), statistiques, vérification publique anonyme.
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const PRE = `T16-${Date.now()}-`;
const ANNEE = 2031; // année isolée : aucune autre donnée de test
let sg = "";
let membreId = 0;
const codes: string[] = [];

const lignes = [
  { reference: `${PRE}1`, date: "2031-01-10", montant: 15000, canal: "MTN", avocatNom: "FICTIF Un" },
  { reference: `${PRE}2`, date: "2031-01-20", montant: 15000, canal: "MTN" },
  { reference: `${PRE}3`, date: "2031-03-05", montant: 15000, canal: "AIRTEL" },
];

beforeAll(async () => {
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  const num = 970000 + Math.floor(Math.random() * 20000);
  membreId = (await prisma.membre.create({ data: { num, nom: `TIMBRE EXT ${num}`, qualite: "AVOCAT" } as never })).id;
});

afterAll(async () => {
  await prisma.timbreExterne.deleteMany({ where: { reference: { startsWith: PRE } } });
  await prisma.timbre.deleteMany({ where: { membreId } });
  await prisma.membre.deleteMany({ where: { id: membreId } });
});

describe("Timbres externes", () => {
  it("importer 2 fois le même fichier laisse le même nombre de lignes", async () => {
    const r1 = await request(app).post("/api/timbres/externes").set(...bearer(sg)).send({ lignes });
    expect(r1.status).toBe(201);
    expect(r1.body).toMatchObject({ importes: 3, doublons: 0 });
    const r2 = await request(app).post("/api/timbres/externes").set(...bearer(sg)).send({ lignes });
    expect(r2.body).toMatchObject({ importes: 0, doublons: 3 });
    expect(await prisma.timbreExterne.count({ where: { reference: { startsWith: PRE } } })).toBe(3);
  });

  it("refuse un fichier invalide (400) et l'accès sans jeton (401)", async () => {
    const mauvais = [{ reference: "", date: "n'importe quoi", montant: -1, canal: "" }];
    expect((await request(app).post("/api/timbres/externes").set(...bearer(sg)).send({ lignes: mauvais })).status).toBe(400);
    expect((await request(app).post("/api/timbres/externes").send({ lignes })).status).toBe(401);
  });

  it("les statistiques ventilent par mois et par canal, internes et externes", async () => {
    const t = await prisma.timbre.create({
      data: { numero: 970000000 + Math.floor(Math.random() * 1e6), code: `T16${Date.now()}`, membreId, affaire: "A", montant: 15000, canal: "MTN", createdAt: new Date("2031-01-15T10:00:00Z") },
    });
    codes.push(t.code);
    const r = await request(app).get(`/api/timbres/stats?annee=${ANNEE}`).set(...bearer(sg));
    expect(r.status).toBe(200);
    const l = r.body.lignes as { mois: number; canal: string; source: string; nombre: number; montant: number }[];
    const trouve = (mois: number, canal: string, source: string) => l.find((x) => x.mois === mois && x.canal === canal && x.source === source);
    expect(trouve(1, "MTN", "externe")).toMatchObject({ nombre: 2, montant: 30000 });
    expect(trouve(3, "AIRTEL", "externe")).toMatchObject({ nombre: 1, montant: 15000 });
    expect(trouve(1, "MTN", "interne")).toMatchObject({ nombre: 1, montant: 15000 });
    expect(l).toHaveLength(3);
    expect((await request(app).get("/api/timbres/stats?annee=abc").set(...bearer(sg))).status).toBe(400);
  });
});

describe("Vérification publique d'un timbre", () => {
  it("ne renvoie ni le nom de l'avocat ni sa personne : numéro, date et validité", async () => {
    const t = await prisma.timbre.findFirstOrThrow({ where: { membreId } });
    const v = await request(app).get(`/api/verifier/timbre/${t.code}`);
    expect(v.status).toBe(200);
    expect(v.body.valide).toBe(true);
    expect(JSON.stringify(v.body)).not.toContain("TIMBRE EXT");
    expect(v.body.beneficiaire).toBeUndefined();
    expect(v.body.numero).toBe(String(t.numero));
    expect(v.body.date).toBeTruthy();
  });
});
