import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";

const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;

async function login(email: string) {
  const r = await request(app).post("/api/auth/login").send({ email, password: "barreau" });
  return r.body as { token: string; refreshToken: string };
}

let sg = "";
let tr = "";
let admin = "";

beforeAll(async () => {
  sg = (await login("sg@barreau-pn.cg")).token;
  tr = (await login("tresoriere@barreau-pn.cg")).token;
  admin = (await login("admin@barreau-pn.cg")).token;
});

describe("Authentification & sécurité", () => {
  it("rejette de mauvais identifiants (401)", async () => {
    const r = await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "faux" });
    expect(r.status).toBe(401);
  });

  it("login renvoie un access et un refresh token", async () => {
    const r = await login("sg@barreau-pn.cg");
    expect(r.token).toBeTruthy();
    expect(r.refreshToken).toBeTruthy();
  });

  it("refuse l'accès sans jeton (401)", async () => {
    const r = await request(app).get("/api/membres");
    expect(r.status).toBe(401);
  });

  it("rotation du refresh token : l'ancien est révoqué", async () => {
    const { refreshToken } = await login("sg@barreau-pn.cg");
    const r1 = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.token).toBeTruthy();
    const r2 = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(r2.status).toBe(401);
  });
});

describe("Cycle financier — règles métier (BR-01, BR-03, RBAC)", () => {
  const annee = 2026;
  let membreId = 0;

  it("inscrit un avocat (SG)", async () => {
    const r = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `TEST Vitest ${Date.now()}`, qualite: "AVOCAT" });
    expect(r.status).toBe(201);
    expect(r.body.numInscription).toMatch(/^PN-/);
    membreId = r.body.id;
  });

  it("BR-01 : quitus bloqué si non à jour (409)", async () => {
    const r = await request(app).post("/api/quitus").set(...bearer(sg)).send({ membreId, annee });
    expect(r.status).toBe(409);
  });

  it("BR-03 : un paiement émet un reçu et met la cotisation à jour", async () => {
    const r = await request(app).post("/api/cotisations/paiement").set(...bearer(sg)).send({ membreId, annee, montant: 150000, mode: "Espèces" });
    expect(r.status).toBe(201);
    expect(r.body.recu.numero).toBeTruthy();
    const c = await request(app).get(`/api/cotisations?annee=${annee}`).set(...bearer(sg));
    const ligne = c.body.lignes.find((l: any) => l.membre.id === membreId);
    expect(ligne.statut).toBe("ajour");
  });

  it("RBAC : le Secrétaire Général ne peut pas valider (403)", async () => {
    const r = await request(app).post(`/api/cotisations/${membreId}/valider`).set(...bearer(sg)).send({ annee });
    expect(r.status).toBe(403);
  });

  it("la Trésorière valide la situation (200)", async () => {
    const r = await request(app).post(`/api/cotisations/${membreId}/valider`).set(...bearer(tr)).send({ annee });
    expect(r.status).toBe(200);
    expect(r.body.valideTresoriere).toBe(true);
  });

  it("BR-01 : quitus délivré après validation (201)", async () => {
    const r = await request(app).post("/api/quitus").set(...bearer(sg)).send({ membreId, annee });
    expect(r.status).toBe(201);
    expect(r.body.numero).toMatch(/^Q-2026-/);
  });
});

