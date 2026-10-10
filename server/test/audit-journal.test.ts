import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

// T18 (CA10) — journal d'audit : envoi de message tracé sans son contenu,
// lecture d'un dossier disciplinaire tracée, filtres userId / action / dates,
// aucune route d'écriture sur /audit.
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const SECRET = `SECRET-CA10-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let sg = "";
let sgId = 0;
let av = { membreId: 0, token: "", userId: 0 };
let convId = 0;
let dossierId = 0;
let avant = 0;

/** Attend la ligne d'audit asynchrone (écrite après l'envoi de la réponse). */
const attendreLigne = async (where: Record<string, unknown>) => {
  let e = null;
  for (let i = 0; i < 30 && !e; i++) {
    e = await prisma.journalAudit.findFirst({ where: { id: { gt: avant }, ...where }, orderBy: { id: "desc" } });
    if (!e) await new Promise((r) => setTimeout(r, 100));
  }
  return e;
};

beforeAll(async () => {
  const login = await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" });
  sg = login.body.token;
  sgId = (await prisma.user.findUniqueOrThrow({ where: { email: "sg@barreau-pn.cg" } })).id;
  avant = (await prisma.journalAudit.aggregate({ _max: { id: true } }))._max.id ?? 0;

  const email = `audit.ca10.${Date.now()}@barreau-pn.cg`;
  const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `AUDIT CA10 ${Date.now()}`, qualite: "AVOCAT", email });
  const prov = await request(app).post(`/api/membres/${m.body.id}/acces`).set(...bearer(sg));
  await request(app).post("/api/auth/activer").send({ token: prov.body.lien.split("/activer/")[1], password: "avocatpass8" });
  const token = (await request(app).post("/api/auth/login").send({ email, password: "avocatpass8" })).body.token as string;
  const userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  av = { membreId: m.body.id, token, userId };

  const d = await prisma.dossierDisciplinaire.create({
    data: { reference: `AUDIT-${Date.now()}`, avocatNom: "Audit CA10", objet: "Lecture tracée", dateSaisine: new Date(), membreId: av.membreId },
  });
  dossierId = d.id;
});

afterAll(async () => {
  // JournalAudit est immuable (trigger) : on n'y touche pas.
  await prisma.dossierDisciplinaire.deleteMany({ where: { id: dossierId } });
  if (convId) await prisma.conversation.deleteMany({ where: { id: convId } });
  await prisma.user.deleteMany({ where: { id: av.userId } });
  await prisma.membre.deleteMany({ where: { id: av.membreId } });
});

describe("Journal d'audit — messagerie sans contenu (CA10)", () => {
  it("un message de l'avocat produit une ligne « Envoi d'un message (message #id) »", async () => {
    const r = await request(app).post("/api/espace/messagerie").set(...bearer(av.token)).send({ sujet: `Sujet ${SECRET}`, corps: `Corps ${SECRET}`, avecAdministration: true });
    expect(r.status).toBe(201);
    convId = r.body.id;
    const e = await attendreLigne({ userId: av.userId, chemin: "/api/espace/messagerie" });
    expect(e).not.toBeNull();
    expect(e!.action).toMatch(/^Envoi d'un message — Messagerie \(message #\d+\)$/);
  });

  it("une réponse de l'administration et une réponse de l'avocat sont tracées", async () => {
    const r1 = await request(app).post(`/api/messagerie/${convId}`).set(...bearer(sg)).send({ corps: `Réponse ${SECRET}` });
    expect(r1.status).toBe(201);
    const e1 = await attendreLigne({ userId: sgId, chemin: `/api/messagerie/${convId}` });
    expect(e1!.action).toBe(`Envoi d'un message — Messagerie (message #${r1.body.id})`);
    expect(e1!.cible).toBe(`#${convId}`);

    const r2 = await request(app).post(`/api/espace/messagerie/${convId}`).set(...bearer(av.token)).send({ corps: `Relance ${SECRET}` });
    expect(r2.status).toBe(201);
    const e2 = await attendreLigne({ userId: av.userId, chemin: `/api/espace/messagerie/${convId}` });
    expect(e2!.action).toBe(`Envoi d'un message — Messagerie (message #${r2.body.id})`);
  });

  it("le texte envoyé n'apparaît dans aucune colonne de JournalAudit", async () => {
    const colonnes = ["action", "cible", "methode", "chemin", "ip", "userNom"] as const;
    const n = await prisma.journalAudit.count({ where: { OR: colonnes.map((c) => ({ [c]: { contains: SECRET } })) } });
    expect(n).toBe(0);
  });

  it("la lecture d'un dossier disciplinaire est tracée dans JournalAudit", async () => {
    expect((await request(app).get(`/api/discipline/${dossierId}`).set(...bearer(sg))).status).toBe(200);
    const e = await attendreLigne({ userId: sgId, chemin: `/api/discipline/${dossierId}`, methode: "GET" });
    expect(e).not.toBeNull();
    expect(e!.action).toBe("Consultation — Dossier disciplinaire");
    expect(e!.cible).toBe(`#${dossierId}`);
  });
});

