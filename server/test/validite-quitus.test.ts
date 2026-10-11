import { describe, it, expect } from "vitest";
import { reglesSchema, REGLES_DEFAUT, REGLES_SECTION_DEFAUT, fusionnerRegles } from "../src/lib/regles.js";
import { finValiditeQuitus } from "../src/lib/business.js";

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("règle quitus.validiteMois", () => {
  it("vaut 3 mois par défaut", () => {
    expect(REGLES_DEFAUT.quitus.validiteMois).toBe(3);
  });
  it("est refusée hors de 1 à 24 ou non entière", () => {
    const ok = (m: unknown) => reglesSchema.safeParse({ ...REGLES_SECTION_DEFAUT, quitus: { validiteMois: m } }).success;
    expect([ok(1), ok(24), ok(3)]).toEqual([true, true, true]);
    expect([ok(0), ok(25), ok(-1), ok(1.5), ok("3")]).toEqual([false, false, false, false, false]);
  });
  it("fusionnerRegles complète la clé absente sans migration", () => {
    expect(fusionnerRegles({}).quitus.validiteMois).toBe(3);
    expect(fusionnerRegles({ regles: { impayes: { delaiRappelJours: 10, delaiMiseEnDemeureJours: 5 } } }).quitus.validiteMois).toBe(3);
    expect(fusionnerRegles({ regles: { quitus: { validiteMois: 6 } } }).quitus.validiteMois).toBe(6);
  });
});

describe("finValiditeQuitus", () => {
  it("ajoute les mois civils", () => {
    expect(iso(finValiditeQuitus(new Date("2026-10-11T10:00:00Z"), 3))).toBe("2027-01-11");
  });
  it("fin de mois : plafonne au dernier jour du mois d'arrivée (31 janv. + 1 mois = 28 févr.)", () => {
    expect(iso(finValiditeQuitus(new Date("2026-01-31T00:00:00Z"), 1))).toBe("2026-02-28");
    expect(iso(finValiditeQuitus(new Date("2026-11-30T00:00:00Z"), 3))).toBe("2027-02-28");
  });
  it("année bissextile", () => {
    expect(iso(finValiditeQuitus(new Date("2028-01-31T00:00:00Z"), 1))).toBe("2028-02-29");
    expect(iso(finValiditeQuitus(new Date("2028-02-29T00:00:00Z"), 12))).toBe("2029-02-28");
  });
  it("ne modifie pas la date reçue", () => {
    const d = new Date("2026-01-31T00:00:00Z"); finValiditeQuitus(d, 1);
    expect(iso(d)).toBe("2026-01-31");
  });
});
