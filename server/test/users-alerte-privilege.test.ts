import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

/**
 * Secret professionnel (R-58, loi 026-92 art. 52) — R1-1 (M-20261016) : l'ADMIN, sous-traitant
 * technique, ne peut pas contourner refuserAdmin en prenant la main sur un compte qui accède au
 * contenu des messages ou des pièces (SG, Bâtonnier, AVOCAT, tout rôle titulaire de « messagerie » :
 * SA et Trésorière par défaut). Il reçoit 403 (REFUS) en création, promotion, modification hors
 * activation, redéfinition du mot de passe et suppression, et la base n'est pas modifiée ; il ne peut
 * pas non plus ouvrir la messagerie à un rôle par PUT /rbac. Il garde la désactivation (alertée au
 * titulaire et au SG) et la gestion des autres comptes. Le SG garde l'accès.
 * Base barreau_pn_test ; comptes marqués « e2e-habilite-<suffixe> », supprimés en afterAll.
 */

// Succession du Bâtonnier : on simule l'octroi de « utilisateurs » au Bâtonnier dans ce fichier
// seulement, sans toucher la table RolePermission partagée avec les autres suites.
vi.mock("../src/lib/rbac.js", async (orig) => {
  const m = await orig<typeof import("../src/lib/rbac.js")>();
  return { ...m, aLaPermission: (r: string, p: string) => (r === "BATONNIER" && p === "utilisateurs") || m.aLaPermission(r, p) };
});

import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { REFUS } from "../src/middleware/auth.js";
import { refusAdminHabilite } from "../src/routes/users.js";

const app = creerApp({ anonyme: 100_000, authentifie: 100_000 });
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const SUF = String(Date.now());
const email = (k: string) => `e2e-habilite-${k}-${SUF}@test.cg`;
let adm = "", sg = "", bat = "", sgId = 0;
const id: Record<string, number> = {};
let rpConsultation: { role: "CONSULTATION"; permission: string }[] = [];

const login = async (e: string) => (await request(app).post("/api/auth/login").send({ email: e, password: "barreau" })).body.token as string;
const nbAlertes = (userId: number) => prisma.notification.count({ where: { userId, type: "securite", message: { contains: SUF } } });
const etat = (i: number) => prisma.user.findUniqueOrThrow({ where: { id: i }, select: { nom: true, email: true, role: true, actif: true, passwordHash: true, tokenVersion: true } });

beforeAll(async () => {
  rpConsultation = (await prisma.rolePermission.findMany({ where: { role: "CONSULTATION" } })).map(({ permission }) => ({ role: "CONSULTATION" as const, permission }));
  const h = bcrypt.hashSync("barreau", 4);
  const comptes = { bat: "BATONNIER", sa: "SECRETAIRE_ADJOINT", tres: "TRESORIERE", avocat: "AVOCAT", cons: "CONSULTATION" } as const;
  for (const [k, role] of Object.entries(comptes)) {
    id[k] = (await prisma.user.create({ data: { nom: `${k} ${SUF}`, email: email(k), role, passwordHash: h } })).id;
  }
  adm = await login("admin@barreau-pn.cg");
  sg = await login("sg@barreau-pn.cg");
  bat = await login(email("bat"));
  sgId = (await prisma.user.findUniqueOrThrow({ where: { email: "sg@barreau-pn.cg" } })).id;
}, 60_000);

afterAll(async () => {
  // Filet : si un refus PUT /rbac avait échoué, la matrice CONSULTATION est restaurée.
  await prisma.rolePermission.deleteMany({ where: { role: "CONSULTATION" } });
  await prisma.rolePermission.createMany({ data: rpConsultation });
  const us = await prisma.user.findMany({ where: { email: { contains: `-${SUF}@test.cg` } }, select: { id: true } });
  await prisma.notification.deleteMany({ where: { message: { contains: SUF } } });
  await prisma.user.deleteMany({ where: { id: { in: us.map((u) => u.id) } } });
});

