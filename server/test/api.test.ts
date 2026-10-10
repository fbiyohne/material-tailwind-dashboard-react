import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { tableauOrdreHtml, listeAvocatsHtml } from "../src/lib/templates.js";
import { trouverChromium, htmlVersPdf } from "../src/lib/pdf.js";

// htmlVersPdf espionné (implémentation réelle conservée) : permet d'inspecter le HTML
// rendu par l'export PDF et de s'affranchir de Chromium dans les tests de sécurité.
vi.mock("../src/lib/pdf.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/lib/pdf.js")>();
  return { ...orig, htmlVersPdf: vi.fn(orig.htmlVersPdf) };
});
import { eligibiliteElectorale, STATUTS_HORS_TABLEAU } from "../src/lib/business.js";

const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;

async function login(email: string) {
  const r = await request(app).post("/api/auth/login").send({ email, password: "barreau" });
  return r.body as { token: string; refreshToken: string };
}

let sg = "";
let tr = "";
let admin = "";
let bat = "";

beforeAll(async () => {
  sg = (await login("sg@barreau-pn.cg")).token;
  tr = (await login("tresoriere@barreau-pn.cg")).token;
  admin = (await login("admin@barreau-pn.cg")).token;
  bat = (await login("batonnier@barreau-pn.cg")).token;
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

  it("I2 : un second paiement sur une cotisation soldée est refusé (409)", async () => {
    const r = await request(app).post("/api/cotisations/paiement").set(...bearer(sg)).send({ membreId, annee, montant: 150000, mode: "Espèces" });
    expect(r.status).toBe(409); // déjà soldée après le paiement BR-03 précédent
  });

  it("I2 : un versement supérieur au solde restant dû est refusé (400)", async () => {
    const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `OVERPAY ${Date.now()}`, qualite: "AVOCAT" });
    const r = await request(app).post("/api/cotisations/paiement").set(...bearer(sg)).send({ membreId: m.body.id, annee, montant: 200000, mode: "Espèces" });
    expect(r.status).toBe(400); // 200000 > 150000 dû
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

  it("C-06 : refuse la suppression (409) d'un avocat ayant un reçu — pièce comptable à conserver (OHADA)", async () => {
    const id = await creerAvocat("SUPPR-RECU");
    await request(app).post("/api/cotisations/paiement").set(...bearer(sg)).send({ membreId: id, annee: 2026, montant: 150000, mode: "Espèces" });
    const del = await request(app).delete(`/api/membres/${id}`).set(...bearer(admin));
    expect(del.status).toBe(409);
    expect(del.body.erreur).toMatch(/pièces comptables/);
    expect((await request(app).get(`/api/membres/${id}`).set(...bearer(sg))).status).toBe(200);
  });

  it("R1-8 : refuse l'attestation (409) pour un radié ou un décédé, sans numéroter ni archiver", async () => {
    const avant = await prisma.archive.count({ where: { categorie: "Attestation d'inscription" } });
    for (const statut of ["RADIE", "DECEDE"] as const) {
      const id = await creerAvocat(`ATTEST-${statut}`);
      await prisma.membre.update({ where: { id }, data: { statut } });
      for (const r of [
        await request(app).post(`/api/membres/${id}/attestation`).set(...bearer(sg)),
        await request(app).get(`/api/membres/${id}/attestation/pdf`).set(...bearer(sg)),
      ]) {
        expect(r.status).toBe(409);
        expect(r.body.erreur).toMatch(/Attestation impossible/);
      }
      await request(app).delete(`/api/membres/${id}`).set(...bearer(admin));
    }
    expect(await prisma.archive.count({ where: { categorie: "Attestation d'inscription" } })).toBe(avant);
  });

  it("R1-8 : l'espace avocat refuse aussi l'attestation (409) à un radié ou décédé avec jeton encore valide", async () => {
    const cats = ["Attestation d'inscription", "Attestation de non-redevance"];
    const avant = await prisma.archive.count({ where: { categorie: { in: cats } } });
    for (const statut of ["RADIE", "DECEDE"] as const) {
      const mail = `attest.${statut.toLowerCase()}.${Date.now()}@barreau-pn.cg`;
      const id = (await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `ESPATT ${statut} ${Date.now()}`, qualite: "AVOCAT", email: mail })).body.id;
      const lien = (await request(app).post(`/api/membres/${id}/acces`).set(...bearer(sg))).body.lien as string;
      await request(app).post("/api/auth/activer").send({ token: lien.split("/activer/")[1], password: "avocatpass8" });
      const jwt = (await request(app).post("/api/auth/login").send({ email: mail, password: "avocatpass8" })).body.token;
      // Changement direct en base : le jeton reste valide, seule la garde de la route protège.
      await prisma.membre.update({ where: { id }, data: { statut } });
      for (const chemin of ["inscription", "non-redevance"]) {
        const r = await request(app).get(`/api/espace/attestation/${chemin}/pdf`).set(...bearer(jwt));
        expect(r.status).toBe(409);
        expect(r.body.erreur).toMatch(/Attestation impossible/);
      }
      await request(app).delete(`/api/membres/${id}`).set(...bearer(admin));
    }
    expect(await prisma.archive.count({ where: { categorie: { in: cats } } })).toBe(avant);
  });

  it("l'ADMIN supprime un avocat sans pièce comptable et son historique non comptable (cascade)", async () => {
    const id = await creerAvocat("SUPPR-CASCADE");
    // Ligne de cotisation et droit de plaidoirie sans reçu : cascade FK, aucune pièce comptable.
    await prisma.cotisation.create({ data: { membreId: id, annee: 2026, montantDu: 150000 } });
    await prisma.droitPlaidoirie.create({ data: { membreId: id, annee: 2026, montantDu: 1000 } });

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

  // Centre de notifications : les alertes in-app sont émises en best-effort (asynchrones),
  // d'où une courte reprise avant assertion.
  const attendreNotifEspace = async (jeton: string, pred: (n: any) => boolean, tentatives = 15) => {
    for (let i = 0; i < tentatives; i++) {
      const r = await request(app).get("/api/espace/notifications").set(...bearer(jeton));
      const item = (r.body.items ?? []).find(pred);
      if (item) return item;
      await new Promise((res) => setTimeout(res, 100));
    }
    return null;
  };

  it("le paiement de l'avocat lui crée une notification in-app (reçu), marquable comme lue", async () => {
    const notif = await attendreNotifEspace(avocat, (n) => n.type === "RECU");
    expect(notif).toBeTruthy();
    // Marquer une seule comme lue, puis tout marquer : le compteur retombe à zéro.
    const lu = await request(app).post(`/api/espace/notifications/${notif.id}/lu`).set(...bearer(avocat));
    expect(lu.status).toBe(200);
    const tout = await request(app).post("/api/espace/notifications/lu-tout").set(...bearer(avocat));
    expect(tout.status).toBe(200);
    const apres = await request(app).get("/api/espace/notifications").set(...bearer(avocat));
    expect(apres.body.nonLus).toBe(0);
  });

  it("une publication mise en ligne notifie les avocats", async () => {
    const p = await request(app).post("/api/publications").set(...bearer(sg)).send({ titre: `Communiqué test ${Date.now()}`, type: "Communiqué" });
    expect(p.status).toBe(201);
    const maj = await request(app).post(`/api/publications/${p.body.id}/statut`).set(...bearer(sg)).send({ statut: "PUBLIE" });
    expect(maj.status).toBe(200);
    const notif = await attendreNotifEspace(avocat, (n) => n.type === "PUBLICATION");
    expect(notif).toBeTruthy();
    expect(notif.lien).toBe("/publications");
  });

  it("centre de notifications back-office : forme de la réponse (SG)", async () => {
    const r = await request(app).get("/api/mes-notifications").set(...bearer(sg));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.items)).toBe(true);
    expect(typeof r.body.nonLus).toBe("number");
  });

  it("cloisonnement des notifications : avocat ⇏ back-office, back-office ⇏ espace", async () => {
    expect((await request(app).get("/api/mes-notifications").set(...bearer(avocat))).status).toBe(403);
    expect((await request(app).get("/api/espace/notifications").set(...bearer(sg))).status).toBe(403);
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

  it("enregistre l'identité (dénomination, signataires, logo) et la persiste", async () => {
    const logo = "data:image/svg+xml;base64,PHN2Zy8+"; // <svg/> minimal
    const patch = { identite: { denomination: "Barreau de Test", batonnier: "Me TEST", logo } };
    const put = await request(app).put("/api/parametres").set(...bearer(sg)).send(patch);
    expect(put.status).toBe(200);
    const get = await request(app).get("/api/parametres").set(...bearer(sg));
    expect(get.body.identite.denomination).toBe("Barreau de Test");
    expect(get.body.identite.batonnier).toBe("Me TEST");
    expect(get.body.identite.logo).toBe(logo);
    // Restaure l'identité par défaut pour ne pas polluer les autres suites.
    await request(app).put("/api/parametres").set(...bearer(sg)).send({
      identite: { denomination: "Barreau de Pointe-Noire", batonnier: "Me BIKINDOU Audrey Séverin", logo: "" },
    });
  });

  it("rejette un logo qui n'est pas une image (400)", async () => {
    expect((await request(app).put("/api/parametres").set(...bearer(sg)).send({ identite: { logo: "https://exemple.cg/logo.png" } })).status).toBe(400);
  });

  it("rejette une clé arbitraire ou un canal inconnu (400)", async () => {
    expect((await request(app).put("/api/parametres").set(...bearer(sg)).send({ inconnu: 1 })).status).toBe(400);
    expect((await request(app).put("/api/parametres").set(...bearer(sg)).send({ paiement: { canauxActifs: ["BITCOIN"] } })).status).toBe(400);
  });
});

