// Tests de rendu des composants partagés de la mission d'audit (T3 design) :
// BandeauExperimental, MentionJuridique, StatutBadge (10 statuts), Frise, StatutMessage.
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BandeauExperimental, TEXTE_EXPERIMENTAL } from "../BandeauExperimental";
import { MentionJuridique, MENTIONS } from "../MentionJuridique";
import { StatutBadge, STATUT_AIDE } from "../StatutBadge";
import { Frise } from "../Frise";
import { StatutMessage, statutMessage } from "../StatutMessage";
import { STATUT_MEMBRE_META } from "../../data/derivations";

const STATUTS = ["inscrit", "suspendu", "radie", "omis", "honoraire", "stagiaire", "decede", "demissionnaire", "retraite", "cessation"];
// Promesses interdites tant qu'elles ne sont pas prouvées (CA16, avis juridique).
const PROMESSES = /chiffr|sécuris|securis|certifi[ée]e?s?|probatoire(?! à confirmer)|horodatage qualifié|signature électronique|recommandé électronique|garanti/i;

describe("BandeauExperimental", () => {
  it("affiche exactement le texte de l'avis juridique", () => {
    render(<BandeauExperimental />);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(
      "Expérimental — non utilisable pour un scrutin officiel ou une émission réelle. Aucun paiement réel n'est effectué.",
      { normalizeWhitespace: true },
    );
    expect(note.textContent.replace(/\s+/g, " ").trim()).toBe(TEXTE_EXPERIMENTAL);
  });
});

describe("MentionJuridique", () => {
  it("rend une mention libre avec sa source et sa nature « Loi »", () => {
    render(<MentionJuridique nature="loi" article="Loi n° 026-92, art. 27">Stage de deux ans.</MentionJuridique>);
    const note = screen.getByRole("note");
    expect(within(note).getByText("Loi")).toBeInTheDocument();
    expect(within(note).getByText("Loi n° 026-92, art. 27")).toBeInTheDocument();
    expect(within(note).getByText("Stage de deux ans.")).toBeInTheDocument();
  });

  it("distingue visuellement et textuellement la nature « Provisoire »", () => {
    render(<MentionJuridique nature="provisoire" article="Règlement intérieur — à confirmer">Sursis.</MentionJuridique>);
    expect(screen.getByText("Provisoire")).toBeInTheDocument();
  });

  it.each(Object.keys(MENTIONS))("préréglage « %s » : texte, article, sans promesse", (type) => {
    render(<MentionJuridique type={type} />);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(MENTIONS[type].texte.replace(/\s+/g, " "));
    expect(note).toHaveTextContent(MENTIONS[type].article);
    expect(note.textContent).not.toMatch(PROMESSES);
  });
});

describe("StatutBadge", () => {
  it.each(STATUTS)("couvre le statut « %s » avec libellé et infobulle", (s) => {
    const { container } = render(<StatutBadge statut={s} />);
    expect(STATUT_MEMBRE_META[s]).toBeDefined();
    expect(screen.getByText(STATUT_MEMBRE_META[s].label)).toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute("title", STATUT_AIDE[s]);
  });

  it("OMIS et RADIE ont des libellés et des classes différents", () => {
    const { container: omis } = render(<StatutBadge statut="omis" />);
    const { container: radie } = render(<StatutBadge statut="radie" />);
    expect(STATUT_MEMBRE_META.omis.label).not.toBe(STATUT_MEMBRE_META.radie.label);
    expect(omis.firstChild.className).not.toBe(radie.firstChild.className);
    expect(STATUT_AIDE.omis).toMatch(/temporaire/i);
    expect(STATUT_AIDE.radie).toMatch(/disciplinaire/i);
  });

  it("annonce l'explication aux lecteurs d'écran quand decrire est actif", () => {
    render(<StatutBadge statut="omis" decrire />);
    expect(screen.getByText(STATUT_AIDE.omis, { exact: false })).toHaveClass("sr-only");
  });

  it("aucune infobulle ne promet sécurité ni chiffrement", () => {
    for (const s of STATUTS) expect(STATUT_AIDE[s]).not.toMatch(PROMESSES);
  });

  it("statut inconnu : affiche la clé brute en gris", () => {
    render(<StatutBadge statut="autre" />);
    expect(screen.getByText("autre")).toBeInTheDocument();
  });
});

describe("Frise", () => {
  const etapes = [
    { libelle: "Rappel", date: "2026-03-01", detail: "Courrier n° 12", etat: "fait" },
    { libelle: "Mise en demeure", date: "2026-04-02T10:00:00.000Z", etat: "courant" },
    { libelle: "Transmission", etat: "a_venir" },
  ];

  it("rend une liste ordonnée étiquetée, une entrée datée par étape", () => {
    render(<Frise titre="Circuit des impayés" etapes={etapes} />);
    const liste = screen.getByRole("list", { name: "Circuit des impayés" });
    const items = within(liste).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0].querySelector("time")).toHaveAttribute("dateTime", "2026-03-01");
    expect(within(items[0]).getByText("Courrier n° 12")).toBeInTheDocument();
  });

  it("porte l'état de chaque étape en texte, pas seulement en couleur", () => {
    render(<Frise titre="Circuit" etapes={etapes} />);
    expect(screen.getByText("Étape franchie :")).toHaveClass("sr-only");
    expect(screen.getByText("Étape en cours :")).toHaveClass("sr-only");
    expect(screen.getByText("Étape à venir :")).toHaveClass("sr-only");
    expect(screen.getByText("Non daté")).toBeInTheDocument();
  });

  it("affiche un état vide utile", () => {
    render(<Frise titre="Historique" etapes={[]} vide="Aucun changement de situation enregistré." />);
    expect(screen.getByText("Aucun changement de situation enregistré.")).toBeInTheDocument();
  });
});

describe("StatutMessage", () => {
  it("déduit le statut le plus avancé", () => {
    expect(statutMessage({ envoyeLe: "2026-10-01" })).toBe("envoye");
    expect(statutMessage({ envoyeLe: "2026-10-01", recuLe: "2026-10-01" })).toBe("recu");
    expect(statutMessage({ envoyeLe: "2026-10-01", recuLe: "2026-10-01", luLe: "2026-10-02" })).toBe("lu");
  });

  it.each([
    [{}, "Envoyé"],
    [{ recuLe: "2026-10-01T09:00:00Z" }, "Reçu"],
    [{ recuLe: "2026-10-01T09:00:00Z", luLe: "2026-10-01T10:00:00Z" }, "Lu"],
  ])("affiche le libellé en texte (%o → %s)", (dates, libelle) => {
    render(<StatutMessage envoyeLe="2026-10-01T08:00:00Z" {...dates} />);
    expect(screen.getByText(libelle)).toBeInTheDocument();
  });

  it("donne le détail horodaté (infobulle et lecteur d'écran)", () => {
    const { container } = render(<StatutMessage envoyeLe="2026-10-01T08:00:00Z" recuLe="2026-10-01T09:00:00Z" luLe="2026-10-01T10:00:00Z" />);
    const racine = container.firstChild;
    expect(racine.getAttribute("title")).toMatch(/^Envoyé le .+ · reçu le .+ · lu le .+$/);
    expect(racine.querySelector(".sr-only").textContent).toBe(racine.getAttribute("title"));
  });
});
