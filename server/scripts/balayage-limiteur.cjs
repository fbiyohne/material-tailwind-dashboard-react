// R2-13 : rejoue le balayage QA (connecté en SG, 27 routes x 2 largeurs = 54 rechargements complets)
// et compte les requêtes /api par rechargement, avec RateLimit-Remaining et les 429.
// Usage (depuis server/) : [EXPIRE_A=n] [BLOCAGE=1] [SORTIE=dossier] node scripts/balayage-limiteur.cjs <url> <libelle> [passes]
// Compte SG de la base de test (mot de passe « barreau »). Chrome : CHROME, sinon l'emplacement Windows standard.
//  EXPIRE_A : après n rechargements, le jeton d'accès est remplacé par un jeton authentique expiré (les 15 min écoulées).
//  BLOCAGE  : phase 2, un 429 (Retry-After 783 s, valeur du constat) est simulé sur les 5 écrans signalés.
const { createRequire } = require("node:module");
const path = require("node:path");
const req = createRequire(path.join(__dirname, "..", "package.json"));
const SORTIE = process.env.SORTIE || require("node:os").tmpdir();
const puppeteer = req("puppeteer-core");
const jwt = req("jsonwebtoken");
const fs = require("node:fs");
const [, , BASE, LIBELLE, PASSES = "1"] = process.argv;
const ROUTES = ["/", "/avocats", "/stagiaires", "/cabinets", "/tableau", "/pieces", "/corps-electoral", "/cotisations", "/quitus", "/recus", "/droits-plaidoirie", "/timbres", "/reunions", "/assemblees", "/discipline", "/elections", "/conseil", "/messagerie", "/archives", "/annuaire", "/publications", "/lettre-batonnier", "/parametres", "/utilisateurs", "/journal-audit", "/profil"];
const CINQ = ["/reunions", "/assemblees", "/publications", "/lettre-batonnier", "/profil"];
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
const connexion = async () => (await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "sg@barreau-pn.cg", password: "barreau" }) })).json();

