/**
 * Client API — wrapper fetch vers le backend (/api), avec jeton JWT et
 * rafraîchissement automatique du jeton d'accès sur 401 (refresh token).
 */
const BASE = "/api";
const TOKEN_KEY = "bpn_token";
const REFRESH_KEY = "bpn_refresh";

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// R2-13 : tout 429 est signalé (délai en secondes) pour afficher le blocage sur n'importe quel écran.
let onLimite = null;
export function setLimiteHandler(fn) {
  onLimite = fn;
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

export function setSession({ token, refreshToken }) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}
// Compat : ancien nom utilisé ailleurs.
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : clearSession());

/** Erreur 429 signalée au contexte (compte à rebours affiché) ; la session n'est jamais touchée. */
function erreurLimite(secondes, message) {
  onLimite?.(secondes);
  return Object.assign(new Error(message || `Trop de requêtes, réessayez dans ${secondes} s.`), { status: 429, retryAfter: secondes });
}
const delaiAnnonce = (res, data) => Number(res.headers.get("Retry-After")) || data?.retryAfter || 60;

let refreshing = null;
/** true : session rafraîchie ; false : jeton refusé (ou réseau) ; { limite: s } : 429, jeton toujours valable (R2-13). */
async function rafraichir() {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (res.status === 429) return { limite: delaiAnnonce(res) };
    if (!res.ok) return false;
    setSession(await res.json());
    return true;
  } catch {
    return false;
  }
}

async function envoyer(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}

/**
 * Exécute une requête et, sur 401, rafraîchit le jeton UNE seule fois avant de
 * réessayer. La promesse de rafraîchissement est partagée entre appels concurrents
 * (`refreshing`). Renvoie la Response finale ; le 401 résiduel est traité par l'appelant.
 * Source unique de cette logique (api + téléchargements de fichiers protégés).
 */
async function avecRafraichissement(faireRequete, tenterRefresh = true) {
  let res = await faireRequete();
  if (res.status === 401 && tenterRefresh) {
    refreshing = refreshing ?? rafraichir();
    const r = await refreshing;
    refreshing = null;
    if (r === true) res = await faireRequete();
    // Rafraîchissement limité : ni clearSession ni onUnauthorized, on attend le délai (R2-13).
    else if (r?.limite) throw erreurLimite(r.limite);
  }
  return res;
}

export async function api(path, opts = {}) {
  // Pas de rafraîchissement pour les requêtes non authentifiées ni les routes d'auth, sauf /auth/me :
  // au rechargement d'une page après expiration du jeton (15 min), la session est rafraîchie au lieu d'être perdue (R2-13).
  const res = await avecRafraichissement(() => envoyer(path, opts), opts.auth !== false && (path === "/auth/me" || !path.startsWith("/auth/")));

  if (res.status === 401) {
    clearSession();
    onUnauthorized?.();
    throw Object.assign(new Error("Session expirée — veuillez vous reconnecter."), { status: 401 });
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    // Le statut est porté par l'erreur : seul un 401 met fin à la session (jamais 429/5xx).
    if (res.status === 429) throw erreurLimite(delaiAnnonce(res, data), data?.erreur);
    throw Object.assign(new Error(data?.erreur || `Erreur ${res.status}`), { status: res.status });
  }
  return data;
}

/** POST authentifié dont la réponse est du texte (HTML d'aperçu d'un document serveur). */
export async function apiTexte(path, body) {
  const res = await avecRafraichissement(() => envoyer(path, { method: "POST", body }));
  if (res.status === 401) { clearSession(); onUnauthorized?.(); }
  if (!res.ok) throw Object.assign(new Error(`Aperçu indisponible (${res.status})`), { status: res.status });
  return res.text();
}

/** Détecte iOS / iPadOS, où l'attribut `download` est ignoré (le blob doit être
 *  ouvert dans un onglet, l'enregistrement se faisant via la feuille de partage). */
const estIOS = () =>
  typeof navigator !== "undefined" &&
  (/iP(ad|hone|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/** Télécharge un PDF serveur authentifié (rafraîchissement automatique sur 401). */
export async function telechargerPdf(path, filename) {
  // Sur iOS/Safari l'attribut `download` ne déclenche aucun enregistrement : on
  // ouvre alors le PDF dans un onglet. Cet onglet doit être ouvert AVANT le
  // `await` (dans le geste de clic) pour échapper au bloqueur de pop-ups.
  const ios = estIOS();
  const onglet = ios ? window.open("", "_blank") : null;
  const charger = () => {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${BASE}${path}`, { headers });
  };
  const res = await avecRafraichissement(charger).catch((e) => { onglet?.close(); throw e; });
  if (!res.ok) {
    onglet?.close();
    if (res.status === 401) { clearSession(); onUnauthorized?.(); }
    throw new Error("Échec du téléchargement du PDF");
  }
  const url = URL.createObjectURL(await res.blob());
  if (ios) {
    if (onglet) onglet.location = url;
    else window.open(url, "_blank");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    // L'ancre doit être présente dans le DOM pour que `.click()` déclenche le
    // téléchargement (Firefox l'exige), et la révocation de l'URL doit être
    // différée : la révoquer juste après le clic interrompt le téléchargement.
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Ouvre un fichier protégé (auth) dans un nouvel onglet (consultation de pièce). */
export async function ouvrirFichierAuth(path) {
  // L'onglet est ouvert dans le contexte synchrone du clic (avant tout `await`)
  // pour ne pas être bloqué par le bloqueur de pop-ups ; le blob authentifié y
  // est injecté une fois récupéré. (Pas de `noopener` : on garde la référence.)
  const onglet = window.open("", "_blank");
  const charger = () => {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${BASE}${path}`, { headers });
  };
  const res = await avecRafraichissement(charger).catch((e) => { onglet?.close(); throw e; });
  if (!res.ok) {
    onglet?.close();
    if (res.status === 401) { clearSession(); onUnauthorized?.(); }
    throw new Error("Échec de l'ouverture du fichier");
  }
  const url = URL.createObjectURL(await res.blob());
  if (onglet) onglet.location = url;
  else window.open(url, "_blank", "noopener"); // repli si l'onglet n'a pu être ouvert
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
