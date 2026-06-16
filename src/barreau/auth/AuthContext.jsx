import { createContext, useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { api, getToken, getRefreshToken, setSession, clearSession, setUnauthorizedHandler } from "../api/client";
import { appliquerConfig } from "../data/config";

const AuthContext = createContext(null);

/**
 * Charge les paramètres (données de référence centralisées) et les applique à
 * la configuration vivante. Tolérant aux échecs : un rôle sans accès lecture
 * (ex. avocat, cloisonné) conserve simplement les valeurs par défaut.
 */
async function chargerReglages() {
  try { appliquerConfig(await api("/parametres")); } catch { /* défauts conservés */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    (async () => {
      if (getToken()) {
        try {
          setUser(await api("/auth/me"));
          await chargerReglages();
        } catch {
          clearSession();
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
    return data.user;
  };

  const logout = async () => {
    const refreshToken = getRefreshToken();
    clearSession();
    setUser(null);
    if (refreshToken) api("/auth/logout", { method: "POST", auth: false, body: { refreshToken } }).catch(() => {});
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node };

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
