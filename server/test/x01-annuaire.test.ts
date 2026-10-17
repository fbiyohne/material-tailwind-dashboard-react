import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * T7 — X-01 : minimisation des données dans l'espace avocat (loi n° 29-2019) et PO-21.
 * - GET /espace/annuaire ne liste que les membres de l'annuaire (INSCRIT, STAGIAIRE, HONORAIRE) :
 *   aucun téléphone ni e-mail d'un radié, décédé, omis ou sorti n'est exposé à un confrère.
 * - POST /espace/messagerie refuse (403) un destinataire hors annuaire, même avec son id.
 * - GET /tableau n'expose ni coordonnées ni motif de sortie, et aucun sorti.
 * Ces tests échouent sur 76958a4 (annuaire non filtré, destinataire accepté) et passent sur la branche.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
let sg = "";
let moi: { membreId: number; token: string };
const crees: number[] = [];
// Préfixe « E2E » : purgeable par prisma/purger-restes-tests.ts si un afterAll n'aboutit pas.
const PREFIXE = "E2E X01";

/** Avocat avec accès à l'espace, comme creerAvocatEspace d'api.test.ts. */
async function avocatEspace(suffixe: string) {
  const email = `e2e.x01.${suffixe}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@barreau-pn.cg`;
  const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `${PREFIXE} ${suffixe} ${Date.now()}`, qualite: "AVOCAT", email });
  crees.push(m.body.id);
  const prov = await request(app).post(`/api/membres/${m.body.id}/acces`).set(...bearer(sg));
  await request(app).post("/api/auth/activer").send({ token: prov.body.lien.split("/activer/")[1], password: "avocatpass8" });
  const token = (await request(app).post("/api/auth/login").send({ email, password: "avocatpass8" })).body.token as string;
  return { membreId: m.body.id as number, token };
}

/** Membre créé directement dans un statut donné, avec des coordonnées reconnaissables. */
async function membreAuStatut(statut: string, qualite = "AVOCAT") {
  const num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 1;
  const m = await prisma.membre.create({
    data: { num, nom: `${PREFIXE} ${statut} ${num}`, qualite, statut, tel: `+242 06 ${num}`, email: `x01.${statut.toLowerCase()}.${num}@test.cg` } as never,
  });
  crees.push(m.id);
  return m;
}

beforeAll(async () => {
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  moi = await avocatEspace("moi");
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { membreId: { in: crees } }, select: { id: true } });
  await prisma.conversation.deleteMany({ where: { participants: { some: { membreId: { in: crees } } } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await prisma.membre.deleteMany({ where: { id: { in: crees } } });
});

describe("X-01 — annuaire de l'espace avocat", () => {
  it("un RADIE, un DECEDE, un OMIS et un DEMISSIONNAIRE sont absents ; aucune de leurs coordonnées ne fuit", async () => {
    const sortis = [];
    for (const s of ["RADIE", "DECEDE", "OMIS", "DEMISSIONNAIRE"]) sortis.push(await membreAuStatut(s)); // séquentiel : num = max+1
    const inscrit = await membreAuStatut("INSCRIT");
    const stagiaire = await membreAuStatut("STAGIAIRE", "STAGIAIRE");
    const r = await request(app).get("/api/espace/annuaire").set(...bearer(moi.token));
    expect(r.status).toBe(200);
    const ids = r.body.map((m: { id: number }) => m.id);
    for (const s of sortis) expect(ids).not.toContain(s.id);
    expect(ids).toContain(inscrit.id);
    expect(ids).toContain(stagiaire.id);
    const brut = JSON.stringify(r.body);
    for (const s of sortis) {
      expect(brut).not.toContain(s.tel);
      expect(brut).not.toContain(s.email);
    }
    // La recherche par nom ne contourne pas le filtre.
    const q = await request(app).get("/api/espace/annuaire").query({ q: sortis[0].nom }).set(...bearer(moi.token));
    expect(q.body).toHaveLength(0);
  });
});

describe("X-01 — destinataire de la messagerie", () => {
  it("message vers un radié : 403 ; vers un inscrit : 201 ; vers un id inexistant : 404", async () => {
    const radie = await membreAuStatut("RADIE");
    const inscrit = await membreAuStatut("INSCRIT");
    const envoyer = (destinataireMembreId: number) =>
      request(app).post("/api/espace/messagerie").set(...bearer(moi.token)).send({ sujet: "X01", corps: "bonjour", avecAdministration: false, destinataireMembreId });
    expect((await envoyer(radie.id)).status).toBe(403);
    expect(await prisma.conversation.count({ where: { participants: { some: { membreId: radie.id } } } })).toBe(0);
    expect((await envoyer(inscrit.id)).status).toBe(201);
    expect((await envoyer(999_999_999)).status).toBe(404);
  });
});

describe("PO-21 — tableau de l'Ordre", () => {
  it("n'expose ni coordonnées ni motif de sortie, et aucun sorti", async () => {
    const radie = await membreAuStatut("RADIE");
    const r = await request(app).get("/api/tableau").set(...bearer(sg));
    expect(r.status).toBe(200);
    const membres = r.body.sections.flatMap((s: { membres: unknown[] }) => s.membres) as Record<string, unknown>[];
    expect(membres.some((m) => m.id === radie.id)).toBe(false);
    for (const m of membres) for (const champ of ["tel", "email", "motifRadiation", "adresse"]) expect(m).not.toHaveProperty(champ);
  });
});

describe("R1-12 — le demandeur doit lui-même figurer dans l'annuaire", () => {
  it("un avocat sorti ou suspendu, accès non encore révoqué : 403, aucune coordonnée servie", async () => {
    const lui = await avocatEspace("sorti");
    const inscrit = await membreAuStatut("INSCRIT");
    expect((await request(app).get("/api/espace/annuaire").set(...bearer(lui.token))).status).toBe(200);
    for (const statut of ["SUSPENDU", "OMIS", "RADIE"]) {
      // Mise à jour directe : simule la course avant la révocation asynchrone du compte.
      await prisma.membre.update({ where: { id: lui.membreId }, data: { statut } as never });
      const r = await request(app).get("/api/espace/annuaire").set(...bearer(lui.token));
      expect(r.status).toBe(403);
      expect(JSON.stringify(r.body)).not.toContain(inscrit.email);
    }
  });
});
