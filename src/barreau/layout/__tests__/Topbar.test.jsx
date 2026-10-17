import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Topbar } from "../Topbar";
import { appliquerConfig, MENTION_DEMONSTRATION } from "../../data/config";

vi.mock("../../api/resources", () => ({
  listerMembres: vi.fn().mockResolvedValue({ items: [] }),
  getAgenda: vi.fn().mockResolvedValue([]),
  getMesNotifications: vi.fn().mockResolvedValue({ items: [] }),
  marquerNotifLue: vi.fn(),
  marquerToutesNotifsLues: vi.fn(),
}));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { role: "SECRETAIRE_GENERAL" } }) }));

describe("Topbar — mention C-13", () => {
  it("n'apparaît qu'en mode démonstration", async () => {
    appliquerConfig({ identite: { modeDemonstration: false } });
    render(<MemoryRouter><Topbar title="Test" /></MemoryRouter>);
    expect(screen.queryByText(MENTION_DEMONSTRATION)).toBeNull();
    await act(async () => appliquerConfig({ identite: { modeDemonstration: true } }));
    expect(screen.getByText(MENTION_DEMONSTRATION)).toBeInTheDocument();
    await act(async () => appliquerConfig({ identite: { modeDemonstration: false } }));
    expect(screen.queryByText(MENTION_DEMONSTRATION)).toBeNull();
  });
});
