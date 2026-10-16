import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { pageA4, blocVerif, entete, champs, signatures, titre, DIRECTION_PDF, CLAUSE_VERIF, CLAUSE_LISTE } from "../src/lib/gabarit.js";
import { identite, MENTION_DEMONSTRATION } from "../src/lib/identiteDocuments.js";

/**
 * Socle PDF commun (M-20261016, T3) : HTML produit par pageA4, sans lancer Chromium.
 * Le rendu réel (A4, pagination) est contrôlé par scripts/apercus-gabarits.ts.
 */
const doc = (o: Partial<Parameters<typeof pageA4>[0]> = {}) =>
  pageA4({ titreCourt: "Quitus", reference: "Q-2026-0042", unePage: true, contenu: "<p>Corps</p>", ...o });
const css = (n: string) => fs.readFileSync(new URL(`../src/lib/gabarits/${n}.css`, import.meta.url), "utf8");

const demoInitial = identite().modeDemonstration;
afterEach(() => { identite().modeDemonstration = demoInitial; });

describe("pageA4 : page A4, pied commun et pagination", () => {
  it("porte le format A4, la pagination Page x/y et l'en-tête courant masqué en page 1", () => {
    const h = doc();
    expect(h).toContain("size: A4");
    expect(h).toContain("counter(pages)");
    expect(h).toContain('"Page " counter(page) "/" counter(pages)');
    expect(h).toContain("@page :first");
    expect(h).toContain("margin: 18mm 18mm 20mm 18mm");
    expect(h).toContain(`${identite().denomination} · Réf. Q-2026-0042`);
    expect(h).toContain(`${identite().denomination} · Quitus`);
    expect(h).toContain('class="une-page"');
    expect(h).not.toContain("A4 landscape");
  });

  it("passe en A4 paysage quand paysage est demandé", () => {
    expect(doc({ paysage: true, unePage: false })).toContain("size: A4 landscape");
  });

  it("neutralise guillemets et barres obliques de la référence dans le CSS des boîtes de marge", () => {
    const h = doc({ reference: 'R"1\\x' });
    expect(h).toContain('Réf. R\\"1\\\\x');
    expect(h).not.toContain('Réf. R"1');
  });

  it("échappe le titre court dans le HTML", () => {
    expect(doc({ titreCourt: "<b>x</b>" })).toContain("<title>&lt;b&gt;x&lt;/b&gt;</title>");
  });
});

describe("Direction graphique : un seul point de choix", () => {
  it("institutionnelle par défaut, classique sur demande", () => {
    expect(DIRECTION_PDF).toBe("institutionnelle");
    expect(doc()).toContain(css("institutionnelle"));
    expect(doc()).toContain(css("socle"));
    const c = doc({ direction: "classique" });
    expect(c).toContain(css("classique"));
    expect(c).not.toContain(css("institutionnelle"));
    expect(c).toContain('class="dir-classique"');
  });
});

describe("Clauses juridiques", () => {
  it("blocVerif reproduit la clause CL-VERIF mot pour mot avec un QR d'au moins 25 mm", () => {
    const b = blocVerif("data:image/png;base64,AAAA", "barreau.cg/v/q/Q-1.ABC");
    expect(CLAUSE_VERIF).toBe("Ce code permet de contrôler que le document a été émis par l'Ordre et d'en connaître le statut actuel. Il ne constitue pas une signature.");
    expect(b).toContain(CLAUSE_VERIF);
    expect(b).toContain('<img src="data:image/png;base64,AAAA"');
    expect(b).toContain("barreau.cg/v/q/Q-1.ABC");
    const qr = Number(/--qr:\s*(\d+)mm/.exec(css("socle"))![1]);
    expect(qr).toBeGreaterThanOrEqual(25);
    expect(blocVerif("<svg></svg>", "u")).toContain("<svg></svg>");
  });

  it("ajoute la clause C-PDF-LISTE seulement sur une liste à diffusion restreinte", () => {
    expect(CLAUSE_LISTE).toContain("Document à diffusion restreinte, réservé aux organes de l'Ordre.");
    expect(doc({ listeRestreinte: true })).toContain(CLAUSE_LISTE);
    expect(doc()).not.toContain(CLAUSE_LISTE);
  });

  it("mention C-13 absente hors démonstration, présente en démonstration", () => {
    identite().modeDemonstration = false;
    expect(doc()).not.toContain(MENTION_DEMONSTRATION);
    identite().modeDemonstration = true;
    expect(doc()).toContain(MENTION_DEMONSTRATION);
  });

  it("aucun terme interdit HJ-6 dans le module ni dans les feuilles de style", () => {
    const sources = [fs.readFileSync(new URL("../src/lib/gabarit.ts", import.meta.url), "utf8"), ...["socle", "institutionnelle", "classique", "compacte"].map(css)].join("\n").toLowerCase();
    for (const t of ["certifié", "signature électronique", "horodatage qualifié", "recommandé électronique", "chiffré de bout en bout", "vote vérifiable", "secret garanti"]) expect(sources).not.toContain(t);
  });
});

describe("Briques communes", () => {
  it("l'en-tête reprend l'identité paramétrée et échappe les champs libres", () => {
    const e = entete("Quitus n°", "Q-1", "Délivré le 1er janvier");
    expect(e).toContain(identite().denomination);
    expect(e).toContain(identite().ordre);
    expect(titre("Sur", "<i>T</i>")).toContain("&lt;i&gt;T&lt;/i&gt;");
    expect(champs([["Nom", "<x>", "nom"]])).toContain('class="champ champ-nom');
    expect(champs([["Nom", "<x>", "nom"]])).toContain("&lt;x&gt;");
    expect(signatures([["Le Bâtonnier", "Me X", "data:image/png;base64,CC"]])).toContain('src="data:image/png;base64,CC"');
  });
});
