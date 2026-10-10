import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * T9 — circuit d'omission pour impayés (rappel → mise en demeure → transmission →
 * omission enregistrée), réinscription, sorties volontaires et reprise
 * (POST/GET /membres/:id/evenements ; CA7, CA8 ; R-12 à R-19, R-24).
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const login = async (email: string) =>
  (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;

let sg = "", bat = "", tr = "";
let reglesInitiales: Record<string, unknown>;
const ids: number[] = [];
const ANNEE = 2026;

async function creer(nom: string, extra: Record<string, unknown> = {}) {
  const r = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `TEST T9 ${nom} ${Date.now()}`, ...extra });
  expect(r.status).toBe(201);
  ids.push(r.body.id);
  return r.body as { id: number };
}
const evt = (token: string, id: number, corps: Record<string, unknown>) =>
  request(app).post(`/api/membres/${id}/evenements`).set(...bearer(token)).send(corps);
/** Les trois étapes du circuit, datées pour respecter les délais par défaut (30 j, 15 j). */
async function circuit(id: number, annee = ANNEE, transmission = "2026-03-02") {
  expect((await evt(tr, id, { type: "RAPPEL", dateEffet: "2026-01-05", annee })).status).toBe(201);
  expect((await evt(tr, id, { type: "MISE_EN_DEMEURE", dateEffet: "2026-02-10", annee })).status).toBe(201);
  expect((await evt(tr, id, { type: "TRANSMISSION", dateEffet: transmission, annee })).status).toBe(201);
}
const omission = (id: number, extra: Record<string, unknown> = {}) =>
  evt(bat, id, { type: "OMISSION", dateEffet: "2026-03-20", annee: ANNEE, reference: "CNO-2026-014", ...extra });
const putRegles = (regles: unknown) => request(app).put("/api/parametres").set(...bearer(sg)).send({ regles });

beforeAll(async () => {
  [sg, bat, tr] = await Promise.all(["sg@barreau-pn.cg", "batonnier@barreau-pn.cg", "tresoriere@barreau-pn.cg"].map(login));
  reglesInitiales = (await request(app).get("/api/parametres").set(...bearer(sg))).body.regles;
});

afterAll(async () => {
  await putRegles(reglesInitiales);
  await prisma.membre.deleteMany({ where: { id: { in: ids } } }); // événements et cotisations en cascade
});

