import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

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

  it("l'avocat paie sa cotisation en ligne (sandbox) — reçu émis, situation à jour", async () => {
    const anneeNow = new Date().getFullYear();
    const init = await request(app).post("/api/espace/paiement").set(...bearer(avocat)).send({ annee: anneeNow, type: "cotisation", canal: "MTN" });
    expect(init.status).toBe(201);
    expect(init.body.sandbox).toBe(true);
    const ref = init.body.paiement.ref;
    const conf = await request(app).post(`/api/espace/paiement/${ref}/confirmer-sandbox`).set(...bearer(avocat)).send({ succes: true });
    expect(conf.status).toBe(200);
    expect(conf.body.statut).toBe("REUSSI");
    expect(conf.body.recuNumero).toBeTruthy();
    const moi = await request(app).get("/api/espace/moi").set(...bearer(avocat));
    expect(moi.body.situation.cotisation.paye).toBeGreaterThan(0);
    expect(moi.body.situation.cotisation.solde).toBe(0);
    const docs = await request(app).get("/api/espace/documents").set(...bearer(avocat));
    expect(docs.body.recus.length).toBeGreaterThan(0);
  });

  it("refuse de confirmer un paiement inexistant / d'autrui (404)", async () => {
    expect((await request(app).post("/api/espace/paiement/PAY-INCONNU/confirmer-sandbox").set(...bearer(avocat)).send({ succes: true })).status).toBe(404);
  });

  it("rejette un paiement sans solde à régler (cotisation déjà soldée, 400)", async () => {
    const anneeNow = new Date().getFullYear();
    const r = await request(app).post("/api/espace/paiement").set(...bearer(avocat)).send({ annee: anneeNow, type: "cotisation", canal: "MTN" });
    expect(r.status).toBe(400);
  });

  it("cloisonnement : un jeton avocat est refusé hors de l'espace (403)", async () => {
    expect((await request(app).get("/api/membres").set(...bearer(avocat))).status).toBe(403);
    expect((await request(app).get("/api/cotisations?annee=2026").set(...bearer(avocat))).status).toBe(403);
    expect((await request(app).get("/api/users").set(...bearer(avocat))).status).toBe(403);
    // le paiement staff reste hors d'atteinte du rôle avocat (cloisonnement)
    expect((await request(app).post("/api/paiements/initier").set(...bearer(avocat)).send({ membreId, annee: 2026, montant: 1000, type: "cotisation", canal: "MTN" })).status).toBe(403);
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

describe("Paramètres — données de référence centralisées", () => {
  it("la lecture est ouverte aux profils du back-office (Trésorière, 200)", async () => {
    const r = await request(app).get("/api/parametres").set(...bearer(tr));
    expect(r.status).toBe(200);
    expect(r.body.tarifs).toBeTruthy();
    expect(Array.isArray(r.body.documents.typesPublication)).toBe(true);
    expect(Array.isArray(r.body.paiement.canauxActifs)).toBe(true);
  });

  it("l'écriture reste réservée au Secrétaire Général (Trésorière → 403)", async () => {
    const r = await request(app).put("/api/parametres").set(...bearer(tr)).send({ stage: { dureeMois: 18 } });
    expect(r.status).toBe(403);
  });

  it("le SG met à jour les données de référence et elles sont persistées", async () => {
    const patch = {
      exercices: { premier: 2019 },
      documents: { typesPublication: ["Avis", "Communiqué", "Décision"] },
      paiement: { canauxActifs: ["MTN", "CARTE"] },
      stage: { dureeMois: 18 },
      libellesStatuts: { cotisation: { ajour: "Régularisé" } },
    };
    const put = await request(app).put("/api/parametres").set(...bearer(sg)).send(patch);
    expect(put.status).toBe(200);
    const get = await request(app).get("/api/parametres").set(...bearer(sg));
    expect(get.body.documents.typesPublication).toContain("Décision");
    expect(get.body.paiement.canauxActifs).toEqual(["MTN", "CARTE"]);
    expect(get.body.stage.dureeMois).toBe(18);
    expect(get.body.libellesStatuts.cotisation.ajour).toBe("Régularisé");
    expect(get.body.exercices.premier).toBe(2019);
  });

  it("rejette une clé arbitraire ou un canal inconnu (400)", async () => {
    expect((await request(app).put("/api/parametres").set(...bearer(sg)).send({ inconnu: 1 })).status).toBe(400);
    expect((await request(app).put("/api/parametres").set(...bearer(sg)).send({ paiement: { canauxActifs: ["BITCOIN"] } })).status).toBe(400);
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

describe("Pièces — file de vérification documentaire (RG-15)", () => {
  it("liste transverse accessible au SG/Bâtonnier, filtrable par statut ; Trésorière exclue (403)", async () => {
    expect((await request(app).get("/api/pieces").set(...bearer(tr))).status).toBe(403);
    const toutes = await request(app).get("/api/pieces").set(...bearer(sg));
    expect(toutes.status).toBe(200);
    expect(Array.isArray(toutes.body)).toBe(true);
    const filtre = await request(app).get("/api/pieces?statut=A_VERIFIER").set(...bearer(sg));
    expect(filtre.status).toBe(200);
    expect(filtre.body.every((p: any) => p.statut === "A_VERIFIER")).toBe(true);
    // chaque pièce expose le membre rattaché (pour la file de validation)
    if (toutes.body.length) expect(toutes.body[0].membre).toHaveProperty("nom");
  });
});

describe("Publications — workflow de validation & RBAC", () => {
  it("la Trésorière n'a pas accès au module (403)", async () => {
    expect((await request(app).get("/api/publications").set(...bearer(tr))).status).toBe(403);
  });

  it("le SG crée un projet ; seul le Bâtonnier/Admin peut le VALIDER", async () => {
    const p = await request(app).post("/api/publications").set(...bearer(sg)).send({ titre: `Pub ${Date.now()}`, type: "Avis", contenu: "x" });
    expect(p.status).toBe(201);
    // VALIDE est réservé au Bâtonnier (ou Admin) — le SG est refusé.
    expect((await request(app).post(`/api/publications/${p.body.id}/statut`).set(...bearer(sg)).send({ statut: "VALIDE" })).status).toBe(403);
    expect((await request(app).post(`/api/publications/${p.body.id}/statut`).set(...bearer(admin)).send({ statut: "VALIDE" })).status).toBe(200);
  });

  it("une publication diffusée (PUBLIE) ne peut plus être supprimée (409)", async () => {
    const p = await request(app).post("/api/publications").set(...bearer(sg)).send({ titre: `Pub ${Date.now()}`, type: "Avis" });
    await request(app).post(`/api/publications/${p.body.id}/statut`).set(...bearer(admin)).send({ statut: "PUBLIE" });
    expect((await request(app).delete(`/api/publications/${p.body.id}`).set(...bearer(sg))).status).toBe(409);
  });

  it("un projet non diffusé est supprimable par le SG (200)", async () => {
    const p = await request(app).post("/api/publications").set(...bearer(sg)).send({ titre: `Pub ${Date.now()}`, type: "Avis" });
    expect((await request(app).delete(`/api/publications/${p.body.id}`).set(...bearer(sg))).status).toBe(200);
  });
});

describe("Réunions & Assemblées — création réservée au SG", () => {
  it("le SG crée, met à jour et supprime une réunion ; la Trésorière est exclue (403)", async () => {
    expect((await request(app).get("/api/reunions").set(...bearer(tr))).status).toBe(403);
    const r = await request(app).post("/api/reunions").set(...bearer(sg)).send({ date: "2026-09-01", lieu: "Maison de l'Avocat", ordreDuJour: ["Point 1"] });
    expect(r.status).toBe(201);
    const patch = await request(app).patch(`/api/reunions/${r.body.id}`).set(...bearer(sg)).send({ pv: "Compte rendu", statut: "TENUE" });
    expect(patch.status).toBe(200);
    expect(patch.body.pv).toBe("Compte rendu");
    expect((await request(app).delete(`/api/reunions/${r.body.id}`).set(...bearer(sg))).status).toBe(200);
  });

  it("le SG crée une assemblée AGO ; un type invalide est rejeté (400)", async () => {
    const a = await request(app).post("/api/assemblees").set(...bearer(sg)).send({ type: "AGO", date: "2026-10-01", ordreDuJour: ["Bilan"] });
    expect(a.status).toBe(201);
    const patch = await request(app).patch(`/api/assemblees/${a.body.id}`).set(...bearer(sg)).send({ decisions: ["Adopté"], quorumPresent: 42 });
    expect(patch.status).toBe(200);
    expect(patch.body.decisions).toContain("Adopté");
    expect((await request(app).post("/api/assemblees").set(...bearer(sg)).send({ type: "XXX", date: "2026-10-01" })).status).toBe(400);
  });
});

describe("Archives — registre documentaire (RG-14, suppression SG)", () => {
  it("crée, recherche puis supprime une archive (suppression réservée au SG)", async () => {
    const ref = `E2E-ARC-${Date.now()}`;
    const a = await request(app).post("/api/archives").set(...bearer(sg)).send({ categorie: "Test E2E", titre: "Document de test", reference: ref });
    expect(a.status).toBe(201);
    const recherche = await request(app).get(`/api/archives?q=${ref}`).set(...bearer(sg));
    expect(recherche.status).toBe(200);
    expect(Array.isArray(recherche.body.archives)).toBe(true);
    expect(recherche.body.archives.some((x: any) => x.id === a.body.id)).toBe(true);
    expect(Array.isArray(recherche.body.categories)).toBe(true);
    // suppression réservée au SG (Trésorière exclue du module → 403)
    expect((await request(app).delete(`/api/archives/${a.body.id}`).set(...bearer(tr))).status).toBe(403);
    expect((await request(app).delete(`/api/archives/${a.body.id}`).set(...bearer(sg))).status).toBe(200);
  });

  it("rejette une date d'archive invalide (400)", async () => {
    const r = await request(app).post("/api/archives").set(...bearer(sg)).send({ categorie: "Test", titre: "x", date: "pas-une-date" });
    expect(r.status).toBe(400);
  });
});

describe("Droits de plaidoirie — paiement & reçu (miroir BR-03)", () => {
  it("enregistre un paiement et reflète le solde ; montant négatif rejeté (400)", async () => {
    const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `DROIT Test ${Date.now()}`, qualite: "AVOCAT" });
    const membreId = m.body.id;
    const annee = new Date().getFullYear();
    expect((await request(app).post("/api/droits/paiement").set(...bearer(sg)).send({ membreId, annee, montant: -1 })).status).toBe(400);
    const pay = await request(app).post("/api/droits/paiement").set(...bearer(sg)).send({ membreId, annee, montant: 10000, mode: "Espèces" });
    expect(pay.status).toBeLessThan(300);
    const grille = await request(app).get(`/api/droits?annee=${annee}`).set(...bearer(tr));
    expect(grille.status).toBe(200);
    const ligne = grille.body.lignes.find((l: any) => l.membre.id === membreId);
    expect(ligne.aLigne).toBe(true);
    expect(ligne.paye).toBeGreaterThan(0);
  });
});

describe("Demandes d'accès — dépôt public & traitement (SG/Admin)", () => {
  it("dépôt public sans authentification, puis approbation unique (re-traitement → 409)", async () => {
    const email = `demande.${Date.now()}@exemple.cg`;
    const depot = await request(app).post("/api/auth/demande-acces").send({ nom: "Confrère Test", email, motif: "Je souhaite accéder à mon espace personnel." });
    expect(depot.status).toBeLessThan(300);
    // la Trésorière ne peut pas consulter les demandes (SG/Admin only)
    expect((await request(app).get("/api/demandes-acces").set(...bearer(tr))).status).toBe(403);
    const liste = await request(app).get("/api/demandes-acces").set(...bearer(sg));
    expect(liste.status).toBe(200);
    const demande = liste.body.find((d: any) => d.email === email);
    expect(demande).toBeTruthy();
    expect(demande.statut).toBe("EN_ATTENTE");
    expect((await request(app).post(`/api/demandes-acces/${demande.id}/approuver`).set(...bearer(sg))).status).toBe(200);
    // une demande déjà traitée ne peut être ré-approuvée (409)
    expect((await request(app).post(`/api/demandes-acces/${demande.id}/approuver`).set(...bearer(sg))).status).toBe(409);
  });

  it("approbation « accès espace avocat » : crée la fiche + un compte AVOCAT inactif avec lien d'activation", async () => {
    const email = `avodemande.${Date.now()}@exemple.cg`;
    const nom = `DEMANDE Avocat ${Date.now()}`;
    await request(app).post("/api/auth/demande-acces").send({ nom, email, numInscription: "PN-9999", motif: "Accès à mon espace personnel d'avocat." });
    const demande = (await request(app).get("/api/demandes-acces").set(...bearer(sg))).body.find((d: any) => d.email === email);
    const r = await request(app).post(`/api/demandes-acces/${demande.id}/approuver-espace`).set(...bearer(sg));
    expect(r.status).toBe(201);
    expect(r.body.lien).toContain("/activer/");
    expect(r.body.membreId).toBeGreaterThan(0);
    // la fiche membre avocat existe désormais
    const membres = await request(app).get(`/api/membres?q=${encodeURIComponent(nom)}`).set(...bearer(sg));
    expect(membres.body.items.some((m: any) => m.nom === nom)).toBe(true);
    // un compte AVOCAT inactif (en attente d'activation) a été provisionné
    const compte = (await request(app).get("/api/users").set(...bearer(admin))).body.find((u: any) => u.email === email);
    expect(compte).toBeTruthy();
    expect(compte.role).toBe("AVOCAT");
    expect(compte.actif).toBe(false);
    // la demande est traitée → re-traitement refusé (409)
    expect((await request(app).post(`/api/demandes-acces/${demande.id}/approuver-espace`).set(...bearer(sg))).status).toBe(409);
  });
});

/** Provisionne un avocat avec accès espace activé ; renvoie sa fiche + son JWT. */
async function creerAvocatEspace(suffixe: string) {
  const email = `e2e.${suffixe}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@barreau-pn.cg`;
  const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `E2E ${suffixe} ${Date.now()}`, qualite: "AVOCAT", email });
  const membreId = m.body.id as number;
  const prov = await request(app).post(`/api/membres/${membreId}/acces`).set(...bearer(sg));
  const activation = prov.body.lien.split("/activer/")[1];
  await request(app).post("/api/auth/activer").send({ token: activation, password: "avocatpass8" });
  const token = (await request(app).post("/api/auth/login").send({ email, password: "avocatpass8" })).body.token as string;
  return { membreId, email, token };
}

describe("Sécurité — réinitialisation de mot de passe", () => {
  it("forgot-password répond 200 sans divulguer l'existence du compte", async () => {
    expect((await request(app).post("/api/auth/forgot-password").send({ email: "sg@barreau-pn.cg" })).status).toBe(200);
    expect((await request(app).post("/api/auth/forgot-password").send({ email: "inconnu@nulle-part.cg" })).status).toBe(200);
  });

  it("reset avec un token invalide → 404", async () => {
    expect((await request(app).post("/api/auth/reset").send({ token: "faux-token", password: "nouveaupass8" })).status).toBe(404);
  });

  it("flux complet : lien → nouveau mot de passe → connexion (token à usage unique)", async () => {
    const av = await creerAvocatEspace("reset");
    await request(app).post("/api/auth/forgot-password").send({ email: av.email });
    const u = await prisma.user.findUnique({ where: { email: av.email } });
    expect(u?.resetToken).toBeTruthy();
    expect((await request(app).get(`/api/auth/reset/${u!.resetToken}`)).status).toBe(200);
    expect((await request(app).post("/api/auth/reset").send({ token: u!.resetToken, password: "toutNeuf9" })).status).toBe(200);
    // ancien mot de passe rejeté, nouveau accepté
    expect((await request(app).post("/api/auth/login").send({ email: av.email, password: "avocatpass8" })).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email: av.email, password: "toutNeuf9" })).status).toBe(200);
    // token consommé
    expect((await request(app).post("/api/auth/reset").send({ token: u!.resetToken, password: "encore9999" })).status).toBe(404);
  });
});

