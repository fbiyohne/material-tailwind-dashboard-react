import { createContext, useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { api, getToken, getRefreshToken, setSession, clearSession, setUnauthorizedHandler } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    (async () => {
      if (getToken()) {
        try {
          setUser(await api("/auth/me"));
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
