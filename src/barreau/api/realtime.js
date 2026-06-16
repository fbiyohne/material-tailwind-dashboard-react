/**
 * Client temps réel (WebSocket /ws) de la messagerie. Connexion unique
 * partagée, authentifiée par le jeton JWT, avec reconnexion automatique
 * (backoff exponentiel). À la réception d'un événement, les composants abonnés
 * rechargent l'état autoritatif via l'API (le serveur ne fait que signaler).
 */
import { getToken } from "./client";

let ws = null;
let reconnexion = null;
let tentative = 0;
let voulu = false; // l'utilisateur est-il censé être connecté ?
const listeners = new Set();

function urlWs() {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws?token=${encodeURIComponent(getToken() ?? "")}`;
}

function planifierReconnexion() {
  if (reconnexion || !voulu) return;
  const delai = Math.min(30000, 1000 * 2 ** tentative);
  reconnexion = setTimeout(() => { reconnexion = null; tentative += 1; ouvrir(); }, delai);
}

function ouvrir() {
  if (!voulu || !getToken()) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  try {
    ws = new WebSocket(urlWs());
  } catch {
    planifierReconnexion();
    return;
  }
  ws.onopen = () => { tentative = 0; };
  ws.onmessage = (e) => {
    let evt;
    try { evt = JSON.parse(e.data); } catch { return; }
    listeners.forEach((l) => { try { l(evt); } catch { /* handler isolé */ } });
  };
  ws.onclose = (e) => {
    ws = null;
    // 4001 = non autorisé, 4003 = interdit : inutile de réessayer en boucle.
    if (e.code !== 4001 && e.code !== 4003) planifierReconnexion();
  };
  ws.onerror = () => { try { ws?.close(); } catch { /* ignore */ } };
}

/** Démarre (idempotent) la connexion temps réel si un jeton est présent. */
export function connecterRealtime() {
  voulu = true;
  tentative = 0;
  ouvrir();
}

/** Ferme la connexion (déconnexion / expiration de session). */
export function deconnecterRealtime() {
  voulu = false;
  if (reconnexion) { clearTimeout(reconnexion); reconnexion = null; }
  if (ws) { try { ws.close(); } catch { /* ignore */ } ws = null; }
}

/** Abonne un handler aux événements temps réel ; renvoie la fonction de désabonnement. */
export function onRealtime(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}
