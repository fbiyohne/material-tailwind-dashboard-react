import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * R1-5 — PATCH /membres/:id et l'import ne contournent ni le circuit d'omission
 * (POST /:id/evenements OMISSION/REINSCRIPTION, CA7) ni la validation du stage
 * (POST /:id/valider-stage, X-04, R-42).
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const PREFIXE = "E2E R15";
let sg = "", admin = "";
let num = 0;

beforeAll(async () => {
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  admin = (await request(app).post("/api/auth/login").send({ email: "admin@barreau-pn.cg", password: "barreau" })).body.token;
  num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 10;
});
afterAll(async () => {
  await prisma.membre.deleteMany({ where: { nom: { startsWith: PREFIXE } } });
});

let n = 0;
const creer = (data: Record<string, unknown>) =>
  prisma.membre.create({ data: { num: num + ++n, nom: `${PREFIXE} ${n}`, qualite: "AVOCAT", statut: "INSCRIT", ...data } as never });
const patch = (id: number, corps: object) => request(app).patch(`/api/membres/${id}`).set(...bearer(sg)).send(corps);

describe("R1-5 — PATCH ne contourne ni l'omission ni la validation du stage", () => {
  it("SG PATCH statut OMIS d'un inscrit : 409, renvoi vers l'omission, statut inchangé", async () => {
    const m = await creer({});
    const r = await patch(m.id, { statut: "OMIS" });
    expect(r.status).toBe(409);
    expect(r.body.erreur).toMatch(/omission/i);
    expect((await prisma.membre.findUnique({ where: { id: m.id } }))?.statut).toBe("INSCRIT");
  });

  it("SG PATCH d'un omis vers INSCRIT : 409 (réinscription par le circuit)", async () => {
    const m = await creer({ statut: "OMIS" });
    const r = await patch(m.id, { statut: "INSCRIT" });
    expect(r.status).toBe(409);
    expect(r.body.erreur).toMatch(/r[ée]inscription/i);
    expect((await prisma.membre.findUnique({ where: { id: m.id } }))?.statut).toBe("OMIS");
  });

  it("PATCH qualite AVOCAT / statut INSCRIT d'un stagiaire : SG 403 (sans stage_valider), ADMIN 409 (valider-stage), stagiaire inchangé", async () => {
    const m = await creer({ qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    for (const corps of [{ qualite: "AVOCAT", statut: "INSCRIT" }, { qualite: "AVOCAT" }, { statut: "INSCRIT" }]) {
      expect((await patch(m.id, corps)).status, JSON.stringify(corps)).toBe(403);
      const r = await request(app).patch(`/api/membres/${m.id}`).set(...bearer(admin)).send(corps);
      expect(r.status, JSON.stringify(corps)).toBe(409);
      expect(r.body.erreur).toMatch(/fin de stage/i);
    }
    expect(await prisma.membre.findUnique({ where: { id: m.id } })).toMatchObject({ qualite: "STAGIAIRE", statut: "STAGIAIRE" });
  });

  it("restent permis : SUSPENDU par PATCH avec discipline_decider (R1-1 : ADMIN), et la fiche d'un omis ou d'un stagiaire sans changement de situation", async () => {
    const a = await creer({});
    expect((await request(app).patch(`/api/membres/${a.id}`).set(...bearer(admin)).send({ statut: "SUSPENDU" })).status).toBe(200);
    const o = await creer({ statut: "OMIS" });
    expect((await patch(o.id, { statut: "OMIS", cabinet: "Cab R15" })).status).toBe(200);
    const s = await creer({ qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    expect((await patch(s.id, { qualite: "STAGIAIRE", statut: "STAGIAIRE", cabinet: "Cab R15" })).status).toBe(200);
  });
});

describe("R1-5 — l'import ne fait ni omission ni réinscription", () => {
  const importer = (membres: unknown[]) => request(app).post("/api/membres/import").set(...bearer(sg)).send({ membres });

  it("« omis » sur un inscrit existant : erreur de ligne, statut inchangé", async () => {
    const m = await creer({});
    const r = await importer([{ num: m.num, nom: m.nom, statut: "omis" }]);
    expect(r.body.maj).toBe(0);
    expect(r.body.erreurs).toHaveLength(1);
    expect(r.body.erreurs[0].message).toMatch(/omission/i);
    expect((await prisma.membre.findUnique({ where: { id: m.id } }))?.statut).toBe("INSCRIT");
  });

  it("« inscrit » sur un omis existant : erreur de ligne ; « omis » sur un omis (aller-retour) : accepté", async () => {
    const m = await creer({ statut: "OMIS" });
    const r = await importer([{ num: m.num, nom: m.nom, statut: "inscrit" }]);
    expect(r.body.erreurs).toHaveLength(1);
    expect((await prisma.membre.findUnique({ where: { id: m.id } }))?.statut).toBe("OMIS");
    expect((await importer([{ num: m.num, nom: m.nom, statut: "omis" }])).body).toMatchObject({ maj: 1, erreurs: [] });
  });
});

describe("R1-5 (reprise QA) — l'import ne fait passer aucun stagiaire au tableau ni ne crée d'omis", () => {
  const importer = (membres: unknown[], qualiteDefaut?: string, q = "") =>
    request(app).post(`/api/membres/import${q}`).set(...bearer(sg)).send({ membres, qualiteDefaut });
  const lire = (id: number) => prisma.membre.findUnique({ where: { id } });
  // num loin du max : la base de test est partagée, un POST /membres concurrent prend max+1.
  const creer = (data: Record<string, unknown>) =>
    prisma.membre.create({ data: { num: num + 5000 + ++n, nom: `${PREFIXE} ${n}`, qualite: "AVOCAT", statut: "INSCRIT", ...data } as never });

  it("(a) stagiaire importé {avocat, inscrit} ou {stagiaire, honoraire} : erreur de ligne, simulation comprise, stagiaire inchangé", async () => {
    const s = await creer({ qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    for (const ligne of [{ qualite: "avocat", statut: "inscrit" }, { qualite: "stagiaire", statut: "honoraire" }, { qualite: "honoraire" }]) {
      for (const q of ["?simulation=1", ""]) {
        const r = await importer([{ num: s.num, nom: s.nom, ...ligne }], undefined, q);
        expect(r.body.maj, JSON.stringify(ligne) + q).toBe(0);
        expect(r.body.erreurs[0]?.message).toMatch(/Valider la fin de stage/);
      }
    }
    expect(await lire(s.id)).toMatchObject({ qualite: "STAGIAIRE", statut: "STAGIAIRE" });
  });

  it("(b) sans colonne qualité, la qualité d'un membre existant n'est jamais réécrite par la qualité par défaut de la page", async () => {
    const s = await creer({ qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    await importer([{ num: s.num, nom: s.nom }], "AVOCAT"); // page « Avocats inscrits »
    expect(await lire(s.id)).toMatchObject({ qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    const a = await creer({});
    const r = await importer([{ num: a.num, nom: a.nom, cabinet: "Cab R15b" }], "STAGIAIRE"); // page « Avocats stagiaires »
    expect(r.body).toMatchObject({ maj: 1, erreurs: [] });
    expect(await lire(a.id)).toMatchObject({ qualite: "AVOCAT", statut: "INSCRIT", cabinet: "Cab R15b" });
  });

  it("(c) création par import d'un membre « omis » : erreur de ligne, simulation comprise, aucun membre créé", async () => {
    const nouveau = num + 5900;
    for (const q of ["?simulation=1", ""]) {
      const r = await importer([{ num: nouveau, nom: `${PREFIXE} omis neuf`, statut: "omis" }], undefined, q);
      expect(r.body.crees, q).toBe(0);
      expect(r.body.erreurs[0]?.message).toMatch(/omission/i);
    }
    expect(await prisma.membre.count({ where: { num: nouveau } })).toBe(0);
  });
});

describe("R1-5 (reprise QA 2) — aucun stagiaire au tableau (inscrit, honoraire) hors valider-stage", () => {
  const importer = (membres: unknown[], q = "") => request(app).post(`/api/membres/import${q}`).set(...bearer(sg)).send({ membres });
  const lire = (id: number) => prisma.membre.findUnique({ where: { id } });
  const creer = (data: Record<string, unknown>) =>
    prisma.membre.create({ data: { num: num + 6000 + ++n, nom: `${PREFIXE} ${n}`, qualite: "AVOCAT", statut: "INSCRIT", ...data } as never });

  it("PATCH {statut: HONORAIRE} ou {qualite: HONORAIRE} d'un stagiaire : SG 403, ADMIN 409, stagiaire inchangé", async () => {
    const s = await creer({ qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    for (const corps of [{ statut: "HONORAIRE" }, { qualite: "HONORAIRE" }]) {
      expect((await patch(s.id, corps)).status, JSON.stringify(corps)).toBe(403);
      const r = await request(app).patch(`/api/membres/${s.id}`).set(...bearer(admin)).send(corps);
      expect(r.status, JSON.stringify(corps)).toBe(409);
      expect(r.body.erreur).toMatch(/fin de stage/i);
    }
    expect(await lire(s.id)).toMatchObject({ qualite: "STAGIAIRE", statut: "STAGIAIRE" });
  });

  it("import d'un nouveau membre {stagiaire, inscrit} ou {stagiaire, honoraire} : erreur de ligne, simulation comprise, aucun membre créé", async () => {
    const nouveau = num + 6900;
    for (const statut of ["inscrit", "honoraire"]) {
      for (const q of ["?simulation=1", ""]) {
        const r = await importer([{ num: nouveau, nom: `${PREFIXE} stagiaire neuf`, qualite: "stagiaire", statut }], q);
        expect(r.body.crees, statut + q).toBe(0);
        expect(r.body.erreurs[0]?.message).toMatch(/Valider la fin de stage/);
      }
    }
    expect(await prisma.membre.count({ where: { num: nouveau } })).toBe(0);
  });

  it("import qualité « stagiaire » sans colonne statut sur un avocat inscrit : erreur de ligne, avocat inchangé ; {stagiaire, stagiaire} reste permis", async () => {
    const a = await creer({});
    for (const q of ["?simulation=1", ""]) {
      const r = await importer([{ num: a.num, nom: a.nom, qualite: "stagiaire" }], q);
      expect(r.body.maj, q).toBe(0);
      expect(r.body.erreurs[0]?.message).toMatch(/Valider la fin de stage/);
    }
    expect(await lire(a.id)).toMatchObject({ qualite: "AVOCAT", statut: "INSCRIT" });
    expect((await importer([{ num: a.num, nom: a.nom, qualite: "stagiaire", statut: "stagiaire" }])).body).toMatchObject({ maj: 1, erreurs: [] });
    expect(await lire(a.id)).toMatchObject({ qualite: "STAGIAIRE", statut: "STAGIAIRE" });
  });
});
