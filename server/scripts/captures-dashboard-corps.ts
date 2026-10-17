/**
 * Captures du Tableau de bord et du Corps électoral (M-20261011, T22), à 1280 et 360 px.
 * Usage : npx tsx scripts/captures-dashboard-corps.ts avant|apres   (instance de test sur 4100)
 * Mesure aussi scrollWidth <= innerWidth à 360 px ; résultat dans mesures-<phase>.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { trouverChromium } = await import("../src/lib/pdf.js");
const puppeteer = (await import("puppeteer-core")).default;

const phase = process.argv[2] === "apres" ? "apres" : "avant";
const URL_APP = process.env.RECETTE_URL ?? "http://localhost:4100";
const MDP = process.env.RECETTE_MDP ?? "barreau";
const DOSSIER = fileURLToPath(new URL("../../docs/captures/m20261011/dashboard-corps/", import.meta.url));
fs.mkdirSync(DOSSIER, { recursive: true });

const nav = await puppeteer.launch({ executablePath: trouverChromium() ?? undefined, args: ["--no-sandbox", "--lang=fr-FR"] });
const page = await nav.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(URL_APP + "/", { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[type="email"]', { timeout: 15000 });
for (const [sel, val] of [['input[type="email"]', "sg@barreau-pn.cg"], ['input[type="password"]', MDP]]) {
  await page.$eval(sel, (e: any, v: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(e, v);
    e.dispatchEvent(new Event("input", { bubbles: true }));
  }, val);
}
await page.click('button[type="submit"]');
await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 20000 });

const mesures: Record<string, unknown> = {};
for (const [nom, chemin] of [["dashboard", "/"], ["corps-electoral", "/corps-electoral"]] as const) {
  for (const [w, h] of [[1280, 900], [360, 780]] as const) {
    await page.setViewport({ width: w, height: h });
    await page.goto(URL_APP + chemin, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 800));
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    mesures[`${nom}-${w}`] = m;
    await page.screenshot({ path: path.join(DOSSIER, `${phase}-${nom}-${w}.png`), fullPage: true });
    // onglet Exclusions du corps électoral
    if (nom === "corps-electoral") {
      await page.evaluate(() => [...document.querySelectorAll('[role="tab"],button')].find((b) => /Exclusions/.test(b.textContent || ""))?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      await new Promise((r) => setTimeout(r, 400));
      mesures[`${nom}-exclusions-${w}`] = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
      await page.screenshot({ path: path.join(DOSSIER, `${phase}-${nom}-exclusions-${w}.png`), fullPage: true });
    }
  }
}
fs.writeFileSync(path.join(DOSSIER, `mesures-${phase}.json`), JSON.stringify(mesures, null, 2));
console.log(JSON.stringify(mesures));
await nav.close();
