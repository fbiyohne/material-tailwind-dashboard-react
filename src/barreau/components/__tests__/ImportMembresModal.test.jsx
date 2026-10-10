import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "../Toast";
import { ImportMembresModal } from "../ImportMembresModal";
import { importerMembres } from "../../api/resources";

vi.mock("../../api/resources", () => ({ importerMembres: vi.fn() }));

const SIMULATION = {
  crees: 1, maj: 0, erreurs: [], simulation: true,
  doublons: [{ ligne: 2, type: "nom", avec: "base", num: 7, nom: "Dupont Jean" }],
  colonnes: { manquantes: [], inconnues: ["foo"] },
};
const rendre = () => render(<ToastProvider><ImportMembresModal open onClose={() => {}} /></ToastProvider>);
const fichier = () => new File(["num;nom\n7;Dupont Jean\n"], "liste.csv", { type: "text/csv" });
// jsdom n'implémente pas File.arrayBuffer
if (!File.prototype.arrayBuffer) File.prototype.arrayBuffer = function () { return new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsArrayBuffer(this); }); };

beforeEach(() => { vi.clearAllMocks(); importerMembres.mockResolvedValue(SIMULATION); });

describe("ImportMembresModal — aperçu avant import", () => {
  it("propose le modèle et affiche l'aperçu (simulation) avant toute confirmation", async () => {
    const { container } = rendre();
    expect(screen.getByRole("link", { name: /modèle d'import/i }).getAttribute("href")).toBe("/modeles/modele-import-membres.csv");
    await userEvent.upload(container.querySelector('input[type="file"]'), fichier());
    expect(await screen.findByTestId("apercu-simulation")).toBeTruthy();
    expect(screen.getByText(/rien n'est encore enregistré/)).toBeTruthy();
    expect(screen.getByText(/foo/)).toBeTruthy();
    expect(screen.getByText("Dupont Jean")).toBeTruthy();
    expect(importerMembres).toHaveBeenCalledTimes(1);
    expect(importerMembres.mock.calls[0][2]).toBe(true); // simulation
  });

  it("Annuler l'aperçu n'appelle pas l'import réel ; Confirmer l'appelle", async () => {
    const { container } = rendre();
    await userEvent.upload(container.querySelector('input[type="file"]'), fichier());
    await screen.findByTestId("apercu-simulation");
    await userEvent.click(screen.getByRole("button", { name: /annuler l'aperçu/i }));
    expect(screen.queryByTestId("apercu-simulation")).toBeNull();
    expect(importerMembres).toHaveBeenCalledTimes(1);

    await userEvent.upload(container.querySelector('input[type="file"]'), fichier());
    await screen.findByTestId("apercu-simulation");
    importerMembres.mockResolvedValue({ crees: 1, maj: 0, erreurs: [] });
    await userEvent.click(screen.getByRole("button", { name: /confirmer l'import/i }));
    await waitFor(() => expect(importerMembres).toHaveBeenLastCalledWith(expect.any(Array), undefined));
  });
});
