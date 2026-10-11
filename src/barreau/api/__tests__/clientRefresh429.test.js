import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, setSession, getToken, getRefreshToken, setUnauthorizedHandler, setLimiteHandler, telechargerPdf } from "../client";

// R2-13 (reprise QA) : un 429 sur /auth/refresh (budget de l'IP saturé par la salle) n'est pas un refus du jeton.
// La session est conservée, le blocage est signalé avec son délai et l'erreur 429 est propagée.
describe("client API — rafraîchissement limité (429)", () => {
  let deco, limite;
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    deco = vi.fn();
    limite = vi.fn();
    setUnauthorizedHandler(deco);
    setLimiteHandler(limite);
    setSession({ token: "expire", refreshToken: "r" });
    vi.stubGlobal("fetch", vi.fn(async (url) =>
      url === "/api/auth/refresh"
        ? new Response(JSON.stringify({ erreur: "Trop de requêtes, réessayez dans 838 s.", retryAfter: 838 }), { status: 429, headers: { "Retry-After": "838" } })
        : new Response(JSON.stringify({ erreur: "Jeton expiré" }), { status: 401 })));
  });

  it("api : 401 puis refresh en 429 conserve la session, signale la limite et lève une erreur 429", async () => {
    const e = await api("/reunions").catch((x) => x);
    expect(e.status).toBe(429);
    expect(e.retryAfter).toBe(838);
    expect(e.message).toBe("Trop de requêtes, réessayez dans 838 s.");
    expect(getToken()).toBe("expire");
    expect(getRefreshToken()).toBe("r");
    expect(deco).not.toHaveBeenCalled();
    expect(limite).toHaveBeenCalledWith(838);
  });

  it("telechargerPdf : même traitement, sans déconnexion", async () => {
    const e = await telechargerPdf("/recus/1/pdf", "r.pdf").catch((x) => x);
    expect(e.status).toBe(429);
    expect(getRefreshToken()).toBe("r");
    expect(deco).not.toHaveBeenCalled();
    expect(limite).toHaveBeenCalledWith(838);
  });

  it("un refus du jeton (401 sur /auth/refresh) termine toujours la session", async () => {
    fetch.mockImplementation(async () => new Response(JSON.stringify({ erreur: "invalide" }), { status: 401 }));
    const e = await api("/reunions").catch((x) => x);
    expect(e.status).toBe(401);
    expect(getRefreshToken()).toBeNull();
    expect(deco).toHaveBeenCalled();
    expect(limite).not.toHaveBeenCalled();
  });
});
