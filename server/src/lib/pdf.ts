import fs from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";

/** Résout le binaire Chromium (env prioritaire, sinon chemins connus). */
function executablePath(): string {
  const candidats = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/opt/pw-browsers/chromium-1223/chrome-linux64/chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ].filter(Boolean) as string[];
  const exe = candidats.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
  if (!exe) throw new Error("Chromium introuvable (définir PUPPETEER_EXECUTABLE_PATH)");
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
    await page.setContent(html, { waitUntil: "networkidle0" });
    return (await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "16mm", right: "16mm" },
    })) as Buffer;
  } finally {
    await page.close();
  }
}
