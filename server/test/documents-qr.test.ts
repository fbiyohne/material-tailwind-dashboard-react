import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { cheminVerif, urlVerif, qrDocument } from "../src/lib/signature.js";
import { finValiditeQuitus } from "../src/lib/business.js";
import { fmtDateFr } from "../src/lib/documentsCommun.js";
import { quitusRicheHtml, recuRicheHtml } from "../src/lib/documentsRiches.js";

// Le PDF n'est pas rendu (pas de Chromium requis) : on capture le HTML envoyé au moteur.
const html = vi.hoisted(() => ({ dernier: "" }));
vi.mock("../src/lib/pdf.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/lib/pdf.js")>();
  return { ...orig, envoyerDocumentPdf: vi.fn(async (res: { end(b: string): void }, h: string) => { html.dernier = h; res.end("pdf"); }) };
});

/**
 * T9 (M-20261011, point 6) : chaque quitus, reçu et timbre porte un chemin de
 * vérification signé distinct (champ `verif`), le QR des PDF l'encode, et la
 * validité du quitus est calculée depuis la règle regles.quitus.validiteMois.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const iso = (d: Date) => d.toISOString().slice(0, 10);
let sg = "";
let avocat = "";
let membreId = 0;
let userId = 0;
let num = 0;
const quitusIds: number[] = [];
const recuIds: number[] = [];
const timbreIds: number[] = [];
let validiteAvant: number | undefined;

/** Écrit (ou retire, si undefined) la seule clé regles.quitus, sans toucher au reste de la ligne. */
const ecrireValidite = async (validiteMois: number | undefined) => {
  const row = await prisma.parametres.findUnique({ where: { id: 1 } });
  const data = (row?.data ?? {}) as Record<string, unknown>;
  const regles = { ...((data.regles as Record<string, unknown>) ?? {}) };
  if (validiteMois === undefined) delete regles.quitus;
  else regles.quitus = { validiteMois };
  await prisma.parametres.upsert({ where: { id: 1 }, update: { data: { ...data, regles } as never }, create: { id: 1, data: { regles } as never } });
};

/** Origine publique configurée pour la suite : seule source de l'URL du QR (jamais l'en-tête Host). */
const ORIGINE = "https://barreau.exemple.cg";
const ancienneOrigine = process.env.PUBLIC_ORIGIN;

beforeAll(async () => {
  process.env.PUBLIC_ORIGIN = ORIGINE;
  const regles = ((await prisma.parametres.findUnique({ where: { id: 1 } }))?.data as { regles?: { quitus?: { validiteMois?: number } } } | null)?.regles;
  validiteAvant = regles?.quitus?.validiteMois;
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 1;
  const m = await prisma.membre.create({ data: { num, nom: `TEST QR ${num}`, qualite: "AVOCAT", statut: "INSCRIT", adresse: "1 rue du Test" } as never });
  membreId = m.id;
  const u = await prisma.user.create({ data: { nom: m.nom, email: `qr${num}@test.cg`, role: "AVOCAT", passwordHash: bcrypt.hashSync("barreau", 4), actif: true, membreId } });
  userId = u.id;
  avocat = (await request(app).post("/api/auth/login").send({ email: u.email, password: "barreau" })).body.token;
  for (const [i, annee] of [2091, 2092].entries()) {
    quitusIds.push((await prisma.quitus.create({ data: { numero: `QT-${num}-${i}`, membreId, annee, dateEmission: new Date(`2026-0${i + 1}-31T10:00:00Z`) } })).id);
    recuIds.push((await prisma.recu.create({ data: { numero: `RT-${num}-${i}`, membreId, annee, montant: 1000, date: new Date("2026-03-01T10:00:00Z"), objet: `Cotisation ordinale ${annee}` } })).id);
  }
  const numTimbre = ((await prisma.timbre.aggregate({ _max: { numero: true } }))._max.numero ?? 0) + 1;
  for (const i of [0, 1]) {
    timbreIds.push((await prisma.timbre.create({ data: { numero: numTimbre + i, code: `TESTQR${num}X${i}`, membreId, affaire: `Affaire ${i}`, montant: 15000 } })).id);
  }
});

