import { describe, it, expect } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";

/**
 * T29 (recette interface) — l'écran de connexion et l'espace avocat (dont le jeton est confiné
 * à /api/espace et /api/auth) affichaient toujours « Barreau de Pointe-Noire », sans la mention C-13,
 * même sous l'identité de démonstration : ils ne pouvaient pas lire /api/parametres.
 * GET /api/auth/identite expose l'identité institutionnelle publique, et elle seule.
 */
const app = creerApp();

describe("GET /api/auth/identite (identité publique)", () => {
  it("répond sans authentification avec la dénomination, la ville, le logo et le mode démonstration", async () => {
    const r = await request(app).get("/api/auth/identite");
    expect(r.status).toBe(200);
    expect(typeof r.body.identite.denomination).toBe("string");
    expect(r.body.identite.denomination.length).toBeGreaterThan(0);
    expect(typeof r.body.identite.ville).toBe("string");
    expect(typeof r.body.identite.modeDemonstration).toBe("boolean");
  });

  it("n'expose ni signataires ni coordonnées (minimisation)", async () => {
    const { body } = await request(app).get("/api/auth/identite");
    expect(Object.keys(body.identite).sort()).toEqual(["denomination", "logo", "modeDemonstration", "ordre", "ville"]);
  });
});

describe("R2-12 cache d'identité non durable", () => {
  it("reprend une modification faite hors processus (autre process, script) en moins de 2 s", async () => {
    const { prisma } = await import("../src/prisma.js");
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    const data = (row?.data ?? {}) as Record<string, any>;
    const avant = await request(app).get("/api/auth/identite");
    try {
      await prisma.parametres.upsert({
        where: { id: 1 },
        update: { data: { ...data, identite: { ...(data.identite ?? {}), denomination: "Barreau R2-12 externe" } } },
        create: { id: 1, data: { identite: { denomination: "Barreau R2-12 externe" } } },
      });
      await new Promise((r) => setTimeout(r, 1100));
      const r = await request(app).get("/api/auth/identite");
      expect(r.body.identite.denomination).toBe("Barreau R2-12 externe");
    } finally {
      if (row) await prisma.parametres.update({ where: { id: 1 }, data: { data } });
      await new Promise((r) => setTimeout(r, 1100));
      const fin = await request(app).get("/api/auth/identite");
      expect(fin.body.identite.denomination).toBe(avant.body.identite.denomination);
    }
  });
});
