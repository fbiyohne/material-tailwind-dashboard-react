import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Les identités réelles ne doivent vivre que dans la config par défaut, l'installation et les données d'amorçage.
const AUTORISES = [/(^|\/)data\//, /Installation\.jsx$/, /__tests__/, /\.test\./];
const INTERDIT = /Pointe-Noire|BIKINDOU|KALINA-MENGA/;

function fichiers(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.jsx?$/.test(n) ? [p] : [];
  });
}

describe("identité du barreau non écrite en dur", () => {
  it("aucun nom réel ni ville en dur hors config, installation et données d'amorçage", () => {
    const racine = join(process.cwd(), "src");
    const fautifs = fichiers(racine)
      .filter((f) => !AUTORISES.some((r) => r.test(relative(racine, f).replaceAll("\\", "/"))))
      .flatMap((f) => readFileSync(f, "utf8").split("\n")
        .map((l, i) => ({ f: relative(racine, f), i: i + 1, l }))
        // les commentaires ne s'affichent pas
        .filter(({ l }) => INTERDIT.test(l) && !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)))
      .map(({ f, i }) => `${f}:${i}`);
    expect(fautifs).toEqual([]);
  });
});
