import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * T6 (M-20261011) — gardes des actions destructives de la fiche avocat.
 *  - DELETE /membres/:id : réservé à une fiche créée par erreur, sans historique (événement de
 *    parcours, paiement, reçu, quitus, timbre, dossier disciplinaire) ; sinon 409 et renvoi vers
 *    une sortie (démission, cessation). Aucun reçu émis n'est effaçable (conservation comptable).
 *  - POST /membres/:id/deces : date d'effet ET pièce justificative (acte ou certificat de décès)
 *    obligatoires ; aucune cause ni donnée de santé acceptée (loi 29-2019 art. 17, R-15).
 *  - PATCH ne peut plus contourner la déclaration (passage à DECEDE sans pièce) : 409.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const MARQUE = `TEST T6 ${Date.now()}`;
let sg = "";
let admin = "";

const login = async (email: string) => (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;
const creer = async (suffixe: string) => {
  const r = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `${MARQUE} ${suffixe}`, qualite: "AVOCAT" });
  expect(r.status).toBe(201);
  return r.body.id as number;
};
/** Le journal est écrit après l'envoi de la réponse (middleware audit) : on attend la ligne. */
const attendreAudit = async (action: string, id: number) => {
  for (let i = 0; i < 30; i++) {
    const e = await prisma.journalAudit.findFirst({ where: { action: { startsWith: action }, cible: `#${id}` } });
    if (e) return e;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
};
const uniq = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

beforeAll(async () => {
  sg = await login("sg@barreau-pn.cg");
  admin = await login("admin@barreau-pn.cg");
});

afterAll(async () => {
  // Fiches à historique non supprimables par l'API : nettoyage direct (pièces d'abord, FK sans cascade).
  const membreId = { in: (await prisma.membre.findMany({ where: { nom: { startsWith: MARQUE } }, select: { id: true } })).map((m) => m.id) };
  await prisma.recu.deleteMany({ where: { membreId } });
  await prisma.paiement.deleteMany({ where: { membreId } });
  await prisma.quitus.deleteMany({ where: { membreId } });
  await prisma.dossierDisciplinaire.deleteMany({ where: { membreId } });
  await prisma.membre.deleteMany({ where: { id: membreId } });
});

describe("T6 — DELETE /membres/:id : fiche créée par erreur seulement", () => {
  const HISTORIQUES: [string, (id: number) => Promise<unknown>][] = [
    ["événement de parcours", (id) => prisma.evenementSituation.create({ data: { membreId: id, type: "RAPPEL", dateEffet: new Date(), annee: 2026 } })],
    ["paiement", (id) => prisma.paiement.create({ data: { ref: `T6-${uniq()}`, canal: "SANDBOX", type: "cotisation", membreId: id, annee: 2026, montant: 1000 } })],
    ["reçu", (id) => prisma.recu.create({ data: { numero: `T6-R-${uniq()}`, membreId: id, montant: 1000, annee: 2026, date: new Date() } })],
    ["quitus", (id) => prisma.quitus.create({ data: { numero: `T6-Q-${uniq()}`, membreId: id, annee: 2026, dateEmission: new Date() } })],
    ["timbre", (id) => prisma.timbre.create({ data: { numero: 1_900_000_000 + Math.floor(Math.random() * 1e8), code: `T6-T-${uniq()}`, membreId: id, affaire: "Test", montant: 1000 } })],
    ["dossier disciplinaire", (id) => prisma.dossierDisciplinaire.create({ data: { reference: `T6-D-${uniq()}`, membreId: id, avocatNom: MARQUE, objet: "Test", dateSaisine: new Date() } })],
  ];

  it.each(HISTORIQUES)("fiche avec %s → 409, renvoi vers une sortie, fiche conservée", async (_libelle, ajouter) => {
    const id = await creer(`hist ${_libelle}`);
    await ajouter(id);
    const r = await request(app).delete(`/api/membres/${id}`).set(...bearer(admin));
    expect(r.status).toBe(409);
    expect(r.body.erreur).toMatch(/démission/);
    expect(r.body.erreur).toMatch(/cessation/);
    expect(await prisma.membre.findUnique({ where: { id } })).not.toBeNull();
  });

  it("le reçu émis par un paiement réel de cotisation n'est jamais effacé (409)", async () => {
    const id = await creer("recu-cotisation");
    expect((await request(app).post("/api/cotisations/paiement").set(...bearer(sg)).send({ membreId: id, annee: 2026, montant: 150000, mode: "Espèces" })).status).toBeLessThan(300);
    expect((await request(app).delete(`/api/membres/${id}`).set(...bearer(admin))).status).toBe(409);
    expect(await prisma.recu.count({ where: { membreId: id } })).toBeGreaterThan(0);
  });

  it("fiche vierge → 200, fiche supprimée et ligne JournalAudit", async () => {
    const id = await creer("vierge");
    const r = await request(app).delete(`/api/membres/${id}`).set(...bearer(admin));
    expect(r.status).toBe(200);
    expect(await prisma.membre.findUnique({ where: { id } })).toBeNull();
    const ligne = await attendreAudit("Suppression — Avocat", id);
    expect(ligne?.action).toMatch(/fiche créée par erreur/);
  });

  it("SG → 403 (suppression réservée à l'ADMIN)", async () => {
    const id = await creer("rbac");
    expect((await request(app).delete(`/api/membres/${id}`).set(...bearer(sg))).status).toBe(403);
  });
});

describe("T6 — POST /membres/:id/deces : date et pièce obligatoires, aucune cause", () => {
  it("sans pièce → 400 ; sans date → 400 ; statut inchangé", async () => {
    const id = await creer("deces-incomplet");
    expect((await request(app).post(`/api/membres/${id}/deces`).set(...bearer(sg)).send({ dateDeces: "2026-09-15" })).status).toBe(400);
    expect((await request(app).post(`/api/membres/${id}/deces`).set(...bearer(sg)).send({ dateDeces: "2026-09-15", piece: "  " })).status).toBe(400);
    expect((await request(app).post(`/api/membres/${id}/deces`).set(...bearer(sg)).send({ piece: "Acte de décès n° 12" })).status).toBe(400);
    expect((await prisma.membre.findUniqueOrThrow({ where: { id } })).statut).toBe("INSCRIT");
  });

  it.each(["cause", "causeDeces", "motif", "details"])("champ « %s » refusé par le schéma (400), rien n'est écrit", async (champ) => {
    const id = await creer(`deces-${champ}`);
    const r = await request(app).post(`/api/membres/${id}/deces`).set(...bearer(sg)).send({ dateDeces: "2026-09-15", piece: "Acte de décès n° 12", [champ]: "maladie" });
    expect(r.status).toBe(400);
    expect((await prisma.membre.findUniqueOrThrow({ where: { id } })).statut).toBe("INSCRIT");
    expect(await prisma.evenementSituation.count({ where: { membreId: id } })).toBe(0);
  });

  it("date + pièce → DECEDE, EvenementSituation DECES avec la pièce et sans motif, JournalAudit", async () => {
    const id = await creer("deces-ok");
    const r = await request(app).post(`/api/membres/${id}/deces`).set(...bearer(sg)).send({ dateDeces: "2026-09-15", piece: "Acte de décès n° 12 — centre d'état civil" });
    expect(r.status).toBe(200);
    expect(r.body.statut).toBe("DECEDE");
    const ev = await prisma.evenementSituation.findFirstOrThrow({ where: { membreId: id, type: "DECES" } });
    expect(ev).toMatchObject({ statutApres: "DECEDE", reference: "Acte de décès n° 12 — centre d'état civil", motif: null });
    expect(ev.dateEffet.toISOString().slice(0, 10)).toBe("2026-09-15");
    expect((await attendreAudit("Déclaration de décès", id))?.action).toBe("Déclaration de décès — Avocat");
    // Fiche désormais historisée : plus supprimable.
    expect((await request(app).delete(`/api/membres/${id}`).set(...bearer(admin))).status).toBe(409);
  });

  it("PATCH vers DECEDE (sans pièce) → 409 : la déclaration passe par /deces", async () => {
    const id = await creer("deces-patch");
    const r = await request(app).patch(`/api/membres/${id}`).set(...bearer(sg)).send({ statut: "DECEDE", dateDeces: "2026-09-15" });
    expect(r.status).toBe(409);
    expect(r.body.erreur).toMatch(/Déclarer le décès/);
    expect((await prisma.membre.findUniqueOrThrow({ where: { id } })).statut).toBe("INSCRIT");
  });
});
