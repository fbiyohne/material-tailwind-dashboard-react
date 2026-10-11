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

/**
 * R1-7 (reprise QA) — aucune autre voie : PATCH /membres/:id (« Modifier ») et l'import ne
 * permettent pas au SG d'enregistrer une radiation, ni de lever une radiation enregistrée.
 */
describe("R1-7 — PATCH et import ne contournent pas discipline_decider", () => {
  const patch = (id: number, jeton: string, b: object) => request(app).patch(`/api/membres/${id}`).set(...bearer(jeton)).send(b);
  const radiations = (membreId: number) => prisma.evenementSituation.count({ where: { membreId, type: "RADIATION" } });

  it("SG PATCH statut=RADIE : 403, statut inchangé, aucun événement RADIATION", async () => {
    const m = await creer();
    const r = await patch(m.id, sg, { statut: "RADIE", dateRadiation: "2026-10-01", motifRadiation: "Décision n° 18" });
    expect(r.status).toBe(403);
    expect(r.body.erreur).toMatch(/discipline_decider/);
    expect((await prisma.membre.findUnique({ where: { id: m.id } }))?.statut).toBe("INSCRIT");
    expect(await radiations(m.id)).toBe(0);
  });

  it("SG PATCH d'un radié vers le tableau : 403 ; correction de la date ou de la référence seule : 200", async () => {
    const m = await creer();
    expect((await radier(m.id, bat)).status).toBe(200);
    expect((await patch(m.id, sg, { statut: "INSCRIT" })).status).toBe(403);
    expect((await prisma.membre.findUnique({ where: { id: m.id } }))?.statut).toBe("RADIE");
    const r = await patch(m.id, sg, { motifRadiation: "Décision du Conseil n° 17 (rectifiée)" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ statut: "RADIE", motifRadiation: "Décision du Conseil n° 17 (rectifiée)" });
  });

  it("ADMIN PATCH statut=RADIE : 200 et événement RADIATION", async () => {
    const m = await creer();
    expect((await patch(m.id, admin, { statut: "RADIE", dateRadiation: "2026-10-01", motifRadiation: "Décision n° 19" })).status).toBe(200);
    expect(await radiations(m.id)).toBe(1);
  });

  it("SG import d'une ligne « radié » sur un inscrit : ligne en erreur, statut inchangé", async () => {
    const m = await creer();
    const r = await request(app).post("/api/membres/import").set(...bearer(sg)).send({ membres: [{ num: m.num, nom: m.nom, statut: "radié" }] });
    expect(r.status).toBe(200);
    expect(r.body.maj).toBe(0);
    expect(r.body.erreurs[0].message).toMatch(/statut de sortie/);
    expect((await prisma.membre.findUnique({ where: { id: m.id } }))?.statut).toBe("INSCRIT");
    expect(await radiations(m.id)).toBe(0);
  });
});
