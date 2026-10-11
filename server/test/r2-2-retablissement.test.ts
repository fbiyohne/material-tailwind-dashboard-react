import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * R2-2 — REINSCRIPTION et REPRISE (POST /membres/:id/evenements) rétablissent le statut
 * qui précédait la mesure (statutAvant de l'événement qui a mis le membre OMIS ou SUSPENDU),
 * avec repli sur la qualité : un stagiaire ne ressort jamais INSCRIT (R1-5), un honoraire
 * redevient HONORAIRE.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const login = async (email: string) =>
  (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;
const MARQUE = `E2E R22 ${Date.now()}`;
let sg = "", bat = "", tr = "";
const ids: number[] = [];
const dossiers: number[] = [];

beforeAll(async () => {
  [sg, bat, tr] = await Promise.all(["sg@barreau-pn.cg", "batonnier@barreau-pn.cg", "tresoriere@barreau-pn.cg"].map(login));
});
afterAll(async () => {
  await prisma.evenementSituation.deleteMany({ where: { dossierId: { in: dossiers } } });
  await prisma.dossierDisciplinaire.deleteMany({ where: { id: { in: dossiers } } });
  await prisma.membre.deleteMany({ where: { id: { in: ids } } });
});

async function creer(nom: string, extra: Record<string, unknown>) {
  const r = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `${MARQUE} ${nom}`, ...extra });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  ids.push(r.body.id);
  return r.body.id as number;
}
const evt = (token: string, id: number, corps: Record<string, unknown>) =>
  request(app).post(`/api/membres/${id}/evenements`).set(...bearer(token)).send(corps);
const statut = async (id: number) => (await prisma.membre.findUniqueOrThrow({ where: { id } })).statut;
/** Statut sous lequel le membre figure dans GET /tableau (la section des stagiaires y figure aussi). */
const auTableau = async (id: number) => {
  const t = await request(app).get("/api/tableau").set(...bearer(sg));
  expect(t.status).toBe(200);
  const s = (t.body.sections as { membres: { id: number; statut: string; qualite: string }[] }[]).flatMap((x) => x.membres).find((m) => m.id === id);
  return s && `${s.qualite}/${s.statut}`;
};

describe("R2-2 — réinscription et reprise rétablissent la situation d'avant la mesure", () => {
  it("stagiaire omis (circuit complet) puis réinscrit : reste STAGIAIRE, jamais INSCRIT au tableau", async () => {
    const id = await creer("stagiaire-omis", { qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    expect(await statut(id)).toBe("STAGIAIRE");
    expect((await evt(tr, id, { type: "RAPPEL", dateEffet: "2026-01-05", annee: 2026 })).status).toBe(201);
    expect((await evt(tr, id, { type: "MISE_EN_DEMEURE", dateEffet: "2026-02-10", annee: 2026 })).status).toBe(201);
    expect((await evt(tr, id, { type: "TRANSMISSION", dateEffet: "2026-03-02", annee: 2026 })).status).toBe(201);
    expect((await evt(bat, id, { type: "OMISSION", dateEffet: "2026-03-20", annee: 2026, reference: "CNO-R22-1" })).status).toBe(201);
    expect(await statut(id)).toBe("OMIS");
    const r = await evt(bat, id, { type: "REINSCRIPTION", reference: "CNO-R22-2" });
    expect(r.status).toBe(201);
    expect(r.body.evenement).toMatchObject({ statutAvant: "OMIS", statutApres: "STAGIAIRE" });
    expect(await prisma.membre.findUniqueOrThrow({ where: { id } })).toMatchObject({ qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    expect(await auTableau(id)).toBe("STAGIAIRE/STAGIAIRE"); // section des stagiaires, jamais INSCRIT
  });

  it("stagiaire sous interdiction ferme puis repris : reste STAGIAIRE, jamais INSCRIT au tableau", async () => {
    const id = await creer("stagiaire-suspendu", { qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    const d = await request(app).post("/api/discipline").set(...bearer(sg)).send({ avocatNom: `Me ${MARQUE}`, objet: "Manquement", membreId: id });
    expect(d.status).toBe(201);
    dossiers.push(d.body.id);
    const dec = await request(app).post(`/api/discipline/${d.body.id}/decision`).set(...bearer(bat)).send({
      sanctionCode: "INTERDICTION_TEMPORAIRE", dureeMois: 1, dateDecision: "2025-01-10",
      motivation: "Motivation suffisante de la décision du conseil de discipline.",
    });
    expect(dec.status, JSON.stringify(dec.body)).toBe(200);
    expect(await statut(id)).toBe("SUSPENDU");
    const r = await evt(sg, id, { type: "REPRISE", reference: "Fin d'interdiction" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.evenement).toMatchObject({ statutAvant: "SUSPENDU", statutApres: "STAGIAIRE" });
    expect(await prisma.membre.findUniqueOrThrow({ where: { id } })).toMatchObject({ qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    expect(await auTableau(id)).toBe("STAGIAIRE/STAGIAIRE"); // section des stagiaires, jamais INSCRIT
  });

  it("honoraire suspendu sans historique : repli sur la qualité, redevient HONORAIRE", async () => {
    const id = await creer("honoraire", { qualite: "HONORAIRE", statut: "HONORAIRE" });
    await prisma.membre.update({ where: { id }, data: { statut: "SUSPENDU" } });
    const r = await evt(sg, id, { type: "REPRISE", reference: "Fin" });
    expect(r.status).toBe(201);
    expect(await statut(id)).toBe("HONORAIRE");
  });
});
