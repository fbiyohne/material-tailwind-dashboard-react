import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { htmlVersPdf } from "../src/lib/pdf.js";

vi.mock("../src/lib/pdf.js", async (importOriginal) => ({ ...(await importOriginal<typeof import("../src/lib/pdf.js")>()), htmlVersPdf: vi.fn(async () => Buffer.from("%PDF-test")) }));

/**
 * T4 (M-20261011, O1) — les avocats sortis du tableau (RADIE, DECEDE, DEMISSIONNAIRE,
 * RETRAITE, CESSATION) quittent la liste par défaut de GET /membres et forment le
 * registre « Anciens membres » (GET /membres?sortis=1) :
 *  - motif et date d'effet tirés du dernier événement de sortie (repli : dateRadiation / dateDeces) ;
 *  - R-62 : sans permission « discipline », la radiation s'affiche « Sortie du tableau » ;
 *  - chaque consultation du registre est journalisée (JournalAudit).
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const marque = `T4AM-${Date.now()}`;

let sg = "", consult = "";
const ids: Record<string, number> = {};
let sansEvenement = 0;

const MOTIFS: Record<string, string> = {
  RADIE: "Radiation", DECEDE: "Décès", DEMISSIONNAIRE: "Démission", RETRAITE: "Retraite", CESSATION: "Cessation d'activité",
};
const DATES: Record<string, string> = {
  RADIE: "2026-03-10", DECEDE: "2026-04-11", DEMISSIONNAIRE: "2026-05-12", RETRAITE: "2026-06-13", CESSATION: "2026-07-14",
};

beforeAll(async () => {
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  const email = `consult-${marque}@test.cg`.toLowerCase();
  await request(app).post("/api/users").set(...bearer(sg)).send({ nom: `${marque} Consultation`, email, role: "CONSULTATION", password: "consultpass8" });
  consult = (await request(app).post("/api/auth/login").send({ email, password: "consultpass8" })).body.token;
  expect(consult).toBeTruthy();
  const max = (await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0;
  let n = max + 1000;
  for (const statut of Object.keys(MOTIFS)) {
    const m = await prisma.membre.create({
      data: {
        num: n++, nom: `${marque} ${statut}`, qualite: "AVOCAT", statut: statut as any, motifRadiation: statut === "RADIE" ? "MOTIF-SECRET-T4" : null,
        evenements: { create: { type: statut === "RADIE" ? "RADIATION" : statut === "DECEDE" ? "DECES" : statut, statutAvant: "INSCRIT", statutApres: statut as any, dateEffet: new Date(DATES[statut]) } },
      },
    });
    ids[statut] = m.id;
  }
  // Fiche importée sans événement : la date vient de dateDeces.
  sansEvenement = (await prisma.membre.create({ data: { num: n++, nom: `${marque} IMPORTE`, qualite: "AVOCAT", statut: "DECEDE", dateDeces: new Date("2025-01-20") } })).id;
});

afterAll(async () => {
  const membres = [...Object.values(ids), sansEvenement].filter(Boolean);
  await prisma.membre.deleteMany({ where: { id: { in: membres } } });
  await prisma.user.deleteMany({ where: { nom: { startsWith: marque } } });
  await prisma.$disconnect();
});

const liste = (query: string, jeton = sg) => request(app).get(`/api/membres?q=${encodeURIComponent(marque)}&pageSize=200${query}`).set(...bearer(jeton));

describe("Anciens membres (O1)", () => {
  it.each(Object.keys(MOTIFS))("%s : absent de la liste par défaut et du tableau, présent au registre avec motif et date", async (statut) => {
    const nom = `${marque} ${statut}`;
    const defaut = await liste("");
    expect(defaut.status).toBe(200);
    expect(defaut.body.items.map((m: any) => m.nom)).not.toContain(nom);

    const registre = await liste("&sortis=1");
    expect(registre.status).toBe(200);
    const ligne = registre.body.items.find((m: any) => m.nom === nom);
    expect(ligne).toBeTruthy();
    expect(ligne.motifSortie).toBe(MOTIFS[statut]);
    expect(String(ligne.dateSortie).slice(0, 10)).toBe(DATES[statut]);

    const tableau = await request(app).get("/api/tableau").set(...bearer(sg));
    expect(tableau.status).toBe(200);
    expect(JSON.stringify(tableau.body)).not.toContain(nom);
  });

  it("le registre ne contient que des sortis ; repli sur dateDeces sans événement", async () => {
    const r = await liste("&sortis=1");
    expect(r.body.items).toHaveLength(6);
    const importe = r.body.items.find((m: any) => m.id === sansEvenement);
    expect(importe.motifSortie).toBe("Décès");
    expect(String(importe.dateSortie).slice(0, 10)).toBe("2025-01-20");
  });

  it("filtres motif et période (du/au) sur la date d'effet", async () => {
    const motif = await liste("&sortis=1&motif=RETRAITE");
    expect(motif.body.items.map((m: any) => m.id)).toEqual([ids.RETRAITE]);
    const periode = await liste("&sortis=1&du=2026-04-01&au=2026-06-01");
    expect(periode.body.items.map((m: any) => m.id).sort()).toEqual([ids.DECEDE, ids.DEMISSIONNAIRE].sort());
    const repli = await liste("&sortis=1&du=2025-01-01&au=2025-12-31");
    expect(repli.body.items.map((m: any) => m.id)).toEqual([sansEvenement]);
  });

  it("GET /membres?statut=RADIE renvoie toujours les radiés", async () => {
    const r = await liste("&statut=RADIE");
    expect(r.body.items.map((m: any) => m.id)).toEqual([ids.RADIE]);
  });

  it("R-62 : sans permission discipline, « Sortie du tableau » et jamais « Radiation »", async () => {
    const r = await liste("&sortis=1", consult);
    expect(r.status).toBe(200);
    const radie = r.body.items.find((m: any) => m.id === ids.RADIE);
    expect(radie.motifSortie).toBe("Sortie du tableau");
    expect(radie.statut).toBeNull();
    expect(radie.dateRadiation).toBeNull();
    const json = JSON.stringify(r.body);
    expect(json).not.toContain(`"Radiation"`); // valeur, pas la clé « dateRadiation »
    expect(json).not.toContain(`"RADIE"`);
    expect(json).not.toContain("MOTIF-SECRET-T4");
    // Radié, démissionnaire, retraité et cessation sont indistinguables ; le décès reste « Décès », sans cause (PO-21).
    for (const m of r.body.items) {
      expect(["Décès", "Sortie du tableau"]).toContain(m.motifSortie);
      if (m.motifSortie !== "Décès") expect(m.statut).toBeNull();
    }
    // Filtrer par une sortie masquée lui est refusé ; le décès reste filtrable.
    for (const st of Object.keys(MOTIFS).filter((x) => x !== "DECEDE")) {
      expect((await liste(`&sortis=1&motif=${st}`, consult)).status).toBe(403);
      expect((await liste(`&statut=${st}`, consult)).status).toBe(403);
    }
    expect((await liste("&sortis=1&motif=DECEDE", consult)).status).toBe(200);
  });

  it("chaque consultation du registre est journalisée, sans le motif", async () => {
    const avant = (await prisma.journalAudit.aggregate({ _max: { id: true } }))._max.id ?? 0;
    await liste("&sortis=1&motif=DECEDE");
    const ligne = await prisma.journalAudit.findFirst({ where: { id: { gt: avant }, chemin: "/api/membres", methode: "GET" } });
    expect(ligne?.action).toMatch(/anciens membres/i);
    expect(ligne?.cible).toContain("lignes=2");
    // La liste ordinaire n'est pas journalisée.
    const apres = (await prisma.journalAudit.aggregate({ _max: { id: true } }))._max.id ?? 0;
    await liste("");
    expect(await prisma.journalAudit.findFirst({ where: { id: { gt: apres }, chemin: "/api/membres", methode: "GET" } })).toBeNull();
  });

  it("R1-5 : un appel direct à page=2 du registre est journalisé aussi (aucune lecture sans trace)", async () => {
    for (const page of [1, 2]) {
      const avant = (await prisma.journalAudit.aggregate({ _max: { id: true } }))._max.id ?? 0;
      const r = await request(app).get(`/api/membres?q=${encodeURIComponent(marque)}&sortis=1&pageSize=1&page=${page}`).set(...bearer(sg));
      expect(r.status).toBe(200);
      expect(r.body.items).toHaveLength(1);
      const ligne = await prisma.journalAudit.findFirst({ where: { id: { gt: avant }, chemin: "/api/membres", methode: "GET" } });
      expect(ligne?.action).toMatch(/anciens membres/i);
    }
  });

  it("export PDF du registre : sortis seuls, motif masqué sans discipline, export journalisé", async () => {
    const avant = (await prisma.journalAudit.aggregate({ _max: { id: true } }))._max.id ?? 0;
    const r = await request(app).get(`/api/membres/export/pdf?sortis=1&q=${encodeURIComponent(marque)}`).set(...bearer(consult));
    expect(r.status).toBe(200);
    const html = vi.mocked(htmlVersPdf).mock.calls.at(-1)![0] as string;
    expect(html).toContain(`${marque} RETRAITE`);
    expect(html).toContain("Sortie du tableau");
    expect(html).not.toContain(">Radiation<"); // l'en-tête fixe « Date de radiation » n'est pas une donnée
    expect(html).not.toContain("Radié");
    const ligne = await prisma.journalAudit.findFirst({ where: { id: { gt: avant }, chemin: "/api/membres/export/pdf" } });
    expect(ligne?.cible).toMatch(/anciens membres.*lignes=6/);
    // Export ordinaire : les sortis n'y figurent pas.
    await request(app).get(`/api/membres/export/pdf?q=${encodeURIComponent(marque)}`).set(...bearer(sg));
    expect(vi.mocked(htmlVersPdf).mock.calls.at(-1)![0]).not.toContain(`${marque} RETRAITE`); // le titre porte la recherche, pas les lignes
  });
});
