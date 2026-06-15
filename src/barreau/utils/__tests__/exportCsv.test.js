import { describe, it, expect } from "vitest";
import { versCsv } from "../exportCsv";

describe("versCsv", () => {
  const colonnes = [
    { label: "N°", valeur: (r) => r.num },
    { label: "Nom", valeur: (r) => r.nom },
    { label: "Montant", valeur: (r) => r.montant },
  ];
  const lignes = [
    { num: 1, nom: "BAKALA Thomas", montant: 150000 },
    { num: 2, nom: 'Cabinet "Loango"; SCPA', montant: 0 },
  ];

  it("génère un en-tête + lignes", () => {
    const csv = versCsv(colonnes, lignes);
    const rows = csv.split("\r\n");
    expect(rows[0]).toBe("N°;Nom;Montant");
    expect(rows[1]).toBe("1;BAKALA Thomas;150000");
  });

  it("échappe les valeurs contenant séparateur, guillemets ou point-virgule", () => {
    const csv = versCsv(colonnes, lignes);
    const rows = csv.split("\r\n");
    expect(rows[2]).toBe('2;"Cabinet ""Loango""; SCPA";0');
  });

  it("gère les valeurs nulles", () => {
    const csv = versCsv([{ label: "X", valeur: (r) => r.x }], [{ x: null }, { x: undefined }]);
    expect(csv.split("\r\n").slice(1)).toEqual(["", ""]);
  });
});
