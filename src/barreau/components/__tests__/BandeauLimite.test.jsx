import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useEffect } from "react";
import { AuthProvider } from "../../auth/AuthContext";
import { api } from "../../api/client";
import { BandeauLimite } from "../BandeauLimite";

vi.mock("../../api/realtime", () => ({ connecterRealtime: vi.fn(), deconnecterRealtime: vi.fn() }));

// R2-13 : après un 429 sur n'importe quel écran (réunions, assemblées, publications, lettre du bâtonnier,
// profil…), le délai annoncé par le serveur est affiché au lieu d'un chargement ou d'une erreur muets.
function EcranQuiCharge() {
  useEffect(() => { api("/reunions").catch(() => {}); }, []);
  return <BandeauLimite />;
}

describe("BandeauLimite (R2-13)", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("affiche « Trop de requêtes, réessayez dans N s. » avec compte à rebours, puis disparaît", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (url) => url === "/api/reunions"
      ? new Response(JSON.stringify({ erreur: "Trop de requêtes, réessayez dans 783 s.", retryAfter: 783 }), { status: 429, headers: { "Retry-After": "783" } })
      : new Response(JSON.stringify({}), { status: 200 })));
    render(<AuthProvider><EcranQuiCharge /></AuthProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByRole("status")).toHaveTextContent("Trop de requêtes, réessayez dans 783 s.");
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByRole("status")).toHaveTextContent("réessayez dans 780 s.");
    await act(async () => { await vi.advanceTimersByTimeAsync(781000); });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("n'affiche rien sans blocage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));
    render(<AuthProvider><EcranQuiCharge /></AuthProvider>);
    await act(async () => {});
    expect(screen.queryByRole("status")).toBeNull();
  });
});
