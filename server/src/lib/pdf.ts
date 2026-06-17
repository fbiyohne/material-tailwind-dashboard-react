import fs from "node:fs";
import path from "node:path";
import type { Response } from "express";
import puppeteer, { type Browser } from "puppeteer-core";

const existe = (p?: string | null): p is string => {
  try { return !!p && fs.existsSync(p); } catch { return false; }
};

/**
 * Résout le binaire Chromium SANS figer la version : variable d'environnement,
 * puis exploration des navigateurs Playwright installés (chromium-<version>,
 * version la plus récente d'abord), puis Chromium/Chrome système. Le chemin
 * codé en dur précédent cassait dès que la version de Chromium changeait.
 */
function trouverChromium(): string | null {
  if (existe(process.env.PUPPETEER_EXECUTABLE_PATH)) return process.env.PUPPETEER_EXECUTABLE_PATH!;

  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    const dossiers = fs
      .readdirSync(racine)
      .filter((d) => d.startsWith("chromium-") || d.startsWith("chromium_headless_shell-"))
      .sort((a, b) => (parseInt(b.split("-").pop() || "0", 10) || 0) - (parseInt(a.split("-").pop() || "0", 10) || 0));
    for (const d of dossiers) {
      for (const rel of ["chrome-linux64/chrome", "chrome-linux/chrome", "chrome-linux/headless_shell", "chrome-linux64/headless_shell"]) {
        const p = path.join(racine, d, rel);
        if (existe(p)) return p;
      }
    }
  } catch { /* racine absente : on continue vers les chemins système */ }

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
