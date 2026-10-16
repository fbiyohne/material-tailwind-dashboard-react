/**
 * R2-7 : un SIGNATURE_KEY_DIR non persistant ne doit plus contourner le refus de
 * démarrage en production. Paire illisible, incomplète ou impossible à persister :
 * erreur, jamais de clé éphémère (qui rendrait les QR imprimés « Non reconnu »).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chargerCles } from "../src/lib/signature.js";

const CLES = ["NODE_ENV", "SIGNATURE_PRIVATE_KEY", "SIGNATURE_PUBLIC_KEY", "SIGNATURE_KEY_DIR"] as const;
const avant = Object.fromEntries(CLES.map((k) => [k, process.env[k]]));
let base: string;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "r2-7-"));
  process.env.NODE_ENV = "production";
  delete process.env.SIGNATURE_PRIVATE_KEY;
  delete process.env.SIGNATURE_PUBLIC_KEY;
  process.env.SIGNATURE_KEY_DIR = base;
});
afterEach(() => {
  for (const k of CLES) {
    if (avant[k] === undefined) delete process.env[k];
    else process.env[k] = avant[k];
  }
  fs.rmSync(base, { recursive: true, force: true });
});

describe("chargerCles en production avec SIGNATURE_KEY_DIR", () => {
  it("dossier vide et inscriptible : génère, persiste, puis relit la même paire", () => {
    const a = chargerCles(base);
    expect(fs.existsSync(path.join(base, "signing-private.pem"))).toBe(true);
    expect(chargerCles(base)).toEqual(a);
  });

  it("persistance impossible (chemin bloqué par un fichier) : démarrage refusé", () => {
    const bloque = path.join(base, "fichier");
    fs.writeFileSync(bloque, "x");
    expect(() => chargerCles(path.join(bloque, "cles"))).toThrow(/Persistance des clés de signature impossible/);
  });

  it("paire incomplète (clé publique seule) : refus, rien n'est écrasé", () => {
    fs.writeFileSync(path.join(base, "signing-public.pem"), "pub");
    expect(() => chargerCles(base)).toThrow(/incomplète/);
    expect(fs.existsSync(path.join(base, "signing-private.pem"))).toBe(false);
  });

  it("paire illisible (fichiers remplacés par des dossiers) : refus", () => {
    fs.mkdirSync(path.join(base, "signing-private.pem"));
    fs.mkdirSync(path.join(base, "signing-public.pem"));
    expect(() => chargerCles(base)).toThrow(/illisibles/);
  });

  it("hors production, persistance impossible : repli en mémoire (développement)", () => {
    process.env.NODE_ENV = "test";
    const bloque = path.join(base, "fichier");
    fs.writeFileSync(bloque, "x");
    expect(chargerCles(path.join(bloque, "cles")).privateKey).toMatch(/PRIVATE KEY/);
  });
});
