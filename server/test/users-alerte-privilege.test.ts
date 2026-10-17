import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

/**
 * L'ADMIN a droit à tout (décision de Fabrice du 16/10/2026, M-20261016-admin-droit-a-tout) : il crée,
 * promeut, modifie, réinitialise et supprime tout compte, y compris ceux qui accèdent au contenu
 * (SG, Bâtonnier, SA, Trésorière, AVOCAT), ouvre la messagerie à un rôle et provisionne l'accès à
 * l'espace avocat. Défense en profondeur conservée : chaque action de l'ADMIN sur un compte habilité
 * est alertée au titulaire et au SG, et le 409 « accès déjà activé » vaut pour tout opérateur.
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
  // Filet : si la restauration PUT /rbac avait échoué, la matrice CONSULTATION est restaurée.
  await prisma.rolePermission.deleteMany({ where: { role: "CONSULTATION" } });
  await prisma.rolePermission.createMany({ data: rpConsultation });
  const us = await prisma.user.findMany({ where: { email: { contains: `-${SUF}@test.cg` } }, select: { id: true } });
  await prisma.notification.deleteMany({ where: { message: { contains: SUF } } });
  await prisma.journalNotification.deleteMany({ where: { destinataire: { contains: `-${SUF}@test.cg` } } });
  await prisma.user.deleteMany({ where: { id: { in: us.map((u) => u.id) } } });
});

const derniere = async (userId: number) =>
  (await prisma.notification.findFirst({ where: { userId, type: "securite", message: { contains: SUF } }, orderBy: { id: "desc" } }))?.message ?? "";
const HABILITES = ["SECRETAIRE_GENERAL", "BATONNIER", "SECRETAIRE_ADJOINT", "TRESORIERE"] as const;
const compte = async (k: string, role: string) =>
  (await prisma.user.create({ data: { nom: `${k} ${SUF}`, email: email(k), role: role as never, passwordHash: bcrypt.hashSync("barreau", 4) } })).id;

describe("L'ADMIN a droit à tout sur les comptes habilités (200/201), avec alerte au titulaire et au SG", () => {
  it.each(HABILITES)("création d'un compte %s : 201, compte créé, alerte « Création du compte »", async (role) => {
    const e = email(`cree-${role.toLowerCase()}`);
    const r = await request(app).post("/api/users").set(...bearer(adm)).send({ nom: `X ${role} ${SUF}`, email: e, role, password: "motdepasse88" });
    expect(r.status).toBe(201);
    expect(r.body.role).toBe(role);
    expect(await derniere(r.body.id)).toContain("Création du compte");
  });

  it.each(HABILITES)("promotion d'un compte Consultation en %s : 200, rôle changé, alerte", async (role) => {
    const i = await compte(`promu-${role.toLowerCase()}`, "CONSULTATION");
    const r = await request(app).patch(`/api/users/${i}`).set(...bearer(adm)).send({ role });
    expect(r.status).toBe(200);
    expect((await etat(i)).role).toBe(role);
    expect(await derniere(i)).toContain("Modification du compte");
  });

  it.each(HABILITES)("modification du nom et de l'email d'un compte %s : 200, alerte « Modification du compte » au titulaire et au SG", async (role) => {
    const i = await compte(`modif-${role.toLowerCase()}`, role);
    const avSg = await nbAlertes(sgId);
    const r = await request(app).patch(`/api/users/${i}`).set(...bearer(adm)).send({ nom: `Renommé ${SUF}`, email: email(`modif2-${role.toLowerCase()}`) });
    expect(r.status).toBe(200);
    expect((await etat(i)).nom).toBe(`Renommé ${SUF}`);
    expect(await derniere(i)).toContain("Modification du compte");
    expect(await nbAlertes(sgId)).toBe(avSg + 1);
  });

  it("rétrogradation d'un Bâtonnier en Consultation : 200, alerte (l'ancien rôle était habilité)", async () => {
    const i = await compte("retro-bat", "BATONNIER");
    expect((await request(app).patch(`/api/users/${i}`).set(...bearer(adm)).send({ role: "CONSULTATION" })).status).toBe(200);
    expect(await derniere(i)).toContain("Modification du compte");
  });

  it.each([...HABILITES, "AVOCAT"])("réinitialisation du mot de passe d'un compte %s : 200, empreinte changée, alerte", async (role) => {
    const i = await compte(`mdp-${role.toLowerCase()}`, role);
    const avant = (await etat(i)).passwordHash;
    expect((await request(app).post(`/api/users/${i}/password`).set(...bearer(adm)).send({ password: "nouveaumdp88" })).status).toBe(200);
    expect((await etat(i)).passwordHash).not.toBe(avant);
    expect(await derniere(i)).toContain("Réinitialisation du mot de passe");
  });

  it("réinitialisation du mot de passe d'un AVOCAT : alerte au SG et email à l'adresse d'avant (hors session contrôlée par l'ADMIN)", async () => {
    const i = await compte("mdp-mail-avocat", "AVOCAT");
    const avSg = await nbAlertes(sgId);
    expect((await request(app).post(`/api/users/${i}/password`).set(...bearer(adm)).send({ password: "nouveaumdp88" })).status).toBe(200);
    expect(await nbAlertes(sgId)).toBe(avSg + 1);
    const mails = await prisma.journalNotification.count({ where: { canal: "EMAIL", destinataire: email("mdp-mail-avocat"), evenement: "ALERTE_PRIVILEGE" } });
    expect(mails).toBe(1);
  });

  it("changement d'email d'un AVOCAT : l'email d'alerte part à l'ancienne adresse", async () => {
    const i = await compte("chg-mail-avocat", "AVOCAT");
    const ancien = email("chg-mail-avocat");
    expect((await request(app).patch(`/api/users/${i}`).set(...bearer(adm)).send({ email: email("chg-mail-avocat2") })).status).toBe(200);
    expect(await prisma.journalNotification.count({ where: { destinataire: ancien, evenement: "ALERTE_PRIVILEGE" } })).toBe(1);
  });

  it("suppression d'un compte habilité : 200, compte supprimé", async () => {
    const i = await compte("suppr-sa", "SECRETAIRE_ADJOINT");
    expect((await request(app).delete(`/api/users/${i}`).set(...bearer(adm))).status).toBe(200);
    expect(await prisma.user.count({ where: { id: i } })).toBe(0);
  });

  it("PUT /rbac : l'ADMIN ouvre la messagerie à Consultation (200, matrice relue avec messagerie) puis la retire", async () => {
    const avant = (await request(app).get("/api/rbac").set(...bearer(adm))).body.matrice.CONSULTATION as string[];
    expect(avant).not.toContain("messagerie");
    const r = await request(app).put("/api/rbac").set(...bearer(adm)).send({ role: "CONSULTATION", permissions: [...avant, "messagerie"] });
    expect(r.status).toBe(200);
    expect((await request(app).get("/api/rbac").set(...bearer(adm))).body.matrice.CONSULTATION).toContain("messagerie");
    expect((await request(app).put("/api/rbac").set(...bearer(adm)).send({ role: "CONSULTATION", permissions: avant })).status).toBe(200);
    expect((await request(app).get("/api/rbac").set(...bearer(adm))).body.matrice.CONSULTATION).toEqual(avant);
  });
});

/**
 * Lien d'activation : l'ADMIN provisionne l'accès espace comme le SG (201, lien) et approuve une
 * demande d'accès. Le 409 « déjà activé » s'applique à tout opérateur, ADMIN compris : désactiver un
 * AVOCAT actif puis lui « renvoyer » un lien d'activation qui revient à l'opérateur permettrait de
 * choisir son mot de passe par /auth/activer (vecteur relevé par la QA).
 */
