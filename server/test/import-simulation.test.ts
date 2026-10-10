import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * T10 — F-08 : POST /membres/import?simulation=1 rejoue la validation sans rien écrire et signale
 * doublons (numéro, nom normalisé) et colonnes manquantes ou inconnues.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
let sg = "";
const PREFIXE = "E2E T10IMP";
let numBase = 0;
let existantId = 0;

beforeAll(async () => {
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  numBase = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 10;
  const m = await prisma.membre.create({ data: { num: numBase, nom: `${PREFIXE} Existant Jean`, qualite: "AVOCAT", statut: "INSCRIT" } });
  existantId = m.id;
});
afterAll(async () => {
  await prisma.membre.deleteMany({ where: { nom: { startsWith: PREFIXE } } });
});

const envoyer = (membres: unknown[], simulation = true) =>
  request(app).post(`/api/membres/import${simulation ? "?simulation=1" : ""}`).set(...bearer(sg)).send({ membres });

describe("import — simulation (F-08)", () => {
  it("n'écrit rien : effectif inchangé, doublon de numéro et de nom signalés", async () => {
    const avant = await prisma.membre.count();
    const rows = [
      { num: numBase + 1, nom: `${PREFIXE} Alpha Marie` },
      { num: numBase + 1, nom: `${PREFIXE} Beta Paul` }, // doublon de numéro dans le fichier
      { num: numBase + 2, nom: `${PREFIXE} Jean Existant` }, // même nom (mots permutés) qu'en base
      { num: numBase + 3, nom: `${PREFIXE} Zeta Luc`, inconnue: "x" },
    ];
    const r = await envoyer(rows);
    expect(r.status).toBe(200);
    expect(r.body.simulation).toBe(true);
    expect(await prisma.membre.count()).toBe(avant);
    expect(r.body.crees).toBe(3);
    expect(r.body.maj).toBe(1);
    expect(r.body.doublons).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "num", avec: "fichier", num: numBase + 1, ligne: 2 }),
      expect.objectContaining({ type: "nom", avec: "base", num: numBase + 2, autreNum: numBase }),
    ]));
    expect(r.body.colonnes.inconnues).toEqual(["inconnue"]);
  });

  it("colonne obligatoire manquante : erreur nommée", async () => {
    const r = await envoyer([{ num: numBase + 5 }]);
    expect(r.body.colonnes.manquantes).toEqual(["nom"]);
    expect(r.body.erreurs.some((e: { message: string }) => e.message.includes("« nom »"))).toBe(true);
  });

  it("un numéro de base sous un autre nom est une collision signalée; même nom = mise à jour sans doublon", async () => {
    const r = await envoyer([{ num: numBase, nom: `${PREFIXE} Autre Personne` }, { num: numBase, nom: `${PREFIXE} Existant Jean` }]);
    expect(r.body.doublons.filter((d: { avec: string; type: string }) => d.type === "num" && d.avec === "base")).toHaveLength(1);
  });

  it("l'import réel (sans simulation) écrit toujours", async () => {
    const r = await envoyer([{ num: numBase + 7, nom: `${PREFIXE} Reel Anne` }], false);
    expect(r.body.crees).toBe(1);
    expect(await prisma.membre.count({ where: { num: numBase + 7 } })).toBe(1);
    expect(existantId).toBeGreaterThan(0);
  });
});
