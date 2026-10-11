/**
 * Recette interface des 12 parcours du §5 (T29, CA5) et captures « après » (CA13).
 *
 *   cd server
 *   DATABASE_URL="<TEST_DATABASE_URL de server/.env>" npx tsx scripts/recette-ui.ts parcours
 *   DATABASE_URL="<TEST_DATABASE_URL de server/.env>" npx tsx scripts/recette-ui.ts apres
 *
 * Pilote un vrai Chromium (puppeteer-core, déjà dépendance du serveur pour les PDF) sur
 * l'instance http://localhost:4100 lancée par scripts/relancer-test.ps1. Chaque capture est
 * prise à 1280 × 900 puis à 360 × 780 ; à 360 px, la largeur défilable de la page
 * (document.scrollWidth) est relevée : au-delà de 360, la capture est signalée en échec.
 *
 * Garde-fou : refus si DATABASE_URL ne vise pas exactement barreau_pn_test.
 * Remise en état : les écritures faites en direct sur les membres DEMO (événements, dossiers,
 * fils, pièces, fiches) sont défaites en fin d'exécution, même en cas d'échec ; les membres
 * « RECETTE … » créés par l'admission directe sont supprimés. Restent, sans effet sur les
 * effectifs du jeu : lignes de JournalAudit (immuable), archives et notifications.
 * Aucun e-mail réel : MailHog du socle uniquement.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_AUTORISEE = "barreau_pn_test";
let nomBase = "";
try { nomBase = new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, ""); } catch { /* vide */ }
if (nomBase !== BASE_AUTORISEE) {
  console.error(`recette-ui : base « ${nomBase} » refusée, seule ${BASE_AUTORISEE} est autorisée.`);
  process.exit(1);
}
const mode = process.argv[2];
if (mode !== "parcours" && mode !== "apres") {
  console.error("recette-ui : préciser « parcours » ou « apres ».");
  process.exit(1);
}

const { prisma } = await import("../src/prisma.js");
const { trouverChromium } = await import("../src/lib/pdf.js");
const puppeteer = (await import("puppeteer-core")).default;

const URL_APP = process.env.RECETTE_URL ?? "http://localhost:4100";
const MDP = "barreau";
const COMPTES = {
  sg: "sg@barreau-pn.cg",
  batonnier: "batonnier@barreau-pn.cg",
  tresoriere: "tresoriere@barreau-pn.cg",
  admin: "admin@barreau-pn.cg",
  avocat: "avocat.demo@demo.invalid",
} as const;
const DOSSIER_CAPTURES = fileURLToPath(new URL("../../docs/captures/", import.meta.url));
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

// ─── Journal de recette ──────────────────────────────────────────────────────
type Capture = { fichier: string; scrollWidth360: number; ok: boolean };
const resultat = {
  mode, debut: new Date().toISOString(), url: URL_APP,
  captures: [] as Capture[],
  controles: [] as { parcours: string; controle: string; ok: boolean; detail?: string }[],
  pdf: [] as { url: string; statut: number; type: string; taille: number }[],
  erreursConsole: [] as string[],
  reponses5xx: [] as string[],
  reponses4xx: [] as string[], // refus attendus (403 du SG, /parametres pour un avocat) : à relire
};
function controle(parcours: string, libelle: string, ok: boolean, detail?: string) {
  resultat.controles.push({ parcours, controle: libelle, ok, detail });
  console.log(`${ok ? "OK " : "KO "} [${parcours}] ${libelle}${detail ? ` — ${detail}` : ""}`);
}

// ─── Aides navigateur ────────────────────────────────────────────────────────
type Page = any;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function stable(page: Page) {
  await page.waitForNetworkIdle({ idleTime: 400, timeout: 15000 }).catch(() => {});
  await pause(250);
}

function suivre(page: Page, nom: string) {
  // tsx (esbuild, keepNames) insère des appels __name() dans les fonctions passées à evaluate.
  page.evaluateOnNewDocument("window.__name = (f) => f;");
  page.on("console", (m: any) => { if (m.type() === "error") resultat.erreursConsole.push(`${nom}: ${m.text()}`); });
  page.on("pageerror", (e: Error) => resultat.erreursConsole.push(`${nom}: ${e.message}`));
  page.on("response", async (r: any) => {
    if (r.status() >= 500) resultat.reponses5xx.push(`${r.status()} ${r.request().method()} ${r.url()}`);
    else if (r.status() >= 400) resultat.reponses4xx.push(`${nom}: ${r.status()} ${r.request().method()} ${r.url().replace(URL_APP, "")}`);
    const type = r.headers()["content-type"] ?? "";
    if (type.includes("application/pdf") || /\/pdf(\?|$)/.test(r.url())) {
      const corps = await r.buffer().catch(() => null); // corps parfois non retenu par le navigateur : taille -1
      resultat.pdf.push({ url: r.url().replace(URL_APP, ""), statut: r.status(), type, taille: corps ? corps.length : -1 });
    }
  });
}

async function aller(page: Page, chemin: string) {
  await page.goto(URL_APP + chemin, { waitUntil: "domcontentloaded" });
  await stable(page);
}