describe("Lien d'activation : l'ADMIN ouvre l'accès espace ; le 409 « déjà activé » vaut pour tous", () => {
  const membresCrees: number[] = [];
  let membreId = 0, userId = 0, hashAvant = "";
  const mailAv = email("avocat-actif");

  beforeAll(async () => {
    const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `E2E habilite ${SUF}`, qualite: "AVOCAT", email: mailAv });
    membreId = m.body.id;
    membresCrees.push(membreId);
    const u = await prisma.user.create({ data: { nom: `Me habilite ${SUF}`, email: mailAv, role: "AVOCAT", membreId, actif: true, passwordHash: bcrypt.hashSync("barreau", 4) } });
    userId = u.id;
    hashAvant = u.passwordHash;
  });

  afterAll(async () => {
    await prisma.demandeAcces.deleteMany({ where: { email: { contains: `-${SUF}@test.cg` } } });
    await prisma.user.deleteMany({ where: { membreId: { in: membresCrees } } });
    for (const mid of membresCrees) await request(app).delete(`/api/membres/${mid}`).set(...bearer(adm));
  });

  it("CA4/CA7 : l'ADMIN provisionne un nouvel avocat (201, lien) et renvoie le lien tant qu'il n'est pas activé (201, renvoi)", async () => {
    const m = await request(app).post("/api/membres").set(...bearer(adm)).send({ nom: `E2E habilite admin ${SUF}`, qualite: "AVOCAT", email: email("avocat-admin") });
    membresCrees.push(m.body.id);
    const p1 = await request(app).post(`/api/membres/${m.body.id}/acces`).set(...bearer(adm));
    expect(p1.status).toBe(201);
    expect(p1.body.lien).toContain("/activer/");
    const p2 = await request(app).post(`/api/membres/${m.body.id}/acces`).set(...bearer(adm));
    expect(p2.status).toBe(201);
    expect(p2.body.renvoi).toBe(true);
    expect(p2.body.lien).toContain("/activer/");
  });

  it("CA5 : l'ADMIN approuve une demande d'accès à l'espace (201, lien, demande approuvée)", async () => {
    const mail = email("demande-admin");
    await request(app).post("/api/auth/demande-acces").send({ nom: `Demande admin ${SUF}`, email: mail, numInscription: "PN-0000", motif: "Accès à mon espace personnel d'avocat." });
    const d = await prisma.demandeAcces.findFirstOrThrow({ where: { email: mail }, orderBy: { id: "desc" } });
    const r = await request(app).post(`/api/demandes-acces/${d.id}/approuver-espace`).set(...bearer(adm));
    expect(r.status).toBe(201);
    membresCrees.push(r.body.membreId);
    expect(r.body.lien).toContain("/activer/");
    expect((await prisma.demandeAcces.findUniqueOrThrow({ where: { id: d.id } })).statut).toBe("APPROUVEE");
  });

  it("CA7 : désactivation (200) puis POST /membres/:id/acces par l'ADMIN : 409, aucun lien, empreinte inchangée, connexion impossible", async () => {
    expect((await request(app).patch(`/api/users/${userId}`).set(...bearer(adm)).send({ actif: false })).status).toBe(200);
    const r = await request(app).post(`/api/membres/${membreId}/acces`).set(...bearer(adm));
    expect(r.status).toBe(409);
    expect(r.body.lien).toBeUndefined();
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u.passwordHash).toBe(hashAvant);
    expect(u.activationToken).toBeNull();
    expect((await request(app).post("/api/auth/login").send({ email: mailAv, password: "choisiparadmin8" })).status).toBe(401);
  });

  it("approbation par l'ADMIN d'une demande d'accès à l'email d'un avocat déjà activé : 409, demande relibérée, aucun lien", async () => {
    await request(app).post("/api/auth/demande-acces").send({ nom: `Usurpation ${SUF}`, email: mailAv, numInscription: "PN-0000", motif: "Accès à mon espace personnel d'avocat." });
    const d = await prisma.demandeAcces.findFirstOrThrow({ where: { email: mailAv }, orderBy: { id: "desc" } });
    const r = await request(app).post(`/api/demandes-acces/${d.id}/approuver-espace`).set(...bearer(adm));
    expect(r.status).toBe(409);
    expect(r.body.lien).toBeUndefined();
    expect((await prisma.demandeAcces.findUniqueOrThrow({ where: { id: d.id } })).statut).toBe("EN_ATTENTE");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).activationToken).toBeNull();
  });

  it("même le SG ne régénère pas de lien sur un compte déjà activé (409) : la réouverture passe par Utilisateurs et « mot de passe oublié »", async () => {
    const r = await request(app).post(`/api/membres/${membreId}/acces`).set(...bearer(sg));
    expect(r.status).toBe(409);
    expect(r.body.lien).toBeUndefined();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash).toBe(hashAvant);
  });

  it("cas positif : le SG provisionne un nouvel avocat (201, lien) et renvoie le lien tant qu'il n'est pas activé", async () => {
    const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `E2E habilite neuf ${SUF}`, qualite: "AVOCAT", email: email("avocat-neuf") });
    membresCrees.push(m.body.id);
    const p1 = await request(app).post(`/api/membres/${m.body.id}/acces`).set(...bearer(sg));
    expect(p1.status).toBe(201);
    expect(p1.body.lien).toContain("/activer/");
    const p2 = await request(app).post(`/api/membres/${m.body.id}/acces`).set(...bearer(sg));
    expect(p2.status).toBe(201);
    expect(p2.body.renvoi).toBe(true);
  });
});

describe("Ce qui reste inchangé : alerte de (dés)activation, comptes non habilités, SG, succession", () => {
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

