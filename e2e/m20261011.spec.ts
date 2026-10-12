/**
 * M-20261011 — parcours de bout en bout (Playwright, vrai Chromium) sur l'instance de test
 * (base barreau_pn_test). Aucun envoi réel : paiements en bac à sable, SMS en simulation, le test SMTP
 * n'est jamais déclenché. Les données créées portent le marqueur « E2E <horodatage> ».
 *
 *   1  Radiation décidée au module Discipline : /avocats -> /anciens-membres
 *   2  Fiche avocat : menu Actions, entrées, aucun « Radier », onglet Parcours
 *   3  Espace avocat : « Copier mon timbre » (image/png), téléchargements PNG et SVG
 *   4  QR d'un quitus décodé depuis la capture -> /v/... « Authentique », 320 px, sans JS
 *   5  Paramètres : 9 onglets, rôle Avocat, test de connexion en simulation
 *   6  Aucun débordement horizontal à 360 px sur les écrans modifiés
 */
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";

const MARQUE = `E2E ${Date.now()}`;
const MDP = "barreau";
const ANNEE = new Date().getFullYear();

// --- aides -------------------------------------------------------------------------------------------

type Session = { token: string; refreshToken: string };
const sessions = new Map<string, Session>();

/** Connexion par l'API, une fois par compte et par exécution (le limiteur de connexion est de 10 par 15 min). */
async function connecter(request: APIRequestContext, email: string): Promise<Session> {
  const connu = sessions.get(email);
  if (connu) return connu;
  const r = await request.post("/api/auth/login", { data: { email, password: MDP } });
  expect(r.status(), `connexion ${email}`).toBe(200);
  const s = (await r.json()) as Session;
  sessions.set(email, s);
  return s;
}

const SG = "sg@barreau-pn.cg";
const BATONNIER = "batonnier@barreau-pn.cg";
const TRESORIERE = "tresoriere@barreau-pn.cg";
const ADMIN = "admin@barreau-pn.cg";
const AVOCAT = "avocat.demo@demo.invalid";

const entete = (s: Session) => ({ Authorization: `Bearer ${s.token}` });

async function api<T = any>(request: APIRequestContext, email: string, methode: "get" | "post" | "put", url: string, data?: unknown, attendu = [200, 201]): Promise<T> {
  const s = await connecter(request, email);
  const r = await request[methode](url, { headers: entete(s), data });
  expect(attendu, `${methode.toUpperCase()} ${url} -> ${r.status()} ${await r.text()}`).toContain(r.status());
  return (await r.json().catch(() => ({}))) as T;
}

/** Ouvre la session dans le navigateur : jetons dans le localStorage avant le premier chargement. */
async function ouvrirSession(page: Page, request: APIRequestContext, email: string) {
  const s = await connecter(request, email);
  await page.addInitScript(({ t, r }) => {
    localStorage.setItem("bpn_token", t);
    localStorage.setItem("bpn_refresh", r);
  }, { t: s.token, r: s.refreshToken });
}

const creerAvocat = (request: APIRequestContext, suffixe: string) =>
  api<{ id: number; nom: string }>(request, SG, "post", "/api/membres", { nom: `${MARQUE} ${suffixe}`, qualite: "AVOCAT", statut: "INSCRIT" });

function decoderQr(png: Buffer): string | null {
  const { width, height, data } = PNG.sync.read(png);
  return jsQR(new Uint8ClampedArray(data), width, height)?.data ?? null;
}

// --- 1 : radiation au module Discipline ---------------------------------------------------------------

