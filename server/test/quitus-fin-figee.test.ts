import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { finValiditeQuitus } from "../src/lib/business.js";
import { fmtDateFr } from "../src/lib/documentsCommun.js";

// Le PDF n'est pas rendu : on capture le HTML envoyé au moteur.
const html = vi.hoisted(() => ({ dernier: "" }));
vi.mock("../src/lib/pdf.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/lib/pdf.js")>();
  return { ...orig, envoyerDocumentPdf: vi.fn(async (res: { end(b: string): void }, h: string) => { html.dernier = h; res.end("pdf"); }) };
});

/**
 * R1-2 (revue M-20261011) : la fin de validité d'un quitus est figée à sa délivrance.
 * Changer regles.quitus.validiteMois ne modifie que le quitus SUIVANT : la page /v,
 * GET /quitus et le PDF d'un quitus déjà délivré gardent la date imprimée.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const iso = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
let sg = "";
let membreId = 0;
const numeros: string[] = [];
let reglesAvant: unknown;

const ecrireValidite = async (validiteMois: number) => {
  const row = await prisma.parametres.findUnique({ where: { id: 1 } });
  const data = (row?.data ?? {}) as Record<string, unknown>;
  const regles = { ...((data.regles as Record<string, unknown>) ?? {}), quitus: { validiteMois } };
  await prisma.parametres.upsert({ where: { id: 1 }, update: { data: { ...data, regles } as never }, create: { id: 1, data: { regles } as never } });
};

beforeAll(async () => {
  reglesAvant = ((await prisma.parametres.findUnique({ where: { id: 1 } }))?.data as { regles?: { quitus?: unknown } } | null)?.regles?.quitus;
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  const num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 1;
  membreId = (await prisma.membre.create({ data: { num, nom: `TEST FIN FIGEE ${num}`, qualite: "AVOCAT", statut: "INSCRIT" } as never })).id;
  for (const annee of [2093, 2094]) {
    await prisma.cotisation.create({ data: { membreId, annee, montantDu: 1000, montantPaye: 1000, valideTresoriere: true } });
  }
});

afterAll(async () => {
  const row = await prisma.parametres.findUnique({ where: { id: 1 } });
  const data = (row?.data ?? {}) as Record<string, unknown>;
  const regles = { ...((data.regles as Record<string, unknown>) ?? {}) };
  if (reglesAvant === undefined) delete regles.quitus; else regles.quitus = reglesAvant;
  await prisma.parametres.update({ where: { id: 1 }, data: { data: { ...data, regles } as never } });
  await prisma.archive.deleteMany({ where: { reference: { in: numeros } } });
  await prisma.quitus.deleteMany({ where: { membreId } });
  await prisma.cotisation.deleteMany({ where: { membreId } });
  await prisma.membre.deleteMany({ where: { id: membreId } });
});

describe("fin de validité du quitus figée à la délivrance", () => {
  it("changer validiteMois ne touche que le quitus suivant (API, page /v, PDF)", async () => {
    await ecrireValidite(3);
    const r1 = await request(app).post("/api/quitus").set(...bearer(sg)).send({ membreId, annee: 2093 });
    expect(r1.status).toBe(201);
    numeros.push(r1.body.numero);
    const fin1 = iso(finValiditeQuitus(new Date(r1.body.dateEmission), 3));
    expect(iso(r1.body.finValidite)).toBe(fin1);
    // Enregistrée en base au moment de la délivrance.
    expect(iso((await prisma.quitus.findUnique({ where: { id: r1.body.id } }))!.finValidite!)).toBe(fin1);

    await ecrireValidite(6);
    const liste = await request(app).get("/api/quitus").set(...bearer(sg));
    expect(iso(liste.body.find((q: { id: number }) => q.id === r1.body.id).finValidite)).toBe(fin1);
    const page = await request(app).get(new URL(r1.body.verif).pathname);
    expect(page.status).toBe(200);
    expect(page.text).toContain(fmtDateFr(new Date(`${fin1}T12:00:00Z`)));
    await request(app).get(`/api/quitus/${r1.body.id}/pdf`).set(...bearer(sg));
    expect(html.dernier).toContain(fmtDateFr(new Date(`${fin1}T12:00:00Z`)));

    const r2 = await request(app).post("/api/quitus").set(...bearer(sg)).send({ membreId, annee: 2094 });
    expect(r2.status).toBe(201);
    numeros.push(r2.body.numero);
    expect(iso(r2.body.finValidite)).toBe(iso(finValiditeQuitus(new Date(r2.body.dateEmission), 6)));
  });
});
