/**
 * Client API — wrapper fetch vers le backend (/api), avec jeton JWT.
 * Gère la déconnexion automatique sur 401.
 */
const BASE = "/api";
const TOKEN_KEY = "bpn_token";

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error("Session expirée — veuillez vous reconnecter.");
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.erreur || `Erreur ${res.status}`);
  return data;
}