describe("Sécurité — accès espace lié au statut du membre", () => {
  it("suspension coupe l'accès ; retour à INSCRIT le rétablit automatiquement", async () => {
    const av = await creerAvocatEspace("statut");
    expect((await request(app).post("/api/auth/login").send({ email: av.email, password: "avocatpass8" })).status).toBe(200);
    await request(app).patch(`/api/membres/${av.membreId}`).set(...bearer(sg)).send({ statut: "SUSPENDU" });
    expect((await request(app).post("/api/auth/login").send({ email: av.email, password: "avocatpass8" })).status).toBe(401);
    await request(app).patch(`/api/membres/${av.membreId}`).set(...bearer(sg)).send({ statut: "INSCRIT" });
    expect((await request(app).post("/api/auth/login").send({ email: av.email, password: "avocatpass8" })).status).toBe(200);
  });
});

describe("Journal d'audit — consultation (RG-16)", () => {
  it("accessible au SG, refusé à la Trésorière (403), paginé", async () => {
    expect((await request(app).get("/api/audit").set(...bearer(tr))).status).toBe(403);
    const r = await request(app).get("/api/audit?pageSize=5").set(...bearer(sg));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.items)).toBe(true);
    expect(typeof r.body.total).toBe("number");
    expect(r.body.pageSize).toBe(5);
  });
});

