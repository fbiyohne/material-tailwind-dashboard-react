/**
 * Captures et mesures d'écrans (M-20261011, T23), à 1280 et 360 px.
 * Usage : npx tsx scripts/captures-ecrans.ts avant|apres   (instance de test sur 4100)
 * Mesure scrollWidth <= innerWidth et liste les éléments qui dépassent hors d'un conteneur à défilement.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { trouverChromium } = await import("../src/lib/pdf.js");
const puppeteer = (await import("puppeteer-core")).default;

const phase = process.argv[2] === "apres" ? "apres" : "avant";
const URL_APP = process.env.RECETTE_URL ?? "http://localhost:4100";
const MDP = process.env.RECETTE_MDP ?? "barreau";
const DOSSIER = fileURLToPath(new URL("../../docs/captures/m20261011/ecrans/", import.meta.url));
fs.mkdirSync(DOSSIER, { recursive: true });

const nav = await puppeteer.launch({ executablePath: trouverChromium() ?? undefined, args: ["--no-sandbox", "--lang=fr-FR"] });

async function session(email: string) {
  const page = await (await nav.createBrowserContext()).newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(URL_APP + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  for (const [sel, val] of [['input[type="email"]', email], ['input[type="password"]', MDP]]) {
    await page.$eval(sel, (e: any, v: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(e, v);
      e.dispatchEvent(new Event("input", { bubbles: true }));
    }, val);
  }
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 20000 });
  return page;
}

const mesure = () => {
  const iw = innerWidth;
  const hors: string[] = [];
  for (const el of document.querySelectorAll("main *, body > div *")) {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width === 0 || r.right <= iw + 1) continue;
    let p = el.parentElement, coupe = false;
    while (p && p !== document.body) {
      const o = getComputedStyle(p).overflowX;
      if (o === "auto" || o === "scroll" || o === "hidden") { coupe = true; break; }
      p = p.parentElement;
    }
    if (!coupe) hors.push(`${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 50)} r=${Math.round(r.right)}`);
  }
  return { sw: document.documentElement.scrollWidth, iw, hors: hors.slice(0, 5) };
};

const mesures: Record<string, unknown> = {};
async function ecran(page: any, nom: string, chemin: string) {
  for (const [w, h] of [[1280, 900], [360, 780]] as const) {
    await page.setViewport({ width: w, height: h });
    await page.goto(URL_APP + chemin, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 800));
    mesures[`${nom}-${w}`] = await page.evaluate(mesure);
    // Capture pleine page par agrandissement du viewport (fullPage rate les aperçus à transform).
    const haut = await page.evaluate(() => Math.min(document.documentElement.scrollHeight, 6000));
    await page.setViewport({ width: w, height: haut });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(DOSSIER, `${phase}-${nom}-${w}.png`) });
  }
}

const sg = await session("sg@barreau-pn.cg");
const jeton = await sg.evaluate(() => Object.values(localStorage).find((v: any) => typeof v === "string" && v.split(".").length === 3) as string);
let idMembre = 1;
try {
  const r = await (await fetch(`${URL_APP}/api/membres?pageSize=1`, { headers: { Authorization: `Bearer ${jeton}` } })).json();
  idMembre = r.items?.[0]?.id ?? r.data?.[0]?.id ?? 1;
} catch { /* repli id 1 */ }
for (const [nom, chemin] of [
  ["avocats", "/avocats"], ["anciens-membres", "/anciens-membres"], ["fiche", `/avocats/${idMembre}`],
  ["quitus", "/quitus"], ["recus", "/recus"], ["timbres", "/timbres"], ["parametres", "/parametres"],
] as const) await ecran(sg, nom, chemin);

const av = await session("avocat@barreau-pn.cg");
await ecran(av, "espace-timbres", "/timbres");

fs.writeFileSync(path.join(DOSSIER, `mesures-${phase}.json`), JSON.stringify(mesures, null, 2));
console.log(JSON.stringify(mesures, null, 1));
await nav.close();
