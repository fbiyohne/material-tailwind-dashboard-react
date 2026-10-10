import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { tableauDepuisFeuille } from "../ImportMembresModal";

const MENTION = "Barreau de Pointe-Noire — Document interne confidentiel — Liste arrêtée au 10/10/2026 — Diffusion interdite.";
const ENTETE = ["N°", "N° inscription", "Nom", "Qualité", "Statut"];
const LIGNES = [["1", "PN-2026-001", "ABIRA Armel", "Avocat", "Inscrit"], ["", "", "", "", ""], ["2", "", "BAKALA Thomas", "Avocat", "Décédé"]];
const lire = (txt) => tableauDepuisFeuille(XLSX, XLSX.read(txt, { type: "string", raw: true }).Sheets.Sheet1);

describe("tableauDepuisFeuille — aller-retour des exports (CA-10)", () => {
  for (const [nom, sep] of [["CSV", ";"], ["TXT", "\t"]]) {
    it(`saute la mention de confidentialité en première ligne (${nom})`, () => {
      const txt = [MENTION, ENTETE, ...LIGNES].map((r) => (Array.isArray(r) ? r.join(sep) : r)).join("\r\n");
      const rows = lire(txt);
      expect(rows).toHaveLength(2);
      expect(rows[1]["Nom"]).toBe("BAKALA Thomas");
    });
  }

  it("fichier sans mention : l'en-tête reste en première ligne", () => {
    expect(lire([ENTETE, ...LIGNES].map((r) => r.join(";")).join("\n"))).toHaveLength(2);
  });

  it("aucune colonne num + nom : tableau vide", () => {
    expect(lire("a;b\n1;2")).toEqual([]);
  });

  it("feuille XLSX avec mention en A1", () => {
    const ws = XLSX.utils.aoa_to_sheet([[MENTION], ENTETE, LIGNES[0], LIGNES[2]]);
    expect(tableauDepuisFeuille(XLSX, ws)).toHaveLength(2);
  });
});
