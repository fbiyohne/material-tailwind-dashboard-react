import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "../Tabs.jsx";

const tabs = [
  { id: "a", label: "Alpha", content: "contenu A" },
  { id: "b", label: "Bêta", content: "contenu B" },
];

// L'enveloppe collante est le parent du bloc qui porte le tablist.
const enveloppe = () => screen.getByRole("tablist").parentElement.parentElement;

describe("Tabs collants", () => {
  it("niveau 1 : enveloppe collante, sous la Topbar, défilement interne en colonne", () => {
    render(<Tabs tabs={tabs} vertical />);
    const c = enveloppe().className;
    expect(c).toContain("sticky");
    expect(c).toContain("top-[var(--haut-collant,0px)]");
    expect(c).toContain("lg:overflow-y-auto");
    expect(screen.getByRole("tablist").className).toContain("overflow-x-auto");
  });

  it("Tabs imbriqué : pas collant", () => {
    const imbrique = [{ id: "x", label: "Externe", content: <Tabs tabs={tabs} ariaLabel="Interne" /> }];
    render(<Tabs tabs={imbrique} />);
    const interne = screen.getByRole("tablist", { name: "Interne" }).parentElement.parentElement;
    expect(interne.className).not.toContain("sticky");
  });

  it("navigation clavier inchangée", () => {
    render(<Tabs tabs={tabs} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Alpha" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Bêta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("contenu B")).toBeInTheDocument();
  });
});