describe("Journal d'audit — filtres et absence d'écriture", () => {
  const lister = (params: Record<string, string>) => request(app).get("/api/audit").query({ pageSize: 100, ...params }).set(...bearer(sg));

  it("filtre userId : seules les lignes de cet utilisateur", async () => {
    const r = await lister({ userId: String(av.userId) });
    expect(r.status).toBe(200);
    expect(r.body.total).toBeGreaterThanOrEqual(2);
    expect(r.body.items.every((i: { userId: number }) => i.userId === av.userId)).toBe(true);
    expect((await lister({ userId: "abc" })).status).toBe(400);
    // Borne INT4 : hors plage = 400 maîtrisé, jamais 500 remonté par Prisma.
    expect((await lister({ userId: "99999999999" })).status).toBe(400);
    expect((await lister({ userId: "0" })).status).toBe(400);
  });

  it("filtre action : libellé partiel, insensible à la casse", async () => {
    const r = await lister({ action: "envoi d'un message", userId: String(sgId) });
    expect(r.body.total).toBeGreaterThanOrEqual(1);
    expect(r.body.items.every((i: { action: string }) => /Envoi d'un message/.test(i.action))).toBe(true);
    expect((await lister({ action: "consultation", userId: String(sgId) })).body.items.some((i: { cible: string }) => i.cible === `#${dossierId}`)).toBe(true);
  });

  it("filtre dates : plage inclusive ; plage dans le futur vide", async () => {
    const jour = new Date().toISOString().slice(0, 10);
    expect((await lister({ from: jour, to: jour, userId: String(av.userId) })).body.total).toBeGreaterThanOrEqual(2);
    expect((await lister({ from: "2099-01-01", userId: String(av.userId) })).body.total).toBe(0);
  });

  it("la réponse liste les acteurs connus (pour le filtre de l'écran)", async () => {
    const r = await lister({});
    expect(r.body.acteurs.some((a: { id: number }) => a.id === av.userId)).toBe(true);
  });

  it("aucune route PUT, PATCH, DELETE ni POST sur /audit", async () => {
    for (const chemin of ["/api/audit", `/api/audit/${avant + 1}`]) {
      expect((await request(app).put(chemin).set(...bearer(sg)).send({ action: "x" })).status).toBe(404);
      expect((await request(app).patch(chemin).set(...bearer(sg)).send({ action: "x" })).status).toBe(404);
      expect((await request(app).delete(chemin).set(...bearer(sg))).status).toBe(404);
      expect((await request(app).post(chemin).set(...bearer(sg)).send({ action: "x" })).status).toBe(404);
    }
  });

  it("l'avocat n'accède pas au journal", async () => {
    expect((await request(app).get("/api/audit").set(...bearer(av.token))).status).toBe(403);
  });
});
