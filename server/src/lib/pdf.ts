import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Response } from "express";
import puppeteer, { type Browser } from "puppeteer-core";

const existe = (p?: string | null): p is string => {
  try { return !!p && fs.existsSync(p); } catch { return false; }
};

/** Premier binaire `chrome` trouvé dans un répertoire de versions (plus récente
 *  d'abord), en explorant les dispositions de dossier Chromium connues. */
function chromeDans(racine: string, prefixes: string[]): string | null {
  try {
    const dossiers = fs
      .readdirSync(racine)
      .filter((d) => prefixes.some((p) => d.startsWith(p)))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const d of dossiers) {
      for (const rel of ["chrome-linux64/chrome", "chrome-linux/chrome", "chrome-linux/headless_shell", "chrome-linux64/headless_shell"]) {
        const p = path.join(racine, d, rel);
        if (existe(p)) return p;
      }
    }
  } catch { /* répertoire absent : ignorer */ }
  return null;
}

/**
 * Résout le binaire Chromium SANS figer la version :
 *  1. PUPPETEER_EXECUTABLE_PATH (prioritaire) ;
 *  2. Chrome installé par @puppeteer/browsers (cache Puppeteer — cas Render,
 *     téléchargé au build) : <cache>/chrome/<plateforme>-<version>/… ;
 *  3. navigateurs Playwright (/opt/pw-browsers/chromium-* — environnement de dev) ;
 *  4. Chromium/Chrome installé au niveau système (VPS, Docker).
 * Le chemin codé en dur précédent cassait dès que la version de Chromium changeait.
 */
function trouverChromium(): string | null {
  if (existe(process.env.PUPPETEER_EXECUTABLE_PATH)) return process.env.PUPPETEER_EXECUTABLE_PATH!;

  const cache = process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), ".cache", "puppeteer");
  const parCache = chromeDans(path.join(cache, "chrome"), ["linux-", "mac-", "win"]);
  if (parCache) return parCache;

  const playwright = chromeDans(process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers", ["chromium-", "chromium_headless_shell-"]);
  if (playwright) return playwright;

  for (const p of ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"]) {
    if (existe(p)) return p;
  }
  return null;
}

function executablePath(): string {
  const exe = trouverChromium();
  if (!exe) {
    throw new Error(
      "Génération PDF indisponible : aucun navigateur Chromium trouvé sur le serveur. " +
        "Définissez PUPPETEER_EXECUTABLE_PATH ou installez Chromium."
    );
  }
  return exe;
}

let navigateur: Browser | null = null;
async function getNavigateur(): Promise<Browser> {
  if (navigateur && navigateur.connected) return navigateur;
  navigateur = await puppeteer.launch({ executablePath: executablePath(), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  return navigateur;
}

/** Convertit un document HTML en PDF A4 (qualité vectorielle). */
export async function htmlVersPdf(html: string): Promise<Buffer> {
  const page = await (await getNavigateur()).newPage();
  try {
    // « networkidle0 » est accepté à l'exécution par setContent (attente du
    // chargement complet des ressources) ; les typings de cette version le
    // restreignent à tort à load/domcontentloaded, d'où le cast.
    await page.setContent(html, { waitUntil: "networkidle0" } as unknown as Parameters<typeof page.setContent>[1]);
    return (await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "16mm", right: "16mm" },
    })) as Buffer;
  } finally {
    await page.close();
  }
}

/** Rend un HTML en PDF et le renvoie en pièce jointe (Content-Disposition). */
export async function envoyerPdf(res: Response, html: string, filename: string): Promise<void> {
  const pdf = await htmlVersPdf(html);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.end(pdf);
}

/**
 * Rend un DOCUMENT pleine page (reçu/quitus riches) : pas de marge, format A4,
 * et mise à l'échelle pour tenir sur UNE page (le document .doc-root porte son
 * propre cadre). Sert la reproduction vectorielle des composants à l'écran.
 */
export async function envoyerDocumentPdf(res: Response, html: string, filename: string): Promise<void> {
  const page = await (await getNavigateur()).newPage();
  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" } as unknown as Parameters<typeof page.setContent>[1]);
    const hauteur = await page.evaluate(() => {
      const el = document.querySelector(".doc-root");
      return el ? Math.ceil((el as HTMLElement).getBoundingClientRect().height) : document.body.scrollHeight;
    });
    const scale = Math.min(1, 1122.5 / hauteur); // 297mm @96dpi ; tient sur une page
    // Si le document doit être réduit pour tenir sur la page, on l'échelonne EN CSS
    // avec un origine « haut-centre » afin qu'il reste CENTRÉ horizontalement
    // (l'option `scale` de page.pdf, elle, aligne en haut-gauche → vide à droite).
    if (scale < 1) {
      await page.evaluate((s) => {
        const el = document.querySelector(".doc-root") as HTMLElement;
        el.style.transformOrigin = "top center";
        el.style.transform = `scale(${s})`;
        document.body.style.cssText = "margin:0;width:794px;overflow:hidden;background:#fff;";
      }, scale);
    }
    const pdf = (await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      pageRanges: "1",
    })) as Buffer;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.end(pdf);
  } finally {
    await page.close();
  }
}