describe("Discipline enrichie — saisine, rapporteur, recours & casier", () => {
  it("dossier avec plaignant/rapporteur, ajout d'un recours, casier par membre", async () => {
    const av = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `DISC ${Date.now()}`, qualite: "AVOCAT" });
    const d = await request(app).post("/api/discipline").set(...bearer(sg)).send({ avocatNom: "Me Disc", objet: "Manquement déontologique", plaignant: "Un confrère", rapporteur: "Me Rapporteur", membreId: av.body.id });
    expect(d.status).toBe(201);
    expect(d.body.plaignant).toBe("Un confrère");
    expect(d.body.rapporteur).toBe("Me Rapporteur");
    const maj = await request(app).patch(`/api/discipline/${d.body.id}`).set(...bearer(sg)).send({ recours: "Appel devant la Cour", dateRecours: "2026-06-20" });
    expect(maj.body.recours).toBe("Appel devant la Cour");
    const casier = await request(app).get(`/api/discipline?membreId=${av.body.id}`).set(...bearer(sg));
    expect(casier.status).toBe(200);
    expect(casier.body.some((x: any) => x.id === d.body.id)).toBe(true);
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

describe("Cycle du stage — rapports & validation (Bâtonnier)", () => {
  it("rapports : SG consigne, Trésorière exclue (403), non-stagiaire rejeté (400)", async () => {
    const stagiaire = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `STAGE Test ${Date.now()}`, qualite: "STAGIAIRE" });
    const sid = stagiaire.body.id;
    expect((await request(app).get(`/api/membres/${sid}/rapports`).set(...bearer(tr))).status).toBe(403);
    const r = await request(app).post(`/api/membres/${sid}/rapports`).set(...bearer(sg)).send({ periode: "T1 2026", appreciation: "Stagiaire assidu et rigoureux.", note: "Favorable" });
    expect(r.status).toBe(201);
    const liste = await request(app).get(`/api/membres/${sid}/rapports`).set(...bearer(sg));
    expect(liste.body.some((x: any) => x.id === r.body.id)).toBe(true);
    const avocat = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `AVOC ${Date.now()}`, qualite: "AVOCAT" });
    expect((await request(app).post(`/api/membres/${avocat.body.id}/rapports`).set(...bearer(sg)).send({ periode: "x", appreciation: "y" })).status).toBe(400);
  });

  it("validation de fin de stage réservée au Bâtonnier ; passe stagiaire → avocat", async () => {
    const stagiaire = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `STAGE Fin ${Date.now()}`, qualite: "STAGIAIRE" });
    const sid = stagiaire.body.id;
    expect((await request(app).post(`/api/membres/${sid}/valider-stage`).set(...bearer(sg))).status).toBe(403);
    const v = await request(app).post(`/api/membres/${sid}/valider-stage`).set(...bearer(admin));
    expect(v.status).toBe(200);
    expect(v.body.qualite).toBe("AVOCAT");
    expect((await request(app).post(`/api/membres/${sid}/valider-stage`).set(...bearer(admin))).status).toBe(409);
  });
});

describe("Import du tableau — qualité par défaut (qualiteDefaut)", () => {
  it("importe en STAGIAIRE quand qualiteDefaut=STAGIAIRE et aucune colonne qualité", async () => {
    const num = 900000 + (Date.now() % 10000);
    const r = await request(app).post("/api/membres/import").set(...bearer(sg))
      .send({ membres: [{ num, nom: `IMPORT Stagiaire ${num}` }], qualiteDefaut: "STAGIAIRE" });
    expect(r.status).toBe(200);
    expect(r.body.crees).toBe(1);
    const m = await prisma.membre.findUnique({ where: { num } });
    expect(m?.qualite).toBe("STAGIAIRE");
    expect(m?.statut).toBe("STAGIAIRE"); // statut dérivé de la qualité stagiaire
    await prisma.membre.delete({ where: { num } });
  });

  it("défaut AVOCAT sans qualiteDefaut (rétro-compatible page Avocats inscrits)", async () => {
    const num = 910000 + (Date.now() % 10000);
    const r = await request(app).post("/api/membres/import").set(...bearer(sg))
      .send({ membres: [{ num, nom: `IMPORT Avocat ${num}` }] });
    expect(r.status).toBe(200);
    const m = await prisma.membre.findUnique({ where: { num } });
    expect(m?.qualite).toBe("AVOCAT");
    await prisma.membre.delete({ where: { num } });
  });

  it("une colonne qualité explicite prime sur qualiteDefaut", async () => {
    const num = 920000 + (Date.now() % 10000);
    const r = await request(app).post("/api/membres/import").set(...bearer(sg))
      .send({ membres: [{ num, nom: `IMPORT Explicite ${num}`, qualite: "honoraire" }], qualiteDefaut: "STAGIAIRE" });
    expect(r.status).toBe(200);
    const m = await prisma.membre.findUnique({ where: { num } });
    expect(m?.qualite).toBe("HONORAIRE");
    await prisma.membre.delete({ where: { num } });
  });
});

describe("Élections — scrutins (confidentialité, unicité, deux modalités)", () => {
  it("cloisonnement : un avocat ne gère pas les scrutins (403)", async () => {
    const av = await creerAvocatEspace("scrutin-cloison");
    expect((await request(app).get("/api/scrutins").set(...bearer(av.token))).status).toBe(403);
  });

  it("présentiel : saisie des voix par le SG", async () => {
    const s = await request(app).post("/api/scrutins").set(...bearer(sg)).send({ titre: `Bâtonnier ${Date.now()}`, type: "BATONNIER", modalite: "PRESENTIEL", nbSieges: 1 });
    const sid = s.body.id;
    const c = await request(app).post(`/api/scrutins/${sid}/candidats`).set(...bearer(sg)).send({ nom: "Me Candidat Bâtonnier" });
    expect((await request(app).post(`/api/scrutins/${sid}/ouvrir`).set(...bearer(sg))).status).toBe(200);
    const r = await request(app).post(`/api/scrutins/${sid}/voix`).set(...bearer(sg)).send({ candidatId: c.body.id, voix: 42 });
    expect(r.status).toBe(200);
    expect(r.body.candidats[0].voix).toBe(42);
  });

  it("en ligne : cycle complet, électeur éligible, vote unique", async () => {
    const s = await request(app).post("/api/scrutins").set(...bearer(sg)).send({ titre: `Conseil ${Date.now()}`, type: "CONSEIL", modalite: "EN_LIGNE", nbSieges: 2 });
    const sid = s.body.id;
    const c1 = await request(app).post(`/api/scrutins/${sid}/candidats`).set(...bearer(sg)).send({ nom: "Me Candidat A" });
    const c2 = await request(app).post(`/api/scrutins/${sid}/candidats`).set(...bearer(sg)).send({ nom: "Me Candidat B" });

    // électeur éligible (cotisation à jour + validée)
    const av = await creerAvocatEspace("vote");
    const annee = new Date().getFullYear();
    await request(app).post("/api/cotisations/paiement").set(...bearer(sg)).send({ membreId: av.membreId, annee, montant: 150000, mode: "Espèces" });
    await request(app).post(`/api/cotisations/${av.membreId}/valider`).set(...bearer(sg)).send({ annee });

    // pas de vote avant ouverture
    expect((await request(app).post(`/api/espace/scrutins/${sid}/voter`).set(...bearer(av.token)).send({ candidatIds: [c1.body.id] })).status).toBe(409);
    expect((await request(app).post(`/api/scrutins/${sid}/ouvrir`).set(...bearer(sg))).status).toBe(200);

    // vote valide
    expect((await request(app).post(`/api/espace/scrutins/${sid}/voter`).set(...bearer(av.token)).send({ candidatIds: [c1.body.id, c2.body.id] })).status).toBe(201);
    // unicité : second vote refusé
    expect((await request(app).post(`/api/espace/scrutins/${sid}/voter`).set(...bearer(av.token)).send({ candidatIds: [c1.body.id] })).status).toBe(409);

    // clôture → dépouillement automatique des bulletins
    expect((await request(app).post(`/api/scrutins/${sid}/clore`).set(...bearer(sg))).status).toBe(200);
    const detail = await request(app).get(`/api/scrutins/${sid}`).set(...bearer(sg));
    expect(detail.body._count.emargements).toBe(1);
    expect(detail.body.candidats.find((c: any) => c.id === c1.body.id).voix).toBe(1);
    expect(detail.body.candidats.find((c: any) => c.id === c2.body.id).voix).toBe(1);

    // publication → Conseil recomposé
    expect((await request(app).post(`/api/scrutins/${sid}/publier`).set(...bearer(sg))).status).toBe(200);
  });
});

describe("Membres — sexe & démographie du tableau de bord", () => {
  it("enregistre le sexe et l'expose dans le tableau de bord", async () => {
    const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `PARITE Test ${Date.now()}`, qualite: "AVOCAT", sexe: "F" });
    expect(m.status).toBe(201);
    expect(m.body.sexe).toBe("F");
    const dash = await request(app).get("/api/dashboard").set(...bearer(sg));
    expect(dash.status).toBe(200);
    expect(dash.body.demographie).toBeTruthy();
    expect(dash.body.demographie.parite.F).toBeGreaterThanOrEqual(1);
    expect(typeof dash.body.demographie.parQualite.AVOCAT).toBe("number");
    expect(Array.isArray(dash.body.demographie.parDecennie)).toBe(true);
    // Le Bâtonnier voit la démographie mais pas les finances (RG-15).
    const dashB = await request(app).get("/api/dashboard").set(...bearer(bat));
    expect(dashB.body.demographie).toBeTruthy();
    expect(dashB.body.finances).toBeUndefined();
    await request(app).delete(`/api/membres/${m.body.id}`).set(...bearer(admin));
  });
});

