import { createContext, useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { api, getToken, setToken, setUnauthorizedHandler } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
    (async () => {
      if (getToken()) {
        try {
          setUser(await api("/auth/me"));
        } catch {
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email, password) => {
    const { token, user: u } = await api("/auth/login", { method: "POST", auth: false, body: { email, password } });
    setToken(token);
    setUser(u);
    return u;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node };

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