test("1. Radiation décidée en Discipline : sort de /avocats et du tableau, entre dans /anciens-membres", async ({ page, request }) => {
  // Effet « à l'enregistrement » pour que la décision s'applique tout de suite ; réglage rétabli en fin de parcours.
  const params = await api<{ regles: Record<string, unknown> }>(request, BATONNIER, "get", "/api/parametres");
  const effetInitial = params.regles.effetRadiation;
  if (effetInitial !== "ENREGISTREMENT") await api(request, BATONNIER, "put", "/api/parametres", { regles: { ...params.regles, effetRadiation: "ENREGISTREMENT" } });
  try {
    const m = await creerAvocat(request, "Radie");
    const d = await api<{ id: number }>(request, SG, "post", "/api/discipline", { avocatNom: m.nom, objet: "Manquement grave (parcours E2E)", membreId: m.id });

    // Avant : visible dans la liste des inscrits et au tableau.
    await ouvrirSession(page, request, SG);
    await page.goto(`/avocats?q=${encodeURIComponent(MARQUE)}`);
    await expect(page.getByText(m.nom).first()).toBeVisible();
    const tableauAvant = JSON.stringify(await api(request, SG, "get", "/api/tableau"));
    expect(tableauAvant).toContain(m.nom);

    // La décision se saisit au module Discipline, par le Bâtonnier, depuis le dossier.
    const page2 = await page.context().newPage();
    await ouvrirSession(page2, request, BATONNIER);
    await page2.goto(`/discipline/${d.id}`);
    await page2.getByRole("tab", { name: /Instruction/ }).click();
    await page2.locator("select.bpn-input", { has: page2.locator("option[value=RADIATION]") }).selectOption("RADIATION");
    await page2.getByLabel(/^Motivation/).fill("Décision du conseil de discipline saisie par le parcours E2E.");
    await page2.getByRole("button", { name: "Enregistrer la décision" }).click();
    await page2.getByRole("dialog").getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page2.getByText("Décision enregistrée.")).toBeVisible();

    // Après : plus dans « Avocats inscrits », plus au tableau, présent dans « Anciens membres ».
    await page.goto(`/avocats?q=${encodeURIComponent(MARQUE)}`);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(m.nom)).toHaveCount(0);
    expect(JSON.stringify(await api(request, SG, "get", "/api/tableau"))).not.toContain(m.nom);

    await page.goto(`/anciens-membres?q=${encodeURIComponent(MARQUE)}`);
    const ligne = page.getByRole("row", { name: new RegExp(m.nom) });
    await expect(ligne).toBeVisible();
    // R-62 : le SG a la permission discipline ? Sinon le motif s'affiche « Sortie du tableau ».
    await expect(ligne).toContainText(/Radiation|Sortie du tableau/);

    // La radiation est répercutée sur la fiche : événement au Parcours.
    await page.goto(`/avocats/${m.id}`);
    await page.getByRole("tab", { name: "Parcours" }).click();
    await expect(page.getByRole("tabpanel")).toContainText(/Radi/);
  } finally {
    if (effetInitial !== "ENREGISTREMENT") {
      const p = await api<{ regles: Record<string, unknown> }>(request, BATONNIER, "get", "/api/parametres");
      await api(request, BATONNIER, "put", "/api/parametres", { regles: { ...p.regles, effetRadiation: effetInitial } });
    }
  }
});

// --- 2 : fiche avocat ---------------------------------------------------------------------------------

