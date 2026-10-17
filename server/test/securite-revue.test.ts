// Clé de TEST uniquement (32 octets à zéro, en base64) : jamais une clé réelle.
process.env.PARAMS_CLE = Buffer.alloc(32).toString("base64");
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { chiffrer, dechiffrer } from "../src/lib/secrets.js";
import { htmlVersPdf } from "../src/lib/pdf.js";

vi.mock("../src/lib/pdf.js", async (importOriginal) => ({ ...(await importOriginal<typeof import("../src/lib/pdf.js")>()), htmlVersPdf: vi.fn(async () => Buffer.from("%PDF-test")) }));

/**
 * T27 (M-20261011) — non-régression des constats de la revue de sécurité :
 *  S1 : sans permission « discipline », le filtre statut=RADIE de la liste et de l'export
 *       contournait le masquage R-62 du registre des anciens membres ;
 *  S2 : changer l'hôte SMTP en gardant le mot de passe masqué permettait de l'envoyer
 *       (AUTH) à un serveur choisi par l'opérateur, via /tester/smtp ou le prochain envoi ;
 *  S3 : déchiffrement GCM avec longueur de tag explicite (Semgrep gcm-no-tag-length).
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const marque = `T27SEC-${Date.now()}`;
let sg = "", consult = "", radie = 0, demis = 0;
let sauvegarde: unknown = null;

beforeAll(async () => {
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  const email = `consult-${marque}@test.cg`.toLowerCase();
  await request(app).post("/api/users").set(...bearer(sg)).send({ nom: `${marque} Consultation`, email, role: "CONSULTATION", password: "consultpass8" });
  consult = (await request(app).post("/api/auth/login").send({ email, password: "consultpass8" })).body.token;
  expect(consult).toBeTruthy();
  const max = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + Math.floor(Math.random() * 900000);
  radie = (await prisma.membre.create({ data: { num: max + 1000, nom: `${marque} RADIE`, qualite: "AVOCAT", statut: "RADIE", dateRadiation: new Date("2026-03-10") } })).id;
  demis = (await prisma.membre.create({ data: { num: max + 1001, nom: `${marque} DEMIS`, qualite: "AVOCAT", statut: "DEMISSIONNAIRE" } })).id;
  sauvegarde = (await prisma.parametres.findUnique({ where: { id: 1 } }))?.data ?? null;
});

afterAll(async () => {
  if (sauvegarde) await prisma.parametres.update({ where: { id: 1 }, data: { data: sauvegarde as object } });
  await prisma.membre.deleteMany({ where: { id: { in: [radie, demis] } } });
  await prisma.user.deleteMany({ where: { nom: { startsWith: marque } } });
  await prisma.$disconnect();
});

describe("S1 — R-62 : filtre statut=RADIE réservé à la permission discipline", () => {
  const q = `q=${encodeURIComponent(marque)}&statut=RADIE`;
  it("liste : 403 sans discipline, servie avec", async () => {
    expect((await request(app).get(`/api/membres?${q}`).set(...bearer(consult))).status).toBe(403);
    expect((await request(app).get(`/api/membres?${q}&sortis=1`).set(...bearer(consult))).status).toBe(403);
    const r = await request(app).get(`/api/membres?${q}`).set(...bearer(sg));
    expect(r.status).toBe(200);
    expect(r.body.items.map((m: any) => m.nom)).toContain(`${marque} RADIE`);
  });
  it("export PDF : 403 sans discipline", async () => {
    expect((await request(app).get(`/api/membres/export/pdf?${q}`).set(...bearer(consult))).status).toBe(403);
  });
  it("export PDF par ids : la radiation est masquée sans discipline, visible avec", async () => {
    const html = async (jeton: string) => {
      expect((await request(app).get(`/api/membres/export/pdf?ids=${radie}`).set(...bearer(jeton))).status).toBe(200);
      return vi.mocked(htmlVersPdf).mock.calls.at(-1)![0] as string;
    };
    const masque = await html(consult);
    expect(masque).toContain(`${marque} RADIE`);
    expect(masque).toContain("Sortie du tableau");
    expect(masque).not.toContain("Radié");
    expect(await html(sg)).toContain("Radié");
  });
  it("le décès reste filtrable sans discipline (libellé « Décès », sans cause)", async () => {
    expect((await request(app).get(`/api/membres?q=${encodeURIComponent(marque)}&statut=DECEDE`).set(...bearer(consult))).status).toBe(200);
  });
});

describe("S2 — mot de passe SMTP non réutilisable vers un autre serveur", () => {
  const put = (corps: object) => request(app).put("/api/parametres").set(...bearer(sg)).send(corps);
  const pass = async () => ((await prisma.parametres.findUnique({ where: { id: 1 } }))!.data as any).smtp?.pass;
  it("même hôte : le mot de passe masqué est conservé", async () => {
    expect((await put({ smtp: { host: "127.0.0.1", port: 1025, secure: false, pass: "secret-smtp-t27-1234" } })).status).toBe(200);
    const avant = await pass();
    expect((await put({ smtp: { host: "127.0.0.1", port: 1025, pass: "••••1234" } })).status).toBe(200);
    expect(await pass()).toBe(avant);
  });
  it.each([
    ["hôte", { host: "smtp.attaquant.example" }],
    ["port", { port: 2525 }],
    ["chiffrement", { secure: true }],
  ])("%s modifié sans nouveau mot de passe : l'ancien est effacé", async (_n, champ) => {
    await put({ smtp: { host: "127.0.0.1", port: 1025, secure: false, pass: "secret-smtp-t27-1234" } });
    expect((await put({ smtp: { pass: "••••1234", ...champ } })).status).toBe(200);
    expect(await pass()).toBeUndefined();
  });
  it("hôte modifié avec un nouveau mot de passe : le nouveau est chiffré", async () => {
    await put({ smtp: { host: "127.0.0.1", port: 1025, secure: false, pass: "secret-smtp-t27-1234" } });
    expect((await put({ smtp: { host: "mail.barreau.example", pass: "autre-secret-t27-5678" } })).status).toBe(200);
    expect(dechiffrer(await pass())).toBe("autre-secret-t27-5678");
  });
});

describe("S3 — tag GCM de longueur imposée", () => {
  it("un tag tronqué à 4 octets est refusé", () => {
    const [p, v, iv, tag, ct] = chiffrer("valeur").split(":");
    const court = Buffer.from(tag, "base64").subarray(0, 4).toString("base64");
    expect(() => dechiffrer([p, v, iv, court, ct].join(":"))).toThrow();
  });
});

describe("R1-4 — R-62 : aucun radié distinguable par élimination sans discipline", () => {
  const qm = encodeURIComponent(marque);
  it("filtres statut/motif RADIE, DEMISSIONNAIRE, RETRAITE, CESSATION : 403", async () => {
    for (const v of ["RADIE", "DEMISSIONNAIRE", "RETRAITE", "CESSATION"])
      for (const url of [`/api/membres?q=${qm}&statut=${v}`, `/api/membres?q=${qm}&sortis=1&motif=${v}`, `/api/membres/export/pdf?q=${qm}&sortis=1&motif=${v}`])
        expect((await request(app).get(url).set(...bearer(consult))).status, url).toBe(403);
  });
  it("registre : radié et démissionnaire portent le même libellé neutre", async () => {
    const r = await request(app).get(`/api/membres?q=${qm}&sortis=1`).set(...bearer(consult));
    expect(r.status).toBe(200);
    expect(r.body.items.map((m: any) => m.motifSortie)).toEqual(["Sortie du tableau", "Sortie du tableau"]);
    for (const m of r.body.items) expect(m.statut).toBeNull();
  });
  it("avec discipline, les motifs propres restent visibles", async () => {
    const r = await request(app).get(`/api/membres?q=${qm}&sortis=1`).set(...bearer(sg));
    expect(r.body.items.map((m: any) => m.motifSortie).sort()).toEqual(["Démission", "Radiation"]);
  });
});
