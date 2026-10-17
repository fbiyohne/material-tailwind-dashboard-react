import { describe, it, expect, afterEach } from "vitest";
import { htmlVersPdf, trouverChromium, DELAIS_PDF } from "../src/lib/pdf.js";

/**
 * Rendu PDF indépendant du réseau (suite QA T25) : le rendu attendait « networkidle0 »,
 * si bien qu'une police Google lente, ou toute requête continue, faisait échouer le PDF
 * au bout de 30 s (TimeoutError). Il attend désormais l'événement load, borné, puis les
 * polices, bornées : au pire le PDF sort avec la police de repli, jamais une erreur 500.
 */
const aPdf = !!trouverChromium();
const initial = { ...DELAIS_PDF };
afterEach(() => Object.assign(DELAIS_PDF, initial));

const estPdf = (b: Uint8Array) => Buffer.from(b).subarray(0, 5).toString("latin1") === "%PDF-";

describe.skipIf(!aPdf)("htmlVersPdf : chargement borné", () => {
  it("produit le PDF même si le réseau n'est jamais au repos (requêtes continues)", async () => {
    // Requête toutes les 200 ms vers un hôte bloqué : « networkidle0 » n'est jamais atteint.
    const html = `<html><body><p>Réseau jamais au repos</p><script>setInterval(() => fetch("https://exemple.invalid/x").catch(() => {}), 200)</script></body></html>`;
    const t0 = Date.now();
    const pdf = await htmlVersPdf(html);
    expect(estPdf(pdf)).toBe(true);
    expect(Date.now() - t0).toBeLessThan(20_000);
  }, 60_000);

  it("produit le PDF quand le chargement dépasse son délai (repli, pas d'erreur)", async () => {
    DELAIS_PDF.chargement = 1; // force le dépassement du délai de chargement
    const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=DM+Sans&display=swap" rel="stylesheet"></head><body>Délai dépassé</body></html>`;
    expect(estPdf(await htmlVersPdf(html))).toBe(true);
  }, 60_000);
});
