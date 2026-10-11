# Inventaire des générations PDF (mission M-20261011, point 8)

Date : 2026-10-11. Branche `feat/ameliorations-fiche-avocat`. Aucun fichier de code modifié par cette tâche.
Les gabarits proposés (aperçus A4) viennent ensuite ; rien n'est appliqué à la production avant validation de Fabrice.

## 1. Contrôle de complétude

Commande : `grep -rnE "htmlVersPdf|envoyerPdf|envoyerDocumentPdf|jsPDF|html2canvas" server/src src/barreau`

Résultat : **46 occurrences dans 13 fichiers**, toutes classées ci-dessous.

| Fichier | Occ. | Section |
|---|---|---|
| server/src/lib/pdf.ts | 4 | 2 |
| server/src/routes/assemblees.ts | 3 | 3 |
| server/src/routes/discipline.ts | 3 | 3 |
| server/src/routes/espace.ts | 9 | 3 |
| server/src/routes/membres.ts | 3 | 3 |
| server/src/routes/messagerie.ts | 3 | 3 |
| server/src/routes/quitus.ts | 2 | 3 |
| server/src/routes/recus.ts | 2 | 3 |
| server/src/routes/reunions.ts | 4 | 3 |
| server/src/routes/scrutins.ts | 2 | 3 |
| server/src/routes/tableau.ts | 2 | 3 |
| src/barreau/utils/exports.js | 8 | 5 |
| src/barreau/components/QRCode.jsx | 1 (commentaire seul, aucun appel) | 5 |

Contrôles complémentaires : `window.print()` (hors grep ci-dessus) trouvé dans DocumentModal.jsx, Annuaire.jsx, CorpsElectoral.jsx, Stagiaires.jsx (section 5). `jsPDF` n'est importé que dans `utils/exports.js` ; Annuaire, CorpsElectoral et Stagiaires n'appellent ni jsPDF ni html2canvas directement.

## 2. Moteur serveur (Puppeteer)

| Fonction | Fichier | Format | Marges | En-tête / pied | Pagination | Défauts constatés |
|---|---|---|---|---|---|---|
| `htmlVersPdf(html)` | server/src/lib/pdf.ts l.123 | A4 portrait, fond imprimé | 16 mm partout, fixes | Aucun (`displayHeaderFooter` absent) | Automatique du navigateur, aucun « page x/y » | 1) pas de pied de page ni de numérotation, 2) pas d'en-tête répété sur les pages 2 et suivantes, 3) marge unique 16 mm quel que soit le document, 4) polices Google chargées par le réseau (seul hôte autorisé) : hors ligne, repli sur la police par défaut et mise en page différente |
| `envoyerPdf(res, html, nom)` | pdf.ts l.138 | A4 (via htmlVersPdf) | 16 mm | idem | idem | Mêmes défauts ; renvoie en pièce jointe sans contrôle de taille |
| `envoyerDocumentPdf(res, html, nom)` | pdf.ts l.150 | A4, `pageRanges: "1"` | 0 (le document porte son cadre) | Aucun | 1 page forcée | 1) mise à l'échelle CSS si la hauteur dépasse 1122 px : le texte rétrécit sans plancher, 2) `pageRanges: "1"` tronque en silence tout ce qui dépasse, 3) largeur de 794 px figée, 4) pas de numérotation (acceptable pour 1 page) |
| `trouverChromium`, `nouvellePage` | pdf.ts | sans objet | sans objet | sans objet | sans objet | Conforme (interception réseau, anti-SSRF) |

## 3. Routes serveur et gabarits

Deux familles de gabarits coexistent. Mêmes couleurs (marine `#1A3A6B`, or `#C4990A`, fond `#FDF6E3`), polices différentes.

- **Famille A, `templates.ts` → `documentHtml()`** : carte à bordure arrondie (`.doc`, rayon 6 px), bandeau marine « organe » en tête, filet or, titre Playfair Display 26 px, référence DM Mono, corps DM Sans 14 px / interligne 1,9, pied avec sceau, « Fait à… le… », bloc signature et cachet, mention « Document officiel ». Rendu par `envoyerPdf` (marges 16 mm).
- **Famille B, `documentsRiches.ts` → `recuRicheHtml` / `quitusRicheHtml`** : pleine page A4 (`@page margin 0`), double cadre or, coin décoratif, filigrane de sceau, en-tête sceau 104 px + dénomination, serif Georgia, bandeau marine de coordonnées en pied, bloc QR. Rendu par `envoyerDocumentPdf` (1 page, sans marge).

