import { describe, it, expect, vi, afterEach } from "vitest";
import QRCode from "qrcode";
import { timbreSvg, copierTimbre, echelleCapture, LARGEUR_MIN } from "../utils/timbreImage";

const timbre = { numero: 12, code: "ABC123", affaire: "ARENS c/ X", reference: "151024", juridiction: "TI de Tié-Tié", montant: 15000, membre: { nom: "BALANDRE Aline" }, createdAt: "2026-10-11" };
const url = "http://localhost/v/t/ABC123.K7M2Q9XAB4";

describe("timbreSvg", () => {
  it("SVG valide, QR de l'URL signée, mention PROTOTYPE, sans foreignObject", async () => {
    const svg = await timbreSvg(timbre, url, { prototype: true });
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.documentElement.tagName).toBe("svg");
    expect(svg).toContain("PROTOTYPE");
    expect(svg).toContain("cette seule affaire");
    expect(svg).not.toMatch(/foreignObject/i);
    const qr = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#1A3A6B", light: "#ffffff" } });
    expect(svg).toContain(qr.match(/<path[^>]*stroke[^>]*d="([^"]+)"/)[1]);
  });
  it("sans prototype, pas de mention PROTOTYPE", async () => {
    expect(await timbreSvg(timbre, url)).not.toContain("PROTOTYPE");
  });
});

describe("copierTimbre", () => {
  afterEach(() => { delete window.ClipboardItem; });
  it("sans ClipboardItem : repli par téléchargement avec message", async () => {
    delete window.ClipboardItem;
    const telecharger = vi.fn();
    const r = await copierTimbre({}, "t.png", { png: async () => new Blob(["x"]), telecharger });
    expect(telecharger).toHaveBeenCalledTimes(1);
    expect(r.copie).toBe(false);
    expect(r.message).toMatch(/téléchargé/);
  });
});

describe("échelle de capture", () => {
  it("donne au moins 1200 px de large", () => {
    for (const l of [360, 300, 1200, 1500]) expect(l * echelleCapture(l)).toBeGreaterThanOrEqual(LARGEUR_MIN);
  });
});
