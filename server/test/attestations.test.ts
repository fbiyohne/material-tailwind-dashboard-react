import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { trouverChromium } from "../src/lib/pdf.js";

/**
 * T14 — Demandes d'attestation archivées via la messagerie :
 * demande de l'avocat → fil administration ; délivrance par l'administration →
 * PDF joint, attestationNumero, archive ; refus à l'avocat ; numérotation ATT continue.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const crees: number[] = [];
let sg = "";
let avocat: { membreId: number; token: string };

const aChromium = !!trouverChromium();

beforeAll(async () => {
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  const email = `e2e.t14.${Date.now()}@barreau-pn.cg`;
  const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `E2E T14 ${Date.now()}`, qualite: "AVOCAT", email });
  crees.push(m.body.id);
  const prov = await request(app).post(`/api/membres/${m.body.id}/acces`).set(...bearer(sg));
  await request(app).post("/api/auth/activer").send({ token: prov.body.lien.split("/activer/")[1], password: "avocatpass8" });
  const token = (await request(app).post("/api/auth/login").send({ email, password: "avocatpass8" })).body.token as string;
  avocat = { membreId: m.body.id, token };
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { membreId: { in: crees } }, select: { id: true } });
  await prisma.conversation.deleteMany({ where: { participants: { some: { membreId: { in: crees } } } } });
  await prisma.archive.deleteMany({ where: { membreNom: { startsWith: "E2E T14" } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await prisma.membre.deleteMany({ where: { id: { in: crees } } });
});

const demander = (type = "INSCRIPTION") =>
  request(app).post("/api/espace/attestations/demandes").set(...bearer(avocat.token)).send({ type });

describe("Demande d'attestation (espace avocat)", () => {
  it("crée un fil avec l'administration portant attestationType", async () => {
    const r = await demander();
    expect(r.status).toBe(201);
    const conv = await prisma.conversation.findUnique({ where: { id: r.body.id }, include: { messages: true } });
    expect(conv).toMatchObject({ avecAdministration: true, attestationType: "INSCRIPTION", attestationNumero: null });
    expect(conv!.messages).toHaveLength(1);
    const admin = await request(app).get(`/api/messagerie/${r.body.id}`).set(...bearer(sg));
    expect(admin.status).toBe(200);
  });

  it("refuse un type inconnu (400) et un non-avocat (403)", async () => {
    expect((await request(app).post("/api/espace/attestations/demandes").set(...bearer(avocat.token)).send({ type: "AUTRE" })).status).toBe(400);
    expect((await request(app).post("/api/espace/attestations/demandes").set(...bearer(sg)).send({ type: "INSCRIPTION" })).status).toBe(403);
  });
});

describe("Délivrance par l'administration", () => {
  it("un avocat ne peut pas délivrer d'attestation (403)", async () => {
    const d = await demander();
    const r = await request(app).post(`/api/messagerie/${d.body.id}/attestation`).set(...bearer(avocat.token));
    expect(r.status).toBe(403);
  });

  it("un fil sans demande d'attestation répond 404", async () => {
    const c = await request(app).post("/api/messagerie").set(...bearer(sg)).send({ membreId: avocat.membreId, sujet: "E2E T14 libre", corps: "bonjour" });
    expect((await request(app).post(`/api/messagerie/${c.body.id}/attestation`).set(...bearer(sg))).status).toBe(404);
  });

  it.skipIf(!aChromium)("délivre : PDF joint, attestationNumero, archive ; 409 à la 2e fois ; numéros ATT croissants", async () => {
    const d1 = await demander();
    const r1 = await request(app).post(`/api/messagerie/${d1.body.id}/attestation`).set(...bearer(sg));
    expect(r1.status, JSON.stringify(r1.body)).toBe(201);
    expect(r1.body.numero).toMatch(/^ATT-\d{4}-\d{3,}$/);

    const conv = await prisma.conversation.findUnique({ where: { id: d1.body.id }, include: { messages: { orderBy: { id: "asc" } } } });
    expect(conv!.attestationNumero).toBe(r1.body.numero);
    const rep = conv!.messages[1];
    expect(rep).toMatchObject({ estAdministration: true, pieceMime: "application/pdf" });
    expect(rep.pieceNom).toBe(`Attestation-${r1.body.numero}.pdf`);
    expect(await prisma.archive.findFirst({ where: { reference: r1.body.numero } })).toMatchObject({ categorie: "Attestation d'inscription" });

    // L'avocat télécharge la pièce, qui est bien un PDF.
    const dl = await request(app).get(`/api/espace/messagerie/messages/${rep.id}/piece`).set(...bearer(avocat.token)).buffer(true).parse((res, cb) => {
      const c: Buffer[] = []; res.on("data", (x) => c.push(x)); res.on("end", () => cb(null, Buffer.concat(c)));
    });
    expect(dl.status).toBe(200);
    expect((dl.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");

    expect((await request(app).post(`/api/messagerie/${d1.body.id}/attestation`).set(...bearer(sg))).status).toBe(409);

    const d2 = await demander();
    const r2 = await request(app).post(`/api/messagerie/${d2.body.id}/attestation`).set(...bearer(sg));
    expect(r2.status).toBe(201);
    const n = (x: string) => Number(x.split("-")[2]);
    expect(n(r2.body.numero)).toBeGreaterThan(n(r1.body.numero));
  }, 60000);
});
