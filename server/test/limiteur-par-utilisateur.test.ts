// R2-13 : le budget de requêtes d'un jeton valide est propre à l'utilisateur, pas à l'IP (salle derrière un seul NAT).
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";

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
});
