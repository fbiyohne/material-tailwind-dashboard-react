import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/** Secret professionnel (R-58) : un ADMIN qui touche un compte à rôle habilité alerte le titulaire et le SG. Base barreau_pn_test. */
const app = creerApp({ anonyme: 100_000, authentifie: 100_000 });
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const SUF = String(Date.now());
const email = (k: string) => `e2e-alerte-${k}-${SUF}@test.cg`;
let adm = "", sg = "", sgId = 0, batId = 0, tresId = 0;

const login = async (e: string) => (await request(app).post("/api/auth/login").send({ email: e, password: "barreau" })).body.token as string;
const nbAlertes = (userId: number) => prisma.notification.count({ where: { userId, type: "securite", message: { contains: SUF } } });

beforeAll(async () => {
  adm = await login("admin@barreau-pn.cg");
  sg = await login("sg@barreau-pn.cg");
  sgId = (await prisma.user.findUniqueOrThrow({ where: { email: "sg@barreau-pn.cg" } })).id;
  const h = bcrypt.hashSync("barreau", 4);
  batId = (await prisma.user.create({ data: { nom: `Bat ${SUF}`, email: email("bat"), role: "BATONNIER", passwordHash: h } })).id;
  tresId = (await prisma.user.create({ data: { nom: `Tres ${SUF}`, email: email("tres"), role: "TRESORIERE", passwordHash: h } })).id;
}, 60_000);

afterAll(async () => {
  const us = await prisma.user.findMany({ where: { email: { contains: `-${SUF}@test.cg` } }, select: { id: true } });
  await prisma.notification.deleteMany({ where: { message: { contains: SUF } } });
  await prisma.user.deleteMany({ where: { id: { in: us.map((u) => u.id) } } });
});

describe("alerte sur rôle habilité", () => {
  it("reset du mot de passe d'un Bâtonnier par l'ADMIN : alerte au titulaire et au SG", async () => {
    const av = await nbAlertes(sgId);
    const r = await request(app).post(`/api/users/${batId}/password`).set(...bearer(adm)).send({ password: "nouveaumdp88" });
    expect(r.status).toBe(200);
    expect(await nbAlertes(batId)).toBe(1);
    expect(await nbAlertes(sgId)).toBe(av + 1);
  });

  it("création d'un SA par l'ADMIN : alerte ; pas d'alerte pour une Trésorière ni quand c'est le SG qui agit", async () => {
    const c = await request(app).post("/api/users").set(...bearer(adm)).send({ nom: `SA ${SUF}`, email: email("sa"), role: "SECRETAIRE_ADJOINT", password: "motdepasse88" });
    expect(c.status).toBe(201);
    expect(await nbAlertes(c.body.id)).toBe(1);
    await request(app).post(`/api/users/${tresId}/password`).set(...bearer(adm)).send({ password: "nouveaumdp88" });
    expect(await nbAlertes(tresId)).toBe(0);
    await request(app).post(`/api/users/${c.body.id}/password`).set(...bearer(sg)).send({ password: "nouveaumdp88" });
    expect(await nbAlertes(c.body.id)).toBe(1);
  });

  it("promotion d'une Trésorière en SG par l'ADMIN : alerte", async () => {
    const r = await request(app).patch(`/api/users/${tresId}`).set(...bearer(adm)).send({ role: "SECRETAIRE_GENERAL" });
    expect(r.status).toBe(200);
    expect(await nbAlertes(tresId)).toBe(1);
  });
});
