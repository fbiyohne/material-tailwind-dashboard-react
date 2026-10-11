# Gabarits PDF A4 : trois directions proposées (mission M-20261011, point 8)

Date : 2026-10-11. Branche `feat/ameliorations-fiche-avocat`.

> **Statut : proposition en attente de la validation de Fabrice. Rien n'est appliqué.**
> Aucun document de production n'utilise ces gabarits : `server/src/lib/templates.ts` et `server/src/lib/documentsRiches.ts` ne sont pas modifiés, et aucune route n'importe `docs/design/pdf/gabarits/` ni `server/scripts/apercus-gabarits.ts`. L'application suivra le choix de Fabrice, dans une tâche séparée.

Point de départ : l'inventaire `INVENTAIRE.md` (23 routes, deux familles de gabarits, aucune numérotation de page, en-tête absent après la page 1, réduction d'échelle et troncature silencieuse des documents d'une page).

## 1. Fichiers

| Chemin | Contenu |
|---|---|
| `gabarits/socle.css` | Socle commun : jetons, échelle typographique, page A4, grille, composants |
| `gabarits/institutionnelle.css`, `classique.css`, `compacte.css` | Les trois directions. Chacune ne fait que redéfinir des variables et l'habillage du socle |
| `gabarits/html/<direction>/<document>.html` | HTML autonome généré (18 fichiers), qu'on peut ouvrir dans un navigateur |
| `apercus/<direction>-<document>.pdf` | Aperçus rendus par `htmlVersPdf`, le moteur de production (18 PDF) |
| `server/scripts/apercus-gabarits.ts` | Générateur sur données fictives, avec contrôle du format A4 et du nombre de pages |

Pour régénérer, depuis `server/` : `npx tsx scripts/apercus-gabarits.ts`. Le code de sortie vaut 1 si une page n'est pas en 210 x 297 mm, si un document d'une page en déborde, ou si la liste tient sur une seule page.

Les six documents sont les mêmes dans chaque direction :

- famille « document officiel » : quitus, reçu, timbre, attestation ;
- famille « liste » : tableau de l'Ordre, 72 lignes sur 3 pages ;
- famille « procès-verbal » : PV d'assemblée générale, 2 pages.

## 2. Socle commun (identique pour les trois directions)

| Élément | Règle |
|---|---|
| Format | A4 portrait de 210 x 297 mm, vérifié sur les 18 PDF |
| Marges | 18 mm en haut, à gauche et à droite ; 20 mm en bas, pour le pied. Elles sont posées par `@page` dans le CSS, et Chrome les applique en priorité sur la marge de 16 mm de `htmlVersPdf` (essai du 2026-10-11) |
| Grille | 174 mm utiles, colonne de libellés de 40 mm, gouttière de 5 mm |
| Polices | Celles de l'application, sans nouvelle police : Playfair Display (titres), DM Sans (texte), DM Mono (références et numéros). La direction classique ajoute Georgia, déjà utilisée par `documentsRiches.ts` |
| Couleurs | Les jetons de `tailwind.config.cjs`, sans nouveau jeton : marine #1A3A6B, or #C4990A, or foncé #8A6D08 pour le texte, crème, gris |
| Échelle (pt) | 7,5 légende, 8,5 petit, 10,5 corps, **12 identité**, **14 nom**, 13 section, 28 titre. Chiffres tabulaires |
| En-tête (page 1) | Sceau dessiné, « Barreau de démonstration », Ordre, adresse, référence et date du document |
| En-tête courant (pages 2 et suivantes) | Dénomination et titre court, dans la boîte de marge `@top-left`, absent en page 1 |
| Pied de page (toutes les pages) | À gauche, dénomination et référence du document ; à droite, **« Page x/y »** (`counter(page)` / `counter(pages)`) |
| Tableaux | En-tête répété à chaque page, lignes jamais coupées |
| Clôture | Lieu, date et signatures ne sont jamais séparés d'une page à l'autre |
| Document d'une page | Composition en colonne : l'espace libre se place au-dessus du bloc de vérification, qui reste en bas de page. Plus de réduction d'échelle ni de `pageRanges: "1"` |
| Bloc QR | QR de niveau de correction M, 28 mm imprimés (26 mm en classique, au-dessus du minimum de 25 mm), URL courte `/v/{q,r,t}/{numero}.{jeton}`, avec la clause CL-VERIF mot pour mot. Le texte ne parle jamais de « signature électronique », sauf pour dire que le code n'en est pas une |
| Mentions | Clause C-13 (données fictives) sur chaque document ; timbre : CL-TIMBRE et « Prototype – sans valeur, aucun paiement réel » |