describe("CA7 — omission pour impayés : trois étapes horodatées, puis décision enregistrée", () => {
  it("OMISSION sans les trois étapes : 409, l'avocat reste inscrit", async () => {
    const m = await creer("sans-etapes");
    const r = await omission(m.id);
    expect(r.status).toBe(409);
    expect((await prisma.membre.findUnique({ where: { id: m.id } }))!.statut).toBe("INSCRIT");
  });

  it("étapes d'un autre exercice : 409 (chaque étape exige la précédente sur le même exercice)", async () => {
    const m = await creer("autre-exercice");
    await circuit(m.id, 2025);
    expect((await omission(m.id)).status).toBe(409);
  });

  it("mise en demeure avant le délai du rappel : 409 ; étape sans la précédente : 409", async () => {
    const m = await creer("ordre");
    expect((await evt(tr, m.id, { type: "MISE_EN_DEMEURE", dateEffet: "2026-02-10", annee: ANNEE })).status).toBe(409);
    expect((await evt(tr, m.id, { type: "RAPPEL", dateEffet: "2026-01-05", annee: ANNEE })).status).toBe(201);
    expect((await evt(tr, m.id, { type: "MISE_EN_DEMEURE", dateEffet: "2026-01-20", annee: ANNEE })).status).toBe(409);
  });

  it("étapes : permission finances (bâtonnier 403) ; refus si le membre est à jour pour l'exercice (409)", async () => {
    const m = await creer("a-jour");
    expect((await evt(bat, m.id, { type: "RAPPEL", annee: ANNEE })).status).toBe(403);
    await prisma.cotisation.create({ data: { membreId: m.id, annee: ANNEE, montantDu: 150000, montantPaye: 150000, datePaiement: new Date() } });
    const r = await evt(tr, m.id, { type: "RAPPEL", annee: ANNEE });
    expect(r.status).toBe(409);
    expect(r.body.erreur).toMatch(/à jour/);
  });

  it("circuit complet : OMIS, organe nommé, réinscription vers INSCRIT, historique visible ; OMIS distinct de RADIE", async () => {
    const m = await creer("circuit");
    await circuit(m.id);
    expect((await omission(m.id, { reference: undefined })).status).toBe(400); // référence obligatoire
    expect((await evt(sg, m.id, { type: "OMISSION", dateEffet: "2026-03-20", annee: ANNEE, reference: "X" })).status).toBe(403); // SG : omission_prononcer refusée par défaut
    const o = await omission(m.id);
    expect(o.status).toBe(201);
    expect(o.body.membre).toMatchObject({ statut: "OMIS", dateRadiation: null, motifRadiation: null });
    expect(o.body.evenement).toMatchObject({ type: "OMISSION", statutAvant: "INSCRIT", statutApres: "OMIS", reference: "CNO-2026-014", annee: ANNEE, motif: "Art. 35-4° loi n° 026-92" });
    expect(o.body.evenement.details.organe).toMatch(/Conseil de l'Ordre national/);

    const tableau = await request(app).get("/api/membres").query({ statut: "RADIE", q: "TEST T9 circuit", pageSize: 200 }).set(...bearer(sg));
    expect(tableau.body.items.map((x: { id: number }) => x.id)).not.toContain(m.id);

    expect((await evt(bat, m.id, { type: "REINSCRIPTION", dateEffet: "2026-06-01" })).status).toBe(400); // référence obligatoire
    const r = await evt(bat, m.id, { type: "REINSCRIPTION", dateEffet: "2026-06-01", reference: "CNO-2026-031" });
    expect(r.status).toBe(201);
    expect(r.body.membre.statut).toBe("INSCRIT");
    expect((await evt(bat, m.id, { type: "REINSCRIPTION", reference: "CNO-2026-032" })).status).toBe(409); // n'est plus omis

    const h = await request(app).get(`/api/membres/${m.id}/evenements`).set(...bearer(sg));
    expect(h.status).toBe(200);
    expect(h.body.map((e: { type: string }) => e.type)).toEqual(["REINSCRIPTION", "OMISSION", "TRANSMISSION", "MISE_EN_DEMEURE", "RAPPEL"]);
    expect(h.body[0]).toMatchObject({ statutAvant: "OMIS", statutApres: "INSCRIT" });
    expect((await request(app).get(`/api/membres/${m.id}/evenements`).set(...bearer(tr))).status).toBe(403);
  });

  it("après réinscription, les étapes antérieures ne valent pas pour une nouvelle omission (409)", async () => {
    const m = await creer("re-omission");
    await circuit(m.id);
    expect((await omission(m.id)).status).toBe(201);
    expect((await evt(bat, m.id, { type: "REINSCRIPTION", dateEffet: "2026-04-01", reference: "CNO-2026-040" })).status).toBe(201);
    expect((await omission(m.id, { dateEffet: "2026-05-01" })).status).toBe(409);
  });
});

describe("CA8 — délai de mise en demeure lu en Paramètres à chaque appel", () => {
  it("delaiMiseEnDemeureJours passé de 15 à 30 : la même omission devient 409, puis 201 au retour à 15", async () => {
    const m = await creer("delai");
    await circuit(m.id, ANNEE, "2026-03-02"); // 20 jours après la mise en demeure
    const regles = structuredClone(reglesInitiales) as { impayes: { delaiMiseEnDemeureJours: number } };
    regles.impayes.delaiMiseEnDemeureJours = 30;
    expect((await putRegles(regles)).status).toBe(200);
    expect((await omission(m.id)).status).toBe(409);
    regles.impayes.delaiMiseEnDemeureJours = 15;
    expect((await putRegles(regles)).status).toBe(200);
    expect((await omission(m.id)).status).toBe(201);
  });
});

describe("Autres causes, sorties volontaires et reprise", () => {
  it("R-15 : omission pour maladie (35-1°) par son seul code ; tout motif libre est refusé (400)", async () => {
    const m = await creer("maladie");
    expect((await omission(m.id, { cause: "35-1", motif: "hospitalisé" })).status).toBe(400);
    expect((await omission(m.id, { cause: "35-9" })).status).toBe(400);
    const r = await omission(m.id, { cause: "35-1" });
    expect(r.status).toBe(201);
    expect(r.body.evenement.motif).toBe("Art. 35-1° loi n° 026-92");
  });

  it("DEMISSIONNAIRE, RETRAITE, CESSATION : SG seul ; un membre sorti ne ressort pas (409)", async () => {
    const m = await creer("sortie");
    expect((await evt(bat, m.id, { type: "DEMISSIONNAIRE", reference: "Lettre du 01/09/2026" })).status).toBe(403);
    expect((await evt(tr, m.id, { type: "RETRAITE" })).status).toBe(403);
    const r = await evt(sg, m.id, { type: "DEMISSIONNAIRE", dateEffet: "2026-09-01", reference: "Lettre du 01/09/2026" });
    expect(r.status).toBe(201);
    expect(r.body.membre.statut).toBe("DEMISSIONNAIRE");
    expect((await evt(sg, m.id, { type: "CESSATION" })).status).toBe(409);
  });

  it("REPRISE : SUSPENDU vers INSCRIT, SG seul ; refusée si le membre n'est pas suspendu (409)", async () => {
    const m = await creer("reprise");
    expect((await evt(sg, m.id, { type: "REPRISE" })).status).toBe(409);
    expect((await request(app).patch(`/api/membres/${m.id}`).set(...bearer(sg)).send({ statut: "SUSPENDU" })).status).toBe(200);
    expect((await evt(bat, m.id, { type: "REPRISE" })).status).toBe(403);
    const r = await evt(sg, m.id, { type: "REPRISE", reference: "Fin d'interdiction" });
    expect(r.status).toBe(201);
    expect(r.body.evenement).toMatchObject({ type: "REPRISE", statutAvant: "SUSPENDU", statutApres: "INSCRIT" });
  });

  it("type inconnu, date future ou membre absent : 400 / 404", async () => {
    const m = await creer("validation");
    expect((await evt(sg, m.id, { type: "RADIATION" })).status).toBe(400);
    expect((await evt(tr, m.id, { type: "RAPPEL", dateEffet: "2999-01-01", annee: ANNEE })).status).toBe(400);
    expect((await evt(tr, 2_000_000_000, { type: "RAPPEL", annee: ANNEE })).status).toBe(404);
  });
});
