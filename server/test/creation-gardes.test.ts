import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * O11 (M-20261011) — garde de création partagée (refusCreation) : POST /membres et la branche
 * création de l'import refusent, avec le même message, la création directe d'un membre omis,
 * suspendu, sorti (radié, décédé, démissionnaire, retraité, cessation) ou d'un stagiaire au
 * tableau (qualité STAGIAIRE + statut INSCRIT/HONORAIRE). L'inscription, l'omission et les
 * sanctions relèvent des organes de l'Ordre (loi 026-92 art. 8, 35, 36), pas d'une saisie du SG.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
let sg = "";
let numBase = 0;
const MARQUE = `TEST O11 ${Date.now()}`;

beforeAll(async () => {
  // Numéros très au-delà des plages des autres tests (base partagée, suites en parallèle) :
  // chaque ligne d'import est une création ; la simulation n'écrit rien.
  numBase = 1_500_000_000 + Math.floor(Math.random() * 400_000_000);
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
});
afterAll(async () => {
  await prisma.membre.deleteMany({ where: { nom: { startsWith: MARQUE } } });
});

// [statut API, libellé d'import, qualité, code HTTP attendu (400 conservé pour RADIE/DECEDE)]
const CAS: [string, string, "AVOCAT" | "STAGIAIRE", number][] = [
  ["OMIS", "omis", "AVOCAT", 409],
  ["SUSPENDU", "suspendu", "AVOCAT", 409],
  ["RADIE", "radié", "AVOCAT", 400],
  ["DECEDE", "décédé", "AVOCAT", 400],
  ["DEMISSIONNAIRE", "démissionnaire", "AVOCAT", 409],
  ["RETRAITE", "retraité", "AVOCAT", 409],
  ["CESSATION", "cessation", "AVOCAT", 409],
  ["INSCRIT", "inscrit", "STAGIAIRE", 409],
  ["HONORAIRE", "honoraire", "STAGIAIRE", 409],
];

describe("O11 — création directe : mêmes gardes pour POST /membres et l'import", () => {
  it.each(CAS)("statut %s (import « %s », qualité %s) refusé avec le message de l'import", async (statut, libelle, qualite, code) => {
    const nom = `${MARQUE} ${statut} ${qualite}`;
    const r = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom, qualite, statut });
    expect(r.status).toBe(code);
    // Simulation : aucune écriture, mêmes gardes.
    const num = numBase + CAS.findIndex((c) => c[0] === statut && c[2] === qualite);
    const imp = await request(app).post("/api/membres/import?simulation=1").set(...bearer(sg))
      .send({ membres: [{ num, nom, qualite: qualite.toLowerCase(), statut: libelle }] });
    expect(imp.status).toBe(200);
    expect(imp.body.crees).toBe(0);
    expect(imp.body.erreurs).toHaveLength(1);
    expect(r.body.erreur).toBe(imp.body.erreurs[0].message);
    expect(await prisma.membre.count({ where: { nom } })).toBe(0);
  });

  it("création valide (AVOCAT, INSCRIT) toujours acceptée ; un stagiaire sans statut est créé STAGIAIRE", async () => {
    const a = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `${MARQUE} Valide`, qualite: "AVOCAT", statut: "INSCRIT" });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ qualite: "AVOCAT", statut: "INSCRIT" });
    const s = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `${MARQUE} Stagiaire`, qualite: "STAGIAIRE" });
    expect(s.status).toBe(201);
    expect(s.body).toMatchObject({ qualite: "STAGIAIRE", statut: "STAGIAIRE" });
  });
});