afterAll(async () => {
  if (ancienneOrigine === undefined) delete process.env.PUBLIC_ORIGIN; else process.env.PUBLIC_ORIGIN = ancienneOrigine;
  await ecrireValidite(validiteAvant);
  await prisma.timbre.deleteMany({ where: { id: { in: timbreIds } } });
  await prisma.recu.deleteMany({ where: { id: { in: recuIds } } });
  await prisma.quitus.deleteMany({ where: { id: { in: quitusIds } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.membre.deleteMany({ where: { id: membreId } });
});

describe("Documents à QR : champ verif distinct par document", () => {
  it("quitus : GET /quitus renvoie verif signé et finValidite calculée", async () => {
    await ecrireValidite(3);
    const r = await request(app).get("/api/quitus").set(...bearer(sg));
    expect(r.status).toBe(200);
    const miens = r.body.filter((q: { membreId: number }) => q.membreId === membreId);
    expect(miens).toHaveLength(2);
    for (const q of miens) {
      expect(q.verif).toBe(urlVerif("q", q.numero));
      expect(q.finValidite.slice(0, 10)).toBe(iso(finValiditeQuitus(new Date(q.dateEmission), 3)));
    }
    expect(miens[0].verif).not.toBe(miens[1].verif);
  });

  it("reçus : GET /recus renvoie deux verif distincts", async () => {
    const r = await request(app).get("/api/recus").set(...bearer(sg));
    const miens = r.body.filter((x: { membreId: number }) => x.membreId === membreId);
    expect(miens.map((x: { verif: string }) => x.verif)).toEqual(miens.map((x: { numero: string }) => urlVerif("r", x.numero)));
    expect(new Set(miens.map((x: { verif: string }) => x.verif)).size).toBe(2);
  });

  it("timbres : GET /timbres et /timbres/:id renvoient verif sur le code", async () => {
    const r = await request(app).get("/api/timbres").set(...bearer(sg));
    const miens = r.body.filter((t: { membreId: number }) => t.membreId === membreId);
    expect(miens).toHaveLength(2);
    for (const t of miens) expect(t.verif).toBe(urlVerif("t", t.code));
    expect(miens[0].verif).not.toBe(miens[1].verif);
    const un = await request(app).get(`/api/timbres/${timbreIds[0]}`).set(...bearer(sg));
    expect(un.body.verif).toBe(urlVerif("t", `TESTQR${num}X0`));
  });

  it("espace avocat : mes documents et mes timbres portent verif (et finValidite pour le quitus)", async () => {
    const d = await request(app).get("/api/espace/documents").set(...bearer(avocat));
    expect(d.status).toBe(200);
    expect(d.body.quitus.map((q: { verif: string }) => q.verif).sort()).toEqual([urlVerif("q", `QT-${num}-0`), urlVerif("q", `QT-${num}-1`)].sort());
    for (const q of d.body.quitus) expect(q.finValidite).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.body.recus.map((x: { verif: string }) => x.verif).sort()).toEqual([urlVerif("r", `RT-${num}-0`), urlVerif("r", `RT-${num}-1`)].sort());
    const t = await request(app).get("/api/espace/timbres").set(...bearer(avocat));
    expect(t.body.timbres.map((x: { verif: string }) => x.verif).sort()).toEqual([urlVerif("t", `TESTQR${num}X0`), urlVerif("t", `TESTQR${num}X1`)].sort());
  });

  it("modifier validiteMois ne réécrit pas la fin d'un quitus déjà délivré (R1-2 ; quitus suivant : quitus-fin-figee.test.ts)", async () => {
    await ecrireValidite(6);
    const r = await request(app).get("/api/quitus").set(...bearer(sg));
    const q = r.body.find((x: { id: number }) => x.id === quitusIds[0]);
    // Quitus antérieur à la colonne finValidite : règle d'alors, 3 mois. 31 janv. + 3 mois = 30 avril.
    expect(q.finValidite.slice(0, 10)).toBe("2026-04-30");
    await request(app).get(`/api/quitus/${quitusIds[0]}/pdf`).set(...bearer(sg));
    expect(html.dernier).toContain(fmtDateFr(new Date("2026-04-30T10:00:00Z")));
    expect(html.dernier).not.toContain(fmtDateFr(new Date("2026-07-31T10:00:00Z")));
    await ecrireValidite(3);
  });
});

describe("PDF : le QR encode le chemin signé du document", () => {
  it("GET /quitus/:id/pdf et /espace/quitus/:id/pdf", async () => {
    for (const [url, tok] of [[`/api/quitus/${quitusIds[1]}/pdf`, sg], [`/api/espace/quitus/${quitusIds[1]}/pdf`, avocat]] as const) {
      expect((await request(app).get(url).set(...bearer(tok))).status).toBe(200);
      expect(html.dernier).toContain(cheminVerif("q", `QT-${num}-1`));
      expect(html.dernier).toContain(await qrDocument("q", `QT-${num}-1`));
    }
  });

  it("GET /recus/:id/pdf et /espace/recus/:id/pdf", async () => {
    for (const [url, tok] of [[`/api/recus/${recuIds[0]}/pdf`, sg], [`/api/espace/recus/${recuIds[0]}/pdf`, avocat]] as const) {
      expect((await request(app).get(url).set(...bearer(tok))).status).toBe(200);
      expect(html.dernier).toContain(cheminVerif("r", `RT-${num}-0`));
      expect(html.dernier).toContain(await qrDocument("r", `RT-${num}-0`));
    }
  });
});

describe("PDF : un en-tête Host falsifié ne détourne pas le QR (R1-6)", () => {
  it("quitus, reçu (back-office et espace) : URL imprimée et QR sous l'origine configurée", async () => {
    const cas = [
      [`/api/quitus/${quitusIds[0]}/pdf`, sg, "q", `QT-${num}-0`],
      [`/api/espace/quitus/${quitusIds[0]}/pdf`, avocat, "q", `QT-${num}-0`],
      [`/api/recus/${recuIds[1]}/pdf`, sg, "r", `RT-${num}-1`],
      [`/api/espace/recus/${recuIds[1]}/pdf`, avocat, "r", `RT-${num}-1`],
    ] as const;
    for (const [url, tok, type, ref] of cas) {
      const r = await request(app).get(url).set(...bearer(tok))
        .set("Host", "piege.example").set("X-Forwarded-Host", "piege.example").set("X-Forwarded-Proto", "https");
      expect(r.status).toBe(200);
      expect(html.dernier).not.toContain("piege.example");
      expect(html.dernier).toContain(`barreau.exemple.cg${cheminVerif(type, ref)}`);
      expect(html.dernier).toContain(await qrDocument(type, ref));
    }
  });
});

describe("Gabarits quitus et reçu (point 6)", () => {
  const membre = { nom: "DUPONT Jean", num: 7, dateInscription: new Date("2020-01-01"), adresse: "Av. Test" };
  const quitus = { numero: "Q-2026-0001", annee: 2026, dateEmission: new Date("2026-10-11T10:00:00Z") };
  const recu = { numero: "R-2026-0001", montant: 50000, annee: 2025, date: new Date("2026-03-01"), objet: "Droit de plaidoirie" };

  it("validité du quitus calculée (clause CL-VALIDITE-QUITUS), aucune durée en dur", () => {
    const h = quitusRicheHtml(quitus, membre, "data:,", "x.cg");
    expect(h).not.toMatch(/trois \(03\) mois|valable pour une durée de/i);
    expect(h).toContain(`Valable jusqu'au <b class="navy">${fmtDateFr(new Date("2027-01-11T10:00:00Z"))}</b> inclus, sauf changement de situation du titulaire`);
    expect(h).toContain("consultable à tout moment par le code de vérification.");
  });

  it("gabarit : la fin de validité figée (Quitus.finValidite) prime sur tout calcul (R1-2)", () => {
    const h = quitusRicheHtml({ ...quitus, finValidite: new Date("2027-04-11T10:00:00Z") }, membre, "data:,", "x.cg");
    expect(h).toContain(`Valable jusqu'au <b class="navy">${fmtDateFr(new Date("2027-04-11T10:00:00Z"))}</b> inclus`);
  });

  it("clause CL-VERIF sous le QR, sans « signature électronique »", () => {
    for (const h of [quitusRicheHtml(quitus, membre, "data:,", "x.cg"), recuRicheHtml(recu, membre, "data:,", "x.cg")]) {
      expect(h).toContain("Ce code permet de contrôler que le document a été émis par l'Ordre et d'en connaître le statut actuel.");
      // Images en data URI (cachets) retirées : leur base64 contient des suites « RSA » fortuites.
      expect(h.replace(/data:[^"')]+/g, "")).not.toMatch(/signature électronique|RSA|valeur probante/i);
    }
    expect(quitusRicheHtml(quitus, membre, "data:,", "x.cg")).toContain(`x.cg${cheminVerif("q", "Q-2026-0001")}`);
    expect(recuRicheHtml(recu, membre, "data:,", "x.cg")).toContain(`x.cg${cheminVerif("r", "R-2026-0001")}`);
  });

  it("identité en 12 pt, nom en 14 pt ; reçu : exercice couvert issu des données", () => {
    const h = quitusRicheHtml(quitus, membre, "data:,", "x.cg");
    expect(h).toMatch(/\.champ \{[^}]*font-size:12pt/);
    expect(h).toContain('<span class="nom">Me DUPONT Jean</span>');
    expect(h).toMatch(/\.champ \.nom \{[^}]*font-size:14pt/);
    expect(recuRicheHtml(recu, membre, "data:,", "x.cg")).toContain("<b>Exercice couvert :</b><span>2025</span>");
  });
});
