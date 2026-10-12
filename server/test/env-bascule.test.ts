/**
 * R1-3 : VERIF_BASCULE n'a pas de défaut en production. Absente ou illisible,
 * le démarrage est refusé : un défaut figé (date du commit) fermerait en silence
 * l'ancienne voie /api/verifier pour des documents authentiques émis entre cette
 * date et le déploiement.
 */
import { afterEach, describe, expect, it } from "vitest";
import { verifierConfigProduction } from "../src/env.js";

const avant = { node: process.env.NODE_ENV, bascule: process.env.VERIF_BASCULE };
afterEach(() => {
  process.env.NODE_ENV = avant.node;
  if (avant.bascule === undefined) delete process.env.VERIF_BASCULE;
  else process.env.VERIF_BASCULE = avant.bascule;
});

describe("verifierConfigProduction : VERIF_BASCULE", () => {
  it("production sans VERIF_BASCULE : erreur de configuration", () => {
    process.env.NODE_ENV = "production";
    delete process.env.VERIF_BASCULE;
    expect(() => verifierConfigProduction(() => {})).toThrow(/VERIF_BASCULE/);
  });

  it("production avec une date illisible : erreur de configuration", () => {
    process.env.NODE_ENV = "production";
    process.env.VERIF_BASCULE = "pas-une-date";
    expect(() => verifierConfigProduction(() => {})).toThrow(/VERIF_BASCULE/);
  });

  it("production avec une date valide : démarre", () => {
    process.env.NODE_ENV = "production";
    process.env.VERIF_BASCULE = "2026-11-01";
    expect(() => verifierConfigProduction(() => {})).not.toThrow();
  });

  it("hors production sans VERIF_BASCULE : aucun refus (défaut de développement)", () => {
    process.env.NODE_ENV = "test";
    delete process.env.VERIF_BASCULE;
    expect(() => verifierConfigProduction(() => {})).not.toThrow();
  });
});
