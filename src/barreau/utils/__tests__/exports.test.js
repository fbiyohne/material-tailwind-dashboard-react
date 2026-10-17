import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import { ajouterPieds, CLAUSE_LISTE } from "../exports";

const pdf3 = () => {
  const p = new jsPDF({ unit: "pt", format: "a4" });
  p.addPage();
  p.addPage();
  return p;
};
const texte = (p, i) => p.internal.pages[i].join(" ");

describe("ajouterPieds", () => {
  it("format A4 et « Page i/n » sur chaque page", () => {
    const p = pdf3();
    ajouterPieds(p, { denomination: "Barreau Test" });
    expect(p.internal.pageSize.getWidth()).toBeCloseTo(595.28, 1);
    expect(p.internal.pageSize.getHeight()).toBeCloseTo(841.89, 1);
    for (let i = 1; i <= 3; i++) expect(texte(p, i)).toContain(`(Page ${i}/3)`);
  });
  it("en-tête court absent en page 1, présent en page 2", () => {
    const p = pdf3();
    ajouterPieds(p, { denomination: "Barreau Test" });
    expect(texte(p, 1).match(/\(Barreau Test\)/g)).toHaveLength(1); // pied seul
    expect(texte(p, 2).match(/\(Barreau Test\)/g)).toHaveLength(2); // en-tête + pied
  });
  it("C-PDF-LISTE seulement si restreint", () => {
    const a = pdf3(), b = pdf3();
    ajouterPieds(a, { denomination: "B", restreint: true });
    ajouterPieds(b, { denomination: "B" });
    expect(texte(a, 1)).toContain("diffusion restreinte");
    expect(CLAUSE_LISTE).toContain("29-2019");
    expect(texte(b, 1)).not.toContain("diffusion restreinte");
  });
});

describe("CSS d'impression", () => {
  it("@page A4 avec numérotation counter(pages)", () => {
    const css = readFileSync("public/css/tailwind.css", "utf8");
    expect(css).toMatch(/size:\s*A4/);
    expect(css).toContain("counter(pages)");
  });
});
