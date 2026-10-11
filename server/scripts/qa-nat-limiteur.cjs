// R2-13 : scénario QA « salle derrière un NAT ». Le SG est connecté sur /reunions ; d'autres postes de la même IP
// épuisent le budget anonyme (600 requêtes) ; le jeton d'accès expire réellement (serveur lancé avec ACCESS_TTL court).
// Attendu : pas d'écran de connexion, refresh token conservé, écran chargé ou bandeau « Trop de requêtes, réessayez dans N s. ».
// Usage (depuis server/) : [TTL_S=60] node scripts/qa-nat-limiteur.cjs <url> <capture.png>
const { createRequire } = require("node:module");
const path = require("node:path");
const puppeteer = createRequire(path.join(__dirname, "..", "package.json"))("puppeteer-core");
const [, , BASE, CAPTURE] = process.argv;
const TTL_S = Number(process.env.TTL_S || 60);
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
(async () => {
  const login = await (await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "sg@barreau-pn.cg", password: "barreau" }) })).json();
  const t0 = Date.now();
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const p = await b.newPage();
  const log = [];
  p.on("response", (r) => { if (r.url().includes("/api/")) log.push(`${Math.round((Date.now() - t0) / 1000)}s ${r.status()} ${r.request().method()} ${r.url().replace(BASE, "")}`); });
  await p.setViewport({ width: Number(process.env.LARGEUR || 1280), height: 800 });
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await p.evaluate((t, r) => { localStorage.setItem("bpn_token", t); localStorage.setItem("bpn_refresh", r); }, login.token, login.refreshToken);
  await p.goto(BASE + "/reunions", { waitUntil: "networkidle0" });
  const c = {};
  for (let i = 0; i < 600; i++) { const s = (await fetch(BASE + "/api/route-anonyme-inexistante")).status; c[s] = (c[s] || 0) + 1; }
  console.log("trafic anonyme", JSON.stringify(c));
  const reste = (TTL_S + 35) * 1000 - (Date.now() - t0);
  if (reste > 0) await attendre(reste); // expiration réelle pendant que l'écran reste ouvert (appels de fond)
  await p.goto(BASE + "/reunions", { waitUntil: "networkidle0", timeout: 20000 }).catch(() => {});
  await attendre(1500);
  const r = await p.evaluate(() => ({
    texte: document.body.innerText.slice(0, 300).replace(/\n/g, " | "),
    connexion: !!document.querySelector('input[autocomplete="username"]') && !!document.querySelector('input[type="password"]'),
    refreshConserve: !!localStorage.getItem("bpn_refresh"),
    bandeau: (document.body.innerText.match(/Trop de requêtes, réessayez dans \d+ s\./) || [null])[0],
    scrollWidth: document.documentElement.scrollWidth,
  }));
  console.log("RESULTAT " + JSON.stringify(r));
  console.log(log.join("\n"));
  if (CAPTURE) await p.screenshot({ path: CAPTURE });
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
