// R2-13 : le budget de requêtes d'un jeton valide est propre à l'utilisateur, pas à l'IP (salle derrière un seul NAT).
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { creerApp } from "../src/app.js";
import { env } from "../src/env.js";

const app = creerApp();
async function jeton(email: string) {
  return (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;
}

describe("Limiteur par utilisateur (R2-13)", () => {
  let sg: string, tr: string;
  beforeAll(async () => { sg = await jeton("sg@barreau-pn.cg"); tr = await jeton("tresoriere@barreau-pn.cg"); });

  it("un utilisateur qui épuise sa limite ne bloque pas un autre utilisateur de la même IP", async () => {
    const p = creerApp({ anonyme: 5, authentifie: 2 });
    const get = (t: string) => request(p).get("/api/membres").set("Authorization", `Bearer ${t}`);
    await get(sg); await get(sg);
    expect((await get(sg)).status).toBe(429);
    expect((await get(tr)).status).toBe(200);
  });

  // Cause racine du constat QA (balayage de 54 pages, 429 pendant 13 min après ~600 requêtes) :
  // le jeton d'accès (15 min) expirait en cours de balayage ; un jeton expiré était compté comme
  // anonyme (600 / 15 min, compteur de l'IP déjà chargé) et recevait 429 au lieu de 401, donc le
  // SPA ne rafraîchissait jamais sa session et restait bloqué jusqu'à la fin de la fenêtre.
  it("jeton expiré mais authentique : 401 (rafraîchissement possible), jamais 429 sur le budget anonyme", async () => {
    const p = creerApp({ anonyme: 2, authentifie: 50 });
    const { sub, role, tv } = jwt.decode(sg) as { sub: number; role: string; tv: number };
    for (let i = 0; i < 3; i++) expect((await request(p).get("/api/membres").set("Authorization", `Bearer ${sg}`)).status).toBe(200);
    const expire = jwt.sign({ sub, role, tv, exp: Math.floor(Date.now() / 1000) - 60 }, env.jwtSecret, { algorithm: "HS256" });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await request(p).get("/api/membres").set("Authorization", `Bearer ${expire}`)).status);
    expect(codes).toEqual([401, 401, 401, 401, 401]);
    // Le rafraîchissement (anonyme) reste possible : il ne partage pas le compteur de l'utilisateur.
    expect((await request(p).post("/api/auth/refresh").send({ refreshToken: "inconnu" })).status).not.toBe(429);
  });

  it("jeton forgé (mauvaise signature) : reste au budget anonyme", async () => {
    const p = creerApp({ anonyme: 2, authentifie: 50 });
    const faux = jwt.sign({ sub: 1, role: "ADMIN", tv: 0 }, "pas-le-secret", { algorithm: "HS256" });
    const codes: number[] = [];
    for (let i = 0; i < 3; i++) codes.push((await request(p).get("/api/membres").set("Authorization", `Bearer ${faux}`)).status);
    expect(codes).toEqual([401, 401, 429]);
  });

  // Reprise QA : le budget anonyme de l'IP est saturé par les autres postes de la salle (NAT) ;
  // le rafraîchissement d'une session authentique ne doit pas en dépendre (sinon le SG est éjecté).
  it("budget anonyme saturé : POST /auth/refresh avec un refresh token valide répond 200", async () => {
    const p = creerApp({ anonyme: 2, authentifie: 50 });
    const { refreshToken } = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body;
    await request(p).get("/api/membres");
    await request(p).get("/api/membres");
    expect((await request(p).get("/api/membres")).status).toBe(429);
    const r = await request(p).post("/api/auth/refresh").send({ refreshToken });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
  });
});
