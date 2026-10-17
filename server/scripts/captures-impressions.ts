/**
 * Captures des documents produits par le NAVIGATEUR (impressions et exports PDF côté client),
 * pour l'inventaire des documents. Instance de test sur 4100, compte ADMIN de test.
 * Usage (depuis server/) : npx tsx scripts/captures-impressions.ts <dossier-sortie>
 * Produit <page>-impression.pdf (window.print simulé) et <page>-export.pdf (bouton d'export PDF, s'il existe).
 */
import fs from "node:fs";
import path from "node:path";
const { trouverChromium } = await import("../src/lib/pdf.js");
const puppeteer = (await import("puppeteer-core")).default;

const sortie = process.argv[2];
if (!sortie) throw new Error("usage : captures-impressions.ts <dossier-sortie>");
fs.mkdirSync(sortie, { recursive: true });
const URL_APP = process.env.RECETTE_URL ?? "http://localhost:4100";
const MDP = process.env.RECETTE_MDP ?? "barreau";
const PAGES = ["/corps-electoral", "/annuaire", "/stagiaires", "/cotisations", "/droits-plaidoirie", "/avocats"];

const nav = await puppeteer.launch({ executablePath: trouverChromium() ?? undefined, args: ["--no-sandbox", "--lang=fr-FR"] });
const page = await (await nav.createBrowserContext()).newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(URL_APP + "/", { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[type="email"]', { timeout: 15000 });
for (const [sel, val] of [['input[type="email"]', "admin@barreau-pn.cg"], ['input[type="password"]', MDP]]) {
  await page.$eval(sel, (e: any, v: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(e, v);
    e.dispatchEvent(new Event("input", { bubbles: true }));
  }, val);
}
await page.click('button[type="submit"]');
await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 20000 });

page.setDefaultTimeout(90000);
console.log("connecté");
const cdp = await page.createCDPSession();
for (const chemin of PAGES) {
  const nom = chemin.slice(1);
  await page.goto(URL_APP + chemin, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 4000));
  await page.emulateMediaType("print");
  await page.setViewport({ width: 794, height: 1123 });
  await page.screenshot({ path: path.join(sortie, `${nom}-impression.png`) as `${string}.png`, fullPage: false });
  await page.setViewport({ width: 1280, height: 900 });
  await page.emulateMediaType("screen");
  // Export PDF côté client : bouton dont le libellé contient « PDF ».
  const dl = path.join(sortie, `dl-${nom}`);
  fs.rmSync(dl, { recursive: true, force: true }); fs.mkdirSync(dl, { recursive: true });
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: path.resolve(dl) });
  const clique = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button, a")].find((e) => /pdf/i.test(e.textContent ?? "") && !/imprimer/i.test(e.textContent ?? ""));
    if (b) { (b as HTMLElement).click(); return (b.textContent ?? "").trim(); }
    return "";
  });
  if (clique) {
    await new Promise((r) => setTimeout(r, 1200));
    // Un menu d'export peut s'ouvrir : on clique alors l'entrée PDF.
    await page.evaluate(() => {
      const it = [...document.querySelectorAll('[role="menuitem"], li button, li a')].find((e) => /pdf/i.test(e.textContent ?? ""));
      if (it) (it as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 6000));
  }
  const f = fs.readdirSync(dl).find((x) => x.endsWith(".pdf"));
  if (f) fs.renameSync(path.join(dl, f), path.join(sortie, `${nom}-export.pdf`));
  fs.rmSync(dl, { recursive: true, force: true });
  console.log(nom, "impression ok", clique ? `| export « ${clique} » ${f ? "ok" : "non téléchargé"}` : "| pas de bouton PDF");
}
await nav.close();
process.exit(0);