describe("Tableau de l'Ordre — document officiel (Conseil en en-tête, sections, signature)", () => {
  it("compose le PDF avec le Conseil, les personnes morales et signe du bâtonnier réel", () => {
    const html = tableauOrdreHtml(
      [{ qualite: "AVOCAT", membres: [{ rang: 1, nom: "DUPONT Jean", statut: "INSCRIT", cabinet: "Cabinet X", dateInscription: "2010-01-01" }] }],
      new Date("2026-07-24"),
      {
        conseil: {
          batonnier: "Me BÂTONNIER Test",
          bureau: [{ fonction: "Secrétaire Général", sigle: "SGO", nom: "Me SG Test" }],
          membres: ["Me Membre Un", "Me Membre Deux"],
        },
        cabinets: [{ num: "C1", nom: "Cabinet Associés Test", forme: "Association d'avocats", titulaire: "Titulaire Test", effectif: 3 }],
      },
    );
    // Conseil en en-tête
    expect(html).toContain("Conseil de l'Ordre");
    expect(html).toContain("Me BÂTONNIER Test");
    expect(html).toContain("Secrétaire Général");
    expect(html).toContain("Me Membre Un");
    // Section personnes morales
    expect(html).toContain("Personnes morales");
    expect(html).toContain("Cabinet Associés Test");
    // Signature = bâtonnier réel (et non l'intitulé codé en dur)
    const pied = html.slice(html.indexOf('class="sign"'));
    expect(pied).toContain("Me BÂTONNIER Test");
    // Ligne de contexte sous le titre : inscrits · personnes morales · date d'arrêté
    expect(html).toContain("1 inscrit au tableau");
    expect(html).toContain("1 personne morale");
    expect(html).toMatch(/arrêté au[\s\S]*2026/);
  });

  it("reste valable sans Conseil ni personnes morales (rétro-compatible)", () => {
    const html = tableauOrdreHtml([{ qualite: "AVOCAT", membres: [{ rang: 1, nom: "SEUL Test", statut: "INSCRIT", cabinet: null, dateInscription: null }] }], new Date());
    expect(html).toContain("Tableau de l'Ordre");
    expect(html).not.toContain("Conseil de l'Ordre");
    expect(html).toContain("Me BIKINDOU Audrey Séverin"); // signataire par défaut
  });
});

describe("Personnes morales — cabinets (SG)", () => {
  it("création, rattachement de membre (effectif), convention/titulaire, retrait/rétablissement", async () => {
    const av = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `CAB Membre ${Date.now()}`, qualite: "AVOCAT" });
    const membreId = av.body.id;
    const c = await request(app).post("/api/cabinets").set(...bearer(sg)).send({ nom: `Cabinet Test ${Date.now()}`, forme: "Association d'avocats" });
    expect(c.status).toBe(201);
    expect(c.body.effectif).toBe(0);
    const cid = c.body.id;
    // rattachement → effectif = 1 (membre INSCRIT)
    const att = await request(app).post(`/api/cabinets/${cid}/membres/${membreId}`).set(...bearer(sg));
    expect(att.body.effectif).toBe(1);
    expect(att.body.membres.some((m: any) => m.id === membreId)).toBe(true);
    // convention + titulaire
    const maj = await request(app).patch(`/api/cabinets/${cid}`).set(...bearer(sg)).send({ conventionDeposee: true, titulaireId: membreId });
    expect(maj.body.conventionDeposee).toBe(true);
    expect(maj.body.titulaire.id).toBe(membreId);
    // retrait puis rétablissement
    expect((await request(app).patch(`/api/cabinets/${cid}`).set(...bearer(sg)).send({ statut: "retiré", motifRetrait: "Test" })).body.statut).toBe("retiré");
    expect((await request(app).patch(`/api/cabinets/${cid}`).set(...bearer(sg)).send({ statut: "actif", motifRetrait: null })).body.statut).toBe("actif");
    // détachement puis suppression
    await request(app).delete(`/api/cabinets/${cid}/membres/${membreId}`).set(...bearer(sg));
    expect((await request(app).delete(`/api/cabinets/${cid}`).set(...bearer(sg))).status).toBe(204);
    await request(app).delete(`/api/membres/${membreId}`).set(...bearer(admin));
  });

  it("lecture réservée à SG/Bâtonnier ; création réservée au SG", async () => {
    expect((await request(app).get("/api/cabinets").set(...bearer(tr))).status).toBe(403);
    expect((await request(app).post("/api/cabinets").set(...bearer(bat)).send({ nom: "X" })).status).toBe(403);
  });
});

describe("Conseil de l'Ordre — composition (SG)", () => {
  it("ajout, mise à jour, clôture de mandat (filtre actif / historique)", async () => {
    const m = await request(app).post("/api/conseil").set(...bearer(sg)).send({ nom: "Me Test Conseil", fonction: "Membre du Conseil" });
    expect(m.status).toBe(201);
    expect(m.body.role).toBe("membre"); // rôle par défaut
    expect((await request(app).get("/api/conseil").set(...bearer(sg))).body.some((x: any) => x.id === m.body.id)).toBe(true);
    const maj = await request(app).patch(`/api/conseil/${m.body.id}`).set(...bearer(sg)).send({ actif: false });
    expect(maj.body.actif).toBe(false);
    // clôturé → absent par défaut, présent dans l'historique
    expect((await request(app).get("/api/conseil").set(...bearer(sg))).body.some((x: any) => x.id === m.body.id)).toBe(false);
    expect((await request(app).get("/api/conseil?tous=1").set(...bearer(sg))).body.some((x: any) => x.id === m.body.id)).toBe(true);
    expect((await request(app).delete(`/api/conseil/${m.body.id}`).set(...bearer(sg))).status).toBe(204);
  });

  it("rôle bureau + sigle ; le sigle est effacé si le rôle n'est plus bureau", async () => {
    const m = await request(app).post("/api/conseil").set(...bearer(sg))
      .send({ nom: "Me Bureau Test", fonction: "Secrétaire Général", role: "bureau", sigle: "SGO" });
    expect(m.status).toBe(201);
    expect(m.body.role).toBe("bureau");
    expect(m.body.sigle).toBe("SGO");
    // repasse en simple membre → le sigle n'a plus de sens et doit être vidé
    const maj = await request(app).patch(`/api/conseil/${m.body.id}`).set(...bearer(sg)).send({ role: "membre" });
    expect(maj.body.role).toBe("membre");
    expect(maj.body.sigle).toBeNull();
    await request(app).delete(`/api/conseil/${m.body.id}`).set(...bearer(sg));
  });

  it("sortie motivée : motif + date conservés, siège en historique, rétablissement", async () => {
    const m = await request(app).post("/api/conseil").set(...bearer(sg)).send({ nom: "Me Sortie Test", fonction: "Membre du Conseil" });
    const sortie = await request(app).patch(`/api/conseil/${m.body.id}`).set(...bearer(sg))
      .send({ actif: false, motifSortie: "Démission", mandatFin: "2026-07-24" });
    expect(sortie.body.actif).toBe(false);
    expect(sortie.body.motifSortie).toBe("Démission");
    expect(sortie.body.mandatFin).not.toBeNull();
    // rétablissement : redevient actif, motif et date de sortie effacés
    const ret = await request(app).patch(`/api/conseil/${m.body.id}`).set(...bearer(sg)).send({ actif: true, motifSortie: null, mandatFin: null });
    expect(ret.body.actif).toBe(true);
    expect(ret.body.motifSortie).toBeNull();
    expect(ret.body.mandatFin).toBeNull();
    await request(app).delete(`/api/conseil/${m.body.id}`).set(...bearer(sg));
  });
});

describe("Tableau de l'Ordre (RG-04..06)", () => {
  it("compose par ancienneté en sections ; publication réservée au SG", async () => {
    const r = await request(app).get("/api/tableau").set(...bearer(sg));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.sections)).toBe(true);
    expect(typeof r.body.total).toBe("number");
    const sec = r.body.sections.find((s: any) => s.membres.length > 1);
    if (sec) { expect(sec.membres[0].rang).toBe(1); expect(sec.membres[1].rang).toBe(2); }
    // publication (arrêté) réservée au SG ; Trésorière exclue du module (403)
    expect((await request(app).get("/api/tableau").set(...bearer(tr))).status).toBe(403);
    const pub = await request(app).post("/api/tableau/publier").set(...bearer(sg));
    expect(pub.status).toBe(201);
    expect(pub.body.reference).toContain("TABLEAU-");
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
  it("R1-6 : un avocat décédé ou radié n'est ni relancé ni compté dans le suivi des droits", async () => {
    const annee = new Date().getFullYear();
    const tag = Date.now();
    const ids: Record<string, number> = {};
    for (const statut of ["INSCRIT", "DECEDE", "RADIE"]) {
      const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `RELDROIT ${statut} ${tag}`, qualite: "AVOCAT", email: `reldroit-${statut.toLowerCase()}-${tag}@test.cg` });
      ids[statut] = m.body.id;
    }
    await prisma.membre.updateMany({ where: { id: { in: [ids.DECEDE, ids.RADIE] } }, data: { statut: "DECEDE" } });
    await prisma.membre.update({ where: { id: ids.RADIE }, data: { statut: "RADIE" } });
    const rel = await request(app).post(`/api/droits/relances?annee=${annee}`).set(...bearer(sg));
    expect(rel.status).toBe(200);
    const emails: string[] = rel.body.destinataires.map((d: any) => d.email);
    expect(emails).toContain(`reldroit-inscrit-${tag}@test.cg`);
    expect(emails).not.toContain(`reldroit-decede-${tag}@test.cg`);
    expect(emails).not.toContain(`reldroit-radie-${tag}@test.cg`);
    const grille = await request(app).get(`/api/droits?annee=${annee}`).set(...bearer(tr));
    const idsGrille = grille.body.lignes.map((l: any) => l.membre.id);
    expect(idsGrille).toContain(ids.INSCRIT);
    expect(idsGrille).not.toContain(ids.DECEDE);
    expect(idsGrille).not.toContain(ids.RADIE);
  });

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

