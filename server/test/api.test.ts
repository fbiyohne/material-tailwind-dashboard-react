import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";

const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;

async function login(email: string) {
  const r = await request(app).post("/api/auth/login").send({ email, password: "barreau" });
  return r.body as { token: string; refreshToken: string };
}

let sg = "";
let tr = "";

beforeAll(async () => {
  sg = (await login("sg@barreau-pn.cg")).token;
  tr = (await login("tresoriere@barreau-pn.cg")).token;
});

describe("Authentification & sécurité", () => {
  it("rejette de mauvais identifiants (401)", async () => {
    const r = await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "faux" });
    expect(r.status).toBe(401);
  });

  it("login renvoie un access et un refresh token", async () => {
    const r = await login("sg@barreau-pn.cg");
    expect(r.token).toBeTruthy();
    expect(r.refreshToken).toBeTruthy();
  });

  it("refuse l'accès sans jeton (401)", async () => {
    const r = await request(app).get("/api/membres");
    expect(r.status).toBe(401);
  });

  it("rotation du refresh token : l'ancien est révoqué", async () => {
    const { refreshToken } = await login("sg@barreau-pn.cg");
    const r1 = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.token).toBeTruthy();
    const r2 = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(r2.status).toBe(401);
  });
});

describe("Cycle financier — règles métier (BR-01, BR-03, RBAC)", () => {
  const annee = 2026;
  let membreId = 0;

  it("inscrit un avocat (SG)", async () => {
    const r = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `TEST Vitest ${Date.now()}`, qualite: "AVOCAT" });
    expect(r.status).toBe(201);
    expect(r.body.numInscription).toMatch(/^PN-/);
    membreId = r.body.id;
  });

  it("BR-01 : quitus bloqué si non à jour (409)", async () => {
    const r = await request(app).post("/api/quitus").set(...bearer(sg)).send({ membreId, annee });
    expect(r.status).toBe(409);
  });

  it("BR-03 : un paiement émet un reçu et met la cotisation à jour", async () => {
    const r = await request(app).post("/api/cotisations/paiement").set(...bearer(sg)).send({ membreId, annee, montant: 150000, mode: "Espèces" });
    expect(r.status).toBe(201);
    expect(r.body.recu.numero).toBeTruthy();
    const c = await request(app).get(`/api/cotisations?annee=${annee}`).set(...bearer(sg));
    const ligne = c.body.lignes.find((l: any) => l.membre.id === membreId);
    expect(ligne.statut).toBe("ajour");
  });

  it("RBAC : le Secrétaire Général ne peut pas valider (403)", async () => {
    const r = await request(app).post(`/api/cotisations/${membreId}/valider`).set(...bearer(sg)).send({ annee });
    expect(r.status).toBe(403);
  });

  it("la Trésorière valide la situation (200)", async () => {
    const r = await request(app).post(`/api/cotisations/${membreId}/valider`).set(...bearer(tr)).send({ annee });
    expect(r.status).toBe(200);
    expect(r.body.valideTresoriere).toBe(true);
  });

  it("BR-01 : quitus délivré après validation (201)", async () => {
    const r = await request(app).post("/api/quitus").set(...bearer(sg)).send({ membreId, annee });
    expect(r.status).toBe(201);
    expect(r.body.numero).toMatch(/^Q-2026-/);
  });
});

describe("Discipline — accès restreint (RG-13)", () => {
  it("interdit l'accès à la Trésorière (403)", async () => {
    const r = await request(app).get("/api/discipline").set(...bearer(tr));
    expect(r.status).toBe(403);
  });
  it("autorise l'accès au Secrétaire Général (200)", async () => {
    const r = await request(app).get("/api/discipline").set(...bearer(sg));
    expect(r.status).toBe(200);
  });
});
