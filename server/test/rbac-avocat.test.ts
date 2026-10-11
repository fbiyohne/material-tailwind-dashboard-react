import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * T17 (M-20261011, point 7) — le rôle Avocat figure dans « Rôles et sécurité »
 * en lecture seule (espace cloisonné) : GET /rbac l'expose, PUT /rbac le refuse.
 */
const app = creerApp();
const login = async (email: string) =>
  (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;

let sg = "", admin = "";
beforeAll(async () => {
  [sg, admin] = await Promise.all(["sg@barreau-pn.cg", "admin@barreau-pn.cg"].map(login));
});

describe("RBAC — rôle Avocat en lecture seule (T17)", () => {
  it("GET /rbac contient AVOCAT en lecture seule, hors des rôles éditables", async () => {
    const r = await request(app).get("/api/rbac").set("Authorization", `Bearer ${sg}`);
    expect(r.status).toBe(200);
    expect(r.body.rolesLectureSeule).toEqual([
      { cle: "AVOCAT", libelle: "Avocat", lectureSeule: true, mention: "Espace cloisonné" },
    ]);
    expect(r.body.rolesEditables.map((x: { cle: string }) => x.cle)).not.toContain("AVOCAT");
  });

  it("PUT /rbac sur AVOCAT est refusé (400), même pour l'administrateur, sans écriture", async () => {
    for (const jeton of [sg, admin]) {
      const r = await request(app).put("/api/rbac").set("Authorization", `Bearer ${jeton}`)
        .send({ role: "AVOCAT", permissions: ["membres"] });
      expect(r.status).toBe(400);
    }
    expect(await prisma.rolePermission.count({ where: { role: "AVOCAT" } })).toBe(0);
  });
});