describe("Round 3 — sécurité (anti-double-crédit & invalidation de session)", () => {
  it("CRITICAL : deux confirmations concurrentes ne créditent qu'une fois", async () => {
    const annee = 2027;
    const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `DOUBLEPAY ${Date.now()}`, qualite: "AVOCAT" });
    const id = m.body.id;
    const init = await request(app).post("/api/paiements/initier").set(...bearer(sg)).send({ membreId: id, annee, montant: 150000, type: "cotisation", canal: "MTN" });
    expect(init.status).toBe(201);
    const ref = init.body.paiement.ref;
    // Rejeu / double-clic : deux finalisations simultanées du même paiement.
    const [a, b] = await Promise.all([
      request(app).post(`/api/paiements/${ref}/confirmer-sandbox`).set(...bearer(sg)).send({ succes: true }),
      request(app).post(`/api/paiements/${ref}/confirmer-sandbox`).set(...bearer(sg)).send({ succes: true }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const cot = await request(app).get(`/api/cotisations?annee=${annee}`).set(...bearer(sg));
    const ligne = cot.body.lignes.find((l: any) => l.membre.id === id);
    expect(ligne.montantPaye).toBe(150000); // crédité une seule fois (pas 300000)
    expect(ligne.statut).toBe("ajour");
  });

  it("changer son mot de passe invalide les jetons d'accès déjà émis (401)", async () => {
    const email = `sess-${Date.now()}@barreau-pn.cg`;
    await request(app).post("/api/users").set(...bearer(admin)).send({ nom: "Session Test", email, role: "TRESORIERE", password: "ancienpass8" });
    const tok = (await request(app).post("/api/auth/login").send({ email, password: "ancienpass8" })).body.token;
    expect((await request(app).get("/api/auth/me").set(...bearer(tok))).status).toBe(200);
    const chg = await request(app).post("/api/auth/password").set(...bearer(tok)).send({ currentPassword: "ancienpass8", newPassword: "nouveaupass8" });
    expect(chg.status).toBe(200);
    // L'ancien jeton d'accès ne doit plus être accepté (tokenVersion incrémentée).
    expect((await request(app).get("/api/auth/me").set(...bearer(tok))).status).toBe(401);
  });
});

describe("Timbre de plaidoirie — émission, vérification, annulation", () => {
  let timbre: any;

  it("émet un timbre (SG) avec n° et code uniques", async () => {
    const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `TIMBRE Test ${Date.now()}`, qualite: "AVOCAT", cabinet: "CABINET KALINA" });
    const r = await request(app).post("/api/timbres").set(...bearer(sg))
      .send({ membreId: m.body.id, affaire: "ARENS Vanessa", reference: "151024", juridiction: "TI de Tié-Tié", montant: 15000 });
    expect(r.status).toBe(201);
    expect(typeof r.body.numero).toBe("number");
    expect(r.body.code).toMatch(/^[A-Z]+$/);
    expect(r.body.montant).toBe(15000);
    timbre = r.body;
  });

  it("vérifie publiquement le timbre par son code (sans authentification)", async () => {
    const v = await request(app).get(`/api/verifier/timbre/${timbre.code}`);
    expect(v.status).toBe(200);
    expect(v.body.valide).toBe(true);
    expect(v.body.type).toBe("timbre");
    expect(v.body.affaire).toBe("ARENS Vanessa");
    expect(v.body.signature).toBeTruthy();
  });

  it("un code inconnu renvoie invalide (404)", async () => {
    const v = await request(app).get("/api/verifier/timbre/INCONNU123");
    expect(v.status).toBe(404);
    expect(v.body.valide).toBe(false);
  });

  it("l'ADMIN annule un timbre ; la vérification le déclare invalide (annulé)", async () => {
    const a = await request(app).post(`/api/timbres/${timbre.id}/annuler`).set(...bearer(admin));
    expect(a.status).toBe(200);
    const v = await request(app).get(`/api/verifier/timbre/${timbre.code}`);
    expect(v.body.valide).toBe(false);
    expect(v.body.motif).toBe("annulé");
  });

  it("cloisonnement : l'émission de timbre est refusée à l'avocat (403)", async () => {
    // (jeton avocat créé plus haut dans la suite espace)
    expect((await request(app).post("/api/timbres").set("Authorization", "Bearer invalide").send({})).status).toBe(401);
  });
});

describe("RBAC — matrice de rôles/permissions & nouveaux profils", () => {
  let consult = ""; // jeton d'un compte « Consultation »
  const email = `consult.${Date.now()}@barreau-pn.cg`;

  it("crée un compte au profil CONSULTATION (SG) et se connecte", async () => {
    const r = await request(app).post("/api/users").set(...bearer(sg)).send({ nom: "Consultant Test", email, role: "CONSULTATION", password: "consultpass8" });
    expect(r.status).toBe(201);
    consult = (await request(app).post("/api/auth/login").send({ email, password: "consultpass8" })).body.token;
    expect(consult).toBeTruthy();
  });

  it("/auth/me renvoie les permissions du profil", async () => {
    const me = await request(app).get("/api/auth/me").set(...bearer(consult));
    expect(me.status).toBe(200);
    expect(Array.isArray(me.body.permissions)).toBe(true);
    expect(me.body.permissions).toContain("membres");
    expect(me.body.permissions).not.toContain("finances");
  });

  it("enforcement : Consultation accède aux modules autorisés, refusé ailleurs", async () => {
    // corps_electoral autorisé (défaut) → 200 ; finances non autorisé → 403.
    expect((await request(app).get("/api/corps-electoral?annee=2026").set(...bearer(consult))).status).toBe(200);
    expect((await request(app).get("/api/cotisations?annee=2026").set(...bearer(consult))).status).toBe(403);
  });

  it("la matrice est consultable (SG) et éditable réservée (403 pour Consultation)", async () => {
    const g = await request(app).get("/api/rbac").set(...bearer(sg));
    expect(g.status).toBe(200);
    expect(Array.isArray(g.body.permissions)).toBe(true);
    expect(g.body.matrice).toBeTruthy();
    expect((await request(app).get("/api/rbac").set(...bearer(consult))).status).toBe(403);
  });

  it("l'édition de la matrice (ADMIN) modifie l'accès effectif, puis on restaure", async () => {
    // Accorde « finances » à Consultation → l'accès passe à 200.
    const put = await request(app).put("/api/rbac").set(...bearer(admin)).send({ role: "CONSULTATION", permissions: ["membres", "corps_electoral", "documents", "audit", "finances"] });
    expect(put.status).toBe(200);
    expect((await request(app).get("/api/cotisations?annee=2026").set(...bearer(consult))).status).toBe(200);
    // Restaure les défauts (retire finances) pour ne pas polluer les autres tests.
    await request(app).put("/api/rbac").set(...bearer(admin)).send({ role: "CONSULTATION", permissions: ["membres", "corps_electoral", "documents", "audit"] });
    expect((await request(app).get("/api/cotisations?annee=2026").set(...bearer(consult))).status).toBe(403);
  });
});