describe("Espace avocat — consultation (annuaire, AG, publications, archives, discipline)", () => {
  let av: { membreId: number; token: string };
  beforeAll(async () => { av = await creerAvocatEspace("conso"); });

  it("annuaire : 200, exclut sa propre fiche, sans données sensibles", async () => {
    const r = await request(app).get("/api/espace/annuaire").set(...bearer(av.token));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.some((m: any) => m.id === av.membreId)).toBe(false);
    if (r.body.length) expect(r.body[0]).not.toHaveProperty("adresse");
  });

  it("assemblées : 200 (liste)", async () => {
    const r = await request(app).get("/api/espace/assemblees").set(...bearer(av.token));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });

  it("publications : ne renvoie que les éléments PUBLIE", async () => {
    const p = await request(app).post("/api/publications").set(...bearer(sg)).send({ titre: `E2E Pub ${Date.now()}`, type: "Avis", contenu: "x" });
    await request(app).post(`/api/publications/${p.body.id}/statut`).set(...bearer(sg)).send({ statut: "PUBLIE" });
    const brouillon = await request(app).post("/api/publications").set(...bearer(sg)).send({ titre: `E2E Brouillon ${Date.now()}`, type: "Avis" });
    const r = await request(app).get("/api/espace/publications").set(...bearer(av.token));
    expect(r.status).toBe(200);
    expect(r.body.every((x: any) => x.statut === "PUBLIE")).toBe(true);
    expect(r.body.some((x: any) => x.id === p.body.id)).toBe(true);
    expect(r.body.some((x: any) => x.id === brouillon.body.id)).toBe(false);
  });

  it("archives : forme {archives, categories}, aucune catégorie disciplinaire", async () => {
    const r = await request(app).get("/api/espace/archives").set(...bearer(av.token));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.archives)).toBe(true);
    expect(Array.isArray(r.body.categories)).toBe(true);
    expect(r.body.categories.some((c: string) => /disciplinaire/i.test(c))).toBe(false);
  });

  it("discipline : ne voit que les dossiers le concernant", async () => {
    const mien = await request(app).post("/api/discipline").set(...bearer(sg)).send({ avocatNom: "E2E Conso", objet: "Le concernant", membreId: av.membreId });
    const autre = await request(app).post("/api/discipline").set(...bearer(sg)).send({ avocatNom: "Autre Confrère", objet: "D'autrui" });
    const r = await request(app).get("/api/espace/discipline").set(...bearer(av.token));
    expect(r.status).toBe(200);
    expect(r.body.some((d: any) => d.id === mien.body.id)).toBe(true);
    expect(r.body.some((d: any) => d.id === autre.body.id)).toBe(false);
    expect((await request(app).get(`/api/espace/discipline/${autre.body.id}`).set(...bearer(av.token))).status).toBe(404);
  });
});