async function connecter(page: Page, email: string) {
  await page.evaluate(() => localStorage.clear());
  await aller(page, "/");
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  for (const [sel, val] of [['input[type="email"]', email], ['input[type="password"]', MDP]]) {
    // Le champ peut être prérempli : valeur posée comme le ferait une saisie (événement input pour React).
    await page.$eval(sel, (e: HTMLInputElement, v: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(e, v);
      e.dispatchEvent(new Event("input", { bubbles: true }));
    }, val);
  }
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 20000 });
  await stable(page);
}

/** Une session (contexte de navigation isolé) par rôle : une seule connexion par compte et par exécution
 *  (le serveur limite à 10 connexions par 15 minutes : relancer l'instance avant une nouvelle exécution). */
const sessions: Record<string, Page> = {};
async function session(navigateur: any, role: keyof typeof COMPTES): Promise<Page> {
  if (sessions[role]) return sessions[role];
  const p = await (await navigateur.createBrowserContext()).newPage();
  suivre(p, role);
  await p.setViewport({ width: 1280, height: 900 });
  await aller(p, "/");
  await connecter(p, COMPTES[role]);
  return (sessions[role] = p);
}

/** Amène à l'écran l'élément qui contient `texte` (avant une capture). */
async function voir(page: Page, texte: string) {
  await page.evaluate((t: string) => [...document.querySelectorAll("button, h2, h3, label, p, div")].reverse().find((e) => (e as HTMLElement).innerText?.includes(t))?.scrollIntoView({ block: "center" }), texte);
  await pause(200);
}

/** Attend la réponse PDF dont l'URL vérifie `motif` (rendu serveur parfois lent). */
async function attendrePdf(motif: RegExp, delai = 45000) {
  for (const fin = Date.now() + delai; Date.now() < fin; await pause(500)) if (resultat.pdf.some((p) => motif.test(p.url) && p.statut === 200 && p.type.includes("pdf"))) return true;
  return false;
}

/** Le module discipline s'ouvre derrière un écran « consultation journalisée ». */
async function entrerDiscipline(page: Page) {
  if (await contient(page, "Entrer dans le module")) await clic(page, "Entrer dans le module");
}

async function attendreTexte(page: Page, texte: string, timeout = 15000) {
  await page.waitForFunction((t: string) => document.body.innerText.includes(t), { timeout }, texte);
}
const contient = (page: Page, texte: string): Promise<boolean> => page.evaluate((t: string) => document.body.innerText.includes(t), texte);

/** Clique l'élément interactif visible dont le texte contient `texte` (dans `portee`, ou la dernière boîte de dialogue si dialogue=true). */
async function clic(page: Page, texte: string, o: { dialogue?: boolean; dans?: string; exact?: boolean } = {}) {
  const h = await page.evaluateHandle((t: string, dialogue: boolean, dans: string | null, exact: boolean) => {
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    let racine: ParentNode = document;
    if (dialogue) racine = [...document.querySelectorAll('[role="dialog"]')].pop() ?? document;
    const els = [...racine.querySelectorAll('button, a, [role="tab"], [role="menuitem"], [role="option"], summary')] as HTMLElement[];
    const visibles = els.filter((e) => e.offsetParent !== null || e.getClientRects().length > 0);
    const cands = visibles.filter((e) => (exact ? norm(e.innerText) === t : norm(e.innerText).includes(t) || e.getAttribute("aria-label") === t));
    if (!dans) return cands[0] ?? null;
    // Le bouton le plus proche (en remontant le DOM) d'un texte contenant `dans` : la bonne ligne, pas la liste entière.
    const distance = (e: HTMLElement) => { let p: HTMLElement | null = e; for (let i = 0; i < 12 && p; i++, p = p.parentElement) if (p.innerText.includes(dans)) return i; return 99; };
    return cands.map((e) => [distance(e), e] as const).filter(([d]) => d < 99).sort((a, b) => a[0] - b[0])[0]?.[1] ?? null;
  }, texte, !!o.dialogue, o.dans ?? null, !!o.exact);
  const el = h.asElement();
  if (!el) {
    const dispo = await page.evaluate(() => [...document.querySelectorAll("button, a, [role=tab]")].map((e) => (e as HTMLElement).innerText.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 80).join(" | "));
    throw new Error(`Élément « ${texte} » introuvable. Disponibles : ${dispo}`);
  }
  await el.evaluate((e: HTMLElement) => e.scrollIntoView({ block: "center" }));
  if (await el.evaluate((e: HTMLButtonElement) => !!e.disabled)) throw new Error(`Bouton « ${texte} » désactivé (formulaire incomplet ?).`);
  await el.click();
  await stable(page);
}