describe("Cycle de vie — statut DECEDE (migration T3)", () => {
  // Nettoyage en afterAll : le bloc reste rejouable même après un échec d'assertion intermédiaire.
  afterAll(async () => {
    await prisma.membre.deleteMany({ where: { OR: [{ nom: { startsWith: "DECEDE Test " } }, { num: { gte: 990000 } }] } });
  });

  it("reconnaît le filtre statut=DECEDE, l'accepte à l'inscription et l'exclut du corps électoral", async () => {
    // Le filtre est reconnu, pas ignoré (liste complète) : seuls des décédés reviennent, même si la
    // base de test en contient déjà (parcours de bout en bout).
    const vide = await request(app).get("/api/membres?statut=DECEDE").set(...bearer(sg));
    expect(vide.status).toBe(200);
    expect(vide.body.items.every((i: { statut: string }) => i.statut === "DECEDE")).toBe(true);

    const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `DECEDE Test ${Date.now()}`, qualite: "AVOCAT" });
    expect(m.status).toBe(201);
    expect((await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: "Direct décédé", statut: "DECEDE" })).status).toBe(400);
    expect((await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: "Direct radié", statut: "RADIE" })).status).toBe(400);
    const d = await request(app).post(`/api/membres/${m.body.id}/deces`).set(...bearer(sg)).send({ dateDeces: "2026-09-15" });
    expect(d.body.statut).toBe("DECEDE");
    const liste = await request(app).get("/api/membres?statut=DECEDE").set(...bearer(sg));
    expect(liste.body.total).toBeGreaterThanOrEqual(1);
    expect(liste.body.items.every((x: any) => x.statut === "DECEDE")).toBe(true);

    const dash = await request(app).get("/api/dashboard").set(...bearer(sg));
    expect(dash.status).toBe(200);

    // Exclusions : tableau de l'Ordre et corps électoral.
    const tableau = await request(app).get("/api/tableau").set(...bearer(sg));
    expect(tableau.status).toBe(200);
    expect(tableau.body.sections.flatMap((s: any) => s.membres).some((x: any) => x.id === m.body.id)).toBe(false);
    expect(STATUTS_HORS_TABLEAU).toEqual(["RADIE", "DECEDE"]);
    expect(eligibiliteElectorale({ qualite: "AVOCAT", statut: "DECEDE" }, null)).toEqual({ eligible: false, raison: "statut" });
  });

  it("R1-7 : un décédé/radié sans ligne réelle n'a aucun dû calculé (cotisations, dashboard)", async () => {
    const annee = 2031;
    const cree = async (statut: string) => {
      const id = (await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `DECEDE Test r17 ${statut} ${Date.now()}`, qualite: "AVOCAT" })).body.id as number;
      await prisma.membre.update({ where: { id }, data: { statut: statut as any } });
      return id;
    };
    const [idDeces, idRadie, idOk] = [await cree("DECEDE"), await cree("RADIE"), await cree("INSCRIT")];
    const avant = (await request(app).get(`/api/dashboard?annee=${annee}`).set(...bearer(sg))).body;
    const cot = await request(app).get(`/api/cotisations?annee=${annee}`).set(...bearer(sg));
    const ligne = (id: number) => cot.body.lignes.find((l: any) => l.membre.id === id);
    expect(ligne(idDeces)).toMatchObject({ montantDu: 0, solde: 0, statut: "exonere" });
    expect(ligne(idRadie)).toMatchObject({ montantDu: 0, solde: 0, statut: "exonere" });
    expect(ligne(idOk).montantDu).toBeGreaterThan(0);
    // Le dashboard ne compte ni inscrit ni retard pour eux : supprimer les deux hors-tableau ne change rien.
    await prisma.membre.deleteMany({ where: { id: { in: [idDeces, idRadie] } } });
    const apres = (await request(app).get(`/api/dashboard?annee=${annee}`).set(...bearer(sg))).body;
    expect(avant.membres).toEqual(apres.membres);
    expect(avant.finances).toEqual(apres.finances);
  });

  it("import : le statut « décédé » (toutes graphies) est refusé (R1-9), aucun membre créé", async () => {
    const r = await request(app).post("/api/membres/import").set(...bearer(sg)).send({
      membres: [
        { num: 990001, nom: "DECEDE Test import 1", statut: "décédé" },
        { num: 990002, nom: "DECEDE Test import 2", statut: "DECEDE" },
        { num: 990003, nom: "DECEDE Test import 3", statut: "Decede" },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ total: 3, crees: 0 });
    expect(r.body.erreurs).toHaveLength(3);
    expect(await prisma.membre.count({ where: { num: { in: [990001, 990002, 990003] } } })).toBe(0);
  });
});

