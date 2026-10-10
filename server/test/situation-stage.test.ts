import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * T8 — X-04 et F-03 : validation de fin de stage (date d'inscription = date de
 * décision, durée et certificat paramétrables), admission directe, et écritures
 * de statut (PATCH, /radier, /deces) tracées par un EvenementSituation.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const login = async (email: string) =>
  (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;
const jour = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

let sg = "", bat = "", admin = "", tr = "";
let stageInitial: unknown;
const ids: number[] = [];

/** Crée un membre par l'API (préfixe de fixture purgeable) et retient son id. */
async function creer(nom: string, extra: Record<string, unknown> = {}) {
  const r = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom, ...extra });
  expect(r.status).toBe(201);
  ids.push(r.body.id);
  return r.body as { id: number; num: number };
}
const stage = (patch: Record<string, unknown>) => request(app).put("/api/parametres").set(...bearer(sg)).send({ stage: patch });
const evenements = (membreId: number) => prisma.evenementSituation.findMany({ where: { membreId }, orderBy: { id: "asc" } });

beforeAll(async () => {
  [sg, bat, admin, tr] = await Promise.all(["sg@barreau-pn.cg", "batonnier@barreau-pn.cg", "admin@barreau-pn.cg", "tresoriere@barreau-pn.cg"].map(login));
  stageInitial = ((await prisma.parametres.findUnique({ where: { id: 1 } }))?.data as { stage?: unknown } | undefined)?.stage;
});

afterAll(async () => {
  // Restaure la règle de stage et retire les fiches créées (événements en cascade).
  await stage({ dureeMois: 24, certificatObligatoire: false, ...(stageInitial as object) });
  await prisma.membre.deleteMany({ where: { id: { in: ids } } });
});

