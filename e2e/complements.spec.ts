/**
 * M-20261011 — compléments de bout en bout : clavier, états d'erreur, secrets, vérification publique,
 * débordement 360 px sur les écrans non couverts par m20261011.spec.ts, noms accessibles des boutons.
 * Aucun envoi réel (le test SMTP n'est jamais déclenché).
 */
import { test, expect, type Page } from "@playwright/test";

const MDP = "barreau";
const SG = "sg@barreau-pn.cg";

async function session(request: any, email: string) {
  const r = await request.post("/api/auth/login", { data: { email, password: MDP } });
  expect(r.status()).toBe(200);
  return (await r.json()) as { token: string; refreshToken: string };
}
async function ouvrir(page: Page, s: { token: string; refreshToken: string }) {
  await page.addInitScript(({ t, r }) => { localStorage.setItem("bpn_token", t); localStorage.setItem("bpn_refresh", r); }, { t: s.token, r: s.refreshToken });
}

test("A. Menu Actions au clavier : ouverture, flèches, Échap rend le focus", async ({ page, request }) => {
  const s = await session(request, SG);
  await ouvrir(page, s);
  const liste = await (await request.get("/api/membres?pageSize=1", { headers: { Authorization: `Bearer ${s.token}` } })).json();
  const id = (liste.items ?? liste.data ?? liste)[0].id;
  await page.goto(`/avocats/${id}`);
  const bouton = page.getByRole("button", { name: /^actions/i });
  await bouton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(bouton).toBeFocused();
});

test("B. GET /parametres : aucun secret en clair, quel que soit le profil", async ({ request }) => {
  for (const email of [SG, "avocat.demo@demo.invalid"]) {
    const s = await session(request, email);
    const r = await request.get("/api/parametres", { headers: { Authorization: `Bearer ${s.token}` } });
    const txt = await r.text();
    expect(txt, email).not.toMatch(/enc:v1:/);
    expect(txt, email).not.toMatch(/"pass"\s*:\s*"(?!•)[^"]+"/);
  }
});

test("C. Vérification publique : jeton altéré ou absent = non reconnu, sans donnée", async ({ page }) => {
  for (const u of ["/v/q/Q-2026-0001.AAAAAAAAAA", "/v/q/Q-2026-0001", "/v/x/zzz.AAAAAAAAAA", "/v/q/%3Cscript%3E.AAAAAAAAAA"]) {
    const r = await page.goto(u);
    expect(r!.status(), u).toBeLessThan(500);
    const html = await page.content();
    expect(html, u).not.toMatch(/Authentique/i);
    expect(html, u).not.toContain("<script>");
  }
  const r = await page.goto("/v/q/Q-2026-0001.AAAAAAAAAA");
  expect(r!.headers()["cache-control"]).toMatch(/no-store/);
});

test("D. Anonyme sur /anciens-membres : écran de connexion affiché", async ({ page }) => {
  await page.goto("/anciens-membres");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
});

test("E. 360 px : autres écrans sans débordement et boutons nommés", async ({ browser, request }) => {
  const s = await session(request, SG);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  await ouvrir(page, s);
  const ecarts: string[] = [];
  for (const c of ["/annuaire", "/stagiaires", "/pieces", "/tableau", "/messagerie", "/cotisations", "/assemblees", "/reunions", "/scrutins", "/journal", "/cabinets", "/conseil"]) {
    await page.goto(c);
    await page.waitForLoadState("networkidle");
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth, iw: innerWidth,
      sansNom: [...document.querySelectorAll("button")].filter((b) => !(b.textContent || "").trim() && !b.getAttribute("aria-label") && !b.getAttribute("title") && !b.getAttribute("aria-labelledby")).length,
      body: (document.body.innerText || "").slice(0, 80),
    }));
    if (m.sw > m.iw) ecarts.push(`${c} débordement ${m.sw}>${m.iw}`);
    if (m.sansNom) ecarts.push(`${c} ${m.sansNom} bouton(s) sans nom accessible`);
    if (/404|introuvable/i.test(m.body)) ecarts.push(`${c} route inconnue (${m.body.replace(/\n/g, " ")})`);
  }
  await ctx.close();
  expect(ecarts).toEqual([]);
});