describe("R2-2 — import : formats de date imposés", () => {
  it("JJ/MM/AAAA lu dans l'ordre français, ISO conservé, date impossible ou hors format ignorée", async () => {
    const nums = [990101, 990102, 990103, 990104];
    const r = await request(app).post("/api/membres/import").set(...bearer(sg)).send({
      membres: [
        { num: 990101, nom: "R22 fr", dateServment: "09/10/2026" },
        { num: 990102, nom: "R22 iso", dateServment: "2026-10-09" },
        { num: 990103, nom: "R22 mois13", dateServment: "2026-13-01" },
        { num: 990104, nom: "R22 inexistant", dateServment: "31/02/2026" },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ crees: 4 });
    const m = await prisma.membre.findMany({ where: { num: { in: nums } }, orderBy: { num: "asc" } });
    expect(m[0].dateServment?.toISOString().slice(0, 10)).toBe("2026-10-09");
    expect(m[1].dateServment?.toISOString().slice(0, 10)).toBe("2026-10-09");
    expect(m[2].dateServment).toBeNull();
    expect(m[3].dateServment).toBeNull();
    await prisma.membre.deleteMany({ where: { num: { in: nums } } });
  });
});

describe("Cycle de vie — radiation motivée, décès, garde-fou DELETE, RBAC (T4)", () => {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const creer = async (nom: string) =>
    (await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `T4 ${nom} ${Date.now()}`, qualite: "AVOCAT" })).body.id as number;
  // Le journal est écrit après l'envoi de la réponse : on attend l'entrée (≤ 3 s).
  const attendreAudit = async (action: string, id: number) => {
    for (let i = 0; i < 30; i++) {
      const e = await prisma.journalAudit.findFirst({ where: { action: { startsWith: action }, cible: `#${id}` } });
      if (e) return e;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  };

  afterAll(async () => {
    await prisma.membre.deleteMany({ where: { nom: { startsWith: "T4 " } } });
  });

  it("CA-01 : radiation avec date et motif → RADIE, valeurs conservées, journal « Radiation d'un avocat »", async () => {
    const id = await creer("radiation");
    const r = await request(app).post(`/api/membres/${id}/radier`).set(...bearer(sg)).send({ dateRadiation: "2026-10-01", motifRadiation: "Décision du Conseil n° 12" });
    expect(r.status).toBe(200);
    expect(r.body.statut).toBe("RADIE");
    expect(r.body.dateRadiation).toMatch(/^2026-10-01/);
    expect(r.body.motifRadiation).toBe("Décision du Conseil n° 12");
    const audit = await attendreAudit("Radiation d'un avocat", id);
    expect(audit?.action).toBe("Radiation d'un avocat — Avocat");
  });

  it("CA-01 : radiation sans corps → date du jour, motif null (compatibilité)", async () => {
    const id = await creer("radiation-defaut");
    const r = await request(app).post(`/api/membres/${id}/radier`).set(...bearer(sg));
    expect(r.status).toBe(200);
    expect(r.body.statut).toBe("RADIE");
    expect(r.body.dateRadiation).toMatch(new RegExp(`^${aujourdhui}`));
    expect(r.body.motifRadiation).toBeNull();
    // Motif trop long refusé (≤ 300 caractères).
    expect((await request(app).post(`/api/membres/${id}/radier`).set(...bearer(sg)).send({ motifRadiation: "x".repeat(301) })).status).toBe(400);
  });

  it("CA-02 : déclaration de décès — validations (400), 404, 403 Trésorière", async () => {
    const id = await creer("deces-valid");
    expect((await request(app).post(`/api/membres/${id}/deces`).set(...bearer(sg)).send({})).status).toBe(400);
    expect((await request(app).post(`/api/membres/${id}/deces`).set(...bearer(sg)).send({ dateDeces: "2099-01-01" })).status).toBe(400);
    expect((await request(app).post(`/api/membres/${id}/deces`).set(...bearer(tr)).send({ dateDeces: "2026-09-15" })).status).toBe(403);
    expect((await request(app).post(`/api/membres/99999999/deces`).set(...bearer(sg)).send({ dateDeces: "2026-09-15" })).status).toBe(404);
    expect((await request(app).get(`/api/membres/${id}`).set(...bearer(sg))).body.statut).toBe("INSCRIT");
  });

  it("CA-02 : décès par SG → DECEDE + dateDeces, journal « Déclaration de décès », compte espace coupé (login 401)", async () => {
    const av = await creerAvocatEspace("t4-deces");
    expect((await request(app).post("/api/auth/login").send({ email: av.email, password: "avocatpass8" })).status).toBe(200);
    const r = await request(app).post(`/api/membres/${av.membreId}/deces`).set(...bearer(sg)).send({ dateDeces: "2026-09-15" });
    expect(r.status).toBe(200);
    expect(r.body.statut).toBe("DECEDE");
    expect(r.body.dateDeces).toMatch(/^2026-09-15/);
    const u = await prisma.user.findUnique({ where: { membreId: av.membreId } });
    expect(u?.actif).toBe(false);
    expect((await request(app).post("/api/auth/login").send({ email: av.email, password: "avocatpass8" })).status).toBe(401);
    expect((await request(app).get("/api/espace/moi").set(...bearer(av.token))).status).toBe(401);
    const audit = await attendreAudit("Déclaration de décès", av.membreId);
    expect(audit?.action).toBe("Déclaration de décès — Avocat");
    await request(app).delete(`/api/membres/${av.membreId}`).set(...bearer(admin));
  });

  it("R1-3 : un lien d'activation en attente est invalidé par le décès (404) et on ne provisionne plus un décédé (409)", async () => {
    const email = `e2e.r13.${Date.now()}@barreau-pn.cg`;
    const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `E2E r13 ${Date.now()}`, qualite: "AVOCAT", email });
    const membreId = m.body.id as number;
    const prov = await request(app).post(`/api/membres/${membreId}/acces`).set(...bearer(sg));
    expect(prov.status).toBe(201);
    const token = prov.body.lien.split("/activer/")[1];
    expect((await request(app).post(`/api/membres/${membreId}/deces`).set(...bearer(sg)).send({ dateDeces: "2026-09-15" })).status).toBe(200);
    expect((await request(app).post("/api/auth/activer").send({ token, password: "avocatpass8" })).status).toBe(404);
    const u = await prisma.user.findUnique({ where: { membreId } });
    expect(u?.actif).toBe(false);
    expect(u?.activationToken).toBeNull();
    expect((await request(app).post(`/api/membres/${membreId}/acces`).set(...bearer(sg))).status).toBe(409);
    await request(app).delete(`/api/membres/${membreId}`).set(...bearer(admin));
  });

  it("C-03 : la liste n'expose jamais motifRadiation ; la fiche le renvoie avec les dates", async () => {
    const id = await creer("motif");
    await request(app).post(`/api/membres/${id}/radier`).set(...bearer(sg)).send({ dateRadiation: "2026-10-02", motifRadiation: "Décision n° 7" });
    const liste = await request(app).get("/api/membres?statut=RADIE&pageSize=200").set(...bearer(sg));
    expect(liste.status).toBe(200);
    const ligne = liste.body.items.find((m: any) => m.id === id);
    expect(ligne).toBeTruthy();
    expect(ligne.dateRadiation).toMatch(/^2026-10-02/);
    expect(ligne).toHaveProperty("dateDeces");
    expect(liste.body.items.some((m: any) => "motifRadiation" in m)).toBe(false);
    const fiche = await request(app).get(`/api/membres/${id}`).set(...bearer(sg));
    expect(fiche.body.motifRadiation).toBe("Décision n° 7");
  });

  it("PATCH : correction d'une saisie — statut INSCRIT et dateDeces null (200)", async () => {
    const id = await creer("correction");
    await request(app).post(`/api/membres/${id}/deces`).set(...bearer(sg)).send({ dateDeces: "2026-09-15" });
    const r = await request(app).patch(`/api/membres/${id}`).set(...bearer(sg)).send({ statut: "INSCRIT", dateDeces: null });
    expect(r.status).toBe(200);
    expect(r.body.statut).toBe("INSCRIT");
    expect(r.body.dateDeces).toBeNull();
    const r2 = await request(app).patch(`/api/membres/${id}`).set(...bearer(sg)).send({ statut: "RADIE", dateRadiation: "2026-10-03", motifRadiation: "Décision n° 8" });
    expect(r2.status).toBe(200);
    expect(r2.body.dateRadiation).toMatch(/^2026-10-03/);
    expect(r2.body.motifRadiation).toBe("Décision n° 8");
  });

  it("R2-1 : PATCH DECEDE sans date → 400 ; date future → 400 ; avec date → 200 ; déjà décédé daté → 200", async () => {
    const id = await creer("r2-1");
    const patch = (b: object) => request(app).patch(`/api/membres/${id}`).set(...bearer(sg)).send(b);
    expect((await patch({ statut: "DECEDE" })).status).toBe(400);
    expect((await patch({ statut: "DECEDE", dateDeces: null })).status).toBe(400);
    expect((await patch({ dateDeces: "2099-01-01" })).status).toBe(400);
    expect((await patch({ statut: "RADIE", dateRadiation: "2099-01-01" })).status).toBe(400);
    expect((await patch({ statut: "DECEDE", dateDeces: "2026-09-15" })).status).toBe(200);
    expect((await patch({ cabinet: "Cab" })).status).toBe(200);
    expect((await patch({ statut: "DECEDE", dateDeces: null })).status).toBe(400);
  });

  it("R2-4 : machine à états — invariants d'acte, transitions refusées, effacement à la sortie", async () => {
    const id = await creer("r2-4");
    const patch = (b: object) => request(app).patch(`/api/membres/${id}`).set(...bearer(sg)).send(b);
    const radier = (b: object = {}) => request(app).post(`/api/membres/${id}/radier`).set(...bearer(sg)).send(b);
    const deces = (d = "2026-09-15") => request(app).post(`/api/membres/${id}/deces`).set(...bearer(sg)).send({ dateDeces: d });
    const lire = () => prisma.membre.findUniqueOrThrow({ where: { id } });
    // PATCH RADIE sans date → 400 ; avec date → 200.
    expect((await patch({ statut: "RADIE" })).status).toBe(400);
    expect((await patch({ statut: "RADIE", dateRadiation: "2026-10-01", motifRadiation: "Déc. 1", dateDeces: "2026-09-01" })).status).toBe(200);
    let m = await lire();
    expect(m.dateDeces).toBeNull(); // date de décès parasite écartée
    expect(m.motifRadiation).toBe("Déc. 1");
    // Déjà radié : /radier → 409, motif/date inchangés ; PATCH motif seul conserve la date.
    expect((await radier()).status).toBe(409);
    expect((await patch({ motifRadiation: "Déc. 2" })).status).toBe(200);
    m = await lire();
    expect(m.dateRadiation?.toISOString().slice(0, 10)).toBe("2026-10-01");
    // Radié → décédé : les données de radiation sont effacées.
    expect((await deces()).status).toBe(200);
    m = await lire();
    expect(m).toMatchObject({ statut: "DECEDE", dateRadiation: null, motifRadiation: null });
    expect(m.dateDeces?.toISOString().slice(0, 10)).toBe("2026-09-15");
    // Décédé : ni /radier, ni PATCH RADIE, ni second /deces (409) ; rien ne change.
    expect((await radier()).status).toBe(409);
    expect((await patch({ statut: "RADIE", dateRadiation: "2026-10-01" })).status).toBe(409);
    expect((await deces()).status).toBe(409);
    expect((await lire()).statut).toBe("DECEDE");
    // Rétablissement : toutes les données d'acte sont effacées.
    expect((await patch({ statut: "INSCRIT" })).status).toBe(200);
    m = await lire();
    expect(m).toMatchObject({ statut: "INSCRIT", dateRadiation: null, motifRadiation: null, dateDeces: null });
    // Date d'acte fournie sur un statut régulier : ignorée.
    expect((await patch({ dateDeces: "2026-09-15", dateRadiation: "2026-10-01" })).status).toBe(200);
    expect(await lire()).toMatchObject({ dateRadiation: null, dateDeces: null });
  });

  it("O3 : aucun rôle non autorisé ne mute un membre (403 sur POST, PATCH, radier, deces, DELETE)", async () => {
    const id = await creer("rbac");
    const compte = async (role: string) => {
      const email = `t4.${role.toLowerCase()}.${Date.now()}@barreau-pn.cg`;
      await request(app).post("/api/users").set(...bearer(sg)).send({ nom: `T4 ${role}`, email, role, password: "motdepasse8" });
      return (await request(app).post("/api/auth/login").send({ email, password: "motdepasse8" })).body.token as string;
    };
    const jetons = { TRESORIERE: tr, BATONNIER: bat, CONSULTATION: await compte("CONSULTATION"), ACCUEIL: await compte("ACCUEIL") };
    for (const [role, jeton] of Object.entries(jetons)) {
      expect(jeton, role).toBeTruthy();
      expect((await request(app).post("/api/membres").set(...bearer(jeton)).send({ nom: "T4 interdit" })).status, `${role} POST`).toBe(403);
      expect((await request(app).patch(`/api/membres/${id}`).set(...bearer(jeton)).send({ nom: "T4 interdit" })).status, `${role} PATCH`).toBe(403);
      expect((await request(app).post(`/api/membres/${id}/radier`).set(...bearer(jeton))).status, `${role} radier`).toBe(403);
      expect((await request(app).post(`/api/membres/${id}/deces`).set(...bearer(jeton)).send({ dateDeces: "2026-09-15" })).status, `${role} deces`).toBe(403);
      expect((await request(app).delete(`/api/membres/${id}`).set(...bearer(jeton))).status, `${role} DELETE`).toBe(403);
    }
    expect((await request(app).delete(`/api/membres/${id}`).set(...bearer(sg))).status).toBe(403);
    expect((await request(app).get(`/api/membres/${id}`).set(...bearer(sg))).body.statut).toBe("INSCRIT");
    await prisma.user.deleteMany({ where: { nom: { startsWith: "T4 " } } });
  });
});

