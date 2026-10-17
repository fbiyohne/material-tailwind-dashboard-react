import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { situationADate } from "../src/lib/cycleVie.js";
import { cotisationDue, tarifsActuels } from "../src/lib/business.js";

/**
 * R2-8 — un paiement antidaté ne rend pas rétroactivement électeur. La date saisie
 * (date de valeur du reçu) est libre dans le passé, mais le corps électoral à D ne
 * compte un reçu que s'il a été ENREGISTRÉ par le serveur au plus tard à D
 * (Recu.createdAt, horodatage serveur). Une date future est refusée (400).
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const j = (iso: string) => new Date(`${iso}T12:00:00Z`);
let sg = "";
let membreId = 0;

beforeAll(async () => {
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  const num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 1000;
  membreId = (await prisma.membre.create({ data: { num, nom: `E2E R28 ${num}`, qualite: "AVOCAT", statut: "INSCRIT", dateInscription: j("2015-01-10") } as never })).id;
});

afterAll(async () => {
  await prisma.recu.deleteMany({ where: { membreId } });
  await prisma.membre.deleteMany({ where: { id: membreId } });
});

describe("R2-8 — paiement antidaté et corps électoral historique", () => {
  it("situationADate : un reçu daté avant D mais enregistré après D ne compte pas", () => {
    const m = { statut: "INSCRIT" as const, dateInscription: j("2010-01-15"), cotisations: [{ annee: 2026, montantDu: 150000, montantPaye: 150000, datePaiement: j("2026-05-10") }] };
    const recu = { annee: 2026, montant: 150000, date: j("2026-05-10"), objet: "Cotisation ordinale 2026" };
    const D = new Date("2026-07-15T23:59:59Z");
    expect(situationADate(m, [], [], [{ ...recu, createdAt: j("2026-10-11") }], D).cotisation?.montantPaye).toBe(0);
    expect(situationADate(m, [], [], [{ ...recu, createdAt: j("2026-05-10") }], D).cotisation?.montantPaye).toBe(150000);
  });

  it("API : paiement saisi aujourd'hui avec une date passée → pas électeur à cette date passée", async () => {
    const montant = cotisationDue(null, await tarifsActuels(), "AVOCAT");
    const p = await request(app).post("/api/cotisations/paiement").set(...bearer(sg)).send({ membreId, annee: 2026, montant, mode: "Espèces", date: "2026-05-10" });
    expect(p.status).toBe(201);
    const corps = await request(app).get("/api/corps-electoral?date=2026-07-15").set(...bearer(sg));
    expect(corps.status).toBe(200);
    expect((corps.body.electeurs as { id: number }[]).some((e) => e.id === membreId)).toBe(false);
    // Aujourd'hui (après l'enregistrement), il est électeur.
    const auj = new Date().toISOString().slice(0, 10);
    const now = await request(app).get(`/api/corps-electoral?date=${auj}`).set(...bearer(sg));
    expect((now.body.electeurs as { id: number }[]).some((e) => e.id === membreId)).toBe(true);
  });

  it("une date de paiement future est refusée (400), cotisation et droit", async () => {
    const futur = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    for (const route of ["cotisations", "droits"]) {
      const r = await request(app).post(`/api/${route}/paiement`).set(...bearer(sg)).send({ membreId, annee: 2027, montant: 1000, mode: "Espèces", date: futur });
      expect(r.status, route).toBe(400);
    }
    expect(await prisma.recu.count({ where: { membreId, annee: 2027 } })).toBe(0);
  });
});
