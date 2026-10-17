import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApercuAjuste } from "../ApercuAjuste";

describe("ApercuAjuste", () => {
  it("rend le document à largeur fixe, sans planter sans ResizeObserver", () => {
    render(<ApercuAjuste largeur={820}><p>Gabarit</p></ApercuAjuste>);
    expect(screen.getByText("Gabarit").parentElement.style.width).toBe("820px");
  });
});