describe("Export PDF de la liste des avocats (T5, CA-08)", () => {
  const pdf = (qs: string, t?: string) => {
    const r = request(app).get(`/api/membres/export/pdf${qs}`).buffer(true).parse((res, cb) => {
      const c: Buffer[] = [];
      res.on("data", (d: Buffer) => c.push(d));
      res.on("end", () => cb(null, Buffer.concat(c)));
    });
    return t ? r.set(...bearer(t)) : r;
  };

  it("sans jeton → 401 ; ids invalides → 400 ; plus de 200 ids → 400", async () => {
    expect((await pdf("")).status).toBe(401);
    expect((await pdf("?ids=abc", sg)).status).toBe(400);
    expect((await pdf(`?ids=${Array.from({ length: 201 }, (_, i) => i + 1).join(",")}`, sg)).status).toBe(400);
  });

  it("un compte AVOCAT → 403", async () => {
    const email = `export.avocat.${Date.now()}@barreau-pn.cg`;
    const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `T5 Export ${Date.now()}`, qualite: "AVOCAT", email });
    const acces = await request(app).post(`/api/membres/${m.body.id}/acces`).set(...bearer(sg));
    const token = acces.body.lien.split("/activer/")[1];
    await request(app).post("/api/auth/activer").send({ token, password: "avocatpass8" });
    const jwt = (await request(app).post("/api/auth/login").send({ email, password: "avocatpass8" })).body.token;
    expect((await pdf("?statut=INSCRIT", jwt)).status).toBe(403);
    await prisma.user.deleteMany({ where: { email } });
    await prisma.membre.deleteMany({ where: { nom: { startsWith: "T5 " } } });
  });

  it("listeAvocatsHtml : encode les champs libres, une ligne par membre, sans motif", () => {
    const html = listeAvocatsHtml(
      [{ num: 1, numInscription: "PN-1", nom: "<script>alert(1)</script>", qualite: "AVOCAT", statut: "DECEDE", cabinet: "A&B", dateDeces: new Date("2026-09-15") }],
      "<script>", new Date("2026-10-10"),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Décédé");
    expect(html).toContain("2026-09-15");
    expect(html).toContain("Document interne confidentiel");
    expect(html.match(/<tbody>.*<\/tbody>/s)![0].match(/<tr>/g)).toHaveLength(1);
  });

  it("le nombre de lignes du gabarit égale celui de GET /api/membres (mêmes filtres, toutes les pages)", async () => {
    const items: any[] = [];
    for (let page = 1; ; page++) {
      const r = await request(app).get(`/api/membres?statut=INSCRIT&pageSize=200&page=${page}`).set(...bearer(sg));
      items.push(...r.body.items);
      if (page >= r.body.totalPages) break;
    }
    const html = listeAvocatsHtml(items, "statut INSCRIT", new Date());
    expect(html.match(/<tbody>.*<\/tbody>/s)![0].match(/<tr>/g)).toHaveLength(items.length);
  });

  it.skipIf(!trouverChromium())("SG : 200, application/pdf, %PDF, sélection ids (2 sur N), audit horodaté avant la réponse", async () => {
    const liste = await request(app).get("/api/membres?pageSize=200").set(...bearer(sg));
    expect(liste.body.items.length).toBeGreaterThan(2);
    // deux derniers membres : prouve que le filtre ids est appliqué (et non les premiers / tous)
    const ids = liste.body.items.slice(-2).map((m: any) => m.id).join(",");
    const user = await prisma.user.findUnique({ where: { email: "sg@barreau-pn.cg" } });
    const maxAvant = (await prisma.journalAudit.aggregate({ _max: { id: true } }))._max.id ?? 0;
    const r = await pdf(`?ids=${ids}`, sg);
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toContain("application/pdf");
    expect(r.headers["content-disposition"]).toMatch(/Avocats-\d{4}-\d{2}-\d{2}\.pdf/);
    expect((r.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");
    // L'audit est écrit avant l'envoi : aucune attente nécessaire, lecture ciblée (id > avant, même utilisateur).
    const e = await prisma.journalAudit.findMany({
      where: { id: { gt: maxAvant }, action: "Export de la liste des avocats", userId: user!.id },
    });
    expect(e).toHaveLength(1);
    expect(e[0].cible).toContain("format=pdf");
    expect(e[0].cible).toContain("sélection de 2");
    expect(e[0].cible).toContain("lignes=2");
  }, 60000);
});

describe("Import du tableau — décès, dates, accès espace, audit (T6)", () => {
  const num = 930000 + (Date.now() % 10000);
  const importer = (membres: object[]) => request(app).post("/api/membres/import").set(...bearer(sg)).send({ membres });
  afterAll(async () => {
    const ms = await prisma.membre.findMany({ where: { nom: { startsWith: "T6 " } }, select: { id: true } });
    await prisma.user.deleteMany({ where: { membreId: { in: ms.map((m) => m.id) } } });
    await prisma.membre.deleteMany({ where: { nom: { startsWith: "T6 " } } });
  });

  it("CA-09 / R1-9 : statut décédé refusé à l'import (même avec date), date invalide ignorée, num non numérique en erreur", async () => {
    const r = await importer([{ num, nom: "T6 Décès", statut: "décédé", dateDeces: "2026-09-15" }]);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ total: 1, crees: 0, maj: 0 });
    expect(r.body.erreurs).toHaveLength(1);
    expect(r.body.erreurs[0].message).toMatch(/interdit à l'import/);
    expect(await prisma.membre.findUnique({ where: { num } })).toBeNull();

    // Date invalide : ligne acceptée, date non modifiée (nouveau membre → null).
    const r2 = await importer([{ num: num + 1, nom: "T6 Date invalide", dateDeces: "n/a" }]);
    expect(r2.body).toMatchObject({ crees: 1, erreurs: [] });
    expect((await prisma.membre.findUnique({ where: { num: num + 1 } }))?.dateDeces).toBeNull();

    // num non numérique : ligne en erreur (numéro de ligne), les autres lignes passent.
    const r3 = await importer([{ num: num + 4, nom: "T6 Bon" }, { num: "abc", nom: "T6 Mauvais num" }]);
    expect(r3.status).toBe(200);
    expect(r3.body.crees).toBe(1);
    expect(r3.body.erreurs).toHaveLength(1);
    expect(r3.body.erreurs[0].ligne).toBe(2);
  });

  it("aller-retour : même jour de dateInscription → horodatage conservé ; autre jour → mis à jour", async () => {
    const n = num + 7;
    const horodatage = new Date("2025-03-04T14:35:12.000Z");
    await prisma.membre.create({ data: { num: n, numInscription: `T${n}`, nom: "T6 Horodatage", qualite: "AVOCAT", statut: "INSCRIT", dateInscription: horodatage } });
    await importer([{ num: n, nom: "T6 Horodatage", dateInscription: "2025-03-04" }]);
    expect((await prisma.membre.findUnique({ where: { num: n } }))?.dateInscription.toISOString()).toBe(horodatage.toISOString());
    await importer([{ num: n, nom: "T6 Horodatage", dateInscription: "2025-03-05" }]);
    expect((await prisma.membre.findUnique({ where: { num: n } }))?.dateInscription.toISOString().slice(0, 10)).toBe("2025-03-05");
  });

  it("statut absent du fichier : le statut existant n'est pas écrasé ; données d'acte jamais altérées par import (R2-4)", async () => {
    await prisma.membre.create({ data: { num: num + 2, numInscription: `T${num + 2}`, nom: "T6 Radié", qualite: "AVOCAT", statut: "RADIE", dateRadiation: new Date("2026-03-01"), motifRadiation: "Décision n° 4" } });
    await importer([{ num: num + 2, nom: "T6 Radié", dateRadiation: "2020-01-01", motifRadiation: "Altéré", dateDeces: "2020-01-01" }]);
    const r = await importer([{ num: num + 2, nom: "T6 Radié", cabinet: "Cabinet X" }]);
    expect(r.body).toMatchObject({ crees: 0, maj: 1 });
    const m = await prisma.membre.findUnique({ where: { num: num + 2 } });
    expect(m?.statut).toBe("RADIE");
    expect(m?.cabinet).toBe("Cabinet X");
    expect(m?.dateRadiation?.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(m?.motifRadiation).toBe("Décision n° 4");
    expect(m?.dateDeces).toBeNull();
  });

  it("R1-2 : « Radiée » → RADIE ; statut inconnu → erreur de ligne, membre inchangé", async () => {
    const n2 = num + 7;
    const r0 = await importer([{ num: n2, nom: "T6 Statut", statut: "Radiée" }]);
    expect(r0.body.erreurs[0].message).toMatch(/interdit à l'import/);
    const r = await importer([{ num: n2, nom: "T6 Statut", statut: "Radiee x" }]);
    expect(r.body.erreurs).toEqual([{ ligne: 1, message: "Statut inconnu : Radiee x" }]);
    expect((await prisma.membre.findUnique({ where: { num: n2 } }))?.statut).toBe("INSCRIT");
  });

  it("R1-9 : membre existant importé « décédé » ou « radié » : refusé, statut et compte espace inchangés ; sortie de RADIE refusée aussi", async () => {
    const c = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `T6 Espace ${Date.now()}`, qualite: "AVOCAT", email: `t6-${Date.now()}@test.cg` });
    const id = c.body.id as number;
    await request(app).post(`/api/membres/${id}/acces`).set(...bearer(sg));
    await prisma.user.update({ where: { membreId: id }, data: { actif: true, activationToken: null } });
    const r = await importer([{ num: c.body.num, nom: c.body.nom, statut: "décédé" }, { num: c.body.num, nom: c.body.nom, statut: "radié" }]);
    expect(r.body).toMatchObject({ maj: 0 });
    expect(r.body.erreurs).toHaveLength(2);
    expect((await prisma.membre.findUnique({ where: { id } }))?.statut).toBe("INSCRIT");
    expect((await prisma.user.findUnique({ where: { membreId: id } }))?.actif).toBe(true);
    // Sortie de RADIE par import : refusée (correction via la fiche).
    await prisma.membre.update({ where: { id }, data: { statut: "RADIE" } });
    const r2 = await importer([{ num: c.body.num, nom: c.body.nom, statut: "inscrit" }]);
    expect(r2.body.erreurs).toHaveLength(1);
    expect((await prisma.membre.findUnique({ where: { id } }))?.statut).toBe("RADIE");
    // Même statut (aller-retour d'export) : accepté.
    expect((await importer([{ num: c.body.num, nom: c.body.nom, statut: "radié" }])).body).toMatchObject({ maj: 1, erreurs: [] });
  });

  it("C-05 : une ligne JournalAudit « Import du tableau » avec les totaux", async () => {
    await importer([{ num: num + 3, nom: "T6 Audit" }]);
    let e = null;
    for (let i = 0; i < 30 && !e; i++) {
      e = await prisma.journalAudit.findFirst({ where: { action: { startsWith: "Import du tableau — Avocat (1 ligne(s), 1 créé(s)" } } });
      if (!e) await new Promise((r) => setTimeout(r, 100));
    }
    expect(e).not.toBeNull();
  });
});

