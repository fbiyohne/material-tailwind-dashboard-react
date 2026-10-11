import { describe, it, expect } from "vitest";
import { exerciceDuCircuit } from "../SituationPanel";

// Parcours 4 (recette T29) : l'omission d'un impayé 2025 enregistrée en 2026 doit viser l'exercice des étapes,
// sinon le serveur répond 409 (étapes introuvables pour l'année de la date d'effet).
describe("exerciceDuCircuit", () => {
  it("reprend l'exercice de la dernière étape du circuit, liste du plus récent au plus ancien", () => {
    const evts = [
      { type: "SANCTION", annee: null },
      { type: "TRANSMISSION", annee: 2025 },
      { type: "MISE_EN_DEMEURE", annee: 2025 },
    ];
    expect(exerciceDuCircuit(evts)).toBe(2025);
  });
  it("renvoie undefined sans étape (le serveur retient l'année de la date d'effet)", () => {
    expect(exerciceDuCircuit([{ type: "DECES", annee: null }])).toBeUndefined();
    expect(exerciceDuCircuit(undefined)).toBeUndefined();
  });
});