describe("Super-administrateur — CRUD étendu (suppressions réservées à l'ADMIN)", () => {
  const creerAvocat = async (nom: string) => {
    const r = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `${nom} ${Date.now()}`, qualite: "AVOCAT" });
    return r.body.id as number;
  };

  it("refuse la suppression d'un avocat au Secrétaire Général (403)", async () => {
    const id = await creerAvocat("SUPPR-RBAC");
    const r = await request(app).delete(`/api/membres/${id}`).set(...bearer(sg));
    expect(r.status).toBe(403);
    await request(app).delete(`/api/membres/${id}`).set(...bearer(admin)); // nettoyage
  });

  it("l'ADMIN supprime un avocat et tout son historique financier (cascade)", async () => {
    const id = await creerAvocat("SUPPR-CASCADE");
    // Génère cotisation + reçu (BR-03), puis un droit de plaidoirie.
    await request(app).post("/api/cotisations/paiement").set(...bearer(sg)).send({ membreId: id, annee: 2026, montant: 150000, mode: "Espèces" });
    await request(app).post("/api/droits/paiement").set(...bearer(sg)).send({ membreId: id, annee: 2026, montant: 1000, mode: "Espèces" });

    const del = await request(app).delete(`/api/membres/${id}`).set(...bearer(admin));
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    // La fiche et l'historique rattaché ont disparu.
    expect((await request(app).get(`/api/membres/${id}`).set(...bearer(sg))).status).toBe(404);
    expect((await request(app).delete(`/api/cotisations/${id}/2026`).set(...bearer(admin))).status).toBe(404);
    expect((await request(app).delete(`/api/droits/${id}/2026`).set(...bearer(admin))).status).toBe(404);
  });

  it("renvoie 404 pour un avocat inexistant", async () => {
    const r = await request(app).delete(`/api/membres/99999999`).set(...bearer(admin));
    expect(r.status).toBe(404);
  });

  it("supprime une ligne de cotisation (ADMIN) mais la refuse au SG (403)", async () => {
    const id = await creerAvocat("COT-SUPPR");
    await request(app).post("/api/cotisations/paiement").set(...bearer(sg)).send({ membreId: id, annee: 2025, montant: 1000, mode: "Espèces" });
    expect((await request(app).delete(`/api/cotisations/${id}/2025`).set(...bearer(sg))).status).toBe(403);
    expect((await request(app).delete(`/api/cotisations/${id}/2025`).set(...bearer(admin))).status).toBe(200);
    await request(app).delete(`/api/membres/${id}`).set(...bearer(admin));
  });

  it("supprime un quitus du registre (ADMIN), refusé au SG (403)", async () => {
    const id = await creerAvocat("QUI-SUPPR");
    await request(app).post("/api/cotisations/paiement").set(...bearer(sg)).send({ membreId: id, annee: 2026, montant: 150000, mode: "Espèces" });
    await request(app).post(`/api/cotisations/${id}/valider`).set(...bearer(tr)).send({ annee: 2026 });
    const q = await request(app).post("/api/quitus").set(...bearer(sg)).send({ membreId: id, annee: 2026 });
    expect(q.status).toBe(201);
    expect((await request(app).delete(`/api/quitus/${q.body.id}`).set(...bearer(sg))).status).toBe(403);
    expect((await request(app).delete(`/api/quitus/${q.body.id}`).set(...bearer(admin))).status).toBe(200);
    await request(app).delete(`/api/membres/${id}`).set(...bearer(admin));
  });

  it("supprime un dossier disciplinaire (ADMIN), refusé au SG (403)", async () => {
    const d = await request(app).post("/api/discipline").set(...bearer(sg)).send({ avocatNom: "TEST Suppression", objet: "Dossier de test" });
    expect(d.status).toBe(201);
    expect((await request(app).delete(`/api/discipline/${d.body.id}`).set(...bearer(sg))).status).toBe(403);
    expect((await request(app).delete(`/api/discipline/${d.body.id}`).set(...bearer(admin))).status).toBe(200);
  });
});

describe("Super-administrateur — comptes utilisateurs (ADMIN)", () => {
  it("refuse la suppression d'un compte au Secrétaire Général (403)", async () => {
    const users = await request(app).get("/api/users").set(...bearer(admin));
    const tres = users.body.find((u: any) => u.role === "TRESORIERE");
    const r = await request(app).delete(`/api/users/${tres.id}`).set(...bearer(sg));
    expect(r.status).toBe(403);
  });

  it("l'ADMIN ne peut pas supprimer son propre compte (400)", async () => {
    const me = await request(app).get("/api/auth/me").set(...bearer(admin));
    const r = await request(app).delete(`/api/users/${me.body.id}`).set(...bearer(admin));
    expect(r.status).toBe(400);
  });

  it("l'ADMIN supprime un compte qu'il a créé (200)", async () => {
    const created = await request(app).post("/api/users").set(...bearer(admin))
      .send({ nom: "Compte Temporaire", email: `temp${Date.now()}@barreau-pn.cg`, role: "SECRETAIRE_GENERAL", password: "motdepasse8" });
    expect(created.status).toBe(201);
    const r = await request(app).delete(`/api/users/${created.body.id}`).set(...bearer(admin));
    expect(r.status).toBe(200);
  });
});

