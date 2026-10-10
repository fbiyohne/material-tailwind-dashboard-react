import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, setSession, getToken, setUnauthorizedHandler } from "../client";

describe("client API — limite de requêtes (429)", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("n'efface pas la session sur 429 et expose retryAfter", async () => {
    setSession({ token: "t", refreshToken: "r" });
    const deco = vi.fn();
    setUnauthorizedHandler(deco);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 429, headers: { "Retry-After": "12" } })));
    const err = await api("/auth/me").catch((e) => e);
    expect(err.status).toBe(429);
    expect(err.retryAfter).toBe(12);
    expect(err.message).toBe("Trop de requêtes, réessayez dans 12 s.");
    expect(getToken()).toBe("t");
    expect(deco).not.toHaveBeenCalled();
  });
});
