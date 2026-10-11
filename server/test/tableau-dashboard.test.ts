import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

// T17 — tableau daté (« Mis à jour le ») et tableau de bord ventilé par qualité.
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
let sg = "";
let membreId = 0;
const ANNEE = 2033; // exercice isolé

beforeAll(async () => {
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  // num au-delà du maximum présent : aucune collision avec les restes de barreau_pn_test (un tirage aléatoire sur 960000-989999 en rencontrait).
  const num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 960000) + 1;
  membreId = (await prisma.membre.create({ data: { num, nom: `TABLEAU DASH ${num}`, qualite: "STAGIAIRE", statut: "STAGIAIRE" } as never })).id;
});
afterAll(async () => { await prisma.membre.deleteMany({ where: { id: membreId } }); });

describe("Tableau daté", () => {
  it("miseAJour = plus récent updatedAt des membres présents, et change après modification", async () => {
    const avant = (await request(app).get("/api/tableau").set(...bearer(sg))).body;
    expect(avant.miseAJour).toBeTruthy();
    await new Promise((r) => setTimeout(r, 20));
    await prisma.membre.update({ where: { id: membreId }, data: { cabinet: "Cabinet T17" } });
    const apres = (await request(app).get("/api/tableau").set(...bearer(sg))).body;
    expect(new Date(apres.miseAJour).getTime()).toBeGreaterThan(new Date(avant.miseAJour).getTime());
    const max = await prisma.membre.aggregate({ _max: { updatedAt: true }, where: { statut: { notIn: ["RADIE", "DECEDE", "DEMISSIONNAIRE", "RETRAITE", "CESSATION"] } } });
    // Base partagée : d'autres écritures concurrentes peuvent survenir entre les deux lectures,
    // d'où un encadrement (notre modification <= date servie <= maximum relu) plutôt qu'une égalité.
    const nous = (await prisma.membre.findUniqueOrThrow({ where: { id: membreId }, select: { updatedAt: true } })).updatedAt;
    const servi = new Date(apres.miseAJour).getTime();
    expect(servi).toBeGreaterThanOrEqual(nous.getTime());
    expect(servi).toBeLessThanOrEqual(max._max.updatedAt!.getTime());
  });

  // Le PDF rend TOUT le tableau : sa durée croît avec le volume de barreau_pn_test (4 600+ inscrits
  // accumulés, PDF de 8 Mo : 5 à 12 s seul, plus de 30 s sous charge concurrente). Délai propre à ce test.
  it("le PDF reste généré", async () => {
    const r = await request(app).get("/api/tableau/pdf").set(...bearer(sg));
    expect(r.status).toBe(200);
  }, 120_000);
});

describe("Dashboard par qualité", () => {
  it("expose avocats et stagiaires (effectif, à jour, retardataires) sans retirer les anciens champs", async () => {
    const d = (await request(app).get(`/api/dashboard?annee=${ANNEE}`).set(...bearer(sg))).body;
    expect(d.membres).toEqual(expect.objectContaining({ inscrits: expect.any(Number), stagiaires: expect.any(Number), aJour: expect.any(Number), enRetard: expect.any(Number) }));
    expect(d.demographie.parQualite).toBeDefined();
    for (const q of ["avocats", "stagiaires"]) {
      expect(d.membres.parQualite[q]).toEqual({ effectif: expect.any(Number), aJour: expect.any(Number), enRetard: expect.any(Number) });
    }
    // Le stagiaire créé est actif, soumis à cotisation : il compte dans les stagiaires, pas dans les avocats.
    expect(d.membres.parQualite.stagiaires.effectif).toBe(d.membres.stagiaires);
    expect(d.membres.parQualite.avocats.effectif).toBe(d.membres.inscrits);
    expect(d.membres.parQualite.avocats.aJour + d.membres.parQualite.stagiaires.aJour).toBe(d.membres.aJour);
    expect(d.membres.parQualite.avocats.enRetard + d.membres.parQualite.stagiaires.enRetard).toBe(d.membres.enRetard);
  });
});

// R1-9 — l'omission retire du tableau (art. 35) ; la suspension y laisse l'avocat (décision de Me MENGA à confirmer).
describe("Tableau : omis exclus, suspendus conservés", () => {
  const ids: number[] = [];
  afterAll(async () => { await prisma.membre.deleteMany({ where: { id: { in: ids } } }); });
  it("un OMIS n'est ni dans le tableau ni dans son PDF ; un SUSPENDU y reste", async () => {
    const base = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 960000) + 1;
    const omis = await prisma.membre.create({ data: { num: base, nom: `R19 OMIS ${base}`, qualite: "AVOCAT", statut: "OMIS" } as never });
    const susp = await prisma.membre.create({ data: { num: base + 1, nom: `R19 SUSP ${base}`, qualite: "AVOCAT", statut: "SUSPENDU" } as never });
    ids.push(omis.id, susp.id);
    const r = await request(app).get("/api/tableau").set(...bearer(sg));
    const presents = new Set(r.body.sections.flatMap((s: { membres: { id: number }[] }) => s.membres.map((x) => x.id)));
    expect(presents.has(omis.id)).toBe(false);
    expect(presents.has(susp.id)).toBe(true);
  });
});
