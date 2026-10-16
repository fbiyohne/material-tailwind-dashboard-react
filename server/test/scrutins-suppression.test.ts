import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

// M-20261016 T2 — suppression d'un scrutin passé (CLOS ou PUBLIE), refus pendant
// le vote (OUVERT), RBAC SG/ADMIN, cascade Candidat/Emargement, audit détaillé.
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const login = async (email: string) => (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;
const suffixe = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

let sg = "";
let sgId = 0;
let bat = "";
let treso = "";
let avocat = { token: "", userId: 0, membreId: 0 };
let avant = 0;
const crees: number[] = [];
let conseilAvant: Awaited<ReturnType<typeof prisma.membreConseil.findMany>> = [];
let maxConseilId = 0;
const refuses: number[] = []; // scrutins dont le DELETE a été refusé

/** Crée un scrutin avec un candidat et le mène jusqu'au statut voulu. */
async function scrutin(statut: "PREPARATION" | "OUVERT" | "CLOS" | "PUBLIE", opts: { type?: string; modalite?: string } = {}) {
  const s = await request(app).post("/api/scrutins").set(...bearer(sg))
    .send({ titre: `Scrutin T2 ${statut} ${suffixe}-${crees.length}`, type: opts.type ?? "BATONNIER", modalite: opts.modalite ?? "PRESENTIEL", nbSieges: 1 });
  expect(s.status).toBe(201);
  const id = s.body.id as number;
  crees.push(id);
  const c = await request(app).post(`/api/scrutins/${id}/candidats`).set(...bearer(sg)).send({ nom: `Me Candidat T2 ${suffixe}` });
  if (statut === "PREPARATION") return { id, titre: s.body.titre as string };
  expect((await request(app).post(`/api/scrutins/${id}/ouvrir`).set(...bearer(sg))).status).toBe(200);
  if ((opts.modalite ?? "PRESENTIEL") === "PRESENTIEL") {
    await request(app).post(`/api/scrutins/${id}/voix`).set(...bearer(sg)).send({ candidatId: c.body.id, voix: 7 });
  }
  if (statut === "OUVERT") return { id, titre: s.body.titre as string };
  expect((await request(app).post(`/api/scrutins/${id}/clore`).set(...bearer(sg))).status).toBe(200);
  if (statut === "CLOS") return { id, titre: s.body.titre as string };
  expect((await request(app).post(`/api/scrutins/${id}/publier`).set(...bearer(sg))).status).toBe(200);
  return { id, titre: s.body.titre as string };
}

/** Attend la ligne d'audit asynchrone (écrite après l'envoi de la réponse). */
async function ligneAudit(chemin: string) {
  for (let i = 0; i < 30; i++) {
    const lignes = await prisma.journalAudit.findMany({ where: { id: { gt: avant }, chemin } });
    if (lignes.length) return lignes;
    await new Promise((r) => setTimeout(r, 100));
  }
  return [];
}

beforeAll(async () => {
  [sg, bat, treso] = await Promise.all(["sg@barreau-pn.cg", "batonnier@barreau-pn.cg", "tresoriere@barreau-pn.cg"].map(login));
  sgId = (await prisma.user.findUniqueOrThrow({ where: { email: "sg@barreau-pn.cg" } })).id;
  avant = (await prisma.journalAudit.aggregate({ _max: { id: true } }))._max.id ?? 0;
  // Composition du Conseil : instantané pour la restaurer après la publication d'un CONSEIL.
  conseilAvant = await prisma.membreConseil.findMany({ where: { actif: true, role: "membre" } });
  maxConseilId = (await prisma.membreConseil.aggregate({ _max: { id: true } }))._max.id ?? 0;

  const email = `scrutin.t2.${suffixe}@barreau-pn.cg`;
  const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `SCRUTIN T2 ${suffixe}`, qualite: "AVOCAT", email });
  const prov = await request(app).post(`/api/membres/${m.body.id}/acces`).set(...bearer(sg));
  await request(app).post("/api/auth/activer").send({ token: prov.body.lien.split("/activer/")[1], password: "avocatpass8" });
  const token = (await request(app).post("/api/auth/login").send({ email, password: "avocatpass8" })).body.token as string;
  avocat = { token, membreId: m.body.id, userId: (await prisma.user.findUniqueOrThrow({ where: { email } })).id };
});

afterAll(async () => {
  // JournalAudit est immuable (trigger) : on n'y touche pas.
  await prisma.scrutin.deleteMany({ where: { id: { in: crees } } });
  await prisma.archive.deleteMany({ where: { reference: { in: crees.map((id) => `SCRUTIN-${id}`) } } });
  // Restaure le Conseil tel qu'il était avant la publication du scrutin CONSEIL de test.
  await prisma.membreConseil.deleteMany({ where: { id: { gt: maxConseilId } } });
  for (const c of conseilAvant) {
    await prisma.membreConseil.update({ where: { id: c.id }, data: { actif: c.actif, mandatFin: c.mandatFin, motifSortie: c.motifSortie } });
  }
  await prisma.user.deleteMany({ where: { id: avocat.userId } });
  await prisma.membre.deleteMany({ where: { id: avocat.membreId } });
});