describe("Messagerie interne — symétrie des non-lus & cloisonnement", () => {
  let a: { membreId: number; token: string };
  let b: { membreId: number; token: string };
  beforeAll(async () => {
    a = await creerAvocatEspace("msgA");
    b = await creerAvocatEspace("msgB");
  });

  const total = async (tok: string) => (await request(app).get("/api/espace/messagerie/non-lus").set(...bearer(tok))).body.total as number;
  const filNonLus = async (tok: string, id: number) => {
    const r = await request(app).get("/api/espace/messagerie").set(...bearer(tok));
    if (!Array.isArray(r.body)) throw new Error(`liste non-array: status=${r.status} body=${JSON.stringify(r.body)}`);
    const f = r.body.find((c) => c.id === id);
    return f ? f.nonLus : -1;
  };

  it("la route /non-lus n'est pas captée par /:id", async () => {
    const r = await request(app).get("/api/espace/messagerie/non-lus").set(...bearer(a.token));
    expect(r.status).toBe(200);
    expect(typeof r.body.total).toBe("number");
  });

  it("avocat ↔ administration : le badge avocat monte sur réponse admin (régression NULL)", async () => {
    const c = await request(app).post("/api/espace/messagerie").set(...bearer(a.token)).send({ sujet: "E2E admin", corps: "bonjour", avecAdministration: true });
    expect(c.status).toBe(201);
    const cid = c.body.id;

    const filAdmin = (await request(app).get("/api/messagerie").set(...bearer(sg))).body.find((x: any) => x.id === cid);
    expect(filAdmin).toBeTruthy();
    expect(filAdmin.nonLus).toBeGreaterThanOrEqual(1);

    await request(app).get(`/api/espace/messagerie/${cid}`).set(...bearer(a.token)); // a lit
    expect(await filNonLus(a.token, cid)).toBe(0);
    const avant = await total(a.token);

    expect((await request(app).post(`/api/messagerie/${cid}`).set(...bearer(sg)).send({ corps: "réponse" })).status).toBe(201);
    expect(await total(a.token)).toBe(avant + 1);

    const fil = await request(app).get(`/api/espace/messagerie/${cid}`).set(...bearer(a.token));
    expect(fil.body.messages.length).toBe(2);
    expect(fil.body.messages[1].estAdministration).toBe(true);
  });

  it("confrère ↔ confrère : visible par le destinataire, invisible pour l'administration", async () => {
    const sujet = `E2E confrere ${Date.now()}`;
    const c = await request(app).post("/api/espace/messagerie").set(...bearer(a.token)).send({ sujet, corps: "cher confrère", avecAdministration: false, destinataireMembreId: b.membreId });
    expect(c.status).toBe(201);
    expect(await filNonLus(b.token, c.body.id)).toBe(1);
    const listeAdmin = await request(app).get("/api/messagerie").set(...bearer(sg));
    expect(listeAdmin.body.some((x: any) => x.id === c.body.id || x.sujet === sujet)).toBe(false);
  });

  it("auto-message interdit (400)", async () => {
    const r = await request(app).post("/api/espace/messagerie").set(...bearer(a.token)).send({ sujet: "moi", corps: "x", avecAdministration: false, destinataireMembreId: a.membreId });
    expect(r.status).toBe(400);
  });

  it("cloisonnement : un avocat ne voit pas la messagerie admin (403)", async () => {
    expect((await request(app).get("/api/messagerie").set(...bearer(a.token))).status).toBe(403);
  });
});
