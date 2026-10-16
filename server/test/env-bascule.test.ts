/**
 * R1-3 : VERIF_BASCULE n'a pas de défaut en production. Absente ou illisible,
 * le démarrage est refusé : un défaut figé (date du commit) fermerait en silence
 * l'ancienne voie /api/verifier pour des documents authentiques émis entre cette
 * date et le déploiement.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifierConfigProduction } from "../src/env.js";

const avant = { node: process.env.NODE_ENV, bascule: process.env.VERIF_BASCULE, origine: process.env.PUBLIC_ORIGIN };
const CLES_SIG = ["SIGNATURE_PRIVATE_KEY", "SIGNATURE_PUBLIC_KEY", "SIGNATURE_KEY_DIR"] as const;
const sigAvant = Object.fromEntries(CLES_SIG.map((k) => [k, process.env[k]]));
// Par défaut, une clé de signature persistante est configurée ; les tests R1-1 la retirent.
beforeEach(() => { process.env.SIGNATURE_KEY_DIR = "/app/server/secrets"; });
beforeEach(() => { process.env.PUBLIC_ORIGIN = "https://barreau.exemple.cg"; });
afterEach(() => {
  if (avant.origine === undefined) delete process.env.PUBLIC_ORIGIN;
  else process.env.PUBLIC_ORIGIN = avant.origine;
  process.env.NODE_ENV = avant.node;
  if (avant.bascule === undefined) delete process.env.VERIF_BASCULE;
  else process.env.VERIF_BASCULE = avant.bascule;
  for (const k of CLES_SIG) {
    if (sigAvant[k] === undefined) delete process.env[k];
    else process.env[k] = sigAvant[k];
  }
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
    process.env.PUBLIC_ORIGIN = "https://barreau.exemple.cg";
    expect(() => verifierConfigProduction(() => {})).toThrow(/VERIF_BASCULE/);
  });

  it("production avec une date valide : démarre", () => {
    process.env.NODE_ENV = "production";
    process.env.VERIF_BASCULE = "2026-11-01";
    process.env.PUBLIC_ORIGIN = "https://barreau.exemple.cg";
    expect(() => verifierConfigProduction(() => {})).not.toThrow();
  });

  it("production sans PUBLIC_ORIGIN ou en http : erreur de configuration", () => {
    process.env.NODE_ENV = "production";
    process.env.VERIF_BASCULE = "2026-11-01";
    delete process.env.PUBLIC_ORIGIN;
    expect(() => verifierConfigProduction(() => {})).toThrow(/PUBLIC_ORIGIN/);
    process.env.PUBLIC_ORIGIN = "http://barreau.exemple.cg";
    expect(() => verifierConfigProduction(() => {})).toThrow(/PUBLIC_ORIGIN/);
  });

  // R1-1 : sans clé de signature persistante, le jeton QR change à chaque redémarrage
  // et tous les documents imprimés deviennent « Non reconnu » : démarrage refusé.
  it("production sans clés de signature ni SIGNATURE_KEY_DIR : erreur de configuration", () => {
    process.env.NODE_ENV = "production";
    process.env.VERIF_BASCULE = "2026-11-01";
    delete process.env.SIGNATURE_PRIVATE_KEY;
    delete process.env.SIGNATURE_PUBLIC_KEY;
    delete process.env.SIGNATURE_KEY_DIR;
    expect(() => verifierConfigProduction(() => {})).toThrow(/SIGNATURE_PRIVATE_KEY/);
  });

  it("production avec la seule clé privée (sans publique) : erreur de configuration", () => {
    process.env.NODE_ENV = "production";
    process.env.VERIF_BASCULE = "2026-11-01";
    process.env.SIGNATURE_PRIVATE_KEY = "pem";
    delete process.env.SIGNATURE_PUBLIC_KEY;
    delete process.env.SIGNATURE_KEY_DIR;
    expect(() => verifierConfigProduction(() => {})).toThrow(/SIGNATURE_PRIVATE_KEY/);
  });

  it("production avec la paire de clés en variables d'environnement : démarre", () => {
    process.env.NODE_ENV = "production";
    process.env.VERIF_BASCULE = "2026-11-01";
    process.env.PUBLIC_ORIGIN = "https://barreau.exemple.cg";
    process.env.SIGNATURE_PRIVATE_KEY = "pem-prive";
    process.env.SIGNATURE_PUBLIC_KEY = "pem-public";
    delete process.env.SIGNATURE_KEY_DIR;
    expect(() => verifierConfigProduction(() => {})).not.toThrow();
  });

  it("hors production sans VERIF_BASCULE : aucun refus (défaut de développement)", () => {
    process.env.NODE_ENV = "test";
    delete process.env.VERIF_BASCULE;
    expect(() => verifierConfigProduction(() => {})).not.toThrow();
  });
});
