import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Response } from "express";
import puppeteer, { TimeoutError, type Browser, type Page } from "puppeteer-core";
import { logger } from "./logger.js";

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
export function trouverChromium(): string | null {
  if (existe(process.env.PUPPETEER_EXECUTABLE_PATH)) return process.env.PUPPETEER_EXECUTABLE_PATH!;

  const cache = process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), ".cache", "puppeteer");
  const parCache = chromeDans(path.join(cache, "chrome"), ["linux-", "mac-", "win"]);
  if (parCache) return parCache;

  const playwright = chromeDans(process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers", ["chromium-", "chromium_headless_shell-"]);
  if (playwright) return playwright;

  for (const p of ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"]) {
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

// Hôtes externes autorisés au rendu (polices Google uniquement). Toute autre
// ressource réseau est bloquée : défense en profondeur contre une injection HTML
// dans un champ libre (ex. nom = `<img src=http://evil/…>`) qui déclencherait
// sinon une requête sortante côté serveur (SSRF aveugle).
const HOTES_AUTORISES = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);

/** Nouvelle page Chromium avec interception des ressources externes non autorisées. */
async function nouvellePage() {
  const page = await (await getNavigateur()).newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    // Schémas non réseau (bootstrap de setContent : about:blank, data:, blob:) — OK.
    if (!/^https?:/i.test(url)) return void req.continue();
    // http(s) : seules les polices Google sont autorisées. Tout autre accès réseau
    // est bloqué, qu'il s'agisse d'une sous-ressource OU d'une navigation injectée
    // (<meta http-equiv=refresh>, iframe navigant vers un hôte externe) — pas de SSRF.
    try {
      if (HOTES_AUTORISES.has(new URL(url).hostname)) return void req.continue();
    } catch { /* URL non standard : on bloque */ }
    return void req.abort();
  });
  return page;
}

/** Délais du rendu (ms), modifiables par les tests. */
export const DELAIS_PDF = { chargement: 20_000, polices: 5_000 };

/**
 * Charge le HTML sans dépendre d'un réseau « au repos » : attente de l'événement load
 * (feuilles de style, images), bornée, puis des polices, bornée. Un délai dépassé (police
 * Google lente, machine chargée) n'est pas une erreur : le PDF sort avec la police de repli.
 * Remplace « networkidle0 », qui échouait au bout de 30 s dès qu'une requête traînait.
 */
async function charger(page: Page, html: string) {
  try {
    await page.setContent(html, { waitUntil: "load", timeout: DELAIS_PDF.chargement });
  } catch (err) {
    if (!(err instanceof TimeoutError)) throw err;
    logger.warn("PDF : chargement des ressources au-delà du délai, rendu avec les polices de repli");
  }
  let minuteur: NodeJS.Timeout | undefined;
  await Promise.race([
    page.evaluate(() => document.fonts.ready.then(() => undefined)).catch(() => undefined),
    new Promise((r) => (minuteur = setTimeout(r, DELAIS_PDF.polices))),
  ]);
  clearTimeout(minuteur);
}

/**
 * Convertit un document HTML en PDF A4 (qualité vectorielle). Les règles @page du document
 * (format, paysage, marges du socle gabarit.ts, boîtes de marge) font foi : aucune marge ni
 * mise à l'échelle imposée ici, donc aucune réduction ni troncature silencieuse.
 */
export async function htmlVersPdf(html: string): Promise<Buffer> {
  // Pied officiel répété sur chaque page (gabarit « officielle ») : déclaré dans le document par
  // <template id="pied-pdf">, dessiné par Chrome dans la marge basse de chaque page.
  const pied = /<template id="pied-pdf">([\s\S]*?)<\/template>/.exec(html)?.[1];
  const page = await nouvellePage();
  try {
    await charger(page, html);
    return (await page.pdf({
      format: "A4", printBackground: true, preferCSSPageSize: true,
      ...(pied ? { displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: pied } : {}),
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

/** Ancien rendu « pleine page » des reçus et quitus, conservé comme alias pour ses appelants. */
export const envoyerDocumentPdf = envoyerPdf;
