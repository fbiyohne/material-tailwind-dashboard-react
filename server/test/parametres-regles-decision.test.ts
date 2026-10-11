import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { REGLES_DEFAUT } from "../src/lib/regles.js";

/** R2-1 — le SG ne peut pas contourner la séparation bâtonnier / SG en réécrivant les règles de décision. */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const login = async (email: string) =>
  (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;
let sg = "", bat = "";
let sauvegarde: unknown = null;

beforeAll(async () => {
  [sg, bat] = await Promise.all([login("sg@barreau-pn.cg"), login("batonnier@barreau-pn.cg")]);
  sauvegarde = (await prisma.parametres.findUnique({ where: { id: 1 } }))?.data ?? null;
});
afterAll(async () => {
  if (sauvegarde) await prisma.parametres.update({ where: { id: 1 }, data: { data: sauvegarde as object } });
});

const piege = () => {
  const { stage: _s, ...regles } = structuredClone(REGLES_DEFAUT);
  regles.sanctions[0].effet = "RADIATION"; // AVERTISSEMENT qui radie
  return regles;
};
const put = (jeton: string, regles: object) => request(app).put("/api/parametres").set(...bearer(jeton)).send({ regles });

describe("R2-1 — règles de décision réservées à discipline_decider", () => {
  it("le SG reçoit 403 en changeant l'effet d'AVERTISSEMENT, et le catalogue reste inchangé", async () => {
    const r = await put(sg, piege());
    expect(r.status).toBe(403);
    expect(r.body.erreur).toMatch(/discipline_decider/);
    const { regles } = (await request(app).get("/api/parametres").set(...bearer(sg))).body;
    expect(regles.sanctions[0].effet).toBe(REGLES_DEFAUT.sanctions[0].effet);
  });

  it("le SG reçoit 403 sur l'électoral et l'éligibilité", async () => {
    const { stage: _s, ...a } = structuredClone(REGLES_DEFAUT);
    a.electoral.exigerCotisationAJour = !a.electoral.exigerCotisationAJour;
    expect((await put(sg, a)).status).toBe(403);
    const { stage: _t, ...b } = structuredClone(REGLES_DEFAUT);
    b.eligibilite.BATONNIER.ancienneteMinAns = 9;
    expect((await put(sg, b)).status).toBe(403);
  });

  it("le SG peut renvoyer les règles inchangées ; le bâtonnier peut les modifier (journal : noms de clés)", async () => {
    const { stage: _s, ...inchangees } = structuredClone(REGLES_DEFAUT);
    expect((await put(sg, inchangees)).status).toBe(200);
    const modif = piege();
    expect((await put(bat, modif)).status).toBe(200);
    await new Promise((r) => setTimeout(r, 300)); // écriture du journal asynchrone
    const ligne = await prisma.journalAudit.findFirst({ where: { action: { contains: "règles modifiées : sanctions" } } });
    expect(ligne).not.toBeNull();
  });
});
