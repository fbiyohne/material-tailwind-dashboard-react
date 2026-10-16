/**
 * M-20261016 (T14) — parcours de bout en bout (Playwright, vrai Chromium) sur l'instance de test
 * (base barreau_pn_test). Aucun envoi réel. Les réponses /api/espace/* du test 3 sont simulées avec
 * page.route : aucune écriture en base hors compte CONSULTATION de test (créé une fois, marque E2E).
 *
 *   1  CA1  Paramètres : onglets collants à 1280 et 360 px, puis AvocatDetail
 *   2  CA7  Impression A4 de l'Annuaire (page.pdf en média print) et export jsPDF de la liste
 *   3       Espace avocat : affichages de T13, accès aux objets d'un autre membre refusé
 *   4       Trésorière et Consultation : menus conformes à la matrice, message neutre sur 403
 *
 * Captures et PDF : docs/captures/m20261016/apres/.
 */
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const APRES = resolve(process.cwd(), "../docs/captures/m20261016/apres");
mkdirSync(APRES, { recursive: true });

const MDP = "barreau";
const MDP_CONSULTATION = "barreau-e2e-2026"; // le compte créé par le test exige 8 caractères
const SG = "sg@barreau-pn.cg";
const ADMIN = "admin@barreau-pn.cg";
const TRESORIERE = "tresoriere@barreau-pn.cg";
const AVOCAT = "avocat.demo@demo.invalid";
const CONSULTATION = "consultation.e2e@demo.invalid";
const REFUS = "Vous n'avez pas les droits nécessaires pour accéder à cette ressource.";

// --- aides -------------------------------------------------------------------------------------------

type Session = { token: string; refreshToken: string };
const sessions = new Map<string, Session>();

/** Une connexion par compte et par exécution (limiteur de connexion : 10 par 15 min). */
async function connecter(request: APIRequestContext, email: string): Promise<Session> {
  const connu = sessions.get(email);
  if (connu) return connu;
  const r = await request.post("/api/auth/login", { data: { email, password: email === CONSULTATION ? MDP_CONSULTATION : MDP } });
  expect(r.status(), `connexion ${email}`).toBe(200);
  const s = (await r.json()) as Session;
  sessions.set(email, s);
  return s;
}

async function get(request: APIRequestContext, email: string, url: string) {
  const s = await connecter(request, email);
  return request.get(url, { headers: { Authorization: `Bearer ${s.token}` } });
}

async function ouvrirSession(page: Page, request: APIRequestContext, email: string) {
  const s = await connecter(request, email);
  await page.addInitScript(({ t, r }) => {
    localStorage.setItem("bpn_token", t);
    localStorage.setItem("bpn_refresh", r);
  }, { t: s.token, r: s.refreshToken });
}

/** Rend un PDF en texte et en tailles de pages (PyMuPDF, comme le contrôle T6). */
function analyserPdf(fichier: string): { pages: { l: number; h: number; texte: string }[] } {
  const code = "import sys,json,pymupdf;d=pymupdf.open(sys.argv[1]);print(json.dumps({'pages':[{'l':p.rect.width,'h':p.rect.height,'texte':p.get_text()} for p in d]}))";
  return JSON.parse(execFileSync("python", ["-I", "-c", code, fichier], { encoding: "utf8", maxBuffer: 64e6 }));
}

const proche = (a: number, b: number) => Math.abs(a - b) <= 1;

const debordement = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Bas de la Topbar collante (0 si absente). */
const basTopbar = (page: Page) => page.evaluate(() => document.querySelector("header")?.getBoundingClientRect().bottom ?? 0);

// --- 1 : CA1 onglets collants ------------------------------------------------------------------------

