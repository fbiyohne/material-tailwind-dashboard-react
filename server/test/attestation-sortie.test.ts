import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * T20 (M-20261011, H2) — Attestation de sortie du tableau : seule attestation
 * délivrable à un ancien membre. Texte neutre (R-62, PO-21) : jamais le motif
 * (radiation, décès…), seulement les dates d'inscription et de sortie.
 */
// Le rendu Chromium n'est pas l'objet du test : on capture le HTML envoyé.
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
const CATEGORIE = "Attestation de sortie du tableau";
const crees: number[] = [];
let sg = "";

const creerAvocat = async (suffixe: string) => {
  const r = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `E2E SORTIE ${suffixe} ${Date.now()}`, qualite: "AVOCAT" });
  crees.push(r.body.id);
  return r.body.id as number;
};

beforeAll(async () => {
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
});
afterAll(async () => {
  await prisma.membre.deleteMany({ where: { id: { in: crees } } });
});

describe("GET /membres/:id/attestation-sortie/pdf", () => {
  it("ancien membre (RADIE, DECEDE, DEMISSIONNAIRE) : PDF neutre, numéroté et archivé", async () => {
    for (const [i, statut] of (["RADIE", "DECEDE", "DEMISSIONNAIRE"] as const).entries()) {
      const id = await creerAvocat(`ANCIEN-${i}`); // nom sans le motif, vérifié absent du texte
      await prisma.membre.update({
        where: { id },
        data: { statut, dateInscription: new Date("2010-03-01"), dateRadiation: statut === "RADIE" ? new Date("2026-09-15") : null, dateDeces: statut === "DECEDE" ? new Date("2026-09-15") : null },
      });
      const avant = await prisma.archive.count({ where: { categorie: CATEGORIE } });
      const r = await request(app).get(`/api/membres/${id}/attestation-sortie/pdf`).set(...bearer(sg));
      expect(r.status).toBe(200);
      expect(r.headers["content-type"]).toMatch(/application\/pdf/);
      expect(rendu.html).toContain("Attestation de sortie du tableau");
      expect(rendu.html).toContain("01 mars 2010");
      expect(rendu.html).toMatch(/ne figure plus au Tableau|n'y figure plus/i);
      if (statut !== "DEMISSIONNAIRE") expect(rendu.html).toContain("15 septembre 2026");
      // Texte du document seulement (la feuille de style contient « border-radius »).
      const texte = rendu.html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
      expect(texte).not.toMatch(/radi|décè|décéd|sanction|discipl/i);
      expect(await prisma.archive.count({ where: { categorie: CATEGORIE } })).toBe(avant + 1);
    }
  });

  it("membre au tableau (INSCRIT, OMIS) : 409, sans numéroter ni archiver", async () => {
    const avant = await prisma.archive.count({ where: { categorie: CATEGORIE } });
    for (const statut of ["INSCRIT", "OMIS"] as const) {
      const id = await creerAvocat(`AU-${statut}`);
      await prisma.membre.update({ where: { id }, data: { statut } });
      const r = await request(app).get(`/api/membres/${id}/attestation-sortie/pdf`).set(...bearer(sg));
      expect(r.status).toBe(409);
      expect(r.body.erreur).toMatch(/attestation d'inscription/);
    }
    expect(await prisma.archive.count({ where: { categorie: CATEGORIE } })).toBe(avant);
  });

  it("réservée au SG et à l'ADMIN : 403 pour la trésorière, 404 pour un membre inconnu", async () => {
    const tres = (await request(app).post("/api/auth/login").send({ email: "tresoriere@barreau-pn.cg", password: "barreau" })).body.token;
    const id = await creerAvocat("ROLE");
    await prisma.membre.update({ where: { id }, data: { statut: "RETRAITE" } });
    if (tres) expect((await request(app).get(`/api/membres/${id}/attestation-sortie/pdf`).set(...bearer(tres))).status).toBe(403);
    expect((await request(app).get(`/api/membres/999999999/attestation-sortie/pdf`).set(...bearer(sg))).status).toBe(404);
  });
});
