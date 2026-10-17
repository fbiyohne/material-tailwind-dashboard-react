import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { cheminVerif, jetonQr, jetonValide, originePublique, qrDocument } from "../src/lib/signature.js";

/** Jeton QR des documents : chemin court signé, unicité, altération, rotation, taille du QR. */
const altere = (j: string) => (j[0] === "A" ? "B" : "A") + j.slice(1);
const jetonDe = (chemin: string) => chemin.split(".").pop()!;
const LF = String.fromCharCode(10);
const CRLF = String.fromCharCode(13, 10);

describe("jeton QR des documents", () => {
  afterEach(() => { delete process.env.SIGNATURE_ANCIENNE_PRIVATE_KEY; });

  it("produit un chemin court /v/{t}/{ref}.{jeton de 10 caractères base32 Crockford}", () => {
    expect(cheminVerif("q", "Q-2026-0001")).toMatch(/^\/v\/q\/Q-2026-0001\.[0-9A-HJKMNP-TV-Z]{10}$/);
  });

  it("deux références ou deux types différents donnent deux chemins différents", () => {
    expect(cheminVerif("q", "Q-2026-0001")).not.toBe(cheminVerif("q", "Q-2026-0002"));
    expect(jetonDe(cheminVerif("q", "X-1"))).not.toBe(jetonDe(cheminVerif("r", "X-1")));
  });

  it("accepte le jeton émis et refuse un jeton altéré d'un caractère, tronqué ou d'un autre type", () => {
    const j = jetonDe(cheminVerif("r", "R-2026-0042"));
    expect(jetonValide("r", "R-2026-0042", j)).toBe(true);
    expect(jetonValide("r", "R-2026-0042", altere(j))).toBe(false);
    expect(jetonValide("r", "R-2026-0042", j.slice(0, 9))).toBe(false);
    expect(jetonValide("q", "R-2026-0042", j)).toBe(false);
    expect(jetonValide("r", "R-2026-0042", "")).toBe(false);
  });

  it("accepte un jeton émis sous l'ancienne clé seulement si elle est configurée (rotation)", () => {
    const { privateKey: ancienne } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const ancien = jetonQr("t", "KALINAUKXEFTQIKH", ancienne);
    expect(jetonValide("t", "KALINAUKXEFTQIKH", ancien)).toBe(false);
    process.env.SIGNATURE_ANCIENNE_PRIVATE_KEY = ancienne;
    expect(jetonValide("t", "KALINAUKXEFTQIKH", ancien)).toBe(true);
    expect(jetonValide("t", "KALINAUKXEFTQIKH", altere(ancien))).toBe(false);
    // Même clé recollée avec des fins de ligne CRLF (variable d'environnement) : même jeton.
    expect(jetonQr("t", "KALINAUKXEFTQIKH", ancienne.split(LF).join(CRLF))).toBe(ancien);
    // Ancienne clé illisible : ignorée, la clé actuelle continue de vérifier.
    process.env.SIGNATURE_ANCIENNE_PRIVATE_KEY = "pas une clé";
    expect(jetonValide("q", "Q-2026-0001", jetonDe(cheminVerif("q", "Q-2026-0001")))).toBe(true);
  });

  it("URL complète ≤ 62 octets et QR de version ≤ 4 (niveau M) avec une origine de 30 caractères", () => {
    const origine = "https://barreau-pn.onrender.co"; // 30 caractères
    expect(origine).toHaveLength(30);
    // Pire cas : code de timbre de 16 caractères (préfixe 6 + aléa 10, lib/timbres.ts).
    for (const [t, ref] of [["q", "Q-2026-0001"], ["r", "R-2026-9999"], ["t", "KALINAUKXEFTQIKH"]] as const) {
      const url = origine + cheminVerif(t, ref);
      expect(Buffer.byteLength(url)).toBeLessThanOrEqual(62);
      expect(QRCode.create(url, { errorCorrectionLevel: "M" }).version).toBeLessThanOrEqual(4);
    }
  });

  it("qrDocument encode l'URL signée sous l'origine publique configurée, jamais l'en-tête Host", async () => {
    const avant = { p: process.env.PUBLIC_ORIGIN, c: process.env.CLIENT_ORIGIN };
    try {
      process.env.PUBLIC_ORIGIN = "https://barreau.exemple.cg/un/chemin";
      expect(originePublique()).toBe("https://barreau.exemple.cg");
      const qr = await qrDocument("q", "Q-2026-0001");
      expect(qr).toMatch(/^data:image\/png;base64,/);
      // Même rendu que les QR actuels (marge 1, 234 px, bleu nuit), niveau M.
      const attendu = await QRCode.toDataURL("https://barreau.exemple.cg" + cheminVerif("q", "Q-2026-0001"),
        { errorCorrectionLevel: "M", margin: 1, width: 234, color: { dark: "#1A3A6B", light: "#ffffff" } });
      expect(qr).toBe(attendu);
      expect(await qrDocument("q", "Q-2026-0002")).not.toBe(qr);
      // Sans PUBLIC_ORIGIN : repli sur CLIENT_ORIGIN (origine du front).
      delete process.env.PUBLIC_ORIGIN;
      process.env.CLIENT_ORIGIN = "http://localhost:5173";
      expect(originePublique()).toBe("http://localhost:5173");
      // Schéma autre que http/https : refusé (aucun QR javascript:, data:, etc.).
      process.env.PUBLIC_ORIGIN = "javascript:alert(1)";
      expect(() => originePublique()).toThrow(/PUBLIC_ORIGIN/);
    } finally {
      for (const [k, v] of [["PUBLIC_ORIGIN", avant.p], ["CLIENT_ORIGIN", avant.c]] as const) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      }
    }
  });
});