### Mentions minimales vérifiées (avis juridique)

| Document | Mentions présentes dans l'aperçu |
|---|---|
| Reçu | Numéro de série continue (« Reçu n° (série continue) R-2026-0187 »), date d'émission, émetteur (en-tête : Ordre et adresse), payeur et n° d'inscription, objet et exercice couvert (tableau), montant en chiffres et en lettres en FCFA (`montantEnLettresFCFA`, fonction de production), mode de paiement, référence de transaction |
| Quitus | Clause CL-VALIDITE-QUITUS. La date de fin est **calculée** par `finValiditeQuitus(délivrance, 3)` (fonction de production, paramètre `regles.quitus.validiteMois`) et n'est jamais écrite en dur |
| Tableau de l'Ordre | Date d'arrêté dans l'en-tête, dans le cartouche de synthèse, dans l'en-tête courant et dans la formule de clôture |
| PV d'AG | Date de transmission dans l'en-tête et le cartouche, et phrase de transmission (art. 23 de la loi n° 026-92) |
| Timbre | Numéro, date, affaire, juridiction, n° de rôle, statut, règle d'usage unique |

## 3. Les trois directions

### Direction 1 : « Institutionnelle sobre »

La page se lit comme un registre. L'en-tête est aligné à gauche et souligné d'un filet marine. Sa marque est un court onglet or, repris devant chaque titre de partie. Les libellés sont en petites capitales, dans une colonne fixe de 40 mm, et le texte s'aligne sur la colonne des valeurs. Il n'y a pas de cadre : seul l'encart de validité a un fond crème.

- Forces : identité et montant trouvés d'un coup d'œil, grâce à l'alignement sur une seule colonne. Elle supporte la photocopie et le fax en noir et blanc. Elle consomme peu d'encre. C'est la plus proche de la famille A actuelle (mêmes polices). Les documents d'une page gardent une vraie réserve, ce qui laisse de la marge pour un nom ou une adresse longs.
- Limites : elle est moins solennelle qu'un acte encadré. Le décalage du texte sur la colonne des valeurs réduit la largeur des longs PV (environ 130 mm).

### Direction 2 : « Classique juridique »

Elle prolonge la famille B (quitus et reçus actuels). La composition est centrée, avec le sceau au centre, un double filet or et un cadre double or sur les documents d'une page. Les titres sont en capitales espacées et le texte courant en Georgia justifié. Le QR prend la place du cachet, au centre entre les deux signatures.

- Forces : c'est la plus « officielle » à la remise en main propre, et elle reste continue avec les quitus déjà délivrés. Placer le QR entre les signatures retrouve la place du sceau central actuel.
- Limites : le cadre et l'en-tête centré coûtent environ 25 mm de hauteur. Le timbre et le reçu ont dû être resserrés pour tenir sur une page, si bien qu'un nom ou une adresse plus longs pourraient déborder sur une deuxième page. Georgia n'existe pas sous Linux (Render) : Chrome la remplacera par une police serif de repli, et le rendu de production différera de ces aperçus faits sous Windows, sauf à auto-héberger une serif. Le cadre consomme de l'encre or.

### Direction 3 : « Compacte administrative »

Elle suit la logique d'un formulaire administratif. Un bandeau marine porte la dénomination, avec une case blanche pour la référence. L'identité tient dans des cases à libellé. Les tableaux ont un en-tête marine et un fond alterné. Le corps est en 9,5 pt, mais l'identité garde 12 pt et le nom 14 pt.

- Forces : c'est la plus dense pour les listes et les états de gestion (35 lignes sur une page pleine, contre 32 à 33 pour les deux autres). Chaque information se retrouve sans lire le texte.
- Limites : elle a un air de formulaire et non d'acte, ce qui pose problème pour une attestation ou un quitus. Le bandeau marine est lourd en encre et passe mal à la photocopie. Le gain de densité est faible sur une liste à 5 colonnes.