describe("DELETE /api/scrutins/:id — scrutin passé", () => {
  it("CLOS présentiel : 204 puis 404", async () => {
    const { id } = await scrutin("CLOS");
    expect((await request(app).delete(`/api/scrutins/${id}`).set(...bearer(sg))).status).toBe(204);
    expect((await request(app).get(`/api/scrutins/${id}`).set(...bearer(sg))).status).toBe(404);
  });

  it("PUBLIE en ligne avec émargement : 204, cascade Candidat/Emargement, une ligne d'audit détaillée", async () => {
    const { id, titre } = await scrutin("PUBLIE", { modalite: "EN_LIGNE" });
    await prisma.emargement.create({ data: { scrutinId: id, membreId: avocat.membreId } });
    expect((await request(app).delete(`/api/scrutins/${id}`).set(...bearer(sg))).status).toBe(204);
    expect(await prisma.emargement.count({ where: { scrutinId: id } })).toBe(0);
    expect(await prisma.candidat.count({ where: { scrutinId: id } })).toBe(0);

    const lignes = await ligneAudit(`/api/scrutins/${id}`);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ methode: "DELETE", statut: 204, userId: sgId });
    expect(lignes[0].action).toContain(titre);
    expect(lignes[0].action).toContain("PUBLIE");
    expect(lignes[0].action).toContain("1 votants");
    expect(lignes[0].action).toContain("Scrutin");
  });

  it("CONSEIL publié puis supprimé : composition du Conseil et Archive du PV conservées", async () => {
    const { id } = await scrutin("PUBLIE", { type: "CONSEIL" });
    // Trace d'un PV généré (même référence que GET /pv/pdf, sans dépendre de Chromium).
    await prisma.archive.create({ data: { categorie: "Procès-verbal (élection)", titre: "PV — test T2", reference: `SCRUTIN-${id}`, date: new Date() } });
    const noms = async () => (await prisma.membreConseil.findMany({ where: { actif: true }, orderBy: { id: "asc" } })).map((c) => c.nom);
    const avantSuppr = await noms();
    expect((await request(app).delete(`/api/scrutins/${id}`).set(...bearer(sg))).status).toBe(204);
    expect(await noms()).toEqual(avantSuppr);
    expect(await prisma.archive.count({ where: { reference: `SCRUTIN-${id}` } })).toBe(1);
  });

  it("OUVERT : 409 en français, scrutin conservé, aucune ligne d'audit", async () => {
    const { id } = await scrutin("OUVERT");
    refuses.push(id);
    const r = await request(app).delete(`/api/scrutins/${id}`).set(...bearer(sg));
    expect(r.status).toBe(409);
    expect(JSON.stringify(r.body)).toContain("Suppression impossible : un vote est en cours.");
    expect(await prisma.scrutin.count({ where: { id } })).toBe(1);
  });

  it("PREPARATION : toujours 204 (pas de régression)", async () => {
    const { id } = await scrutin("PREPARATION");
    expect((await request(app).delete(`/api/scrutins/${id}`).set(...bearer(sg))).status).toBe(204);
    expect(await prisma.scrutin.count({ where: { id } })).toBe(0);
  });

  it("RBAC : Trésorière, Bâtonnier et avocat 403, sans jeton 401 ; scrutin conservé, aucune ligne d'audit", async () => {
    const { id } = await scrutin("CLOS");
    refuses.push(id);
    for (const t of [treso, bat, avocat.token]) {
      expect((await request(app).delete(`/api/scrutins/${id}`).set(...bearer(t))).status).toBe(403);
    }
    expect((await request(app).delete(`/api/scrutins/${id}`)).status).toBe(401);
    expect(await prisma.scrutin.count({ where: { id } })).toBe(1);
  });

  it("id inexistant : 404", async () => {
    expect((await request(app).delete("/api/scrutins/999999999").set(...bearer(sg))).status).toBe(404);
  });

  it("DELETE refusés : seuls les 403 sont journalisés (« Accès refusé », D18), jamais le 401 ni le 409", async () => {
    await new Promise((r) => setTimeout(r, 300));
    expect(await prisma.scrutin.count({ where: { id: { in: refuses } } })).toBe(2);
    const lignes = await prisma.journalAudit.findMany({ where: { id: { gt: avant }, methode: "DELETE", chemin: { in: refuses.map((id) => `/api/scrutins/${id}`) } } });
    // 3 refus 403 (Trésorière, Bâtonnier, avocat) sur le scrutin clos ; le 401 sans jeton n'a pas d'auteur.
    expect(lignes).toHaveLength(3);
    expect(lignes.every((l) => l.action.startsWith("Accès refusé"))).toBe(true);
  });
});
