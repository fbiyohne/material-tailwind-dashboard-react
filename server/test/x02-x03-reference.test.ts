import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { cotisationDue, tarifsActuels } from "../src/lib/business.js";

/**
 * T30 — preuve CA4 pour X-02 et X-03 rejouable sur 76958a4 : ce fichier n'importe que
 * des modules présents à la référence (discipline-decision et corps-electoral-date
 * importent lib/regles.ts, absent de 76958a4, et y échouent donc dès l'import).
 * Sur 76958a4 : le SG enregistre la décision (200) et ?date= est ignoré. Sur la branche : 403, liste à la date.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const login = async (email: string) => (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;
let sg = "";
let membreId = 0;
let dossierId = 0;

beforeAll(async () => {
  sg = await login("sg@barreau-pn.cg");
  const num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 1000;
  const m = await prisma.membre.create({ data: { num, nom: `E2E T30 REF ${num}`, qualite: "AVOCAT", statut: "INSCRIT", dateInscription: new Date("2015-01-10T12:00:00Z") } as never });
  membreId = m.id;
  const montant = cotisationDue(null, await tarifsActuels(), "AVOCAT");
  const p = await request(app).post("/api/cotisations/paiement").set(...bearer(sg)).send({ membreId, annee: 2026, montant, mode: "Espèces", date: "2026-05-10" });
  expect(p.status).toBe(201);
  // R2-8 : versement réellement reçu le 10 mai (horodatage serveur simulé).
  await prisma.recu.updateMany({ where: { membreId, annee: 2026 }, data: { createdAt: new Date("2026-05-10T12:00:00Z") } });
  const d = await prisma.dossierDisciplinaire.create({ data: { reference: `T30-REF-${num}`, membreId, avocatNom: m.nom, objet: "Preuve X-02", dateSaisine: new Date() } });
  dossierId = d.id;
});

afterAll(async () => {
  await prisma.dossierDisciplinaire.deleteMany({ where: { id: dossierId } });
  await prisma.recu.deleteMany({ where: { membreId } });
  await prisma.membre.deleteMany({ where: { id: membreId } });
});

describe("CA4 — X-02 et X-03 rejouables sur 76958a4", () => {
  it("X-02 : le SG ne peut pas enregistrer décision, sanction ni statut DECISION (403)", async () => {
    for (const corps of [{ decision: "<p>Décision</p>" }, { sanction: "Radiation" }, { statut: "DECISION" }]) {
      expect((await request(app).patch(`/api/discipline/${dossierId}`).set(...bearer(sg)).send(corps)).status).toBe(403);
    }
  });

  it("X-03 : à une date antérieure au paiement, l'avocat n'est pas électeur ; après, il l'est", async () => {
    const ids = async (date: string) => new Set(((await request(app).get(`/api/corps-electoral?date=${date}`).set(...bearer(sg))).body.electeurs as { id: number }[]).map((e) => e.id));
    expect((await ids("2026-04-30")).has(membreId)).toBe(false);
    expect((await ids("2026-07-15")).has(membreId)).toBe(true);
  });
});
