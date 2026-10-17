/**
 * M-20261016-admin-droit-a-tout — passe du testeur : écrans touchés, 360 px / 1280 px, clavier, sombre,
 * erreur API, débordement horizontal. Lecture seule (aucun envoi). Captures < 1 Mo.
 */
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve(process.cwd(), "../docs/captures/m20261016-admin/testeur");
mkdirSync(DIR, { recursive: true });
const TAILLES = { mobile: { width: 360, height: 740 }, bureau: { width: 1280, height: 800 } };

async function connecte(page: Page, request: any, email: string) {
  const r = await request.post("/api/auth/login", { data: { email, password: "barreau" } });
  expect(r.status()).toBe(200);
  const { token, refreshToken } = await r.json();
  await page.addInitScript(({ t, f }) => { localStorage.setItem("bpn_token", t); localStorage.setItem("bpn_refresh", f); }, { t: token, f: refreshToken });
  return { Authorization: `Bearer ${token}` };
}
const debordement = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [nom, vp] of Object.entries(TAILLES)) {
  test(`ADMIN ${nom} : écrans touchés, pas de débordement ni d'erreur console`, async ({ page, request }) => {
    const erreurs: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
    page.on("pageerror", (e) => erreurs.push(String(e)));
    await connecte(page, request, "admin@barreau-pn.cg");
    await page.setViewportSize(vp);
    const ecrans: [string, string][] = [["messagerie", "/messagerie"], ["pieces", "/pieces"], ["utilisateurs", "/utilisateurs"], ["avocats", "/avocats"]];
    for (const [id, url] of ecrans) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `${DIR}/admin-${id}-${nom}.png` });
      expect(await debordement(page), `débordement horizontal ${id} ${nom}`).toBeLessThanOrEqual(1);
    }
    expect(erreurs.filter((e) => !/favicon/.test(e)), "erreurs console").toEqual([]);
  });
}

test("ADMIN 360 : fiche avocat, bouton accès espace; Utilisateurs : rôles de création", async ({ page, request }) => {
  const h = await connecte(page, request, "admin@barreau-pn.cg");
  await page.setViewportSize(TAILLES.mobile);
  const liste = await (await request.get("/api/membres", { headers: h })).json();
  const m = (Array.isArray(liste) ? liste : liste.items ?? liste.data)[0];
  await page.goto(`/avocats/${m.id}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${DIR}/admin-avocat-detail-mobile.png` });
  await page.getByRole("button", { name: /^Actions/ }).click();
  const acces = await page.getByText(/accès espace/i).count();
  await page.screenshot({ path: `${DIR}/admin-avocat-actions-mobile.png` });
  expect(acces, "entrée « Accès espace » visible pour l'ADMIN").toBeGreaterThan(0);
  expect(await debordement(page)).toBeLessThanOrEqual(1);

  await page.goto("/utilisateurs");
  await page.waitForLoadState("networkidle");
  const nouveau = page.getByRole("button", { name: /Nouveau compte/ }).first();
  await nouveau.click();
  const options = await page.locator("select").last().locator("option").allTextContents();
  console.log("OPTIONS_ROLE", JSON.stringify(options));
  await page.screenshot({ path: `${DIR}/admin-utilisateurs-creation-mobile.png` });
});

test("ADMIN : clavier sur Messagerie (Tab atteint un fil, Entrée l'ouvre) et mode sombre", async ({ page, request }) => {
  await connecte(page, request, "admin@barreau-pn.cg");
  await page.setViewportSize(TAILLES.bureau);
  await page.goto("/messagerie");
  await page.waitForLoadState("networkidle");
  const fil = page.locator("ul button").first();
  if (await fil.count()) {
    await fil.focus();
    const ouvert = page.waitForResponse((x) => /\/api\/messagerie\/\d+$/.test(x.url()), { timeout: 5000 }).catch(() => null);
    await page.keyboard.press("Enter");
    const rep = await ouvert;
    expect(rep?.status(), "Entrée sur un fil l'ouvre").toBe(200);
  } else console.log("MESSAGERIE_VIDE");
  const focusVisible = await page.evaluate(() => { const a = document.activeElement as HTMLElement; return a ? getComputedStyle(a).outlineStyle + "|" + getComputedStyle(a).boxShadow : ""; });
  console.log("FOCUS", focusVisible);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: `${DIR}/admin-messagerie-sombre.png` });
  const fond = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log("FOND_SOMBRE", fond);
});

test("ADMIN : état d'erreur API sur Messagerie et Pièces (500 simulé)", async ({ page, request }) => {
  await connecte(page, request, "admin@barreau-pn.cg");
  await page.setViewportSize(TAILLES.mobile);
  await page.route("**/api/messagerie", (r) => r.request().method() === "GET" ? r.fulfill({ status: 500, json: { error: "x" } }) : r.continue());
  await page.route("**/api/pieces", (r) => r.request().method() === "GET" ? r.fulfill({ status: 500, json: { error: "x" } }) : r.continue());
  for (const u of ["/messagerie", "/pieces"]) {
    await page.goto(u);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${DIR}/admin-erreur-${u.slice(1)}-mobile.png` });
    const texte = (await page.locator("main").first().innerText()).slice(0, 400);
    console.log("ERREUR", u, JSON.stringify(texte));
  }
});

test("ADMIN : état vide Messagerie (liste vide simulée)", async ({ page, request }) => {
  await connecte(page, request, "admin@barreau-pn.cg");
  await page.setViewportSize(TAILLES.mobile);
  await page.route("**/api/messagerie", (r) => r.request().method() === "GET" ? r.fulfill({ status: 200, json: [] }) : r.continue());
  await page.goto("/messagerie");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${DIR}/admin-vide-messagerie-mobile.png` });
  console.log("VIDE", JSON.stringify((await page.locator("main").first().innerText()).slice(0, 300)));
});

test("Non-régression visuelle : SG sans changement (Messagerie visible ? Utilisateurs sans ADMIN)", async ({ page, request }) => {
  await connecte(page, request, "sg@barreau-pn.cg");
  await page.setViewportSize(TAILLES.bureau);
  await page.goto("/utilisateurs");
  await page.waitForLoadState("networkidle");
  const nouveau = page.getByRole("button", { name: /Nouveau compte/ }).first();
  await nouveau.click();
  const options = await page.locator("select").last().locator("option").allTextContents();
  console.log("SG_OPTIONS_ROLE", JSON.stringify(options));
  expect(options.join("|"), "le SG ne voit pas ADMIN").not.toMatch(/admin/i);
});
