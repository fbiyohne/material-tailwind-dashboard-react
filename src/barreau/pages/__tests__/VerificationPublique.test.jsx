import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerificationPublique } from "../VerificationPublique";

// T10 (avis juridique, point 6) : la page ne qualifie plus le contrôle de « signature
// électronique RSA » ; elle porte la clause CL-VERIF.
afterEach(() => vi.unstubAllGlobals());

describe("VerificationPublique — clause CL-VERIF", () => {
  it("affiche la clause CL-VERIF et aucune mention RSA", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ valide: true, type: "quitus", numero: "Q-2026-0001", date: "2026-10-01" }) }));
    const { container } = render(<VerificationPublique type="quitus" numero="Q-2026-0001" />);
    expect(await screen.findByText("Document authentique")).toBeInTheDocument();
    const texte = container.textContent;
    expect(texte).toContain("Ce code permet de contrôler que le document a été émis par l'Ordre et d'en connaître le statut actuel. Il ne constitue pas une signature électronique.");
    expect(texte).toContain("Authenticité vérifiable en scannant ce code ou sur ");
    expect(texte).not.toMatch(/RSA|SHA-256/);
  });
});
