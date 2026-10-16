import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { cotisationDue, droitDuAvec, tarifsActuels } from "../src/lib/business.js";

/**
 * R2-1 — le reçu renvoyé à l'émission (POST /cotisations/paiement et /droits/paiement,
 * tous deux via encaisser) porte `verif`, le chemin court signé : le QR affiché à
 * l'écran juste après l'émission ouvre la page /v du bon reçu (« Authentique »).
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
let sg = "";
let membreId = 0;

beforeAll(async () => {
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  const num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 1000;
  membreId = (await prisma.membre.create({ data: { num, nom: `E2E R21 ${num}`, qualite: "AVOCAT", statut: "INSCRIT", dateInscription: new Date("2015-01-10") } as never })).id;
});

afterAll(async () => {
  await prisma.cotisation.deleteMany({ where: { membreId } });
  await prisma.droitPlaidoirie.deleteMany({ where: { membreId } });
  await prisma.recu.deleteMany({ where: { membreId } });
  await prisma.membre.deleteMany({ where: { id: membreId } });
});

describe("R2-1 — verif dans la réponse d'encaissement", () => {
  it("cotisation et droit : body.recu.verif est un chemin /v/r signé qui répond Authentique", async () => {
    const tarifs = await tarifsActuels();
    const cas = [
      { route: "cotisations", montant: cotisationDue(null, tarifs, "AVOCAT") },
      { route: "droits", montant: droitDuAvec(tarifs, "AVOCAT") },
    ];
    for (const { route, montant } of cas) {
      const p = await request(app).post(`/api/${route}/paiement`).set(...bearer(sg)).send({ membreId, annee: 2026, montant, mode: "Espèces" });
      expect(p.status, route).toBe(201);
      expect(p.body.recu.verif, route).toMatch(/^\/v\/r\/R-.+\.[0-9A-Z]{10}$/);
      expect(p.body.recu.verif, route).toContain(`/v/r/${p.body.recu.numero}.`);
      const v = await request(app).get(p.body.recu.verif);
      expect(v.status, route).toBe(200);
      expect(v.text, route).toContain("Authentique");
    }
  });
});