test("2. Fiche avocat : menu Actions, six entrées, aucun Radier, onglet Parcours", async ({ page, request }) => {
  const m = await creerAvocat(request, "Fiche");
  await ouvrirSession(page, request, ADMIN);
  await page.goto(`/avocats/${m.id}`);
  await expect(page.getByRole("heading", { name: new RegExp(m.nom) })).toBeVisible();

  // Boutons-icônes directs avec info-bulle et libellé accessible.
  await expect(page.getByRole("button", { name: "Modifier la fiche" })).toHaveAttribute("title", "Modifier la fiche");

  const actions = page.getByRole("button", { name: "Actions" });
  await expect(actions).toHaveAttribute("aria-haspopup", "menu");
  await actions.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  for (const nom of ["Contacter", "Modifier", "Accès espace", "Attestation", "Déclarer le décès", "Supprimer"]) {
    await expect(menu.getByRole("menuitem", { name: nom })).toBeVisible();
  }
  await expect(page.getByText(/Radier/)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(actions).toBeFocused();

  // Onglet « Parcours » (et non « Situation »), phrase d'explication, aucun bouton d'action dedans.
  await expect(page.getByRole("tab", { name: "Situation" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Parcours" }).click();
  const panneau = page.getByRole("tabpanel");
  await expect(panneau).toContainText("Historique daté de chaque changement de situation");
  await expect(panneau.getByRole("button")).toHaveCount(0);
  await expect(page.getByText(/Radier/)).toHaveCount(0);
});

// --- 3 : espace avocat, timbre ------------------------------------------------------------------------

test("3. Espace avocat : Copier mon timbre (image/png dans le presse-papiers), téléchargements PNG et SVG", async ({ browser, request }) => {
  const ctx = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"], acceptDownloads: true });
  const page = await ctx.newPage();
  try {
    await ouvrirSession(page, request, AVOCAT);
    await page.goto("/timbres");
    await page.getByLabel("Affaire").fill(`${MARQUE} c/ Société Test`);
    await page.getByLabel("Juridiction").fill("TGI de Pointe-Noire");
    await page.getByRole("button", { name: /Payer & émettre/ }).click();
    const copier = page.getByRole("button", { name: "Copier mon timbre" });
    await expect(copier).toBeVisible();
    const lien = await page.getByRole("link", { name: /Vérifier/ }).first().getAttribute("href");
    expect(lien).toMatch(/^\/v\/t\//);

    // Copie : le presse-papiers contient une image PNG d'au moins 1200 px, QR lisible = URL signée du timbre.
    await copier.click();
    await expect(page.getByText(/copié|presse-papiers/i).first()).toBeVisible();
    const lu = await page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      const types = items.flatMap((i) => [...i.types]);
      const blob = await items[0].getType("image/png");
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (const b of buf) bin += String.fromCharCode(b);
      return { types, base64: btoa(bin) };
    });
    expect(lu.types).toContain("image/png");
    const png = Buffer.from(lu.base64, "base64");
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(PNG.sync.read(png).width).toBeGreaterThanOrEqual(1200);
    expect(decoderQr(png)).toContain(lien!);

    // Téléchargement PNG.
    const [dlPng] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Télécharger PNG" }).click()]);
    expect(dlPng.suggestedFilename()).toMatch(/^Timbre-.*\.png$/);
    const fichierPng = (await dlPng.createReadStream().then(async (s) => { const c: Buffer[] = []; for await (const x of s) c.push(x as Buffer); return Buffer.concat(c); }));
    expect(PNG.sync.read(fichierPng).width).toBeGreaterThanOrEqual(1200);
    expect(decoderQr(fichierPng)).toContain(lien!);

    // Téléchargement SVG : vectoriel, sans foreignObject, QR décodable après rastérisation.
    const [dlSvg] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Télécharger SVG" }).click()]);
    expect(dlSvg.suggestedFilename()).toMatch(/^Timbre-.*\.svg$/);
    const svg = (await dlSvg.createReadStream().then(async (s) => { const c: Buffer[] = []; for await (const x of s) c.push(x as Buffer); return Buffer.concat(c).toString("utf8"); }));
    expect(svg).toMatch(/<svg[\s>]/);
    expect(svg).not.toContain("foreignObject");
    const rast = await ctx.newPage();
    await rast.setViewportSize({ width: 1400, height: 1000 });
    await rast.setContent(`<body style="margin:0;background:#fff"><img id="s" style="width:1200px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"></body>`);
    const capture = await rast.locator("#s").screenshot();
    expect(decoderQr(capture)).toContain(lien!);
  } finally {
    await ctx.close();
  }
});

// --- 4 : QR d'un quitus -> page publique /v ---------------------------------------------------------------

test("4. QR d'un quitus : décodé depuis la capture, ouvre /v/... « Authentique » à 320 px sans JavaScript", async ({ browser, request }) => {
  const m = await creerAvocat(request, "Quitus");
  await api(request, SG, "post", "/api/cotisations/paiement", { membreId: m.id, annee: ANNEE, montant: 150000, mode: "Espèces" });
  await api(request, TRESORIERE, "post", `/api/cotisations/${m.id}/valider`, { annee: ANNEE });

  // Génération depuis l'écran Quitus ; capture à fort grossissement du QR affiché dans l'aperçu.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 3, acceptDownloads: true });
  const page = await ctx.newPage();
  let numero = "", url = "";
  try {
    await ouvrirSession(page, request, SG);
    await page.goto("/quitus");
    const select = page.locator("select").filter({ hasText: m.nom });
    await expect(select).toBeVisible();
    await select.selectOption({ label: (await select.locator("option", { hasText: m.nom }).textContent())!.trim() });
    await page.getByRole("button", { name: /Générer & archiver/ }).click();
    await expect(page.getByText(/Q-\d{4}-\d+/).first()).toBeVisible();
    numero = (await page.locator('input[readonly]').first().inputValue()).trim();
    await expect.poll(async () => (await page.locator('a[href^="/v/q/"]').count()), { timeout: 20_000 }).toBeGreaterThan(0);
    const qr = page.locator('img[alt="QR code de vérification"]').first();
    await qr.scrollIntoViewIfNeeded();
    const decode = decoderQr(await qr.screenshot());
    expect(decode, "le QR de la capture est lisible").not.toBeNull();
    url = decode!;
  } finally {
    await ctx.close();
  }
  const chemin = new URL(url).pathname;
  expect(chemin).toMatch(/^\/v\/q\/[A-Z0-9-]+\.[0-9A-Z]{10}$/);
  expect(url.length).toBeLessThanOrEqual(62);
  expect(chemin).toContain(`/${numero}.`);

  // Téléphone de base : 320 px, JavaScript désactivé.
  const mobile = await browser.newContext({ viewport: { width: 320, height: 640 }, javaScriptEnabled: false });
  try {
    const p = await mobile.newPage();
    const rep = await p.goto(chemin);
    expect(rep!.status()).toBe(200);
    const html = await rep!.text();
    expect(html).not.toMatch(/<script/i);
    expect(html.length).toBeLessThan(100_000);
    await expect(p.locator("body")).toContainText("Authentique");
    await expect(p.locator("body")).toContainText(numero);
    await expect(p.locator("body")).toContainText(m.nom.toUpperCase().split(" ")[0]);
    expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

    // Jeton altéré d'un caractère : « Non reconnu », aucune donnée.
    const altere = chemin.slice(0, -1) + (chemin.endsWith("0") ? "1" : "0");
    const rep2 = await p.goto(altere);
    expect(rep2!.status()).toBe(404);
    const html2 = await rep2!.text();
    expect(html2).toContain("Non reconnu");
    expect(html2).not.toContain(numero);
  } finally {
    await mobile.close();
  }
});

// --- 5 : Paramètres -----------------------------------------------------------------------------------

test("5. Paramètres : 9 onglets, rôle Avocat, test de connexion en simulation", async ({ page, request }) => {
  await ouvrirSession(page, request, SG);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/parametres");
  const attendus = ["Barreau et identité", "Règles juridiques", "Tarifs et exercices", "Rôles et sécurité", "Paiements", "Notifications", "Messagerie", "Modules", "Documents"];
  const onglets = page.getByRole("tablist").first().getByRole("tab");
  await expect(onglets.first()).toBeVisible();
  const noms = (await onglets.allTextContents()).map((t) => t.trim().replace(/\d+$/, "").trim());
  expect(noms).toEqual(attendus);

  await page.getByRole("tab", { name: /Rôles et sécurité/ }).click();
  const panneau = page.getByRole("tabpanel");
  await expect(panneau.getByText("Avocat", { exact: true }).first()).toBeVisible();
  await expect(panneau).toContainText("Espace cloisonné");

  // Test de connexion SMS : simulation, aucun appel externe (le test SMTP n'est jamais lancé).
  await page.getByRole("tab", { name: /Notifications/ }).click();
  const test = page.getByRole("button", { name: "Tester la connexion" }).last();
  await expect(test).toBeEnabled();
  const [reponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/parametres/tester/sms")),
    test.click(),
  ]);
  expect(reponse.status()).toBe(200);
  expect((await reponse.json()).simulation).toBe(true);
  await expect(page.getByRole("status").filter({ hasText: /simulation/i })).toBeVisible();
});

// --- 6 : pas de débordement à 360 px ------------------------------------------------------------------

test("6. Aucun débordement horizontal à 360 px sur les écrans modifiés", async ({ browser, request }) => {
  const m = await creerAvocat(request, "Mobile");
  const ecransSg = ["/", "/corps-electoral", "/avocats", "/anciens-membres", `/avocats/${m.id}`, "/quitus", "/recus", "/timbres", "/parametres", "/discipline"];
  const echecs: string[] = [];
  const mesurer = async (email: string, chemins: string[]) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    try {
      await ouvrirSession(page, request, email);
      for (const c of chemins) {
        await page.goto(c);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("main, #root").first()).toBeVisible();
        const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
        if (sw > iw) echecs.push(`${email} ${c} : scrollWidth ${sw} > ${iw}`);
      }
    } finally {
      await ctx.close();
    }
  };
  await mesurer(SG, ecransSg);
  await mesurer(AVOCAT, ["/timbres"]);
  expect(echecs).toEqual([]);
});
