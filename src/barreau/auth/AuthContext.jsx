import { createContext, useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { api, getToken, getRefreshToken, setSession, clearSession, setUnauthorizedHandler, setLimiteHandler } from "../api/client";
import { connecterRealtime, deconnecterRealtime } from "../api/realtime";
import { appliquerConfig } from "../data/config";

const AuthContext = createContext(null);

// Blocage 429 en cours : fin absolue (ms) et minuteur unique, partagés par tous les appels (R2-13).
let finLimite = 0;
let minuteur = null;

/** Prolonge le blocage jusqu'au délai annoncé (15 min au plus) et publie chaque seconde les secondes restantes. */
function signalerLimite(secondes, setLimite) {
  finLimite = Math.max(finLimite, Date.now() + Math.min(Number(secondes) || 0, 900) * 1000);
  if (minuteur) return;
  const tic = () => {
    const reste = Math.max(Math.ceil((finLimite - Date.now()) / 1000), 0);
    setLimite(reste);
    minuteur = reste > 0 ? setTimeout(tic, 1000) : null;
  };
  tic();
}

/** Attend la fin du blocage annoncé par un 429, le délai restant étant affiché pendant l'attente. */
async function attendreLimite(e, setLimite) {
  signalerLimite(e.retryAfter, setLimite);
  await new Promise((ok) => setTimeout(ok, Math.max(finLimite - Date.now(), 0)));
}

/**
 * Charge les paramètres (données de référence centralisées) et les applique à
 * la configuration vivante. Tolérant aux échecs : un rôle sans accès lecture
 * (ex. avocat, cloisonné) conserve simplement les valeurs par défaut.
 */
async function chargerReglages() {
  try { appliquerConfig(await api("/parametres")); } catch { /* défauts conservés */ }
}

/** Identité publique (GET /auth/identite) : écran de connexion et espace avocat, qui n'ont pas accès à /parametres. */
async function chargerIdentite(setLimite) {
  const lire = () => api("/auth/identite", { auth: false });
  try {
    let r;
    try { r = await lire(); } catch (e) {
      // Limite atteinte (salle derrière un NAT) : on attend le délai annoncé puis on réessaie une fois.
      if (e.status !== 429) throw e;
      await attendreLimite(e, setLimite);
      r = await lire();
    }
    appliquerConfig(r);
  } catch { /* défauts conservés */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [limite, setLimite] = useState(0); // secondes avant la fin d'un blocage 429 (0 = aucun)

  useEffect(() => {
    setUnauthorizedHandler(() => { deconnecterRealtime(); setUser(null); });
    setLimiteHandler((s) => signalerLimite(s, setLimite));
    (async () => {
      await chargerIdentite(setLimite);
      if (getToken()) {
        try {
          let moi;
          try {
            moi = await api("/auth/me");
          } catch (e) {
            // Limite atteinte : on attend le délai annoncé puis on réessaie une fois, sans perdre la session.
            if (e.status !== 429) throw e;
            await attendreLimite(e, setLimite);
            moi = await api("/auth/me");
          }
          setUser(moi);
          await chargerReglages();
          connecterRealtime();
        } catch (e) {
          // Le jeton n'est effacé que sur 401 (déjà traité par api()) : jamais sur 429/5xx/réseau.
          if (e.status === 401) clearSession();
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email, password) => {
    const data = await api("/auth/login", { method: "POST", auth: false, body: { email, password } });
    setSession(data);
    await chargerReglages();
    setUser(data.user);
    connecterRealtime();
    return data.user;
  };

  const logout = async () => {
    const refreshToken = getRefreshToken();
    deconnecterRealtime();
    clearSession();
    setUser(null);
    if (refreshToken) api("/auth/logout", { method: "POST", auth: false, body: { refreshToken } }).catch(() => {});
  };

  return <AuthContext.Provider value={{ user, loading, limite, login, logout }}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node };

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