describe("X-04 — valider-stage fixe la date d'inscription au tableau", () => {
  it("dateInscription = dateDecision, événement PASSAGE_TABLEAU daté de la décision", async () => {
    const s = await creer(`STAGE T8 ${Date.now()}`, { qualite: "STAGIAIRE", statut: "STAGIAIRE", dateInscription: "2023-01-10" });
    const r = await request(app).post(`/api/membres/${s.id}/valider-stage`).set(...bearer(bat))
      .send({ dateDecision: "2026-03-15", dateDemande: "2026-02-01" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ qualite: "AVOCAT", statut: "INSCRIT" });
    expect(jour(r.body.dateInscription)).toBe("2026-03-15");
    const evts = await evenements(s.id);
    expect(evts).toHaveLength(1);
    expect(evts[0]).toMatchObject({ type: "PASSAGE_TABLEAU", statutAvant: "STAGIAIRE", statutApres: "INSCRIT" });
    expect(jour(evts[0].dateEffet)).toBe("2026-03-15");
    expect(evts[0].details).toMatchObject({ dateDemande: "2026-02-01" });
  });

  it("sans corps : dateInscription = aujourd'hui ; une date de décision future est refusée (400)", async () => {
    const s = await creer(`STAGE T8 sans corps ${Date.now()}`, { qualite: "STAGIAIRE", statut: "STAGIAIRE", dateInscription: "2023-01-10" });
    const futur = await request(app).post(`/api/membres/${s.id}/valider-stage`).set(...bearer(bat)).send({ dateDecision: "2999-01-01" });
    expect(futur.status).toBe(400);
    const r = await request(app).post(`/api/membres/${s.id}/valider-stage`).set(...bearer(bat));
    expect(r.status).toBe(200);
    expect(jour(r.body.dateInscription)).toBe(jour(new Date()));
  });

  it("GET /membres?sort=dateInscription trie réellement par date d'inscription (200)", async () => {
    const tag = `AVOC T8 tri ${Date.now()}`;
    const premier = await creer(`${tag} A`, { dateInscription: "2026-02-01" }); // num plus petit, date plus récente
    const second = await creer(`${tag} B`, { dateInscription: "2025-01-01" });
    const r = await request(app).get("/api/membres").query({ q: tag, sort: "dateInscription", order: "asc" }).set(...bearer(sg));
    expect(r.status).toBe(200);
    expect(r.body.items.map((m: { id: number }) => m.id)).toEqual([second.id, premier.id]);
  });

  it("SG : 403 (stage_valider réservé au bâtonnier par défaut)", async () => {
    const s = await creer(`STAGE T8 rbac ${Date.now()}`, { qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    expect((await request(app).post(`/api/membres/${s.id}/valider-stage`).set(...bearer(sg))).status).toBe(403);
  });
});

describe("CA8 — durée du stage et certificat paramétrables (sans redéploiement)", () => {
  it("dureeMois = 36 : un stage de 30 mois est refusé (409) ; dureeMois = 24 : accepté (200)", async () => {
    const s = await creer(`STAGE T8 duree ${Date.now()}`, { qualite: "STAGIAIRE", statut: "STAGIAIRE", dateServment: "2024-01-01" });
    expect((await stage({ dureeMois: 36 })).status).toBe(200);
    const refus = await request(app).post(`/api/membres/${s.id}/valider-stage`).set(...bearer(bat)).send({ dateDecision: "2026-07-01" });
    expect(refus.status).toBe(409);
    expect((await prisma.membre.findUnique({ where: { id: s.id } }))?.qualite).toBe("STAGIAIRE");
    expect((await stage({ dureeMois: 24 })).status).toBe(200);
    const ok = await request(app).post(`/api/membres/${s.id}/valider-stage`).set(...bearer(bat)).send({ dateDecision: "2026-07-01" });
    expect(ok.status).toBe(200);
  });

  it("certificatObligatoire = true : sans certificat 400, avec date et référence 200", async () => {
    const s = await creer(`STAGE T8 certif ${Date.now()}`, { qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    expect((await stage({ certificatObligatoire: true })).status).toBe(200);
    try {
      const sans = await request(app).post(`/api/membres/${s.id}/valider-stage`).set(...bearer(bat)).send({ dateDecision: "2026-07-01" });
      expect(sans.status).toBe(400);
      const avec = await request(app).post(`/api/membres/${s.id}/valider-stage`).set(...bearer(bat))
        .send({ dateDecision: "2026-07-01", dateCertificat: "2026-06-20", refCertificat: "CERT-ON-2026-014" });
      expect(avec.status).toBe(200);
      const [e] = await evenements(s.id);
      expect(e).toMatchObject({ type: "PASSAGE_TABLEAU", reference: "CERT-ON-2026-014" });
      expect(e.details).toMatchObject({ dateCertificat: "2026-06-20", organe: expect.stringContaining("Bâtonnier national") });
    } finally {
      await stage({ certificatObligatoire: false });
    }
  });
});

describe("F-03 — admission directe (POST /membres/admission-directe)", () => {
  const corps = (extra: Record<string, unknown> = {}) =>
    ({ nom: `AVOC T8 admission ${Date.now()}`, cas: "MAGISTRAT", ancienneteAns: 6, reference: "DELIB-CO-2026-03", dateDecision: "2026-04-02", ...extra });

  it("cas inconnu ou ancienneté insuffisante : 400", async () => {
    expect((await request(app).post("/api/membres/admission-directe").set(...bearer(sg)).send(corps({ cas: "HUISSIER" }))).status).toBe(400);
    expect((await request(app).post("/api/membres/admission-directe").set(...bearer(sg)).send(corps({ ancienneteAns: 4 }))).status).toBe(400);
  });

  it("profil sans la permission admission_directe : 403", async () => {
    expect((await request(app).post("/api/membres/admission-directe").set(...bearer(tr)).send(corps())).status).toBe(403);
  });

  it("crée un avocat INSCRIT avec un événement ADMISSION_DIRECTE (SG et bâtonnier)", async () => {
    for (const t of [sg, bat]) {
      const r = await request(app).post("/api/membres/admission-directe").set(...bearer(t)).send(corps());
      expect(r.status).toBe(201);
      ids.push(r.body.id);
      expect(r.body).toMatchObject({ qualite: "AVOCAT", statut: "INSCRIT" });
      expect(jour(r.body.dateInscription)).toBe("2026-04-02");
      const evts = await evenements(r.body.id);
      expect(evts).toHaveLength(1);
      expect(evts[0]).toMatchObject({ type: "ADMISSION_DIRECTE", statutApres: "INSCRIT", reference: "DELIB-CO-2026-03" });
      expect(evts[0].details).toMatchObject({ cas: "MAGISTRAT", ancienneteAns: 6 });
    }
  });
});

describe("D5 — PATCH, /radier et /deces écrivent un EvenementSituation", () => {
  it("/radier : événement RADIATION daté de la décision, avec sa référence", async () => {
    const m = await creer(`AVOC T8 radier ${Date.now()}`);
    const r = await request(app).post(`/api/membres/${m.id}/radier`).set(...bearer(sg)).send({ dateRadiation: "2026-05-02", motifRadiation: "Décision n° 12" });
    expect(r.status).toBe(200);
    expect(r.body.statut).toBe("RADIE");
    const evts = await evenements(m.id);
    expect(evts).toHaveLength(1);
    expect(evts[0]).toMatchObject({ type: "RADIATION", statutAvant: "INSCRIT", statutApres: "RADIE", reference: "Décision n° 12" });
    expect(jour(evts[0].dateEffet)).toBe("2026-05-02");
  });

  it("/deces : événement DECES daté de l'acte, sans motif", async () => {
    const m = await creer(`AVOC T8 deces ${Date.now()}`);
    expect((await request(app).post(`/api/membres/${m.id}/deces`).set(...bearer(sg)).send({ dateDeces: "2026-06-01" })).status).toBe(200);
    const evts = await evenements(m.id);
    expect(evts).toHaveLength(1);
    expect(evts[0]).toMatchObject({ type: "DECES", statutAvant: "INSCRIT", statutApres: "DECEDE", motif: null });
    expect(jour(evts[0].dateEffet)).toBe("2026-06-01");
  });

  it("PATCH : événement seulement si le statut change", async () => {
    const m = await creer(`AVOC T8 patch ${Date.now()}`);
    expect((await request(app).patch(`/api/membres/${m.id}`).set(...bearer(sg)).send({ cabinet: "Cabinet T8" })).status).toBe(200);
    expect(await evenements(m.id)).toHaveLength(0);
    const r = await request(app).patch(`/api/membres/${m.id}`).set(...bearer(sg)).send({ statut: "SUSPENDU", cabinet: "Cabinet T8 bis" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ statut: "SUSPENDU", cabinet: "Cabinet T8 bis" });
    const evts = await evenements(m.id);
    expect(evts).toHaveLength(1);
    expect(evts[0]).toMatchObject({ type: "CHANGEMENT_STATUT", statutAvant: "INSCRIT", statutApres: "SUSPENDU" });
  });
});
