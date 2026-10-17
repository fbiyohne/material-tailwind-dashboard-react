import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuActions } from "../MenuActions";

function monter(extra = {}) {
  const a = vi.fn(), b = vi.fn(), c = vi.fn();
  render(
    <div>
      <MenuActions entrees={[
        { id: "a", libelle: "Contacter", onSelect: a },
        { id: "b", libelle: "Accès espace", onSelect: b, disabled: true, motif: "Déjà activé" },
        { id: "c", libelle: "Supprimer", onSelect: c, danger: true, separe: true },
      ]} {...extra} />
      <p>dehors</p>
    </div>,
  );
  return { a, b, c };
}

describe("MenuActions", () => {
  it("s'ouvre au clic et expose les rôles ARIA", async () => {
    monter();
    const bouton = screen.getByRole("button", { name: /actions/i });
    expect(bouton).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("menu")).toBeNull();
    await userEvent.click(bouton);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
    expect(bouton).toHaveAttribute("aria-expanded", "true");
  });

  it("flèche bas déplace le focus, en sautant l'entrée désactivée", async () => {
    monter();
    await userEvent.click(screen.getByRole("button", { name: /actions/i }));
    expect(screen.getByRole("menuitem", { name: "Contacter" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Supprimer" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Contacter" })).toHaveFocus();
  });

  it("Échap ferme et rend le focus au bouton", async () => {
    monter();
    const bouton = screen.getByRole("button", { name: /actions/i });
    await userEvent.click(bouton);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(bouton).toHaveFocus();
  });

  it("un clic extérieur ferme le menu", async () => {
    monter();
    await userEvent.click(screen.getByRole("button", { name: /actions/i }));
    await userEvent.click(screen.getByText("dehors"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("une entrée désactivée n'est pas déclenchable et porte son motif", async () => {
    const { a, b } = monter();
    await userEvent.click(screen.getByRole("button", { name: /actions/i }));
    const off = screen.getByRole("menuitem", { name: "Accès espace" });
    expect(off).toHaveAttribute("aria-disabled", "true");
    expect(off).toHaveAttribute("title", "Déjà activé");
    await userEvent.click(off);
    expect(b).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Contacter" }));
    expect(a).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
