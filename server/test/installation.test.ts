import { describe, it, expect, afterAll, beforeAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

const app = creerApp();

describe("Installation — gating", () => {
  it("assistant inactif si INSTALL_WIZARD absent (cas Render)", async () => {
    delete process.env.INSTALL_WIZARD;
    const r = await request(app).get("/api/installation/etat");
    expect(r.status).toBe(200);
    expect(r.body.actif).toBe(false);
  });

  it("assistant inactif si un ADMIN existe déjà, même avec le flag", async () => {
    process.env.INSTALL_WIZARD = "1";
    const r = await request(app).get("/api/installation/etat"); // base seedée → admin présent
    expect(r.body.actif).toBe(false);
    delete process.env.INSTALL_WIZARD;
  });
});