### Comparaison

| Critère | 1. Institutionnelle | 2. Classique | 3. Compacte |
|---|---|---|---|
| Lisibilité de l'identité (12 et 14 pt) | Très bonne | Bonne (italique pour les libellés) | Très bonne |
| Solennité d'un acte | Moyenne | Forte | Faible |
| Marge pour un contenu plus long sur une page | Large | Faible (resserrée) | Large |
| Lignes de tableau par page pleine | 32 | 33 | 35 |
| Photocopie et fax en noir et blanc | Excellent | Bon (filets or pâles) | Moyen (bandeau plein) |
| Encre | Faible | Moyenne (cadre) | Forte (bandeau) |
| Rendu identique sous Linux (Render) | Oui | Non (Georgia absente) | Oui |
| Continuité avec l'existant | Famille A | Famille B | Aucune |

## 4. Recommandation

**Direction 1, « Institutionnelle sobre », pour tous les documents.** C'est la seule qui réunit trois qualités : un rendu identique en production, une réserve de place sur les documents d'une page, et une impression ou photocopie propre. Elle remplace les deux familles actuelles par un seul socle. Si Fabrice tient à la solennité du quitus actuel, une variante possible consiste à garder la direction 1 partout et à n'appliquer la clôture de la direction 2 (QR au centre entre les signatures) qu'au quitus et à l'attestation. Ce n'est qu'une option, que nous ne recommandons pas par défaut.

## 5. Ce qu'il faudra trancher ou faire lors de l'application (après validation)

1. Choisir la direction (ou la variante ci-dessus).
2. Version de Chrome en production : les boîtes de marge (`@bottom-right`, `counter(pages)`) exigent Chrome 131 ou plus. Les aperçus ont été rendus avec le Chrome 155 du poste. Il faut vérifier la version installée par Puppeteer sur Render.
3. Polices : elles sont chargées depuis Google Fonts, seul hôte autorisé par `pdf.ts`. Hors ligne, le rendu passe sur les polices de repli. L'auto-hébergement des trois polices (licence OFL) est à prévoir.
4. QR sur les attestations : l'aperçu propose un type `a` (`/v/a/...`), qui n'existe pas dans le jeton signé actuel (types q, r, t). Il faudra l'ajouter si Fabrice valide l'extension du QR aux attestations (constat 5 de l'inventaire).
5. Liste des avocats en 11 colonnes (export) : elle demande l'A4 paysage. `htmlVersPdf` impose `format: "A4"` en portrait. Il faudra une option de paysage (`landscape` ou `preferCSSPageSize`) au moment de l'application. Les aperçus restent en portrait, au format demandé.
6. Documents d'une page : afficher « Page 1/1 » ou masquer la numérotation (`@page :first` sur ces seuls documents) ? Le socle l'affiche partout, par cohérence.
7. Supprimer la mise à l'échelle et `pageRanges: "1"` de `envoyerDocumentPdf`, qui deviennent inutiles et tronquent en silence ; ramener `QuitusDocument` et `RecuDocument` (aperçu à l'écran) au même HTML que le PDF (constat 1).

## 6. Vérification

- `npx tsx scripts/apercus-gabarits.ts` : code de sortie 0. 18 PDF produits ; toutes les pages en 210 x 297 mm, les documents officiels sur 1 page, les listes sur 3 pages et les PV sur 2 pages (contrôle intégré : lecture des `/MediaBox` après décompression des flux).
- Contrôle croisé avec PyMuPDF : les 18 fichiers mesurent 210,2 x 297,0 mm (A4 de Chrome). « Page x/y » est présent sur chaque page : « Page 1/3 », « Page 2/3 », « Page 3/3 » pour les listes, « Page 1/2 », « Page 2/2 » pour les PV.
- Contrôle visuel : les pages ont été rastérisées par PyMuPDF et relues une à une. Défauts trouvés puis corrigés : URL coupée au milieu de la référence, signatures seules en page 4, débordements d'une page, cases vides dans la direction compacte, sélecteurs de la clôture classique qui fuyaient sur les listes.
- Limite : le QR n'a pas été scanné avec un téléphone. Les URL sont fictives (`barreau-demo.cg`) et les jetons ne sont pas calculés par `signature.ts`.
