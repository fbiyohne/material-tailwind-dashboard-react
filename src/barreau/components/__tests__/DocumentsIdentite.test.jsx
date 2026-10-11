import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { appliquerConfig, PARAMETRES_DEFAUT } from "../../data/config";
import { RecuDocument } from "../RecuDocument";
import { QuitusDocument } from "../QuitusDocument";
import { DocumentChrome } from "../DocumentChrome";
import { EtatImprimable } from "../EtatImprimable";
import { AttestationModal } from "../AttestationModal";
import { ToastProvider } from "../Toast";

// Recette T29, parcours 11 : l'aperçu du reçu portait « Pointe-Noire, le … » et « au Barreau de Pointe-Noire »
// sous l'identité de démonstration (X-05 corrigé côté PDF serveur, pas dans les aperçus de l'interface).
const membre = { id: 1, num: 800001, nom: "BALANDRE Aline", cabinet: "Cabinet fictif", dateInscription: "2015-01-01", statut: "inscrit", qualite: "avocat" };

describe("Aperçus de documents à l'identité paramétrée", () => {
  beforeAll(() => appliquerConfig({ identite: { denomination: "Barreau de démonstration", ville: "Ville de démonstration", adresse: "Adresse de démonstration" } }));
  afterEach(cleanup);
  afterAll(() => appliquerConfig({ identite: PARAMETRES_DEFAUT.identite }));

  it.each([
    ["reçu", <RecuDocument key="r" numero="R-1" membre={membre} montant={150000} exercice={2026} mode="Espèces" date="2026-10-11" />],
    ["quitus", <QuitusDocument key="q" numero="Q-1" membre={membre} exercice={2026} date="2026-10-11" />],
    ["document", <DocumentChrome key="d" title="Attestation" reference="A-1">corps</DocumentChrome>],
    ["état imprimable", <EtatImprimable key="e" id="e" titre="État" entete={["A"]} lignes={[["x"]]} />],
    ["attestation", <ToastProvider key="a"><AttestationModal open onClose={() => {}} membre={membre} /></ToastProvider>],
  ])("%s : nouvelle dénomination et nouvelle ville, aucune occurrence de « Pointe-Noire »", (_n, el) => {
    render(el);
    expect(document.body.textContent).not.toMatch(/Pointe-Noire/i);
    expect(document.body.textContent).toMatch(/démonstration/);
  });
});
