import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../Toast";
import { ConfirmProvider } from "../ConfirmDialog";
import { InscriptionModal, peutOuvrirInscription } from "../InscriptionModal";

vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user }) }));
vi.mock("../../api/resources", () => ({ inscrireMembre: vi.fn(), admettreDirectement: vi.fn(), getParametres: vi.fn().mockResolvedValue({ regles: { admissionDirecte: { cas: [] } } }) }));
let user;

// Parcours 3 (recette T29) : le bâtonnier, qui a l'action admission_directe, doit pouvoir l'ouvrir ;
// l'inscription ordinaire (POST /membres) reste réservée au SG et à l'ADMIN.
describe("Admission directe par le bâtonnier", () => {
  it("le bâtonnier avec l'action admission_directe ouvre l'inscription, un rôle sans l'action non", () => {
    expect(peutOuvrirInscription({ role: "BATONNIER", permissions: ["admission_directe"] })).toBe(true);
    expect(peutOuvrirInscription({ role: "SECRETAIRE_GENERAL" })).toBe(true);
    expect(peutOuvrirInscription({ role: "BATONNIER", permissions: [] })).toBe(false);
  });

  it("le modal du bâtonnier ne propose que l'admission directe (pas d'inscription ordinaire)", () => {
    user = { role: "BATONNIER", permissions: ["admission_directe"] };
    render(<MemoryRouter><ToastProvider><ConfirmProvider><InscriptionModal open onClose={() => {}} /></ConfirmProvider></ToastProvider></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "Inscription ordinaire" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Cas d.admission/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Admettre au tableau/ })).toBeInTheDocument();
  });
});
