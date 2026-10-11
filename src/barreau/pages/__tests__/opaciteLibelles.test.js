import { describe, it, expect } from "vitest";
import timbres from "../Timbres.jsx?raw";
import recus from "../Recus.jsx?raw";
import quitus from "../Quitus.jsx?raw";

// Tailwind 3.3.4 ne génère pas text-white/55 (échelle d'opacité : 50, 60, 70…) : le libellé
// retombait sur la couleur par défaut, quasi invisible sur fond navy (contraste 1,01:1).
describe("Libellés de cartes sombres", () => {
  it.each([["Timbres", timbres], ["Recus", recus], ["Quitus", quitus]])("%s n'utilise pas text-white/55", (_, src) => {
    expect(src).not.toMatch(/text-white\/55/);
  });
});
