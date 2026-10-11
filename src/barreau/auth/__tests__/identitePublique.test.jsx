import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";
import { appliquerConfig, identite, MENTION_DEMONSTRATION } from "../../data/config";
import { BandeauDemonstration } from "../../components/BandeauDemonstration";

// Avocat : jeton confiné à /espace et /auth, /parametres refusé (403).
const IDENTITE_DEMO = { denomination: "Barreau de démonstration", ville: "Ville de démonstration", modeDemonstration: true };
vi.mock("../../api/client", () => ({
  api: vi.fn(async (path) => {
    if (path === "/auth/identite") return { identite: IDENTITE_DEMO };
    if (path === "/auth/login") return { token: "t", refreshToken: "r", user: { role: "AVOCAT" } };
    throw Object.assign(new Error("Accès refusé"), { status: 403 });
  }),
  getToken: () => null, getRefreshToken: () => null, setSession: vi.fn(), clearSession: vi.fn(), setUnauthorizedHandler: vi.fn(),
}));
vi.mock("../../api/realtime", () => ({ connecterRealtime: vi.fn(), deconnecterRealtime: vi.fn() }));

function Connexion() {
  const { loading, login } = useAuth();
  return loading ? null : <button onClick={() => login("a@b.cg", "x")}>connexion</button>;
}

// Recette T29 : l'écran de connexion et l'espace avocat gardaient « Barreau de Pointe-Noire »
// et n'affichaient pas la mention C-13 sous l'identité de démonstration.
describe("Identité publique : connexion et espace avocat", () => {
  beforeEach(() => appliquerConfig({ identite: { denomination: "Barreau de Pointe-Noire", modeDemonstration: false } }));

  it("est chargée avant l'écran de connexion, puis conservée pour un avocat sans accès à /parametres", async () => {
    render(<AuthProvider><Connexion /></AuthProvider>);
    await screen.findByText("connexion");
    expect(identite().denomination).toBe("Barreau de démonstration");
    await act(async () => screen.getByText("connexion").click());
    expect(identite().denomination).toBe("Barreau de démonstration");
    expect(identite().ville).toBe("Ville de démonstration");
  });

  it("le bandeau C-13 suit le mode démonstration", async () => {
    render(<BandeauDemonstration />);
    expect(screen.queryByText(MENTION_DEMONSTRATION)).toBeNull();
    await act(async () => appliquerConfig({ identite: { modeDemonstration: true } }));
    await waitFor(() => expect(screen.getByText(MENTION_DEMONSTRATION)).toBeInTheDocument());
  });
});

// R1-14 : une limite 429 sur /auth/identite ne doit pas faire retomber sur l'identité de base.
describe("Identité publique : limite 429", () => {
  it("réessaie après retryAfter au lieu de garder les défauts", async () => {
    const { api } = await import("../../api/client");
    appliquerConfig({ identite: { denomination: "Barreau de Pointe-Noire", modeDemonstration: false } });
    let n = 0;
    api.mockImplementationOnce(async () => { n++; throw Object.assign(new Error("429"), { status: 429, retryAfter: 0 }); });
    render(<AuthProvider><Connexion /></AuthProvider>);
    await screen.findByText("connexion");
    expect(n).toBe(1);
    expect(identite().denomination).toBe("Barreau de démonstration");
    expect(identite().modeDemonstration).toBe(true);
  });
});