/** Renseigne le champ dont le libellé commence par `libelle` (FormField, label, aria-label ou placeholder). */
async function remplir(page: Page, libelle: string, valeur: string | boolean, o: { dialogue?: boolean } = {}) {
  const ok = await page.evaluate((lib: string, v: string | boolean, dialogue: boolean) => {
    const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
    let racine: ParentNode = document;
    if (dialogue) racine = [...document.querySelectorAll('[role="dialog"]')].pop() ?? document;
    const n = norm(lib);
    let ctl: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null = racine.querySelector(`[aria-label="${lib}"]`);
    for (const e of [...racine.querySelectorAll("label, .bpn-label, span, div")] as HTMLElement[]) {
      if (ctl) break;
      const t = norm(e.innerText ?? "");
      if (!t.startsWith(n) || t.length > n.length + 60) continue;
      const lab = e.closest("label") as HTMLLabelElement | null;
      ctl = (lab?.control as never) ?? lab?.querySelector("input,select,textarea") ?? null;
      if (!ctl && e.tagName === "LABEL" && (e as HTMLLabelElement).htmlFor) ctl = document.getElementById((e as HTMLLabelElement).htmlFor) as never;
      for (let p = e.parentElement, i = 0; !ctl && p && i < 2; p = p.parentElement, i++) ctl = p.querySelector("input:not([type=hidden]):not([type=file]),select,textarea");
      if (ctl) break;
    }
    ctl ??= racine.querySelector(`[placeholder^="${lib}"]`);
    if (!ctl) return false;
    if (ctl instanceof HTMLInputElement && ctl.type === "checkbox") {
      if (ctl.checked !== v) ctl.click();
      return true;
    }
    let val = String(v);
    if (ctl instanceof HTMLSelectElement) {
      const opt = [...ctl.options].find((o) => o.value === val) ?? [...ctl.options].find((o) => o.text.includes(val));
      if (!opt) return false;
      val = opt.value;
    }
    const proto = ctl instanceof HTMLSelectElement ? HTMLSelectElement.prototype : ctl instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(ctl, val);
    ctl.dispatchEvent(new Event(ctl instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    ctl.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, libelle, valeur, !!o.dialogue);
  if (!ok) throw new Error(`Champ « ${libelle} » introuvable ou valeur « ${valeur} » absente.`);
  await pause(150);
}

async function deposerFichier(page: Page, selecteur: string, fichier: string) {
  const input = await page.waitForSelector(selecteur, { timeout: 10000 });
  await input.uploadFile(fichier);
  await stable(page);
}

/** Capture 1280 × 900 puis 360 × 780 ; relève la largeur défilable à 360 px. */
async function capture(page: Page, nom: string) {
  await page.setViewport({ width: 1280, height: 900 });
  await pause(400);
  await page.screenshot({ path: path.join(DOSSIER_CAPTURES, `${nom}-1280.png`) });
  await page.setViewport({ width: 360, height: 780 });
  await pause(600);
  const sw: number = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
  await page.screenshot({ path: path.join(DOSSIER_CAPTURES, `${nom}-360.png`) });
  resultat.captures.push({ fichier: nom, scrollWidth360: sw, ok: sw <= 360 });
  console.log(`   capture ${nom} (largeur à 360 px : ${sw})`);
  await page.setViewport({ width: 1280, height: 900 });
  await pause(300);
}

/** Appel d'API depuis la session du navigateur (jeton de l'utilisateur connecté). */
function api(page: Page, methode: string, chemin: string, corps?: unknown): Promise<number> {
  return page.evaluate(async (m: string, c: string, b: string | null) => {
    const r = await fetch(`/api${c}`, { method: m, headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("bpn_token")}` }, body: b ?? undefined });
    return r.status;
  }, methode, chemin, corps === undefined ? null : JSON.stringify(corps));
}

const idDe = async (num: number) => (await prisma.membre.findUniqueOrThrow({ where: { num }, select: { id: true } })).id;

// ─── Fichiers de test (fictifs) ──────────────────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "recette-ui-"));
const PDF_MIN = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";
const fichierPdf = (nom: string) => { const p = path.join(TMP, nom); fs.writeFileSync(p, PDF_MIN); return p; };
const SECRET = `RECETTE-SECRET-${Date.now()}`;

// ─── Parcours ────────────────────────────────────────────────────────────────
const NUM = { balandre: 800001, kemandre: 800002, solandre: 800006, balivor: 800011, balonde: 800021, balorin: 800061, kemorin: 800062 };

async function parcours(navigateur: any) {
  // 0 — Ouverture
  const accueil = await navigateur.newPage();
  await accueil.setViewport({ width: 1280, height: 900 });
  await aller(accueil, "/");
  await capture(accueil, "parcours-00-connexion");
  controle("0", "écran de connexion à l'identité paramétrée", await accueil.evaluate(() => document.body.innerText.includes("démonstration")));
  await accueil.close();
  let page = await session(navigateur, "sg");
  controle("0", "mention de démonstration visible après connexion", await contient(page, "Données entièrement fictives"));
  await capture(page, "parcours-00-accueil-sg");

  // 1 — Import avec erreurs et doublons, annulation avant confirmation (SG)
  const csv = path.join(TMP, "import-recette.csv");
  fs.writeFileSync(csv, "﻿num;nom;qualite;statut;sexe;cabinet;tel;email\n" +
    "790001;RECETTEIMPORT Lucie;avocat;inscrit;F;;;\n" +
    "790001;RECETTEIMPORT Lucie;avocat;inscrit;F;;;\n" +
    "800001;BALANDRE Aline;avocat;inscrit;F;;;\n" +
    "790002;RECETTEIMPORT Marc;avocat;statut-inconnu;H;;;\n");
  await aller(page, "/avocats");
  await clic(page, "Importer (Excel/CSV/TXT)");
  await deposerFichier(page, '[role="dialog"] input[type="file"]', csv);
  await page.waitForSelector('[data-testid="apercu-simulation"]', { timeout: 20000 });
  const apercu: string = await page.$eval('[data-testid="apercu-simulation"]', (e: HTMLElement) => e.innerText);
  controle("1", "aperçu simulé affiché avant toute écriture", apercu.length > 0, apercu.replace(/\s+/g, " ").slice(0, 200));
  await capture(page, "parcours-01-import-apercu");
  await clic(page, "Annuler l'aperçu", { dialogue: true });
  await capture(page, "parcours-01-import-annule");
  await clic(page, "Fermer", { dialogue: true });
  controle("1", "annulation : rien n'est écrit (num 790001 et 790002 absents)", (await prisma.membre.count({ where: { num: { in: [790001, 790002] } } })) === 0);

  // 6 (volet SG) — le SG ne peut pas valider un stage
  await aller(page, `/avocats/${await idDe(NUM.kemorin)}`);
  await clic(page, "Stage", { exact: true });
  controle("6", "SG : fin de stage réservée (mention affichée, pas de bouton)", await contient(page, "La fin de stage est enregistrée par le Bâtonnier national"));
  await capture(page, "parcours-06-sg-stage-reserve");
  controle("6", "SG : POST valider-stage refusé (403)", (await api(page, "POST", `/membres/${await idDe(NUM.kemorin)}/valider-stage`, {})) === 403);

  // 4 (volet SG) — rappel, mise en demeure, transmission horodatés
  await aller(page, `/avocats/${await idDe(NUM.balonde)}`);
  await clic(page, "Situation", { exact: true });
  for (const [bouton, date, ref] of [
    ["Enregistrer un rappel", "2026-06-01", "REC-RECETTE"],
    ["Enregistrer une mise en demeure", "2026-07-06", "MED-RECETTE"],
    ["Enregistrer la transmission", "2026-07-24", "TRA-RECETTE"],
  ]) {
    await clic(page, bouton);
    await remplir(page, "Date d'effet", date, { dialogue: true });
    await remplir(page, "Référence", ref, { dialogue: true });
    if (bouton.includes("rappel")) await capture(page, "parcours-04-rappel-modale");
    await clic(page, "Enregistrer", { dialogue: true, exact: true });
    await attendreTexte(page, ref);
  }
  controle("4", "trois étapes horodatées enregistrées par le SG", (await prisma.evenementSituation.count({ where: { membreId: await idDe(NUM.balonde), reference: { in: ["REC-RECETTE", "MED-RECETTE", "TRA-RECETTE"] } } })) === 3);
  await capture(page, "parcours-04-circuit-etapes");

  // 5 et 6 (volet SG) — saisine de deux dossiers, refus de la décision
  const dossiers: number[] = [];
  for (const [num, objet] of [[NUM.solandre, "Manquement fictif — recette (sursis)"], [NUM.balivor, "Manquement grave fictif — recette (radiation)"]] as const) {
    await aller(page, "/discipline");
    await entrerDiscipline(page);
    await clic(page, "Ouvrir un dossier");
    const nom = (await prisma.membre.findUniqueOrThrow({ where: { num } })).nom;
    await remplir(page, "Rechercher l'avocat", nom, { dialogue: true });
    await stable(page);
    await remplir(page, "Avocat mis en cause", `Me ${nom}`, { dialogue: true });
    await remplir(page, "Objet de la saisine", objet, { dialogue: true });
    if (num === NUM.solandre) await capture(page, "parcours-05-saisine-sg");
    await clic(page, "Ouvrir le dossier", { dialogue: true });
    const d = await prisma.dossierDisciplinaire.findFirstOrThrow({ where: { objet }, orderBy: { id: "desc" } });
    dossiers.push(d.id);
  }
  await aller(page, `/discipline/${dossiers[0]}`);
  await entrerDiscipline(page);
  await clic(page, "Instruction & décision");
  controle("6", "SG : formulaire de décision absent, enregistrement réservé au bâtonnier", !(await contient(page, "Enregistrer la décision")) && (await contient(page, "réservé au bâtonnier")));
  await voir(page, "réservé au bâtonnier");
  await capture(page, "parcours-06-sg-dossier-sans-decision");
  controle("6", "SG : POST /discipline/:id/decision refusé (403)", (await api(page, "POST", `/discipline/${dossiers[0]}/decision`, { sanctionCode: "AVERTISSEMENT", motivation: "Essai de refus du SG (recette)." })) === 403);
  await aller(page, "/parametres");
  await clic(page, "Rôles & sécurité");
  await capture(page, "parcours-06-matrice-actions");

  // 2, 3, 4, 5 — décisions enregistrées par le bâtonnier
  page = await session(navigateur, "batonnier");
  // 2 — stagiaire vers le tableau
  const balorin = await idDe(NUM.balorin);
  await aller(page, `/avocats/${balorin}`);
  await clic(page, "Stage", { exact: true });
  await clic(page, "Valider la fin de stage");
  await remplir(page, "Date de la décision", AUJOURDHUI, { dialogue: true });
  await capture(page, "parcours-02-fin-de-stage-modale");
  await clic(page, "Valider la fin de stage", { dialogue: true });
  const mb = await prisma.membre.findUniqueOrThrow({ where: { id: balorin } });
  controle("2", "stagiaire passé au tableau, date d'inscription = date de décision", mb.statut === "INSCRIT" && mb.qualite === "AVOCAT" && mb.dateInscription?.toISOString().slice(0, 10) === AUJOURDHUI);
  await aller(page, `/avocats/${balorin}`);
  await capture(page, "parcours-02-fiche-inscrite");
  await aller(page, "/avocats?tri=dateInscription&q=BALORIN");
  await capture(page, "parcours-02-liste-tri-inscription");

  // 3 — admission directe
  await aller(page, "/");
  await clic(page, "Avocat", { exact: true });
  // Le bâtonnier n'a que l'admission directe ; le SG choisit entre les deux modes.
  if (await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].some((e) => (e as HTMLElement).innerText.trim() === "Admission directe"))) await clic(page, "Admission directe", { dialogue: true });
  await remplir(page, "Nom et prénom", "RECETTE Claire", { dialogue: true });
  const casOk = await page.evaluate(() => {
    const s = [...document.querySelectorAll('[role="dialog"] select')].find((e) => (e.closest("label")?.innerText ?? "").toLowerCase().includes("cas d'admission")) as HTMLSelectElement | undefined;
    return s && [...s.options].find((o) => o.value)?.text;
  });
  await remplir(page, "Cas d'admission", casOk ?? "", { dialogue: true });
  await remplir(page, "Ancienneté", "30", { dialogue: true });
  await remplir(page, "Référence de la décision", "RECETTE-ADM-01", { dialogue: true });
  await capture(page, "parcours-03-admission-directe");
  await clic(page, "Admettre au tableau", { dialogue: true });
  const admis = await prisma.membre.findFirst({ where: { nom: "RECETTE Claire" }, orderBy: { id: "desc" } });
  controle("3", "admission directe : membre créé INSCRIT avec événement ADMISSION_DIRECTE",
    !!admis && admis.statut === "INSCRIT" && (await prisma.evenementSituation.count({ where: { membreId: admis.id, type: "ADMISSION_DIRECTE" } })) === 1);
  if (admis) {
    await aller(page, `/avocats/${admis.id}`);
    await clic(page, "Situation", { exact: true });
    await capture(page, "parcours-03-fiche-historique");
  }

  // 4 — omission enregistrée puis réinscription
  const balonde = await idDe(NUM.balonde);
  await aller(page, `/avocats/${balonde}`);
  await clic(page, "Situation", { exact: true });
  await clic(page, "Enregistrer l'omission");
  await remplir(page, "Référence", "CONSEIL-ON-RECETTE-01", { dialogue: true });
  await capture(page, "parcours-04-omission-modale");
  await clic(page, "Enregistrer", { dialogue: true, exact: true });
  controle("4", "omission enregistrée : statut OMIS", (await prisma.membre.findUniqueOrThrow({ where: { id: balonde } })).statut === "OMIS");
  await aller(page, `/avocats/${balonde}`);
  await clic(page, "Situation", { exact: true });
  const infobulle: string = await page.evaluate(() => [...document.querySelectorAll("[title]")].find((e) => (e as HTMLElement).innerText.trim() === "Omis")?.getAttribute("title") ?? "");
  controle("4", "infobulle du statut Omis : mesure temporaire (distincte de la radiation)", /temporaire/i.test(infobulle), infobulle.slice(0, 160));
  await capture(page, "parcours-04-omission-fiche");
  await clic(page, "Réinscrire");
  await remplir(page, "Référence", "CONSEIL-ON-RECETTE-02", { dialogue: true });
  await clic(page, "Enregistrer", { dialogue: true, exact: true });
  controle("4", "réinscription : statut INSCRIT, historique complet", (await prisma.membre.findUniqueOrThrow({ where: { id: balonde } })).statut === "INSCRIT");
  await aller(page, `/avocats/${balonde}`);
  await clic(page, "Situation", { exact: true });
  await capture(page, "parcours-04-reinscription-historique");

  // 5 — décision avec sursis : l'avocat reste au tableau
  await aller(page, `/discipline/${dossiers[0]}`);
  await entrerDiscipline(page);
  await clic(page, "Instruction & décision");
  await remplir(page, "Peine (art. 36)", "INTERDICTION_TEMPORAIRE");
  await remplir(page, "Durée (mois)", "6");
  await remplir(page, "Avec sursis", true);
  await remplir(page, "Motivation", "Motivation fictive de recette : décision enregistrée par le bâtonnier.");
  await voir(page, "Enregistrer la décision");
  await capture(page, "parcours-05-decision-sursis");
  await clic(page, "Enregistrer la décision");
  await capture(page, "parcours-05-decision-confirmation");
  await clic(page, "Enregistrer", { dialogue: true, exact: true });
  controle("5", "sursis : décision enregistrée sur le dossier", (await prisma.dossierDisciplinaire.findUniqueOrThrow({ where: { id: dossiers[0] } })).sursis === true);
  const solandre = await prisma.membre.findUniqueOrThrow({ where: { num: NUM.solandre } });
  controle("5", "sursis : avocat toujours INSCRIT", solandre.statut === "INSCRIT");
  await aller(page, `/avocats/${solandre.id}`);
  controle("5", "sursis : mention affichée sur la fiche", await contient(page, "Sanction avec sursis enregistrée"));
  await capture(page, "parcours-05-fiche-sursis");

  // 7 — tableau ouvert dans une seconde session : mis à jour sans rechargement
  const tableau = await (await session(navigateur, "sg")).browserContext().newPage();
  suivre(tableau, "tableau");
  await tableau.setViewport({ width: 1280, height: 900 });
  await aller(tableau, "/tableau");
  const compter = (): Promise<number> => tableau.evaluate(() => Number((document.body.innerText.match(/—\s*([\d\s ]+)\s*inscrits/) ?? [])[1]?.replace(/\D/g, "") ?? NaN));
  const avant = await compter();
  await capture(tableau, "parcours-07-tableau-avant");

  // 5 — radiation enregistrée : la fiche passe en RADIE, retrait du tableau
  await aller(page, `/discipline/${dossiers[1]}`);
  await entrerDiscipline(page);
  await clic(page, "Instruction & décision");
  await remplir(page, "Peine (art. 36)", "RADIATION");
  await remplir(page, "Motivation", "Motivation fictive de recette : radiation enregistrée par le bâtonnier.");
  await clic(page, "Enregistrer la décision");
  await clic(page, "Enregistrer", { dialogue: true, exact: true });
  const balivor = await prisma.membre.findUniqueOrThrow({ where: { num: NUM.balivor } });
  controle("5", "radiation : fiche en RADIE sans saisie manuelle", balivor.statut === "RADIE");
  await aller(page, `/avocats/${balivor.id}`);
  await capture(page, "parcours-05-fiche-radiee");

  await pause(2500);
  await stable(tableau);
  const apres = await compter();
  controle("7", "tableau mis à jour sans rechargement (un inscrit de moins)", apres === avant - 1, `${avant} → ${apres}`);
  controle("7", "date de dernière mise à jour affichée", await contient(tableau, "Mis à jour"));
  await capture(tableau, "parcours-07-tableau-apres");
  await clic(tableau, "Télécharger le PDF");
  controle("7", "PDF du tableau généré", await attendrePdf(/tableau/));
  await tableau.close();

  // 8 — messagerie (espace avocat)
  page = await session(navigateur, "avocat");
  await aller(page, "/annuaire");
  await remplir(page, "Rechercher un confrère", "KEMANDRE");
  await stable(page);
  controle("8", "annuaire : radiée BALIVOR absente", !(await contient(page, "BALIVOR")));
  controle("8", "espace avocat : identité de démonstration et mention C-13", (await contient(page, "Données entièrement fictives")) && !(await contient(page, "Pointe-Noire")));
  await capture(page, "parcours-08-annuaire");
  await clic(page, "Contacter", { dans: "KEMANDRE" });
  await remplir(page, "Objet du message", "[RECETTE] Substitution d'audience", { dialogue: true });
  await remplir(page, "Message", `Bonjour confrère, pièce jointe ci-dessous. ${SECRET}`, { dialogue: true });
  await deposerFichier(page, '[role="dialog"] input[aria-label="Joindre un fichier"]', fichierPdf("conclusions-recette.pdf"));
  await capture(page, "parcours-08-nouveau-message");
  await clic(page, "Envoyer", { dialogue: true, exact: true });
  await attendreTexte(page, SECRET);
  const msg = await prisma.message.findFirst({ where: { corps: { contains: SECRET } } });
  controle("8", "message envoyé avec pièce jointe et empreinte", !!msg?.pieceNom && !!msg?.empreinte);
  await capture(page, "parcours-08-fil-envoye");
  await aller(page, "/messagerie");
  await clic(page, "Demander une attestation");
  await clic(page, "Envoyer la demande", { dialogue: true });
  await capture(page, "parcours-08-demande-attestation");

  // 8 — l'administration lit et délivre l'attestation
  page = await session(navigateur, "sg");
  await aller(page, "/messagerie");
  await clic(page, "BALANDRE", {});
  await clic(page, "Délivrer l'attestation");
  await capture(page, "parcours-08-attestation-delivree");
  const fil = await prisma.conversation.findFirst({ where: { attestationType: { not: null }, createdAt: { gte: T0 } }, orderBy: { id: "desc" } });
  controle("8", "attestation délivrée et numérotée", !!fil?.attestationNumero && fil.attestationNumero !== "EN_COURS", fil?.attestationNumero ?? "");

  // 8 — l'avocat voit « lu » et imprime l'accusé de lecture
  page = await session(navigateur, "avocat");
  await aller(page, "/messagerie");
  await clic(page, "Demande d'attestation d'inscription");
  await attendreTexte(page, "Accusé de lecture");
  await capture(page, "parcours-08-statut-lu-accuse");
  await clic(page, "Accusé de lecture (PDF)");
  controle("8", "accusé de lecture PDF généré", await attendrePdf(/\/accuse\/pdf/));

  // 9 — dépôt d'une pièce, rejet motivé, nouvelle soumission, validation
  await aller(page, "/documents");
  await clic(page, "Pièces justificatives");
  await deposerFichier(page, 'input[type="file"]', fichierPdf("diplome-recette.pdf"));
  await clic(page, "Soumettre le document");
  await capture(page, "parcours-09-piece-deposee");
  page = await session(navigateur, "sg");
  await aller(page, "/pieces");
  await clic(page, "Rejeter", { dans: "BALANDRE" });
  await remplir(page, "Motif du rejet", "Copie illisible : merci de fournir un scan lisible (recette).", { dialogue: true });
  await capture(page, "parcours-09-rejet-motif");
  await clic(page, "Rejeter la pièce", { dialogue: true });
  const piece = await prisma.pieceDossier.findFirst({ where: { nomFichier: "diplome-recette.pdf" }, orderBy: { id: "desc" } });
  controle("9", "pièce rejetée avec motif", piece?.statut === "REJETEE" && !!piece.note);
  page = await session(navigateur, "avocat");
  await aller(page, "/documents");
  await clic(page, "Pièces justificatives");
  controle("9", "avocat : motif du rejet visible", await contient(page, "Copie illisible"));
  await capture(page, "parcours-09-avocat-rejet-visible");
  await deposerFichier(page, 'input[type="file"]', fichierPdf("diplome-recette-v2.pdf"));
  await clic(page, "Soumettre le document");
  page = await session(navigateur, "sg");
  await aller(page, "/pieces");
  await clic(page, "Vérifier", { dans: "BALANDRE", exact: true }); // onglet « À vérifier » : la seule pièce en attente
  const v2 = await prisma.pieceDossier.findFirst({ where: { nomFichier: "diplome-recette-v2.pdf" }, orderBy: { id: "desc" } });
  controle("9", "nouvelle soumission vérifiée (validée)", v2?.statut === "VERIFIEE", v2?.statut);
  await clic(page, "Toutes");
  await capture(page, "parcours-09-piece-validee");

  // 10 — corps électoral à deux dates
  page = await session(navigateur, "batonnier");
  await aller(page, "/corps-electoral");
  const electeurs = (): Promise<string> => page.evaluate(() => {
    const e = [...document.querySelectorAll("*")].find((x) => (x as HTMLElement).innerText?.trim().toLowerCase().startsWith("électeurs qualifiés") && (x as HTMLElement).innerText.length < 60) as HTMLElement | undefined;
    return e?.parentElement?.innerText.replace(/\s+/g, " ") ?? "";
  });
  await remplir(page, "Situation à la date du", "2026-01-31");
  await stable(page);
  const e1 = await electeurs();
  await capture(page, "parcours-10-corps-31-janvier");
  await remplir(page, "Situation à la date du", AUJOURDHUI);
  await stable(page);
  const e2 = await electeurs();
  await capture(page, "parcours-10-corps-aujourdhui");
  controle("10", "deux dates, deux listes différentes", e1 !== e2, `${e1} | ${e2}`);

  // 11 — reçu au nom du barreau de démonstration
  page = await session(navigateur, "tresoriere");
  await aller(page, "/recus");
  // Liste limitée aux 200 premiers membres (relevé) : premier avocat proposé.
  const beneficiaire: string = await page.evaluate(() => { const s = [...document.querySelectorAll("select")].find((e) => (e.closest("label")?.innerText ?? "").startsWith("Avocat bénéficiaire") || (e.closest("label")?.innerText ?? "").toUpperCase().startsWith("AVOCAT BÉNÉFICIAIRE")); return [...(s?.options ?? [])].find((o) => o.value)?.text ?? ""; });
  await remplir(page, "Avocat bénéficiaire", beneficiaire);
  await stable(page);
  // Hors listes déroulantes : des cabinets de la base de test portent « Pointe-Noire » dans leur nom.
  const horsListes: string = await page.evaluate(() => { const c = document.body.cloneNode(true) as HTMLElement; c.querySelectorAll("select").forEach((e) => e.remove()); return c.innerText; });
  controle("11", "aperçu du reçu à l'identité paramétrée, sans « Pointe-Noire »", horsListes.includes("Barreau de démonstration") && !horsListes.includes("Pointe-Noire"));
  await capture(page, "parcours-11-recu-apercu");
  await stable(page);
  await clic(page, "PDF", { exact: true });
  controle("11", "PDF du reçu généré", await attendrePdf(/recus\/\d+\/pdf/));
  await aller(page, "/quitus");
  await capture(page, "parcours-11-quitus");

  // T — prototypes : timbre et vote
  await aller(page, "/timbres");
  controle("T", "timbres : bandeau Expérimental", await contient(page, "Expérimental"));
  await capture(page, "parcours-T-timbres");
  await clic(page, "Statistiques", { exact: true });
  await capture(page, "parcours-T-timbres-statistiques");
  page = await session(navigateur, "batonnier");
  await aller(page, "/elections");
  controle("T", "élections : bandeau Expérimental", await contient(page, "Expérimental"));
  await capture(page, "parcours-T-elections");

  // 12 — journal d'audit filtrable, sans contenu de message
  page = await session(navigateur, "admin");
  await aller(page, "/journal-audit");
  await remplir(page, "Action", "message");
  await stable(page);
  controle("12", "journal filtré par action : envoi de message tracé", await contient(page, "message #"));
  await capture(page, "parcours-12-journal-filtre-action");
  await remplir(page, "Utilisateur", "BALANDRE");
  await stable(page);
  await capture(page, "parcours-12-journal-filtre-utilisateur");
  await remplir(page, "Action", "");
  await remplir(page, "Utilisateur", "");
  await remplir(page, "Rechercher une action", SECRET);
  await stable(page);
  controle("12", "aucune ligne ne contient le corps du message", !(await contient(page, SECRET)));
  controle("12", "base : corps du message absent de JournalAudit", (await prisma.journalAudit.count({ where: { OR: [{ cible: { contains: SECRET } }, { chemin: { contains: SECRET } }, { action: { contains: SECRET } }] } })) === 0);
  await capture(page, "parcours-12-journal-recherche-secret");
}

/** Captures « après » des 4 écrans de référence, mêmes conditions que les captures « avant » (SG, identité de base). */
async function apres(navigateur: any) {
  const page = await session(navigateur, "sg");
  for (const [nom, chemin] of [["avocats", "/avocats"], ["avocat-detail", `/avocats/${await idDe(1)}`], ["tableau", "/tableau"], ["messagerie", "/messagerie"]]) {
    await aller(page, chemin);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, `apres-${nom}`);
  }
}

// ─── Remise en état des membres DEMO touchés en direct ───────────────────────
const T0 = (await prisma.$queryRaw<{ t: Date }[]>`SELECT now() AS t`)[0].t;
const instantane = mode === "parcours" ? await prisma.membre.findMany({ where: { num: { gte: 800001, lte: 800200 } } }) : [];

async function remettreEnEtat() {
  const ids = instantane.map((m) => m.id);
  const depuis = { gte: T0 };
  await prisma.evenementSituation.deleteMany({ where: { membreId: { in: ids }, createdAt: depuis } });
  await prisma.dossierDisciplinaire.deleteMany({ where: { membreId: { in: ids }, createdAt: depuis } });
  await prisma.conversation.deleteMany({ where: { createdAt: depuis, participants: { some: { membreId: { in: ids } } } } });
  await prisma.pieceDossier.deleteMany({ where: { membreId: { in: ids }, createdAt: depuis } });
  await prisma.membre.deleteMany({ where: { nom: { startsWith: "RECETTE " }, createdAt: depuis } });
  for (const { id, createdAt: _c, updatedAt: _u, ...champs } of instantane) await prisma.membre.update({ where: { id }, data: champs as never });
  console.log(`Remise en état : ${ids.length} membres DEMO restaurés, écritures postérieures à ${T0.toISOString()} retirées.`);
}

const navigateur = await puppeteer.launch({ executablePath: trouverChromium() ?? undefined, args: ["--no-sandbox", "--disable-dev-shm-usage", "--lang=fr-FR"] });
let code = 0;
try {
  if (mode === "parcours") await parcours(navigateur);
  else await apres(navigateur);
} catch (e) {
  code = 1;
  console.error("ÉCHEC :", (e as Error).message);
  const pages = await navigateur.pages();
  await pages[pages.length - 1]?.screenshot({ path: path.join(TMP, "echec.png") }).catch(() => {});
  console.error(`Capture de l'échec : ${path.join(TMP, "echec.png")}`);
} finally {
  await navigateur.close();
  if (mode === "parcours") await remettreEnEtat();
  await prisma.$disconnect();
}
const ko = resultat.controles.filter((c) => !c.ok).length + resultat.captures.filter((c) => !c.ok).length;
fs.writeFileSync(path.join(DOSSIER_CAPTURES, `recette-ui-${mode}.json`), JSON.stringify({ ...resultat, fin: new Date().toISOString(), echecs: ko, interrompu: code === 1 }, null, 2));
console.log(`Contrôles : ${resultat.controles.length - resultat.controles.filter((c) => !c.ok).length}/${resultat.controles.length} ; captures : ${resultat.captures.length} ; 5xx : ${resultat.reponses5xx.length} ; erreurs console : ${resultat.erreursConsole.length}`);
process.exit(code || (ko ? 1 : 0));