describe("R1-1 — l'ADMIN ne prend pas la main sur un compte qui accède au contenu (403, base inchangée)", () => {
  it.each(["SECRETAIRE_GENERAL", "BATONNIER", "SECRETAIRE_ADJOINT", "TRESORIERE"])("création d'un compte %s : 403 REFUS, aucun compte créé", async (role) => {
    const e = email(`cree-${role.toLowerCase()}`);
    const r = await request(app).post("/api/users").set(...bearer(adm)).send({ nom: `X ${SUF}`, email: e, role, password: "motdepasse88" });
    expect(r.status).toBe(403);
    expect(r.body.erreur).toBe(REFUS);
    expect(await prisma.user.count({ where: { email: e } })).toBe(0);
  });

  it.each(["SECRETAIRE_GENERAL", "BATONNIER", "SECRETAIRE_ADJOINT", "TRESORIERE"])("promotion d'un compte Consultation en %s : 403, rôle inchangé", async (role) => {
    expect((await request(app).patch(`/api/users/${id.cons}`).set(...bearer(adm)).send({ role })).status).toBe(403);
    expect((await etat(id.cons)).role).toBe("CONSULTATION");
  });

  it("redéfinition du mot de passe d'un SG, Bâtonnier, SA, Trésorière, Avocat : 403, empreinte et session inchangées", async () => {
    for (const i of [sgId, id.bat, id.sa, id.tres, id.avocat]) {
      const avant = await etat(i);
      const r = await request(app).post(`/api/users/${i}/password`).set(...bearer(adm)).send({ password: "piratage888" });
      expect(r.status).toBe(403);
      expect(await etat(i)).toEqual(avant);
    }
  });

  it("modification de l'email ou du nom, ou rétrogradation d'un compte habilité : 403, compte inchangé", async () => {
    for (const i of [id.bat, id.avocat]) {
      const avant = await etat(i);
      // Changer l'email ouvrirait la voie « mot de passe oublié » vers une boîte de l'ADMIN.
      for (const body of [{ email: email("detourne") }, { nom: "Renommé" }, { role: "CONSULTATION" }, { actif: true, nom: "Renommé" }]) {
        expect((await request(app).patch(`/api/users/${i}`).set(...bearer(adm)).send(body)).status).toBe(403);
      }
      expect(await etat(i)).toEqual(avant);
    }
  });

  it("suppression d'un compte habilité : 403, compte conservé", async () => {
    expect((await request(app).delete(`/api/users/${id.sa}`).set(...bearer(adm))).status).toBe(403);
    expect(await prisma.user.count({ where: { id: id.sa } })).toBe(1);
  });

  it("PUT /rbac : l'ADMIN n'ouvre pas la messagerie à Consultation (403, matrice inchangée) ; il peut toujours retirer un module", async () => {
    const avant = (await request(app).get("/api/rbac").set(...bearer(adm))).body.matrice.CONSULTATION as string[];
    expect(avant).not.toContain("messagerie");
    const r = await request(app).put("/api/rbac").set(...bearer(adm)).send({ role: "CONSULTATION", permissions: [...avant, "messagerie"] });
    expect(r.status).toBe(403);
    expect((await request(app).get("/api/rbac").set(...bearer(adm))).body.matrice.CONSULTATION).toEqual(avant);
    expect((await request(app).put("/api/rbac").set(...bearer(adm)).send({ role: "CONSULTATION", permissions: avant })).status).toBe(200);
  });
});

