import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, setSession, getToken, setUnauthorizedHandler } from "../client";

// R2-13 : au rechargement d'une page après expiration du jeton d'accès (15 min), /auth/me répond 401.
// Le client doit rafraîchir la session (refresh token valide) au lieu de renvoyer l'utilisateur à la connexion.
describe("client API — /auth/me avec jeton expiré", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("rafraîchit le jeton puis rejoue /auth/me, sans déconnexion", async () => {
    setSession({ token: "expire", refreshToken: "r" });
    const deco = vi.fn();
    setUnauthorizedHandler(deco);
    const fetchMock = vi.fn(async (url, init) => {
      if (url === "/api/auth/refresh") return new Response(JSON.stringify({ token: "neuf", refreshToken: "r2" }), { status: 200 });
      const ok = init.headers.Authorization === "Bearer neuf";
      return new Response(JSON.stringify(ok ? { id: 1 } : { erreur: "Jeton expiré" }), { status: ok ? 200 : 401 });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await api("/auth/me")).toEqual({ id: 1 });
    expect(getToken()).toBe("neuf");
    expect(deco).not.toHaveBeenCalled();
  });

  it("ne tente pas de rafraîchissement sur une autre route /auth/ (changement de mot de passe)", async () => {
    setSession({ token: "t", refreshToken: "r" });
    setUnauthorizedHandler(() => {});
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ erreur: "Mot de passe actuel incorrect" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await api("/auth/password", { method: "POST", body: {} }).catch(() => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
