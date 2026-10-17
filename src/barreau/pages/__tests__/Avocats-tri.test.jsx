import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { Avocats } from "../Avocats";
import { listerMembres } from "../../api/resources";

vi.mock("../../api/resources", () => ({
  listerMembres: vi.fn(),
  getCotisations: vi.fn().mockResolvedValue([]),
  supprimerMembre: vi.fn(),
  telechargerAvocatsPdf: vi.fn(),
  journaliserExport: vi.fn(),
}));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { role: "SECRETAIRE_GENERAL" } }) }));
vi.mock("../../components/AttestationModal", () => ({ AttestationModal: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  listerMembres.mockResolvedValue({ items: [{ id: 1, num: 1, nom: "BAKALA Jean", qualite: "titulaire", statut: "inscrit", dateInscription: "2010-01-05" }] });
});

describe("Avocats — tri par date d'inscription", () => {
  it("envoie sort=dateInscription au serveur (paramètre de GET /membres) et affiche la colonne", async () => {
    render(<MemoryRouter><ToastProvider><ConfirmProvider><Avocats /></ConfirmProvider></ToastProvider></MemoryRouter>);
    await screen.findByText("Me BAKALA Jean");
    expect(listerMembres.mock.calls[0][0].sort).toBeUndefined();
    await userEvent.selectOptions(screen.getByLabelText("Trier par"), "dateInscription");
    await waitFor(() => expect(listerMembres).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "dateInscription" })));
    expect(screen.getByRole("columnheader", { name: /Inscription/ })).toBeInTheDocument();
  });
});
