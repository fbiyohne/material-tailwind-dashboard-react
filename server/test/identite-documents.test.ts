import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/prisma.js";
import { rafraichirIdentite, MENTION_DEMONSTRATION } from "../src/lib/identiteDocuments.js";
import { recuRicheHtml, quitusRicheHtml } from "../src/lib/documentsRiches.js";
import { tableauOrdreHtml, attestationHtml, listeAvocatsHtml } from "../src/lib/templates.js";
import { envoyerDocumentPdf, trouverChromium } from "../src/lib/pdf.js";
import { spawnSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// X-05 / CA11 : reçus, quitus et tableau suivent l'identité paramétrée du barreau.
const LOGO = "data:image/png;base64,iVBORw0KGgo=";
const membre = { nom: "TEST IDENTITE", num: 1, dateInscription: new Date("2020-01-01") };
const recu = { numero: "R-1", montant: 50000, annee: 2026, date: new Date("2026-03-01") };
const quitus = { numero: "Q-1", annee: 2026, dateEmission: new Date("2026-03-01") };
const rendus = () => [
  recuRicheHtml(recu, membre, "data:,", "http://x"),
  quitusRicheHtml(quitus, membre, "data:,", "http://x"),
  attestationHtml(membre, "ATT-1", new Date("2026-03-01")),
  tableauOrdreHtml([{ qualite: "AVOCAT", membres: [] }], new Date("2026-03-01")),
  listeAvocatsHtml([], "tous", new Date("2026-03-01")),
];
const lire = async () => ((await prisma.parametres.findUnique({ where: { id: 1 } }))?.data ?? {}) as Record<string, unknown>;
const ecrire = async (identite: Record<string, unknown>) => {
  const data = { ...(await lire()), identite } as never;
  await prisma.parametres.upsert({ where: { id: 1 }, update: { data }, create: { id: 1, data } });
  await rafraichirIdentite();
};
let avant: unknown;

beforeAll(async () => { avant = (await lire()).identite; });
afterAll(async () => {
  const data = { ...(await lire()), identite: avant } as never;
  await prisma.parametres.update({ where: { id: 1 }, data: { data } });
  await rafraichirIdentite();
});

describe("Identité paramétrée des documents (X-05)", () => {
  it("reprend dénomination, ville et logo, sans « Pointe-Noire »", async () => {
    await ecrire({ denomination: "Barreau de démonstration", ville: "Brazzaville", logo: LOGO, modeDemonstration: false, adresse: "Adresse démo" });
    for (const h of rendus()) {
      expect(h).not.toContain("Pointe-Noire");
      expect(h).not.toContain("pointe-noire");
      expect(h).toContain(LOGO);
    }
    const [r, q] = rendus();
    expect(r).toContain("Brazzaville, le");
    expect(r).toContain("au Barreau de démonstration");
    expect(q).toContain("Brazzaville, le");
    expect(q).toContain("Barreau de démonstration"); // en-tête du socle A4 (M-20261016) : casse d'origine
  });

  it("la mention C-13 n'apparaît qu'en mode démonstration", async () => {
    await ecrire({ denomination: "Barreau de démonstration", ville: "Brazzaville", modeDemonstration: true });
    for (const h of rendus()) expect(h).toContain(MENTION_DEMONSTRATION);
    await ecrire({ denomination: "Barreau de démonstration", ville: "Brazzaville", modeDemonstration: false });
    for (const h of rendus()) expect(h).not.toContain(MENTION_DEMONSTRATION);
  });

  it("aucune mention de TVA sur le reçu et le quitus", () => {
    const [r, q] = rendus();
    expect(r + q).not.toMatch(/TVA/);
  });
});

// PDF réellement rendu : même appel que les routes GET /recus/:id/pdf (recus.ts) et
// GET /quitus/:id/pdf (quitus.ts) — envoyerDocumentPdf(res, recuRicheHtml|quitusRicheHtml(...)).
// Texte extrait par pdftotext (xpdf/poppler) ; test sauté si Chromium ou pdftotext manque.
const aPdftotext = !spawnSync("pdftotext", ["-v"]).error;
const textePdf = async (html: string) => {
  let pdf = Buffer.alloc(0);
  const res = { setHeader() {}, end(b: Uint8Array) { pdf = Buffer.from(b); } };
  await envoyerDocumentPdf(res as never, html, "x.pdf");
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  const f = join(tmpdir(), `x05-${process.pid}-${Date.now()}.pdf`);
  writeFileSync(f, pdf);
  try { return spawnSync("pdftotext", ["-enc", "UTF-8", f, "-"], { encoding: "utf8" }).stdout; } finally { rmSync(f, { force: true }); }
};

describe("Identité paramétrée : PDF rendus et coordonnées (X-05, CA11)", () => {
  it.skipIf(!trouverChromium() || !aPdftotext)("le texte extrait du reçu et du quitus PDF porte la nouvelle identité, zéro « Pointe-Noire »", async () => {
    await ecrire({ denomination: "Barreau de démonstration", ville: "Brazzaville", logo: LOGO, modeDemonstration: true });
    const [r, q] = rendus();
    for (const t of [await textePdf(r), await textePdf(q)]) {
      expect(t).toContain("Brazzaville, le");
      expect(t.toUpperCase()).toContain("BARREAU DE DÉMONSTRATION");
      expect(t).toContain("Barreau de démonstration.");
      expect(t.toLowerCase()).not.toContain("pointe-noire");
    }
  }, 60000);

  it("bandeau de contact : coordonnées par défaut pour l'identité de base, aucune pour une autre ville non renseignée", async () => {
    await ecrire({});
    const [r0, q0] = rendus();
    for (const h of [r0, q0]) {
      expect(h).toContain("contact@barreaudepointenoire.cg");
      expect(h).toContain("+242 06 857 74 74");
    }
    await ecrire({ denomination: "Barreau de démonstration", ville: "Brazzaville" });
    for (const h of rendus()) expect(h.toLowerCase()).not.toContain("pointe-noire");
    await ecrire({ denomination: "Barreau de démonstration", ville: "Brazzaville", courriel: "contact@demo.test", site: "www.demo.test", telephones: "+242 01 / +242 02" });
    const [r, q] = rendus();
    for (const h of [r, q]) {
      expect(h).toContain("contact@demo.test");
      expect(h).toContain("www.demo.test");
      expect(h).toContain("<span>+242 01</span> · <span>+242 02</span>"); // coordonnées sur une ligne (socle A4, M-20261016)
    }
  });
});
