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

let refreshing = null;
async function rafraichir() {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
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

export async function api(path, opts = {}) {
  let res = await envoyer(path, opts);

  // Tentative de rafraîchissement sur 401 (hors routes d'auth).
  if (res.status === 401 && opts.auth !== false && !path.startsWith("/auth/")) {
    refreshing = refreshing ?? rafraichir();
    const ok = await refreshing;
    refreshing = null;
    if (ok) res = await envoyer(path, opts);
  }

  if (res.status === 401) {
    clearSession();
    onUnauthorized?.();
    throw new Error("Session expirée — veuillez vous reconnecter.");
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.erreur || `Erreur ${res.status}`);
  return data;
}

/** Télécharge un PDF serveur authentifié (rafraîchissement automatique sur 401). */
export async function telechargerPdf(path, filename) {
  const charger = () => {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${BASE}${path}`, { headers });
  };
  let res = await charger();
  if (res.status === 401) {
    refreshing = refreshing ?? rafraichir();
    const ok = await refreshing;
    refreshing = null;
    if (ok) res = await charger();
  }
  if (!res.ok) {
    if (res.status === 401) { clearSession(); onUnauthorized?.(); }
    throw new Error("Échec du téléchargement du PDF");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Ouvre un fichier protégé (auth) dans un nouvel onglet (consultation de pièce). */
export async function ouvrirFichierAuth(path) {
  const charger = () => {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${BASE}${path}`, { headers });
  };
  let res = await charger();
  if (res.status === 401) {
    refreshing = refreshing ?? rafraichir();
    const ok = await refreshing;
    refreshing = null;
    if (ok) res = await charger();
  }
  if (!res.ok) {
    if (res.status === 401) { clearSession(); onUnauthorized?.(); }
    throw new Error("Échec de l'ouverture du fichier");
  }
  const url = URL.createObjectURL(await res.blob());
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
