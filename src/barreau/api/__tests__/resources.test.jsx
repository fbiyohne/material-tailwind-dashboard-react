import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { normaliserMembre } from "../resources";
import { STATUT_MEMBRE_META } from "../../data/derivations";
import { StatutBadge } from "../../components/StatutBadge";

describe("normaliserMembre — décès et radiation", () => {
  it("convertit le statut DECEDE et la date de décès en AAAA-MM-JJ", () => {
    const m = normaliserMembre({ statut: "DECEDE", dateDeces: "2026-09-15T00:00:00.000Z" });
    expect(m.statut).toBe("decede");
    expect(m.dateDeces).toBe("2026-09-15");
  });

  it("convertit la date de radiation et conserve le motif", () => {
    const m = normaliserMembre({ statut: "RADIE", dateRadiation: "2026-10-01T00:00:00.000Z", motifRadiation: "Décision n° 12" });
    expect(m.dateRadiation).toBe("2026-10-01");
    expect(m.motifRadiation).toBe("Décision n° 12");
  });

  it("laisse les dates absentes à null", () => {
    const m = normaliserMembre({ statut: "INSCRIT" });
    expect(m.dateDeces).toBeNull();
    expect(m.dateRadiation).toBeNull();
  });
});

describe("statut decede", () => {
  it("est déclaré dans STATUT_MEMBRE_META avec le ton gris", () => {
    expect(STATUT_MEMBRE_META.decede).toEqual({ label: "Décédé", ton: "gris" });
  });

  it("StatutBadge rend « Décédé »", () => {
    render(<StatutBadge statut="decede" />);
    expect(screen.getByText("Décédé")).toBeInTheDocument();
  });
});
