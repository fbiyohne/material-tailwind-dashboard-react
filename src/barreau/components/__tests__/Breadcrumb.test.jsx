import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Breadcrumb } from "../Breadcrumb";

describe("Breadcrumb", () => {
  it("rend les segments, le dernier non cliquable", () => {
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: "Avocats", to: "/avocats" }, { label: "Me BAKALA" }]} />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Avocats" })).toHaveAttribute("href", "/avocats");
    expect(screen.getByText("Me BAKALA")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Me BAKALA" })).toBeNull();
  });
});