describe("Revue sécurité T10 — données disciplinaires, extraction en masse, rôles", () => {
  const suffixe = Date.now();
  let avocatJwt = "";
  let consultJwt = "";
  let radieId = 0;
  const avocatEmail = `t10.avocat.${suffixe}@barreau-pn.cg`;
  const consultEmail = `t10.consult.${suffixe}@barreau-pn.cg`;

  beforeAll(async () => {
    const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `T10 Avocat ${suffixe}`, qualite: "AVOCAT", email: avocatEmail });
    const acces = await request(app).post(`/api/membres/${m.body.id}/acces`).set(...bearer(sg));
    await request(app).post("/api/auth/activer").send({ token: acces.body.lien.split("/activer/")[1], password: "avocatpass8" });
    avocatJwt = (await request(app).post("/api/auth/login").send({ email: avocatEmail, password: "avocatpass8" })).body.token;
    await request(app).post("/api/users").set(...bearer(sg)).send({ nom: `T10 Consultation`, email: consultEmail, role: "CONSULTATION", password: "consultpass8" });
    consultJwt = (await request(app).post("/api/auth/login").send({ email: consultEmail, password: "consultpass8" })).body.token;
    const r = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `T10 Radie ${suffixe}`, qualite: "AVOCAT" });
    radieId = r.body.id;
    await request(app).post(`/api/membres/${radieId}/radier`).set(...bearer(sg)).send({ dateRadiation: "2026-10-01", motifRadiation: "MOTIF-SECRET-T10" });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [avocatEmail, consultEmail] } } });
    await prisma.membre.deleteMany({ where: { nom: { startsWith: "T10 " } } });
  });

  it("AVOCAT → 403 sur export PDF, journal d'export, déclaration de décès et import", async () => {
    expect(avocatJwt).toBeTruthy();
    expect((await request(app).get("/api/membres/export/pdf").set(...bearer(avocatJwt))).status).toBe(403);
    expect((await request(app).post("/api/membres/export").set(...bearer(avocatJwt)).send({ format: "csv", filtre: "tous", lignes: 1 })).status).toBe(403);
    expect((await request(app).post(`/api/membres/${radieId}/deces`).set(...bearer(avocatJwt)).send({ dateDeces: "2026-09-15" })).status).toBe(403);
    expect((await request(app).post("/api/membres/import").set(...bearer(avocatJwt)).send({ membres: [{ num: 999999, nom: "T10 Intrus" }] })).status).toBe(403);
    expect(await prisma.membre.findUnique({ where: { num: 999999 } })).toBeNull();
  });

  it("CONSULTATION ne reçoit jamais motifRadiation : ni dans GET /membres, ni dans le HTML de l'export PDF", async () => {
    const liste = await request(app).get(`/api/membres?q=${encodeURIComponent(`T10 Radie ${suffixe}`)}`).set(...bearer(consultJwt));
    expect(liste.status).toBe(200);
    expect(liste.body.items).toHaveLength(1);
    expect(JSON.stringify(liste.body)).not.toContain("MOTIF-SECRET-T10");
    expect("motifRadiation" in liste.body.items[0]).toBe(false);
    vi.mocked(htmlVersPdf).mockResolvedValueOnce(Buffer.from("%PDF-test"));
    const r = await request(app).get(`/api/membres/export/pdf?ids=${radieId}`).set(...bearer(consultJwt));
    expect(r.status).toBe(200);
    const html = vi.mocked(htmlVersPdf).mock.calls.at(-1)![0];
    expect(html).toContain(`T10 Radie ${suffixe}`);
    expect(html).not.toContain("MOTIF-SECRET-T10");
  });

  it("R1-11 : le titre du PDF porte le libellé français du statut, pas la valeur brute de l'enum", async () => {
    vi.mocked(htmlVersPdf).mockResolvedValueOnce(Buffer.from("%PDF-test"));
    const r = await request(app).get("/api/membres/export/pdf?statut=DECEDE").set(...bearer(sg));
    expect(r.status).toBe(200);
    const html = vi.mocked(htmlVersPdf).mock.calls.at(-1)![0];
    expect(html).toContain("statut Décédé");
    expect(html).not.toContain("statut DECEDE");
    expect(html).toContain("white-space:nowrap");
  });

  it("ids : 201 valeurs → 400, « 1;DROP » → 400, sans appel au rendu", async () => {
    const appels = vi.mocked(htmlVersPdf).mock.calls.length;
    const ids201 = Array.from({ length: 201 }, (_, i) => i + 1).join(",");
    expect((await request(app).get(`/api/membres/export/pdf?ids=${ids201}`).set(...bearer(sg))).status).toBe(400);
    expect((await request(app).get(`/api/membres/export/pdf?ids=${encodeURIComponent("1;DROP")}`).set(...bearer(sg))).status).toBe(400);
    expect((await request(app).get(`/api/membres/export/pdf?ids=1&ids=2`).set(...bearer(sg))).status).toBe(400);
    expect(vi.mocked(htmlVersPdf).mock.calls.length).toBe(appels);
  });

  it("import : plafond 2 000 lignes (2 001 → 400, rien d'écrit) ; clés d'en-tête hostiles ignorées", async () => {
    const base = 970000 + (suffixe % 10000);
    const trop = Array.from({ length: 2001 }, (_, i) => ({ num: base + i, nom: `T10 Lot ${i}` }));
    expect((await request(app).post("/api/membres/import").set(...bearer(sg)).send({ membres: trop })).status).toBe(400);
    expect(await prisma.membre.count({ where: { nom: { startsWith: "T10 Lot " } } })).toBe(0);
    const hostile = JSON.parse(`[{"num": ${base}, "nom": "T10 Hostile", "__proto__": {"statut": "RADIE"}, "id": 1, "numInscription": "PN-X", "motifRadiation": "x"}]`);
    const r = await request(app).post("/api/membres/import").set(...bearer(sg)).send({ membres: hostile });
    expect(r.status).toBe(200);
    const m = await prisma.membre.findUnique({ where: { num: base } });
    expect(m?.statut).toBe("INSCRIT");
    expect(m?.numInscription).toBe(`T${base}`);
    expect(m?.id).not.toBe(1);
  });

  it("export client (CSV/XLSX/TXT) journalisé : format, filtre, lignes, identité et horodatage", async () => {
    const user = await prisma.user.findUnique({ where: { email: consultEmail } });
    const avant = (await prisma.journalAudit.aggregate({ _max: { id: true } }))._max.id ?? 0;
    const r = await request(app).post("/api/membres/export").set(...bearer(consultJwt)).send({ format: "xlsx", filtre: "statut RADIE", lignes: 3 });
    expect(r.status).toBe(204);
    expect((await request(app).post("/api/membres/export").set(...bearer(consultJwt)).send({ format: "exe", filtre: "x", lignes: 1 })).status).toBe(400);
    let e = null;
    for (let i = 0; i < 20 && !e; i++) {
      e = await prisma.journalAudit.findFirst({ where: { id: { gt: avant }, userId: user!.id, chemin: "/api/membres/export" } });
      if (!e) await new Promise((res) => setTimeout(res, 100));
    }
    expect(e).not.toBeNull();
    expect(e!.action).toBe("Export de la liste des avocats");
    expect(e!.cible).toBe("format=xlsx; filtre=statut RADIE; lignes=3");
    // Une seule ligne (pas de doublon du middleware générique).
    expect(await prisma.journalAudit.count({ where: { id: { gt: avant }, userId: user!.id, chemin: "/api/membres/export" } })).toBe(1);
    expect(e!.userNom).toBe("T10 Consultation");
    expect(e!.quand).toBeInstanceOf(Date);
  });

  it("export client : si l'écriture du journal échoue → 500 (pas de trace, pas d'export)", async () => {
    const spy = vi.spyOn(prisma.journalAudit, "create").mockRejectedValueOnce(new Error("panne"));
    const r = await request(app).post("/api/membres/export").set(...bearer(consultJwt)).send({ format: "csv", filtre: "tous", lignes: 1 });
    spy.mockRestore();
    expect(r.status).toBe(500);
  });
});

describe("Limiteur global (R1-12)", () => {
  it("/api/health reste hors compteur", async () => {
    const r = await request(app).get("/api/health");
    expect(r.status).toBe(200);
    expect(r.headers["ratelimit-limit"]).toBeUndefined();
  });

  it("anonyme et jeton bidon : 429 en français avec Retry-After ; jeton valide : limite plus haute", async () => {
    const petite = creerApp({ anonyme: 2, authentifie: 4 });
    const jeton = sg;
    for (const auth of [undefined, "Bearer bidon"]) {
      const agent = () => { const r = request(petite).get("/api/membres"); return auth ? r.set("Authorization", auth) : r; };
      await agent(); await agent();
      const r = await agent();
      expect(r.status).toBe(429);
      expect(r.body.erreur).toMatch(/^Trop de requêtes, réessayez dans \d+ s\.$/);
      expect(typeof r.body.retryAfter).toBe("number");
      expect(Number(r.headers["retry-after"])).toBeGreaterThan(0);
    }
    const p2 = creerApp({ anonyme: 1, authentifie: 4 });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await request(p2).get("/api/membres").set("Authorization", `Bearer ${jeton}`)).status);
    expect(codes.slice(0, 4)).toEqual([200, 200, 200, 200]);
    expect(codes[4]).toBe(429);
  });
});
