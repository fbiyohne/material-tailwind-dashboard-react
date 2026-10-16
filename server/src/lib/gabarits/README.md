# Gabarits PDF — socle commun et directions

Feuilles de style de tous les documents PDF rendus par le serveur (Puppeteer, `../pdf.ts`).
Source unique : `../gabarit.ts` les lit une fois au chargement, et `server/scripts/apercus-gabarits.ts` aussi.

| Fichier | Rôle |
|---|---|
| `socle.css` | Jetons (couleurs et polices de l'application), échelle typographique, page A4 (marges 18/18/18/20 mm), composants communs : en-tête, identité, tableau, signatures, bloc de vérification, mentions |
| `officielle.css` | Direction « Officielle » (appliquée par défaut depuis le 2026-10-16) : papier à en-tête réel du Barreau — logo entre deux filets bleus, pied à coordonnées et bandes jaune et bleue. Aperçus : `docs/design/pdf/officielle/` |
| `institutionnelle.css` | Direction 1 « Institutionnelle sobre » (sélectionnable) |
| `classique.css` | Direction 2 « Classique juridique » (sélectionnable) |
| `compacte.css` | Direction 3 « Compacte administrative » (sélectionnable) |

Une direction ne fait que redéfinir des variables et l'habillage du socle.

## Choisir la direction

Un seul point : `export const DIRECTION_PDF` dans `../gabarit.ts`. Changer sa valeur bascule tous les
documents, sans toucher aux gabarits de documents. Le paramètre `direction` de `pageA4()` ne sert qu'au
script de contrôle.

## Assembler un document

```ts
import { pageA4, entete, titre, champs, signatures, blocVerif } from "./gabarit.js";
const html = pageA4({ titreCourt: "Quitus", reference: numero, unePage: true, contenu: `${entete(...)}<main>…</main>` });
await envoyerPdf(res, html, "Quitus.pdf");
```

`pageA4()` ajoute à chaque document :

- les règles `@page` : A4 (ou A4 paysage avec `paysage: true`), pied commun C-PDF-PIED
  « dénomination · Réf. … » à gauche et « Page x/y » à droite, en-tête courant (dénomination · titre court)
  à partir de la page 2 seulement (`@page :first`) ;
- la clause C-PDF-LISTE dans le pied de chaque page avec `listeRestreinte: true` (listes non publiques ;
  le tableau de l'Ordre, public, n'en a pas besoin) ;
- la mention C-13 uniquement si l'identité est en mode démonstration.

Direction « officielle » : le pied (coordonnées, « Réf. … · Page x/y », clause C-PDF-LISTE, bandes) est
un `<template id="pied-pdf">` que `htmlVersPdf()` passe à Chrome comme `footerTemplate` (dessiné dans la
marge basse de chaque page, styles en ligne obligatoires). Une copie `.pied-ecran` le montre dans les aperçus
à l'écran (iframe), masquée à l'impression. Logo : celui des Paramètres, sinon `server/assets/logo-barreau.png`.

`blocVerif(qr, url)` place le QR reçu tel quel (data URI de `qrDocument`, ou SVG produit par le serveur)
et la clause CL-VERIF mot pour mot. La taille imprimée du QR est la variable `--qr` du socle (au moins 25 mm).
Ni la charge signée ni l'URL `/v/...` ne sont produites ici.

L'identité (dénomination, ordre, adresse, logo) vient toujours de `identite()` (Paramètres), jamais en dur.

## Rendu

`htmlVersPdf()` rend avec `preferCSSPageSize: true` : le `@page` du document fait foi. Aucune marge,
aucune mise à l'échelle ni découpe de page n'est imposée par le code (`envoyerDocumentPdf` n'est plus
qu'un alias de `envoyerPdf`). Un document trop long passe donc sur une page de plus au lieu d'être réduit :
on resserre le gabarit, jamais l'échelle.

Termes interdits (HJ-6) dans les en-têtes, pieds et clauses : « certifié », « signature électronique »,
« horodatage qualifié », « recommandé électronique », « chiffré de bout en bout », « vote vérifiable »,
« secret garanti ». Le test `server/test/pdf-gabarit.test.ts` le vérifie.

## Documents assemblés sur le socle

- Famille A (`../templates.ts`, `documentHtml()`) : attestations, convocations, feuille de présence, PV,
  décision disciplinaire, accusé de lecture, tableau de l'Ordre, liste des avocats (paysage, C-PDF-LISTE).
- Famille B (`../documentsRiches.ts`) : quitus et reçu de paiement, une page chacun, `blocVerif()` avec la
  chaîne QR reçue des routes (`qrDocument`, inchangée) et le chemin signé `cheminVerif()`. Textes, numéro,
  date et montant repris à l'identique. Espacements resserrés localement (jamais l'échelle) : tient sur une
  page avec les noms, cabinets et adresses les plus longs (contrôlé par rendu réel, M-20261016 T5).
  Test : `server/test/documents-riches-socle.test.ts`.
  Aperçus de l'application : `POST /quitus/apercu` et `POST /recus/apercu` renvoient le HTML du même
  assembleur (QR remplacé par `QR_APERCU` avant délivrance), affiché par `ApercuServeur.jsx`.
- Listes et états de l'écran (corps électoral, annuaire, stagiaires, cotisations, droits de plaidoirie) :
  `POST /etats/pdf` (`../../routes/etats.ts`) met en page les lignes envoyées, sans cachet ni QR,
  en diffusion restreinte ; refusé aux comptes avocat. Test : `server/test/etats-pdf.test.ts`.
