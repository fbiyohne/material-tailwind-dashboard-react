import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { VignetteTimbre } from "../components/VignetteTimbre";

// On intercepte le QR pour lire la valeur encodée.
const valeurs = [];
vi.mock("../components/QRCode", () => ({ QRCode: ({ value }) => { valeurs.push(value); return null; } }));

const o = window.location.origin;
const dernier = () => valeurs[valeurs.length - 1];

describe("QR des documents : chemin signé et repli", () => {
  afterEach(() => { cleanup(); valeurs.length = 0; });

  it("timbre : URL absolue du serveur telle quelle, sinon ancien chemin", () => {
    const t = { numero: 1, code: "TP-ABC", affaire: "X", montant: 5000 };
    render(<VignetteTimbre timbre={{ ...t, verif: "https://ordre.exemple.cg/v/t/TP-ABC.BBBBBBBBBB" }} />);
    expect(dernier()).toBe("https://ordre.exemple.cg/v/t/TP-ABC.BBBBBBBBBB");
    cleanup();
    render(<VignetteTimbre timbre={t} />);
    expect(dernier()).toBe(`${o}/verifier/timbre/TP-ABC`);
  });
});
