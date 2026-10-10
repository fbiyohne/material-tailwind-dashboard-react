import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "../Toast";
import { MatriceAcces } from "../MatriceAcces";
import { getRbac, majRbacRole } from "../../api/resources";

vi.mock("../../api/resources", () => ({ getRbac: vi.fn(), majRbacRole: vi.fn().mockResolvedValue({}) }));

beforeEach(() => {
  vi.clearAllMocks();
  getRbac.mockResolvedValue({
    permissions: [{ cle: "membres", libelle: "Membres", description: "" }],
    actions: [{ cle: "discipline_decider", libelle: "Enregistrer une décision disciplinaire", description: "" }],
    rolesEditables: [{ cle: "BATONNIER", libelle: "Bâtonnier" }],
    rolesComplet: [{ cle: "SECRETAIRE_GENERAL", libelle: "Secrétaire Général" }],
    matrice: { BATONNIER: ["membres"] },
  });
});

describe("MatriceAcces — actions", () => {
  it("le PUT contient les clés de modules et d'actions", async () => {
    render(<ToastProvider><MatriceAcces /></ToastProvider>);
    await userEvent.click(await screen.findByLabelText("Bâtonnier — Enregistrer une décision disciplinaire"));
    await userEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(majRbacRole).toHaveBeenCalledTimes(1);
    const [role, cles] = majRbacRole.mock.calls[0];
    expect(role).toBe("BATONNIER");
    expect([...cles].sort()).toEqual(["discipline_decider", "membres"]);
  });
});
