import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../Toast";
import { ConfirmProvider } from "../ConfirmDialog";
import { InscriptionModal } from "../InscriptionModal";
import { admettreDirectement, getParametres } from "../../api/resources";

let user = { role: "SECRETAIRE_GENERAL", permissions: ["admission_directe"] };
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user }) }));
vi.mock("../../api/resources", () => ({ inscrireMembre: vi.fn(), admettreDirectement: vi.fn(), getParametres: vi.fn() }));

const CAS = [{ code: "MAGISTRAT", libelle: "Magistrat", ancienneteMinAns: 5, article: "loi n° 026-92, art. 32-1°" }];
const rendre = () => render(<MemoryRouter><ToastProvider><ConfirmProvider><InscriptionModal open onClose={() => {}} /></ConfirmProvider></ToastProvider></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  user = { role: "SECRETAIRE_GENERAL", permissions: ["admission_directe"] };
  getParametres.mockResolvedValue({ regles: { admissionDirecte: { cas: CAS } } });
});

describe("InscriptionModal — admission directe", () => {
  it("affiche cas (depuis les règles), ancienneté, référence et mention provisoire", async () => {
    rendre();
    await userEvent.click(screen.getByRole("button", { name: "Admission directe" }));
    expect(await screen.findByRole("option", { name: "Magistrat" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Ancienneté/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Référence de la décision/)).toBeInTheDocument();
    expect(screen.getByText(/Provisoire, à confirmer par les textes/)).toBeInTheDocument();
  });

  it("refuse une ancienneté insuffisante, puis envoie l'admission", async () => {
    admettreDirectement.mockResolvedValue({ id: 9, numInscription: "PN-2026-009" });
    rendre();
    await userEvent.click(screen.getByRole("button", { name: "Admission directe" }));
    await screen.findByRole("option", { name: "Magistrat" });
    await userEvent.type(screen.getByLabelText(/Nom et prénom/), "KOUMBA Jean");
    await userEvent.selectOptions(screen.getByLabelText(/Cas d'admission/), "MAGISTRAT");
    await userEvent.type(screen.getByLabelText(/Ancienneté/), "3");
    await userEvent.type(screen.getByLabelText(/Référence de la décision/), "DEC-12");
    await userEvent.click(screen.getByRole("button", { name: /Admettre au tableau/ }));
    expect(await screen.findByText(/5 ans au moins pour ce cas/)).toBeInTheDocument();
    expect(admettreDirectement).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText(/Ancienneté/));
    await userEvent.type(screen.getByLabelText(/Ancienneté/), "6");
    await userEvent.click(screen.getByRole("button", { name: /Admettre au tableau/ }));
    await waitFor(() => expect(admettreDirectement).toHaveBeenCalledWith(expect.objectContaining({ nom: "KOUMBA Jean", cas: "MAGISTRAT", ancienneteAns: 6, reference: "DEC-12" })));
  });

  it("sans la permission : pas de bascule vers l'admission directe", () => {
    user = { role: "CONSULTATION", permissions: [] };
    rendre();
    expect(screen.queryByRole("button", { name: "Admission directe" })).not.toBeInTheDocument();
    expect(getParametres).not.toHaveBeenCalled();
  });
});