(async () => {
  const login = await connexion();
  if (!login.token) throw new Error("connexion SG impossible : " + JSON.stringify(login));
  const m = await (await fetch(BASE + "/api/membres?pageSize=1", { headers: { Authorization: "Bearer " + login.token } })).json();
  ROUTES.push("/avocats/" + (m.items ?? m.data ?? m)[0].id);
  const secret = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/).find((l) => l.startsWith("JWT_SECRET=")).slice(11).replace(/"/g, "");
  const d = jwt.decode(login.token);
  const expire = jwt.sign({ sub: d.sub, role: d.role, tv: d.tv, exp: Math.floor(Date.now() / 1000) - 5 }, secret, { algorithm: "HS256" });
  const EXPIRE_A = Number(process.env.EXPIRE_A || 0);

  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  let seau = [];
  page.on("response", (r) => {
    const u = r.url();
    if (!u.includes("/api/")) return;
    const h = r.headers();
    seau.push({ statut: r.status(), reste: h["ratelimit-remaining"] != null ? Number(h["ratelimit-remaining"]) : null, retry: h["retry-after"] ?? null });
  });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate((t, r) => { localStorage.setItem("bpn_token", t); localStorage.setItem("bpn_refresh", r); }, login.token, login.refreshToken);

  const lignes = [];
  const debut = Date.now();
  for (let p = 0; p < Number(PASSES); p++) for (const largeur of [1280, 360]) {
    await page.setViewport({ width: largeur, height: 800 });
    for (const route of ROUTES) {
      seau = [];
      if (EXPIRE_A && lignes.length === EXPIRE_A) {
        await page.evaluate((t) => localStorage.setItem("bpn_token", t), expire);
        console.log("--- jeton d'accès remplacé par un jeton authentique expiré (15 min écoulées) ---");
      }
      await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 20000 }).catch(() => {});
      await attendre(400);
      const texte = await page.evaluate(() => document.body.innerText).catch(() => "");
      const comptes = seau.filter((x) => x.reste != null);
      const l = {
        t: Math.round((Date.now() - debut) / 1000), passe: p + 1, largeur, route,
        requetesApi: seau.length, compteesLimiteur: comptes.length,
        statuts: seau.reduce((a, x) => ((a[x.statut] = (a[x.statut] || 0) + 1), a), {}),
        resteMin: comptes.length ? Math.min(...comptes.map((x) => x.reste)) : null,
        retryAfter: seau.find((x) => x.retry)?.retry ?? null,
        chargementMuet: /Chargement…/.test(texte) && !/Trop de requêtes/.test(texte),
        messageLimite: (texte.match(/Trop de requêtes[^\n]*/) || [null])[0],
        connexion: /Mot de passe/i.test(texte) && /Se connecter|Connexion/i.test(texte),
      };
      lignes.push(l);
      console.log(`${String(l.t).padStart(4)}s p${l.passe} ${largeur} ${route.padEnd(20)} api=${l.requetesApi} comptees=${l.compteesLimiteur} ${JSON.stringify(l.statuts)} reste=${l.resteMin} retry=${l.retryAfter}${l.chargementMuet ? " CHARGEMENT-MUET" : ""}${l.messageLimite ? " MSG=" + l.messageLimite : ""}${l.connexion ? " ECRAN-CONNEXION" : ""}`);
    }
  }
  const total = lignes.reduce((a, l) => a + l.requetesApi, 0), comptees = lignes.reduce((a, l) => a + l.compteesLimiteur, 0);
  const bilan = { libelle: LIBELLE, url: BASE, rechargements: lignes.length, dureeS: Math.round((Date.now() - debut) / 1000), requetesApi: total, compteesLimiteur: comptees, parRechargement: +(comptees / lignes.length).toFixed(1), maxParRechargement: Math.max(...lignes.map((l) => l.compteesLimiteur)), rechargementsAvec429: lignes.filter((l) => l.statuts[429]).length, chargementsMuets: lignes.filter((l) => l.chargementMuet).length, ecransConnexion: lignes.filter((l) => l.connexion).length };
  console.log("BILAN " + JSON.stringify(bilan));

  const blocage = [];
  if (process.env.BLOCAGE) {
    // « total » : toute l'API bloquée, /auth/me compris (constat QA) ; « donnees » : session valide, données de l'écran bloquées.
    let mode = "";
    await page.setRequestInterception(true);
    page.on("request", (r) => {
      const u = r.url();
      const libre = !u.includes("/api/") || /\/api\/(auth\/identite|installation\/etat|notifications|mes-notifications|health)/.test(u) || (mode === "donnees" && u.includes("/api/auth/me"));
      if (libre) return r.continue();
      r.respond({ status: 429, headers: { "Retry-After": "783" }, contentType: "application/json", body: JSON.stringify({ erreur: "Trop de requêtes, réessayez dans 783 s.", retryAfter: 783 }) });
    });
    const neuf = await connexion(); // jeton neuf : la phase 1 a pu l'expirer
    for (const md of ["total", "donnees"]) for (const largeur of [1280, 360]) for (const route of CINQ) {
      mode = md;
      await page.evaluate((t, r) => { localStorage.setItem("bpn_token", t); localStorage.setItem("bpn_refresh", r); }, neuf.token, neuf.refreshToken);
      await page.setViewport({ width: largeur, height: 800 });
      await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
      await attendre(2500);
      const texte = await page.evaluate(() => document.body.innerText);
      const msg = (texte.match(/Trop de requêtes, réessayez dans \d+ s\./) || [null])[0];
      const muet = /Chargement…/.test(texte) && !msg;
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      await page.screenshot({ path: `${SORTIE}/r2-13-${LIBELLE}-${md}-${route.slice(1)}-${largeur}.png` });
      blocage.push({ mode: md, largeur, route, message: msg, chargementMuet: muet, scrollWidth: sw });
      console.log(`BLOCAGE ${md} ${largeur} ${route.padEnd(18)} message=${msg} chargementMuet=${muet} scrollWidth=${sw}`);
    }
  }
  await browser.close();
  fs.writeFileSync(`${SORTIE}/balayage-${LIBELLE}.json`, JSON.stringify({ bilan, lignes, blocage }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