| # | Document | Route | Appel (fichier:ligne) | Gabarit | Famille | Format | QR | Défauts constatés |
|---|---|---|---|---|---|---|---|---|
| 1 | Quitus | GET /api/quitus/:id/pdf | quitus.ts:35 | `quitusRicheHtml` | B | A4, 1 page, marge 0 | oui (`/verifier/quitus/{numero}`, séquentiel) | Identité en 13 px, nom non mis en valeur ; durée « trois (03) mois » codée en dur (documentsRiches.ts l.218) ; devise « Défendre • Conseiller • Servir la Justice » codée en dur ; réduction d'échelle possible ; pas de date de fin de validité ; « Le Trésorier » ici, « La Trésorière » sur le reçu (libellés non alignés) |
| 2 | Reçu de paiement | GET /api/recus/:id/pdf | recus.ts:23 | `recuRicheHtml` | B | A4, 1 page, marge 0 | oui (`/verifier/recu/{numero}`) | Mêmes défauts d'identité et d'échelle ; aucune période couverte affichée ; montant en lettres généré à la volée sans contrôle de longueur |
| 3 | Reçu (espace avocat) | GET /api/espace/recus/:id/pdf | espace.ts:317 | `recuRicheHtml` | B | A4, 1 page | oui (même code que 2, QR dupliqué) | Idem 2 ; construction du QR dupliquée (4 endroits) |
| 4 | Quitus (espace avocat) | GET /api/espace/quitus/:id/pdf | espace.ts:330 | `quitusRicheHtml` | B | A4, 1 page | oui | Idem 1 |
| 5 | Attestation d'inscription (SG) | GET /api/membres/:id/attestation/pdf | membres.ts:996 | `attestationHtml` | A | A4, marge 16 mm | non | Pas de QR ni de numéro vérifiable en ligne ; pas de pied paginé ; carte à bordure arrondie en A4 ; corps court laissant la moitié de la page vide |
| 6 | Attestation d'inscription (avocat) | GET /api/espace/attestation/inscription/pdf | espace.ts:133 | `attestationHtml` | A | idem | non | Idem 5 |
| 7 | Attestation de non-redevance (avocat) | GET /api/espace/attestation/non-redevance/pdf | espace.ts:158 | `attestationNonRedevanceHtml` | A | idem | non | Idem 5 |
| 8 | Attestation envoyée en pièce jointe de message | POST /api/messagerie/:id/attestation | messagerie.ts:239 (`htmlVersPdf` direct) | `attestationHtml` ou `attestationNonRedevanceHtml` | A | A4, marge 16 mm | non | Idem 5 ; génération par `htmlVersPdf` direct (hors `envoyerPdf`) |
| 9 | Tableau de l'Ordre | GET /api/tableau/pdf | tableau.ts:85 | `tableauOrdreHtml` | A | A4 portrait, 3 pages pour 60 lignes (capture) | non | Pas de numérotation ni de répétition de l'en-tête de tableau sur les pages suivantes ; date d'arrêté seulement dans le titre ; tableau 12 px sous une carte à bordure qui se coupe d'une page à l'autre ; sans QR de vérification |
| 10 | Liste des avocats (export) | GET /api/membres/export/pdf | membres.ts:127 (`htmlVersPdf` direct) | `listeAvocatsHtml` | A | A4 **portrait**, 3 pages pour 70 lignes (capture) | non | 11 colonnes en 8 px (≈ 6 pt) en portrait : illisible à l'impression ; titre noyé dans un `<span>` 13 px à la place du titre 26 px ; pas de numérotation ; « Document interne » répété dans titre et pied ; paysage nécessaire |
| 11 | Convocation de réunion | GET /api/reunions/:id/convocation/pdf | reunions.ts:23 | `convocationReunionHtml` | A | A4 | non | Référence limitée à la date de réunion (pas de numéro d'ordre) ; pas de pied paginé |
| 12 | Feuille de présence | GET /api/reunions/:id/feuille-presence/pdf | reunions.ts:53 | `feuillePresenceHtml` | A | A4 portrait | non | Tableau d'émargement en 13 px sans hauteur de ligne fixe pour signer ; pas de répétition de l'en-tête sur plusieurs pages |
| 13 | PV de réunion | GET /api/reunions/:id/pv/pdf | reunions.ts:62 | `pvReunionHtml` | A | A4 (1 page en capture) | non | Sections I à V sans pagination ni pied de signature par page ; texte libre en `<p>` sans styles de liste cohérents |
| 14 | Convocation d'assemblée générale | GET /api/assemblees/:id/convocation/pdf | assemblees.ts:25 | `convocationAgHtml` | A | A4 | non | Idem 11 |
| 15 | Convocation d'AG (espace) | GET /api/espace/assemblees/:id/convocation/pdf | espace.ts:395 | `convocationAgHtml` | A | A4 | non | Doublon de route avec 14 |
| 16 | PV d'assemblée générale | GET /api/assemblees/:id/pv/pdf | assemblees.ts:57 | `pvAssembleeHtml` | A | A4 | non | Idem 13 |
| 17 | PV d'AG (espace) | GET /api/espace/assemblees/:id/pv/pdf | espace.ts:407 | `pvAssembleeHtml` | A | A4 | non | Doublon de route avec 16 |
| 18 | PV de scrutin | GET /api/scrutins/:id/pv/pdf | scrutins.ts:109 | `pvScrutinHtml` | A | A4 | non | Pas de ligne de total dans le tableau (total seulement en en-tête) ; pas de pied paginé ni de QR de contrôle |
| 19 | Convocation disciplinaire | GET /api/discipline/:id/convocation/pdf | discipline.ts:326 | `convocationDisciplineHtml` | A | A4 | non | Idem 11 |
| 20 | Décision disciplinaire | GET /api/discipline/:id/decision/pdf | discipline.ts:338 | `decisionDisciplineHtml` | A | A4 (1 page en capture) | non | Sanction dans un encart `.montant` prévu pour un montant ; décision longue coupée sans pied paginé ni mention « page x/y » |
| 21 | Décision disciplinaire (espace) | GET /api/espace/discipline/:id/decision/pdf | espace.ts:443 | `decisionDisciplineHtml` | A | A4 | non | Doublon de route avec 20 |
| 22 | Accusé de lecture (administration) | GET /api/messagerie/messages/:id/accuse/pdf | messagerie.ts:105 | `accuseReceptionHtml` | A | A4 (1 page, 146 Ko) | non | Aucun QR pour vérifier l'accusé ; empreinte SHA-256 en 11 px sans retour à la ligne contrôlé |
| 23 | Accusé de lecture (espace) | GET /api/espace/messagerie/messages/:id/accuse/pdf | espace.ts:704 | `accuseReceptionHtml` | A | A4 | non | Doublon de route avec 22 |

Défauts transverses de la famille A : en-tête présent seulement en page 1 ; carte à bordure arrondie qui se coupe d'une page à l'autre ; marge latérale effective d'environ 27 mm (16 mm de page plus 34 px de remplissage) ; tailles en px au lieu de pt ; mention « Document officiel » seulement en fin de dernière page ; aucune numérotation ni référence du document répétée ; aucune échelle typographique commune avec la famille B.

## 4. Captures PDF actuelles

Générées par `htmlVersPdf` sur des données fictives (aucune donnée réelle, pas de base touchée), dans `docs/design/pdf/actuel/` :

| Fichier | Famille | Pages | Remarque |
|---|---|---|---|
| quitus.pdf | B | 1 | rendu direct (marge 16 mm) ; en production : `envoyerDocumentPdf` |
| recu.pdf | B | 1 | idem |
| attestation.pdf | A | 1 | |
| attestation-non-redevance.pdf | A | 1 | |
| tableau.pdf | A | 3 | 60 lignes fictives |
| liste-avocats.pdf | A | 3 | 70 lignes fictives, portrait |
| pv-reunion.pdf | A | 1 | |
| decision-discipline.pdf | A | 1 | |
| accuse-lecture.pdf | A | 1 | |

Limite : aucun outil de rastérisation de PDF disponible sur le poste (ni pdftoppm ni mutool) ; les défauts de mise en page ci-dessus viennent de la lecture du code et du nombre de pages des captures, pas d'un contrôle visuel page par page. Les PDF sont à ouvrir avec un lecteur.

## 5. Côté client (navigateur)

| Fonction / usage | Fichier | Technique | Format | Défauts constatés |
|---|---|---|---|---|
| `exporterPdf(nom, sélecteur, {page})` | src/barreau/utils/exports.js l.7 | html2canvas (échelle 2) puis jsPDF | A4 en pt ; mode « page » : une page, marge 14 pt, JPEG 0,95 ; mode « flux » : marge 40 pt, tranches PNG | Image rastérisée : texte non sélectionnable, non vectoriel, QR flou à l'impression ; tranches coupées au milieu d'une ligne de tableau ; aucune numérotation ni pied ; poids élevé en PNG ; qualité dépendante de l'écran |
| `telechargerDocumentPdf(serveur, nom, sél.)` | exports.js l.70 | Serveur d'abord, repli sur `exporterPdf({page:true})` | A4 | Le repli produit un document différent du PDF serveur (deux rendus pour un même document) |
| `exporterPng`, `copierPng` | exports.js l.83 et l.100 | html2canvas (échelle 3) | PNG, hors PDF | Hors périmètre PDF ; concerne le timbre (point 9, repris par `timbreImage.js`) |
| Chargements `html2canvas` / `jspdf` | exports.js l.10-15, 86, 103 | import dynamique | sans objet | Conforme (hors bundle initial) |
| `DocumentModal` | components/DocumentModal.jsx l.35, 45-46 | `telechargerPdf(pdfPath)` serveur si fourni, sinon `exporterPdf` ou `window.print()` | A4 | Trois chemins différents selon la prop ; sans `pdfPath`, rendu client rastérisé. Appelé avec `pdfPath` par AssembleeDetail, DossierDetail, ReunionDetail (serveur) |
| `Quitus.jsx`, `Recus.jsx` | pages | `telechargerDocumentPdf` | A4, 1 page | Aperçu à l'écran (`QuitusDocument`, `RecuDocument`, Tailwind, 820 px) = troisième copie du gabarit à maintenir en plus de documentsRiches.ts |
| `Avocats.jsx` l.211 | pages | Serveur d'abord, repli `exporterPdf("#zone-impression-avocats")` | A4 | Le repli client produit une liste différente de `listeAvocatsHtml` |
| `Cotisations.jsx` l.163, `DroitsPlaidoirie.jsx` l.106 | pages | `exporterPdf` sur `EtatImprimable` | A4 flux | Aucun équivalent serveur ; états longs découpés en tranches image |
| `Annuaire.jsx` l.51 | page | `window.print()` + `.bpn-print-zone` | A4, marge 18 mm (`public/css/tailwind.css` @media print) | Pas de jsPDF ; mise en page dépendante du navigateur et de l'imprimante |
| `CorpsElectoral.jsx` l.109 | page | `window.print()` | A4, marge 18 mm | Idem |
| `Stagiaires.jsx` l.176 | page | `window.print()` | A4, marge 18 mm | Idem |
| `QRCode.jsx` | components | commentaire sur html2canvas, aucun appel | sans objet | Conforme (le QR est rendu en image pour la capture) |

## 6. Constats pour la proposition de gabarits

1. Trois implémentations du même document (Puppeteer famille A, Puppeteer famille B, composants Tailwind) et deux chaînes de repli : à ramener à un socle HTML/CSS unique côté serveur.
2. Aucune numérotation « page x/y » ni référence répétée en pied de page, alors que Puppeteer sait le faire (`displayHeaderFooter`, `footerTemplate`).
3. Les listes longues (tableau, liste d'avocats, états) demandent l'en-tête de tableau répété et, pour la liste d'avocats, un format paysage.
4. Marges et échelle typographique à fixer une fois (marges 18 à 20 mm, tailles en pt, corps 10 à 11 pt, identité 12 pt minimum).
5. Le QR existe seulement sur quitus et reçu ; à étendre aux attestations et aux PV si Fabrice le valide.
6. Doublons de routes entre `/api/espace/*` et les routes d'administration pour six documents : même gabarit, pas de risque de divergence visuelle, mais deux points d'appel à tenir à jour.
7. Les points 6 (identité lisible, validité calculée, QR signé) sont traités dans la mission comme correctifs locaux de la famille B, sans refonte globale.
