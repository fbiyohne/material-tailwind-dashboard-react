import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { signerAccessToken } from "../src/lib/tokens.js";
import { CLAUSE_LISTE } from "../src/lib/gabarit.js";

/** POST /etats/pdf : listes et états de l'application sur le gabarit officiel. HTML capturé, sans Chromium. */
const rendu = vi.hoisted(() => ({ html: "" }));
vi.mock("../src/lib/pdf.js", async (original) => {
  const mod = await original<typeof import("../src/lib/pdf.js")>();
  return {
    ...mod,
    envoyerPdf: async (res: import("express").Response, html: string, filename: string) => {
      rendu.html = html;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.end(Buffer.from("%PDF-test"));
    },
  };
});

const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const ETAT = { titre: "Liste du corps électoral", entete: ["N°", "Nom"], lignes: [["1", "<b>Me X</b>"], [2, null]], fichier: "Corps-electoral" };
let sg = "";
let avocat = "";

beforeAll(async () => {
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  const u = await prisma.user.findFirst({ where: { role: "AVOCAT", actif: true } });
  if (u) avocat = signerAccessToken(u);
});

describe("POST /etats/pdf", () => {
  it("met les lignes en page sur le gabarit officiel, échappées, en diffusion restreinte", async () => {
    const r = await request(app).post("/api/etats/pdf").set(...bearer(sg)).send(ETAT);
    expect(r.status).toBe(200);
    expect(r.headers["content-disposition"]).toMatch(/Corps-electoral-\d{4}-\d{2}-\d{2}\.pdf/);
    expect(rendu.html).toContain("Liste du corps électoral");
    expect(rendu.html).toContain("&lt;b&gt;Me X&lt;/b&gt;");
    expect(rendu.html).not.toContain("<b>Me X</b>");
    expect(rendu.html).toContain('<template id="pied-pdf">');
    expect(rendu.html).toContain(CLAUSE_LISTE);
    expect(rendu.html).toContain("2 lignes");
  });

  it("refuse un compte avocat et une charge invalide", async () => {
    if (avocat) expect((await request(app).post("/api/etats/pdf").set(...bearer(avocat)).send(ETAT)).status).toBe(403);
    expect((await request(app).post("/api/etats/pdf").set(...bearer(sg)).send({ ...ETAT, fichier: "../x" })).status).toBe(400);
    expect((await request(app).post("/api/etats/pdf").send(ETAT)).status).toBe(401);
  });
});