describe("R1-1 — ce qui reste permis", () => {
  it("l'ADMIN désactive puis réactive un compte habilité : 200, alerte au titulaire et au SG", async () => {
    const av = await nbAlertes(sgId);
    expect((await request(app).patch(`/api/users/${id.sa}`).set(...bearer(adm)).send({ actif: false })).status).toBe(200);
    expect((await etat(id.sa)).actif).toBe(false);
    expect(await nbAlertes(id.sa)).toBe(1);
    expect(await nbAlertes(sgId)).toBe(av + 1);
    expect((await request(app).patch(`/api/users/${id.sa}`).set(...bearer(adm)).send({ actif: true })).status).toBe(200);
    expect((await etat(id.sa)).actif).toBe(true);
  });

  it("l'ADMIN gère toujours un compte sans accès au contenu (Consultation, Accueil) : mot de passe, rôle, création", async () => {
    expect((await request(app).post(`/api/users/${id.cons}/password`).set(...bearer(adm)).send({ password: "nouveaumdp88" })).status).toBe(200);
    expect((await request(app).patch(`/api/users/${id.cons}`).set(...bearer(adm)).send({ role: "ACCUEIL", nom: `cons ${SUF}` })).status).toBe(200);
    expect((await request(app).patch(`/api/users/${id.cons}`).set(...bearer(adm)).send({ role: "CONSULTATION" })).status).toBe(200);
    const c = await request(app).post("/api/users").set(...bearer(adm)).send({ nom: `Acc ${SUF}`, email: email("acc"), role: "ACCUEIL", password: "motdepasse88" });
    expect(c.status).toBe(201);
    expect(await nbAlertes(id.cons)).toBe(0);
  });

  it("le SG garde la main : crée un SA, redéfinit son mot de passe, crée un SG et une Trésorière ; refus du Bâtonnier inchangé (R-42)", async () => {
    const c = await request(app).post("/api/users").set(...bearer(sg)).send({ nom: `SA2 ${SUF}`, email: email("sa2"), role: "SECRETAIRE_ADJOINT", password: "motdepasse88" });
    expect(c.status).toBe(201);
    expect((await request(app).post(`/api/users/${c.body.id}/password`).set(...bearer(sg)).send({ password: "nouveaumdp88" })).status).toBe(200);
    expect((await request(app).post("/api/users").set(...bearer(sg)).send({ nom: `SG2 ${SUF}`, email: email("sg2"), role: "SECRETAIRE_GENERAL", password: "motdepasse88" })).status).toBe(201);
    expect((await request(app).post("/api/users").set(...bearer(sg)).send({ nom: `Tres2 ${SUF}`, email: email("tres2"), role: "TRESORIERE", password: "motdepasse88" })).status).toBe(201);
    expect((await request(app).post(`/api/users/${id.bat}/password`).set(...bearer(sg)).send({ password: "nouveaumdp88" })).status).toBe(403);
  });

  it("succession : un Bâtonnier doté de « utilisateurs » crée le compte de son successeur ; il ne crée pas d'ADMIN", async () => {
    const c = await request(app).post("/api/users").set(...bearer(bat)).send({ nom: `Bat2 ${SUF}`, email: email("bat2"), role: "BATONNIER", password: "motdepasse88" });
    expect(c.status).toBe(201);
    expect((await request(app).post("/api/users").set(...bearer(bat)).send({ nom: `Adm ${SUF}`, email: email("adm"), role: "ADMIN", password: "motdepasse88" })).status).toBe(403);
  });
});

describe("R1-1 — amorçage (règle pure)", () => {
  it("l'ADMIN ne crée que le tout premier compte SG ou Bâtonnier (aucun compte de ce rôle, même désactivé)", () => {
    expect(refusAdminHabilite("ADMIN", "SECRETAIRE_GENERAL", 0)).toBe(false);
    expect(refusAdminHabilite("ADMIN", "BATONNIER", 0)).toBe(false);
    expect(refusAdminHabilite("ADMIN", "SECRETAIRE_GENERAL", 1)).toBe(true);
    expect(refusAdminHabilite("ADMIN", "SECRETAIRE_ADJOINT", 0)).toBe(true); // le SG crée les SA
    expect(refusAdminHabilite("ADMIN", "AVOCAT", 0)).toBe(true);
    expect(refusAdminHabilite("ADMIN", "CONSULTATION", 3)).toBe(false);
    expect(refusAdminHabilite("ADMIN", "ADMIN", 2)).toBe(false);
    expect(refusAdminHabilite("SECRETAIRE_GENERAL", "SECRETAIRE_GENERAL", 1)).toBe(false);
  });
});
