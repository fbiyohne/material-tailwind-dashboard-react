import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { GABARITS, texteCorps } from "./fixtures/templates-socle-donnees.js";
import { CLAUSE_LISTE } from "../src/lib/gabarit.js";

/**
 * Famille A sur le socle A4 (M-20261016, T4). Le texte du corps de chaque gabarit est identique
 * à l'instantané pris sur ada3e30 (aucun texte juridique réécrit) ; seule la mise en page change.
 */
const avant: Record<string, string> = JSON.parse(fs.readFileSync(new URL("./fixtures/templates-corps.json", import.meta.url), "utf8"));

describe("documentHtml : famille A sur pageA4", () => {
  for (const [nom, f] of Object.entries(GABARITS)) {
    it(`${nom} : texte du corps inchangé, pagination et pied communs`, () => {
      const h = f();
      expect(texteCorps(h)).toBe(avant[nom]);
      expect(avant[nom].length).toBeGreaterThan(20);
      expect(h).toContain("counter(pages)");
      expect(h).toContain("@page :first");
      expect(h).not.toContain("Données entièrement fictives"); // C-13 : démonstration seulement
    });
  }

  it("la liste des avocats est en A4 paysage avec la clause C-PDF-LISTE", () => {
    const h = GABARITS.listeAvocats();
    expect(h).toContain("A4 landscape");
    expect(h).toContain("diffusion restreinte");
    expect(h).toContain(CLAUSE_LISTE.slice(0, 40));
  });

  it("le tableau de l'Ordre (registre public) est en portrait sans C-PDF-LISTE", () => {
    const h = GABARITS.tableauOrdre();
    expect(h).not.toContain("diffusion restreinte");
    expect(h).not.toContain("A4 landscape");
  });

  it("les autres documents ne portent pas la clause de liste", () => {
    for (const k of Object.keys(GABARITS).filter((k) => k !== "listeAvocats")) expect(GABARITS[k]()).not.toContain("diffusion restreinte");
  });
});