for (const [nom, largeur, hauteur] of [["1280", 1280, 800], ["360", 360, 740]] as const) {
  test(`1. Paramètres : la barre d'onglets reste visible pendant le défilement (${nom} px)`, async ({ page, request }) => {
    await ouvrirSession(page, request, ADMIN);
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.goto("/parametres");
    const tablist = page.getByRole("tablist").first();
    await expect(tablist).toBeVisible();
    await page.waitForLoadState("networkidle");
    // Capture du haut de page, comparable à la capture « avant ».
    const haut = `${APRES}/parametres-${nom}.png`;
    await page.screenshot({ path: haut });

    // Panneau le plus long : celui qui donne la plus grande hauteur de document.
    const onglets = tablist.getByRole("tab");
    const n = await onglets.count();
    expect(n).toBeGreaterThanOrEqual(9);
    let plusLong = 0, hMax = 0;
    for (let i = 0; i < n; i++) {
      await onglets.nth(i).click();
      await page.waitForLoadState("networkidle");
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      if (h > hMax) { hMax = h; plusLong = i; }
    }
    await onglets.nth(plusLong).click();
    await page.waitForLoadState("networkidle");
    expect(hMax, "le panneau le plus long doit dépasser la fenêtre pour prouver le défilement").toBeGreaterThan(hauteur);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const topbar = await basTopbar(page);
    const r = await tablist.evaluate((el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; });
    // Au bas du défilement : le tablist est entièrement dans la fenêtre, sous la Topbar.
    expect(r.top, "haut du tablist >= bas de la Topbar").toBeGreaterThanOrEqual(topbar - 1);
    expect(r.bottom).toBeLessThanOrEqual(hauteur + 1);
    await page.screenshot({ path: `${APRES}/parametres-defile-${nom}.png` });

    // Un clic sur un autre onglet (visible sans remonter) change le panneau.
    const autre = (plusLong + 1) % n;
    const avant = await page.getByRole("tabpanel").getAttribute("id");
    await onglets.nth(autre).click();
    await expect(onglets.nth(autre)).toHaveAttribute("aria-selected", "true");
    expect(await page.getByRole("tabpanel").getAttribute("id")).not.toBe(avant);

    // Remontée : le premier titre du panneau n'est recouvert ni par la barre ni par la Topbar.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const libre = await page.getByRole("tabpanel").evaluate((p) => {
      const t = p.querySelector("h1,h2,h3,h4,label,p,button") as HTMLElement | null;
      if (!t) return { trouve: false, ok: false };
      const b = t.getBoundingClientRect();
      const e = document.elementFromPoint(b.left + Math.min(b.width, 40) / 2, b.top + Math.min(b.height, 20) / 2);
      return { trouve: true, ok: !!e && (p.contains(e) || e === p) };
    });
    expect(libre.trouve).toBe(true);
    expect(libre.ok, "elementFromPoint au premier élément du panneau renvoie le panneau").toBe(true);

    expect(await debordement(page), "pas de défilement horizontal de la page").toBeLessThanOrEqual(0);

  });
}

for (const [nom, largeur, hauteur] of [["1280", 1280, 800], ["360", 360, 740]] as const) {
  test(`1b. Fiche avocat (autre page à onglets) : barre collante (${nom} px)`, async ({ page, request }) => {
    await ouvrirSession(page, request, ADMIN);
    await page.setViewportSize({ width: largeur, height: hauteur });
    const liste = await (await get(request, SG, "/api/membres")).json();
    const id = (Array.isArray(liste) ? liste : liste.items ?? liste.data)[0].id;
    await page.goto(`/avocats/${id}`);
    const tablist = page.getByRole("tablist").first();
    await expect(tablist).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const topbar = await basTopbar(page);
    const r = await tablist.evaluate((el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; });
    expect(r.top).toBeGreaterThanOrEqual(topbar - 1);
    expect(r.bottom).toBeLessThanOrEqual(hauteur + 1);
    const onglets = tablist.getByRole("tab");
    const suivant = onglets.nth(1);
    await suivant.click();
    await expect(suivant).toHaveAttribute("aria-selected", "true");
    await page.screenshot({ path: `${APRES}/avocat-detail-${nom}.png` });
    if (largeur === 360) expect(await debordement(page)).toBeLessThanOrEqual(0);
  });
}

// --- 2 : CA7 impression A4 et jsPDF ------------------------------------------------------------------

test("2a. Annuaire : impression en A4 avec pied paginé (média print)", async ({ page, request }) => {
  await ouvrirSession(page, request, SG);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/annuaire");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /Annuaire/ }).first()).toBeVisible();
  await page.emulateMedia({ media: "print" });
  const fichier = `${APRES}/annuaire-impression.pdf`;
  await page.pdf({ path: fichier, preferCSSPageSize: true });
  const pdf = analyserPdf(fichier);
  expect(pdf.pages.length).toBeGreaterThanOrEqual(1);
  for (const p of pdf.pages) {
    expect(proche(p.l, 595) && proche(p.h, 842), `page ${p.l}x${p.h} pt`).toBe(true);
  }
  expect(pdf.pages.map((p) => p.texte).join("\n")).toMatch(/Page 1\s*\/\s*\d+/);
});