describe("Espace avocat — provisionnement, activation & cloisonnement", () => {
  let membreId = 0;
  let token = ""; // token d'activation
  let avocat = ""; // JWT d'accès de l'avocat
  const email = `avocat.test.${Date.now()}@barreau-pn.cg`;

  it("crée un avocat avec email (SG)", async () => {
    const r = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `ESPACE Test ${Date.now()}`, qualite: "AVOCAT", email });
    expect(r.status).toBe(201);
    membreId = r.body.id;
  });

  it("refuse le provisionnement sans email sur la fiche (400)", async () => {
    const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `NOEMAIL ${Date.now()}`, qualite: "AVOCAT" });
    const r = await request(app).post(`/api/membres/${m.body.id}/acces`).set(...bearer(sg));
    expect(r.status).toBe(400);
    await request(app).delete(`/api/membres/${m.body.id}`).set(...bearer(admin));
  });

  it("provisionne l'accès espace (SG) et renvoie un lien d'activation", async () => {
    const r = await request(app).post(`/api/membres/${membreId}/acces`).set(...bearer(sg));
    expect(r.status).toBe(201);
    expect(r.body.lien).toContain("/activer/");
    token = r.body.lien.split("/activer/")[1];
    expect(token).toBeTruthy();
  });

  it("le compte avocat ne peut pas se connecter avant activation (401)", async () => {
    const r = await request(app).post("/api/auth/login").send({ email, password: "barreau" });
    expect(r.status).toBe(401);
  });

  it("active le compte avec un mot de passe choisi, puis se connecte", async () => {
    const info = await request(app).get(`/api/auth/activation/${token}`);
    expect(info.status).toBe(200);
    expect(info.body.email).toBe(email);
    const act = await request(app).post("/api/auth/activer").send({ token, password: "avocatpass8" });
    expect(act.status).toBe(200);
    avocat = (await request(app).post("/api/auth/login").send({ email, password: "avocatpass8" })).body.token;
    expect(avocat).toBeTruthy();
  });

  it("l'avocat consulte sa situation et ses documents", async () => {
    const moi = await request(app).get("/api/espace/moi").set(...bearer(avocat));
    expect(moi.status).toBe(200);
    expect(moi.body.membre.id).toBe(membreId);
    expect(moi.body.situation.cotisation).toBeTruthy();
    const docs = await request(app).get("/api/espace/documents").set(...bearer(avocat));
    expect(docs.status).toBe(200);
    expect(Array.isArray(docs.body.recus)).toBe(true);
  });

  it("cloisonnement : un jeton avocat est refusé hors de l'espace (403)", async () => {
    expect((await request(app).get("/api/membres").set(...bearer(avocat))).status).toBe(403);
    expect((await request(app).get("/api/cotisations?annee=2026").set(...bearer(avocat))).status).toBe(403);
    expect((await request(app).get("/api/users").set(...bearer(avocat))).status).toBe(403);
  });

  it("l'espace est refusé aux profils du back-office (403)", async () => {
    expect((await request(app).get("/api/espace/moi").set(...bearer(sg))).status).toBe(403);
  });

  it("cloisonnement documentaire : un document inexistant/d'autrui renvoie 404", async () => {
    expect((await request(app).get("/api/espace/recus/99999999/pdf").set(...bearer(avocat))).status).toBe(404);
  });

  it("refuse un second provisionnement quand l'accès est déjà actif (409)", async () => {
    const r = await request(app).post(`/api/membres/${membreId}/acces`).set(...bearer(sg));
    expect(r.status).toBe(409);
  });

  it("régénère le lien tant que l'accès n'est pas activé (renvoi)", async () => {
    const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `RENVOI ${Date.now()}`, qualite: "AVOCAT", email: `renvoi.${Date.now()}@barreau-pn.cg` });
    expect((await request(app).post(`/api/membres/${m.body.id}/acces`).set(...bearer(sg))).status).toBe(201);
    const p2 = await request(app).post(`/api/membres/${m.body.id}/acces`).set(...bearer(sg));
    expect(p2.status).toBe(201);
    expect(p2.body.renvoi).toBe(true);
    await request(app).delete(`/api/membres/${m.body.id}`).set(...bearer(admin)); // cascade le compte
  });
});

describe("Discipline — accès restreint (RG-13)", () => {
  it("interdit l'accès à la Trésorière (403)", async () => {
    const r = await request(app).get("/api/discipline").set(...bearer(tr));
    expect(r.status).toBe(403);
  });
  it("autorise l'accès au Secrétaire Général (200)", async () => {
    const r = await request(app).get("/api/discipline").set(...bearer(sg));
    expect(r.status).toBe(200);
  });
});
