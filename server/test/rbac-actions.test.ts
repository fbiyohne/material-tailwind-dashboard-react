import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { requireAuth, requirePermission } from "../src/middleware/auth.js";
import { errorHandler } from "../src/middleware/error.js";
import { aLaPermission, rafraichirMatrice, ACTIONS } from "../src/lib/rbac.js";

/**
 * T3 — permissions d'action (R-42 ajusté) : séparation bâtonnier / secrétaire
 * général, repli par catégorie et validation des clés dans PUT /rbac.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const login = async (email: string) =>
  (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;

// Route minimale protégée par l'action discipline_decider (même middleware que les routes réelles).
const mini = express();
mini.get("/decider", requireAuth, requirePermission("discipline_decider"), (_req, res) => res.json({ ok: true }));
mini.use(errorHandler);

const MODULES_BATONNIER = ["membres", "corps_electoral", "reunions_assemblees", "discipline", "elections", "messagerie", "documents", "audit"];

let sg = "", bat = "", admin = "";
let lignesInitiales: { role: "BATONNIER"; permission: string }[] = [];

beforeAll(async () => {
  [sg, bat, admin] = await Promise.all(["sg@barreau-pn.cg", "batonnier@barreau-pn.cg", "admin@barreau-pn.cg"].map(login));
  lignesInitiales = (await prisma.rolePermission.findMany({ where: { role: "BATONNIER" } })) as typeof lignesInitiales;
});

afterAll(async () => {
  // Restaure l'état initial des lignes du bâtonnier pour ne pas polluer les autres fichiers.
  await prisma.rolePermission.deleteMany({ where: { role: "BATONNIER" } });
  if (lignesInitiales.length) await prisma.rolePermission.createMany({ data: lignesInitiales, skipDuplicates: true });
  await rafraichirMatrice();
});

describe("RBAC — actions (T3, R-42)", () => {
  it("discipline_decider : SG 403, BATONNIER 200, ADMIN 200", async () => {
    expect((await request(mini).get("/decider").set(...bearer(sg))).status).toBe(403);
    expect((await request(mini).get("/decider").set(...bearer(bat))).status).toBe(200);
    expect((await request(mini).get("/decider").set(...bearer(admin))).status).toBe(200);
  });

  it("défauts R-42 : le SG garde la saisine et l'admission directe, pas la décision ni le stage ni l'omission", () => {
    expect(aLaPermission("SECRETAIRE_GENERAL", "discipline_saisir")).toBe(true);
    expect(aLaPermission("SECRETAIRE_GENERAL", "admission_directe")).toBe(true);
    expect(aLaPermission("SECRETAIRE_GENERAL", "stage_valider")).toBe(false);
    expect(aLaPermission("SECRETAIRE_GENERAL", "omission_prononcer")).toBe(false);
    expect(aLaPermission("SECRETAIRE_GENERAL", "finances")).toBe(true); // modules : accès complet conservé
    expect(aLaPermission("TRESORIERE", "discipline_decider")).toBe(false);
    for (const a of ACTIONS) expect(aLaPermission("ADMIN", a.cle)).toBe(true);
  });

  it("GET /rbac expose le catalogue d'actions et la matrice inclut les actions du bâtonnier", async () => {
    const g = await request(app).get("/api/rbac").set(...bearer(sg));
    expect(g.status).toBe(200);
    expect(g.body.actions.map((a: { cle: string }) => a.cle)).toContain("discipline_decider");
    expect(g.body.matrice.BATONNIER).toContain("discipline_decider");
    expect(g.body.matrice.BATONNIER).toContain("membres");
  });

  it("repli par catégorie : après un PUT /rbac sur les seules clés de modules, le bâtonnier conserve discipline_decider", async () => {
    const put = await request(app).put("/api/rbac").set(...bearer(admin)).send({ role: "BATONNIER", permissions: MODULES_BATONNIER });
    expect(put.status).toBe(200);
    expect((await request(mini).get("/decider").set(...bearer(bat))).status).toBe(200);
    const me = await request(app).get("/api/auth/me").set(...bearer(bat));
    expect(me.body.permissions).toContain("discipline_decider");
    expect(me.body.permissions).toContain("membres");
  });

  it("PUT /rbac avec une clé d'action honore la liste : retirer discipline_decider donne 403 au bâtonnier, puis restauration", async () => {
    const put = await request(app).put("/api/rbac").set(...bearer(admin))
      .send({ role: "BATONNIER", permissions: [...MODULES_BATONNIER, "discipline_saisir"] });
    expect(put.status).toBe(200);
    expect((await request(mini).get("/decider").set(...bearer(bat))).status).toBe(403);
    expect((await request(mini).get("/decider").set(...bearer(admin))).status).toBe(200); // l'ADMIN n'est jamais verrouillé
    const restaure = await request(app).put("/api/rbac").set(...bearer(admin))
      .send({ role: "BATONNIER", permissions: [...MODULES_BATONNIER, ...ACTIONS.map((a) => a.cle)] });
    expect(restaure.status).toBe(200);
    expect((await request(mini).get("/decider").set(...bearer(bat))).status).toBe(200);
  });

  it("PUT /rbac avec une clé d'action inconnue renvoie 400 et ne modifie rien", async () => {
    const r = await request(app).put("/api/rbac").set(...bearer(admin))
      .send({ role: "BATONNIER", permissions: [...MODULES_BATONNIER, "discipline_inconnue"] });
    expect(r.status).toBe(400);
    expect((await request(mini).get("/decider").set(...bearer(bat))).status).toBe(200);
  });

  it("PUT /rbac refuse le SG : ses actions suivent les défauts R-42, non modifiables", async () => {
    const r = await request(app).put("/api/rbac").set(...bearer(admin)).send({ role: "SECRETAIRE_GENERAL", permissions: ["discipline_decider"] });
    expect(r.status).toBe(400);
    expect((await request(mini).get("/decider").set(...bearer(sg))).status).toBe(403);
  });
});
