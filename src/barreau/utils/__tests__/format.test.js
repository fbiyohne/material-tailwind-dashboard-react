import { describe, it, expect } from "vitest";
import { formatDate, formatFCFA } from "../format";

describe("formatDate", () => {
  it("formate une date ISO en français long", () => {
    expect(formatDate("2026-06-15")).toBe("15 juin 2026");
  });
  it("accepte un objet Date", () => {
    expect(formatDate(new Date("2026-01-05T10:00:00Z"))).toBe("5 janvier 2026");
  });
  it("renvoie un tiret pour une valeur vide", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });
  it("renvoie un tiret pour une date invalide", () => {
    expect(formatDate("pas-une-date")).toBe("—");
  });
});

describe("formatFCFA (inchangé, garde-fou)", () => {
  it("formate avec séparateurs (espace fine insécable)", () => {
    // L'implémentation utilise   (espace fine insécable) comme séparateur de milliers.
    expect(formatFCFA(1500000)).toBe("1 500 000 FCFA");
  });
});
