import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { QuitusDocument } from "../components/QuitusDocument";
import { RecuDocument } from "../components/RecuDocument";
import { VignetteTimbre } from "../components/VignetteTimbre";

// On intercepte le QR pour lire la valeur encodée.
const valeurs = [];
vi.mock("../components/QRCode", () => ({ QRCode: ({ value }) => { valeurs.push(value); return null; } }));

const o = window.location.origin;
const membre = { nom: "BALANDRE Aline", dateInscription: "2015-01-01" };
const dernier = () => valeurs[valeurs.length - 1];

describe("QR des documents : chemin signé et repli", () => {
  afterEach(() => { cleanup(); valeurs.length = 0; });

  it("quitus : URL absolue du serveur telle quelle, sinon ancien chemin", () => {
    render(<QuitusDocument numero="Q-2026-0001" membre={membre} exercice={2026} date="2026-10-11" verif="https://ordre.exemple.cg/v/q/Q-2026-0001.K7M2Q9XAB4" />);
    expect(dernier()).toBe("https://ordre.exemple.cg/v/q/Q-2026-0001.K7M2Q9XAB4");
    cleanup();
    render(<QuitusDocument numero="Q-2026-0001" membre={membre} exercice={2026} date="2026-10-11" />);
    expect(dernier()).toBe(`${o}/verifier/quitus/Q-2026-0001`);
  });

  it("reçu : URL absolue du serveur telle quelle, sinon ancien chemin", () => {
    render(<RecuDocument numero="R-1" membre={membre} montant={1000} exercice={2026} mode="Espèces" date="2026-10-11" verif="https://ordre.exemple.cg/v/r/R-1.AAAAAAAAAA" />);
    expect(dernier()).toBe("https://ordre.exemple.cg/v/r/R-1.AAAAAAAAAA");
    cleanup();
    render(<RecuDocument numero="R-1" membre={membre} montant={1000} exercice={2026} mode="Espèces" date="2026-10-11" />);
    expect(dernier()).toBe(`${o}/verifier/recu/R-1`);
  });

  it("timbre : URL absolue du serveur telle quelle, sinon ancien chemin", () => {
    const t = { numero: 1, code: "TP-ABC", affaire: "X", montant: 5000 };
    render(<VignetteTimbre timbre={{ ...t, verif: "https://ordre.exemple.cg/v/t/TP-ABC.BBBBBBBBBB" }} />);
    expect(dernier()).toBe("https://ordre.exemple.cg/v/t/TP-ABC.BBBBBBBBBB");
    cleanup();
    render(<VignetteTimbre timbre={t} />);
    expect(dernier()).toBe(`${o}/verifier/timbre/TP-ABC`);
  });

  it("quitus : validité issue de finValidite, jamais en dur", () => {
    render(<QuitusDocument numero="Q-1" membre={membre} exercice={2026} date="2026-10-11" finValidite="2027-01-11" />);
    expect(document.body.textContent).toMatch(/Valable jusqu'au 11 janvier 2027 inclus/);
    expect(document.body.textContent).not.toMatch(/trois \(03\) mois|valable pour une durée de/i);
  });
});
