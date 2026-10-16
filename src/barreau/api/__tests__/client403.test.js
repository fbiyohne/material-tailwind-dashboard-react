import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, setSession } from "../client";

const reponse403 = (erreur) => vi.fn(async () => new Response(JSON.stringify(erreur ? { erreur } : {}), { status: 403 }));

describe("client API — refus 403", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); setSession({ token: "t", refreshToken: "r" }); });

  it("conserve le message métier d'un 403", async () => {
    vi.stubGlobal("fetch", reponse403("La messagerie interne est désactivée."));
    const err = await api("/messagerie").catch((e) => e);
    expect(err.status).toBe(403);
    expect(err.message).toBe("La messagerie interne est désactivée.");
  });

  it("garde le repli « Erreur 403 » sans message serveur", async () => {
    vi.stubGlobal("fetch", reponse403(null));
    const err = await api("/messagerie").catch((e) => e);
    expect(err.message).toBe("Erreur 403");
  });
});