test("2b. Liste des avocats : export jsPDF (repli) en A4 avec pied paginé", async ({ page, request }) => {
  await ouvrirSession(page, request, SG);
  await page.setViewportSize({ width: 1280, height: 900 });
  // Le PDF serveur est refusé pour forcer le repli navigateur (jsPDF), sans effet en base.
  await page.route("**/api/membres/export/pdf**", (r) => r.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
  await page.goto("/avocats");
  await page.waitForLoadState("networkidle");
  await page.locator("summary", { hasText: "Exporter" }).first().click();
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name: /PDF/ }).first().click(),
  ]);
  const fichier = `${APRES}/avocats-jspdf.pdf`;
  await dl.saveAs(fichier);
  const pdf = analyserPdf(fichier);
  for (const p of pdf.pages) expect(proche(p.l, 595) && proche(p.h, 842), `page ${p.l}x${p.h} pt`).toBe(true);
  const texte = pdf.pages.map((p) => p.texte).join("\n");
  expect(texte).toMatch(/Page 1\s*\/\s*\d+/);
  expect(texte).toContain("diffusion restreinte");
});

// --- 3 : espace avocat -------------------------------------------------------------------------------

const json = (corps: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });

test("3a. Espace avocat : statut, recouvrement, parcours, stage, quitus, timbre utilisé, discipline, scrutin", async ({ page, request }) => {
  await ouvrirSession(page, request, AVOCAT);
  // Aucune écriture : seules les lectures sont simulées (textes longs, cas limites).
  await page.route(/\/api\/espace\/moi$/, async (route) => {
    const reel = await (await route.fetch()).json();
    await route.fulfill(json({
      ...reel,
      membre: { ...reel.membre, statut: "suspendu", qualite: "stagiaire" },
      recouvrement: { type: "MISE_EN_DEMEURE", dateEffet: "2026-09-02" },
      situation: { ...reel.situation, cotisation: { du: 50000, paye: 0, solde: 50000, statut: "impaye", valideTresoriere: false } },
    }));
  });
  await page.route(/\/api\/espace\/parcours$/, (r) => r.fulfill(json({
    evenements: [{ id: 1, type: "MISE_EN_DEMEURE", dateEffet: "2026-09-02", reference: "MD-E2E-1", motif: null }],
    stage: { dateServment: "2025-01-10", dureeMois: 36, maitreStage: "Me Okemba E2E", finPrevue: "2028-01-10", stageValideAt: null },
  })));
  await page.route(/\/api\/espace\/documents$/, (r) => r.fulfill(json({
    recus: [{ id: 1, numero: "R-E2E-1", montant: 1000, annee: 2025, date: "2025-02-01", verif: "http://localhost/v/r/R-E2E-1.t" }],
    quitus: [{ id: 1, numero: "Q-E2E-1", annee: 2025, date: "2025-02-01", finValidite: "2025-12-31", verif: "http://localhost/v/q/Q-E2E-1.t" }],
  })));
  await page.route(/\/api\/espace\/pieces$/, (r) => r.fulfill(json([{ id: 3, type: "IDENTITE", nomFichier: "cni.pdf", statut: "REJETEE", note: "Illisible E2E", createdAt: "2026-10-01" }])));
  const t = (id: number, statut: string) => ({ id, numero: id, code: `c${id}`, affaire: `Affaire E2E ${id}`, statut, createdAt: "2026-10-01", membre: { nom: "Demo" } });
  await page.route(/\/api\/espace\/timbres$/, (r) => r.request().method() === "GET" ? r.fulfill(json({ montant: 15000, timbres: [t(1, "UTILISE"), t(2, "VALIDE")] })) : r.continue());
  await page.route(/\/api\/espace\/discipline$/, (r) => r.fulfill(json([{ id: 2, reference: "D-E2E-2", objet: "Objet", statut: "ouvert", dateSaisine: "2026-01-01" }])));
  await page.route(/\/api\/espace\/scrutins$/, (r) => r.fulfill(json([{ id: 1, titre: "Conseil E2E", type: "CONSEIL", statut: "OUVERT", nbSieges: 2, dateScrutin: "2026-11-05", aDejaVote: false, eligible: true, candidats: [] }])));
  let utilise = 0;
  await page.route(/\/api\/espace\/timbres\/\d+\/utilise$/, (r) => { utilise++; return r.fulfill(json({ ok: true })); });

  for (const [nom, l, h] of [["1280", 1280, 800], ["360", 360, 740]] as const) {
    await page.setViewportSize({ width: l, height: h });

    await page.goto("/");
    await expect(page.getByText("Suspendu").first()).toBeVisible();
    await expect(page.getByText(/Mise en demeure du .* pour l'exercice/)).toBeVisible();
    await expect(page.getByText("Mon parcours")).toBeVisible();
    await expect(page.getByText("MD-E2E-1")).toBeVisible();
    await expect(page.getByText("Mon stage")).toBeVisible();
    await expect(page.getByText("Me Okemba E2E")).toBeVisible();
    await page.screenshot({ path: `${APRES}/espace-avocat-situation-${nom}.png`, fullPage: true });
    expect(await debordement(page), `situation ${nom}`).toBeLessThanOrEqual(0);

    await page.goto("/documents");
    await expect(page.getByText(/Valable jusqu'au/)).toBeVisible();
    await expect(page.getByText("Expiré")).toBeVisible();
    await expect(page.getByRole("link", { name: /Vérifier/ }).first()).toBeVisible();
    await page.screenshot({ path: `${APRES}/espace-avocat-documents-${nom}.png`, fullPage: true });
    expect(await debordement(page), `documents ${nom}`).toBeLessThanOrEqual(0);
    await page.getByRole("tab", { name: /Pièces justificatives/ }).click();
    await expect(page.getByText(/Motif : Illisible E2E/)).toBeVisible();
    await page.screenshot({ path: `${APRES}/espace-avocat-pieces-${nom}.png`, fullPage: true });

    await page.goto("/timbres");
    await expect(page.getByText("Utilisé", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Marquer utilisé" })).toHaveCount(1);
    await page.getByRole("button", { name: "Marquer utilisé" }).click();
    await expect(page.getByText(/définitive/)).toBeVisible();
    await page.screenshot({ path: `${APRES}/espace-avocat-timbres-${nom}.png`, fullPage: true });
    await page.getByRole("button", { name: "Annuler" }).click();
    expect(await debordement(page), `timbres ${nom}`).toBeLessThanOrEqual(0);

    await page.goto("/discipline");
    await expect(page.getByText(/Décision en attente de notification/)).toBeVisible();
    await page.screenshot({ path: `${APRES}/espace-avocat-discipline-${nom}.png`, fullPage: true });
    expect(await debordement(page), `discipline ${nom}`).toBeLessThanOrEqual(0);

    await page.goto("/elections");
    await expect(page.getByText(/Scrutin du/)).toBeVisible();
    await page.screenshot({ path: `${APRES}/espace-avocat-elections-${nom}.png`, fullPage: true });
    expect(await debordement(page), `elections ${nom}`).toBeLessThanOrEqual(0);
  }
  expect(utilise, "le refus de la confirmation n'appelle jamais le serveur").toBe(0);
});

test("3b. Espace avocat : l'objet d'un autre membre est refusé (403 ou 404)", async ({ request }) => {
  const moi = await (await get(request, AVOCAT, "/api/espace/moi")).json();
  const liste = async (url: string) => {
    const r = await get(request, SG, url);
    if (r.status() !== 200) return [] as any[];
    const c = await r.json();
    return (Array.isArray(c) ? c : c.items ?? c.data ?? []) as any[];
  };
  const autre = (rows: any[]) => rows.find((x) => (x.membreId ?? x.membre?.id) !== moi.membre.id && (x.membreId ?? x.membre?.id) != null);
  const cas: [string, string, any][] = [
    ["GET", "recus", autre(await liste("/api/recus"))],
    ["GET", "quitus", autre(await liste("/api/quitus"))],
    ["POST", "timbres", autre(await liste("/api/timbres"))],
    ["GET", "discipline", autre(await liste("/api/discipline"))],
  ];
  const s = await connecter(request, AVOCAT);
  const h = { Authorization: `Bearer ${s.token}` };
  let verifies = 0;
  for (const [methode, ressource, o] of cas) {
    if (!o) continue; // aucune donnée d'un autre membre pour cette ressource dans la base de test
    const chemin = ressource === "recus" || ressource === "quitus" ? `/api/espace/${ressource}/${o.id}/pdf`
      : ressource === "timbres" ? `/api/espace/timbres/${o.id}/utilise` : `/api/espace/discipline/${o.id}`;
    const r = methode === "POST" ? await request.post(chemin, { headers: h }) : await request.get(chemin, { headers: h });
    expect([403, 404], `${methode} ${chemin} -> ${r.status()}`).toContain(r.status());
    verifies++;
  }
  expect(verifies, "au moins une ressource d'un autre membre a été testée").toBeGreaterThan(0);
  // Un id inexistant ou étranger ne divulgue rien : même famille de réponse.
  const r = await request.get("/api/espace/pieces/99999999/fichier", { headers: h });
  expect([403, 404]).toContain(r.status());
});

// --- 4 : droits par rôle -----------------------------------------------------------------------------

async function liensMenu(page: Page): Promise<string[]> {
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav).toBeVisible();
  return (await nav.getByRole("link").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
}

test("4a. Trésorière : menu conforme à la matrice, message neutre sur 403", async ({ page, request }) => {
  await ouvrirSession(page, request, TRESORIERE);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const liens = await liensMenu(page);
  console.log("Menu Trésorière :", liens.join(" | "));
  for (const l of ["Cotisations", "Quitus", "Messagerie"]) expect(liens.some((x) => x.startsWith(l)), l).toBe(true);
  for (const l of ["Discipline", "Avocats inscrits", "Paramètres", "Utilisateurs"]) expect(liens.some((x) => x.startsWith(l)), `absent : ${l}`).toBe(false);
  await page.screenshot({ path: `${APRES}/role-tresoriere-menu-1280.png` });

  // Le serveur refuse, avec le texte neutre (aucune indication sur l'existence d'un dossier).
  const r = await get(request, TRESORIERE, "/api/discipline");
  expect(r.status()).toBe(403);
  expect(JSON.stringify(await r.json())).toContain(REFUS);
  // L'accès direct à l'URL n'affiche aucun dossier disciplinaire.
  await page.goto("/discipline");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
  await expect(page.getByText(/Dossiers? disciplinaires?/i)).toHaveCount(0);
});

test("4b. Consultation : lecture seule, menu conforme à la matrice, message neutre sur 403", async ({ page, request }) => {
  // Compte de test créé une fois (marque E2E) par le SG ; 409 si déjà présent.
  const s = await connecter(request, SG);
  const c = await request.post("/api/users", { headers: { Authorization: `Bearer ${s.token}` }, data: { nom: "E2E Consultation", email: CONSULTATION, role: "CONSULTATION", password: MDP_CONSULTATION } });
  expect([201, 409]).toContain(c.status());
  await ouvrirSession(page, request, CONSULTATION);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const liens = await liensMenu(page);
  console.log("Menu Consultation :", liens.join(" | "));
  for (const l of ["Avocats inscrits"]) expect(liens.some((x) => x.startsWith(l)), l).toBe(true);
  for (const l of ["Cotisations", "Quitus", "Discipline", "Messagerie", "Paramètres"]) expect(liens.some((x) => x.startsWith(l)), `absent : ${l}`).toBe(false);
  await page.screenshot({ path: `${APRES}/role-consultation-menu-1280.png` });

  for (const url of ["/api/discipline", "/api/cotisations", "/api/messagerie"]) {
    const r = await get(request, CONSULTATION, url);
    expect(r.status(), url).toBe(403);
    expect(JSON.stringify(await r.json()), url).toContain(REFUS);
  }
  // Écriture refusée : lecture seule.
  const w = await request.post("/api/users", { headers: { Authorization: `Bearer ${(await connecter(request, CONSULTATION)).token}` }, data: {} });
  expect(w.status()).toBe(403);
});
