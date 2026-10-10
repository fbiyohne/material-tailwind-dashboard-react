import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { JournalAudit } from "../JournalAudit";
import { listerAudit } from "../../api/resources";

// T18 — filtres utilisateur et action du journal d'audit (CA10).
vi.mock("../../api/resources", () => ({ listerAudit: vi.fn() }));

const reponse = {
  total: 1, page: 1, pageSize: 10,
  acteurs: [{ id: 3, nom: "Me SG Test" }, { id: 9, nom: "Me Avocat Test" }],
  items: [{ id: 1, userId: 9, action: "Envoi d'un message — Messagerie (message #12)", cible: "#4", methode: "POST", chemin: "/api/espace/messagerie/4", statut: 201, ip: "127.0.0.1", acteur: "Me Avocat Test", quand: "2026-10-10T10:00:00.000Z" }],
};

const rendre = () => render(<MemoryRouter><ToastProvider><JournalAudit /></ToastProvider></MemoryRouter>);

beforeEach(() => { vi.clearAllMocks(); listerAudit.mockResolvedValue(reponse); });

describe("JournalAudit — filtres", () => {
  it("affiche les filtres utilisateur, action et dates, et la ligne sans contenu de message", async () => {
    rendre();
    expect(await screen.findByText("Envoi d'un message — Messagerie (message #12)")).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Utilisateur" });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Me SG Test" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Action" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Du/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Au/)).toBeInTheDocument();
  });

  it("choisir un utilisateur et saisir une action relance la liste avec userId et action", async () => {
    rendre();
    await screen.findByText(/message #12/);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Utilisateur" }), "9");
    await waitFor(() => expect(listerAudit).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "9", page: 1 })));
    await userEvent.type(screen.getByRole("textbox", { name: "Action" }), "Envoi");
    await waitFor(() => expect(listerAudit).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "9", action: "Envoi" })));
    await userEvent.click(screen.getByRole("button", { name: "Réinitialiser" }));
    await waitFor(() => expect(listerAudit).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "", action: "" })));
  });
});
