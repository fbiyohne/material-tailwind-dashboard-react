import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Login } from "../Login";

vi.mock("../AuthContext", () => ({ useAuth: () => ({ login: vi.fn() }) }));
vi.mock("../AuthLayout", () => ({ AuthLayout: ({ children }) => <div>{children}</div> }));

afterEach(() => vi.unstubAllEnvs());

describe("Login : comptes de démonstration", () => {
  it("masqués et champs vides hors démo", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_DEMO", "");
    render(<Login />);
    expect(screen.queryByText(/Comptes de démonstration/)).toBeNull();
    expect(screen.queryByDisplayValue("barreau")).toBeNull();
  });
  it("affichés en mode démo", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_DEMO", "1");
    render(<Login />);
    expect(screen.getByText(/Comptes de démonstration/)).toBeTruthy();
  });
});
