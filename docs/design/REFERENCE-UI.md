# Référence UI : design actuel de src/barreau (mission M-20261011, T2)

Relevé en lecture seule du design EXISTANT. Il ne propose aucun design nouveau : toutes les tâches front de la mission s'alignent dessus. Il complète `docs/design/REFERENCE-DESIGN.md` (mission précédente : identité, classes `bpn-*`, liste de contrôle CA13), dont le contenu reste valable ; ce fichier ajoute les chemins par motif, les rayons, les comportements à 360 px et les manques à combler.
La charte `~/.creatic/team/CHARTE-UI.md` ne sert ici que pour l'accessibilité et les états.

## 1. Jetons et leur source

| Famille | Valeurs | Source |
|---|---|---|
| Marine | `navy` #1A3A6B, `navy-2` #0d2247, `navy-3` #0a1a36 | `tailwind.config.cjs` (`theme.extend.colors`) |
| Or | `or` #C4990A, `or-2` #e8bc3a, `or-3` #f5d878, `or-L` #FDF6E3, `or-fonce` #8A6D08 (seul or autorisé pour du TEXTE sur fond clair) | idem |
| Neutres | `creme` #FAF8F3 (fond de page, `body`), `grisL` #F2EFE8, `grisM` #E0DBD0 (bordures), `gris` #7A756A (texte secondaire), `encre` #1C1C18 (texte) | idem |
| Sémantiques | `rouge` #8B1A1A, `vert` #1A5C3A ; fonds `rougeL` #f4e6e6, `vertL` #e6f4ee, `bleuL` #e6edf4 | idem |
| Variables CSS | `--bpn-navy`, `--bpn-or`, `--bpn-vert`, `--bpn-rouge`, `--bpn-gris` | `public/css/tailwind.css` (l.12-16), lues par `StatCard` |
| Polices | `font-display` Playfair Display (titres, valeurs), `font-sans` DM Sans (corps), `font-mono` DM Mono (références, numéros d'inscription) | `tailwind.config.cjs` ; chargées par Google Fonts dans `index.html` (l.12-15), pas auto-hébergées |
| Échelle de texte | `2xs` 12 px, `xs` 13, `sm` 15, `base` 17, `lg` 19 (aucun `text-[Npx]` dans les pages) | `tailwind.config.cjs` (`fontSize`) |
| Rayons | `rounded` boutons, champs, lignes de menu ; `rounded-md` Notice ; `rounded-lg` cartes de stat, modale, blocs en pointillé ; `rounded-xl` `bpn-card` et badges ; `rounded-full` pastilles, icônes rondes, croix de modale | classes `bpn-*` dans `public/css/tailwind.css` et composants |
| Ombres | `shadow-card` (0 4px 24px .08), `shadow-card-hover`, `shadow-modal` | `tailwind.config.cjs` (`boxShadow`) |
| Largeur | `max-w-container` 1500 px ; contenu en `px-4 py-6 md:px-8 md:py-8` | `tailwind.config.cjs`, `layout/BarreauLayout.jsx` l.49 |
| Ruptures | défaut Tailwind (sm 640, md 768, lg 1024, xl 1280) + `nav` 1400 | `tailwind.config.cjs` |
| Mouvement | `fadeIn`, `bpnTileIn`, `animate-spin-slow`, `animate-pulse-dot` ; `prefers-reduced-motion` neutralise tout | `public/css/tailwind.css` l.34-47 |
| Focus | halo or 2 px (`:focus-visible`), `bpn-btn` en ombre or 3 px | `public/css/tailwind.css` l.22-32 |

Aucune dépendance UI hormis `@heroicons/react` 2.0.18 (`24/outline` partout, `24/solid` à la marge). `@material-tailwind/react` est installé mais n'est pas utilisé dans `src/barreau`. Aucune autre bibliothèque d'icônes : tout nouvel icône vient de heroicons.

## 2. Motifs et composants à réutiliser

Tous les composants sont dans `src/barreau/components/`, exportés par `index.js`.

| Motif | Composant ou classe existant | Chemin | Notes d'usage |
|---|---|---|---|
| Bouton | `bpn-btn` + `bpn-btn-primary` (navy) / `-or` / `-ghost` / `-danger` / `-sm` ; wrapper avec `loading` | `components/Button.jsx`, classes dans `public/css/tailwind.css` | Désactivé : opacité 40 %. Texte `sm`, `rounded`, `px-4 py-2`. Cible tactile : `min-h-[44px] sm:min-h-0` (voir `pages/AvocatDetail.jsx` l.137-139) |
| Bouton danger discret | ghost + `text-rouge hover:!bg-rougeL hover:!text-rouge` | `pages/AvocatDetail.jsx` l.139 (`btnRouge`) | Contour, pas de rouge plein hors confirmation |
| Bouton-icône | NON DÉDIÉ. Précédent le plus proche : `bpn-btn bpn-btn-ghost` contenant une icône `h-4 w-4` ; croix ronde `h-6 w-6 rounded-full bg-grisL text-gris hover:bg-grisM` | `components/Modal.jsx` l.91 ; `pages/Avocats.jsx` (`ExporterInactif`) | Manque à combler (O2) : composé de `bpn-btn bpn-btn-ghost` carré (min 44 px sous `sm`), icône heroicons, `aria-label` ET `title` obligatoires |
| Menu déroulant | NON DÉDIÉ. Précédent : `<details>/<summary>` avec panneau `absolute z-20 mt-1 w-56 max-w-[calc(100vw-2rem)] rounded border border-grisM bg-white p-1 shadow-card`, lignes `min-h-[44px] rounded px-3 text-sm hover:bg-grisL`, icône `h-4 w-4`, Échap rend le focus au `<summary>` | `pages/Avocats.jsx` l.60-95 (menu d'export) | `MenuActions.jsx` (O2/D4) doit reprendre exactement ces classes ; séparateur `border-t border-grisM` ; entrée destructive `text-rouge hover:bg-rougeL` |
| Info-bulle | attribut `title` natif (pas de composant) | `components/StatutBadge.jsx` (`STATUT_AIDE`), `pages/AvocatDetail.jsx` l.161 | Toute icône seule porte `title` et `aria-label` ; ne pas créer de composant de bulle |
| Badge | `Badge` (tons vert, rouge, or, gris, bleu) avec point `bpn-badge-dot` ; `StatutBadge` pour le statut d'un membre | `components/Badge.jsx`, `components/StatutBadge.jsx` | `rounded-xl px-2.5 text-xs` ; libellé écrit + point, jamais la couleur seule ; omission = contour pointillé |
| Carte | `bpn-card` (`rounded-xl border border-grisM bg-white`), `bpn-card-header` (`px-4 py-2.5`, bordure basse), `bpn-card-heading` (Playfair `base` navy) | `public/css/tailwind.css` ; usages dans `pages/Dashboard.jsx`, `pages/Parametres.jsx` | Lignes libellé/valeur dans une carte pour les fiches |
| Tuile d'indicateur | `StatCard`, `bpn-stat` (`rounded-lg`, liseré gauche 3 px coloré, valeur Playfair 28 px) | `components/StatCard.jsx` | Grille `grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4` (Dashboard l.167, CorpsElectoral l.84) |
| Tableau | `DataTable` (tri, sélection, pagination, densité), `SortTh`, `Pagination`, style `bpn-table` (en-tête navy, capitales, survol `grisL/60`) | `components/DataTable.jsx`, `SortTh.jsx`, `Pagination.jsx` | Enveloppé dans `overflow-x-auto` : le défilement horizontal reste LOCAL au tableau, jamais sur la page ; passe lui-même par `Skeleton`, `ErrorState`, `EmptyState` |
| Onglets | `Tabs` (WAI-ARIA, actif marine + liseré or, icône optionnelle, compteur en pastille, `flex-wrap`) | `components/Tabs.jsx` | Utilisés par `pages/AvocatDetail.jsx` et `pages/Parametres.jsx` l.343 et l.493 |
| Modale | `Modal` (`open onClose title footer`, `max-w-2xl rounded-lg shadow-modal`, voile `bg-navy-3/80`, focus piégé, Échap) | `components/Modal.jsx` | Pied : `bpn-btn-ghost` Annuler puis `bpn-btn-primary` ou `-danger` |
| Confirmation | `ConfirmProvider` + `useConfirm()` (`danger`, `confirmLabel`, `motif` : saisie d'un texte obligatoire) | `components/ConfirmDialog.jsx` | Obligatoire avant toute action irréversible ; icône rouge ronde `bg-rougeL` |
| Modale d'acte de statut | `ActeStatutModal` (omission, radiation, décès, etc., avec pièce et date d'effet) | `components/ActeStatutModal.jsx` | À réutiliser pour tout changement de statut (parcours, radiation exécutoire) |
| Formulaire | `FormSection` (icône + titre + grille 1 ou 2 colonnes), `FormField` (libellé, requis, indice, erreur), `bpn-input`, `bpn-label` | `components/FormSection.jsx`, `FormField.jsx` | Champ : `rounded border-grisM`, focus bordure or + halo 3 px |
| Encart | `Notice` (tons or, rouge, vert, bleu, gris ; bord gauche 3 px, `text-xs`) | `components/Notice.jsx` | Pour l'explication en tête de « Parcours », les mentions « mode test » des Paramètres |
| Mention juridique | `MentionJuridique`, `BandeauExperimental` | `components/MentionJuridique.jsx`, `BandeauExperimental.jsx` | Prototype / bac à sable : toujours ce bandeau |
| État vide | `EmptyState` (icône ronde `bg-grisL`, titre Playfair, description, action) | `components/EmptyState.jsx` | Via `DataTable` (props `emptyTitle`, `emptyDescription`, `emptyIcon`) ; hors tableau, l'appeler directement |
| État erreur / chargement / retour | `ErrorState`, `Skeleton` / `TableSkeleton`, `ToastProvider` + `useToast()` (région `aria-live`) | `components/ErrorState.jsx`, `Skeleton.jsx`, `Toast.jsx` | Quatre états à couvrir : chargement, vide, erreur, succès |
| En-tête de page | `PageHeader` (eyebrow `bpn-eyebrow`, titre `bpn-title`, sous-titre, fil d'Ariane, actions à droite) | `components/PageHeader.jsx`, `Breadcrumb.jsx` | Toute page liste ou fiche commence ainsi |
| Frise chronologique | `Frise` (franchi marine plein, en cours anneau `or-fonce`, à venir pointillé gris) | `components/Frise.jsx` | Base du « Parcours » |
| Documents | `QuitusDocument`, `RecuDocument`, `VignetteTimbre`, `QRCode`, `Sceau`, `DocumentChrome`, `DocumentModal`, `EtatImprimable` | `components/` | Zone imprimable `bpn-print-zone`, masquage `bpn-no-print` |
| Matrice de droits | `MatriceAcces` | `components/MatriceAcces.jsx` | À étendre par la ligne Avocat en lecture seule |
| Recherche + filtres | `input.bpn-input pl-9` avec icône, `select.bpn-input sm:w-56`, paramètres d'URL (`setParam`) | `pages/Avocats.jsx` l.277-283 | Même barre pour « Anciens membres » |

## 3. Motifs d'écran

1. **Liste** (`pages/Avocats.jsx`) : `PageHeader` avec actions (Exporter, Importer), barre recherche et filtres, `bpn-card` contenant un `DataTable`, `StatutBadge`, état vide du tableau. « Anciens membres » reprend ce motif tel quel.
2. **Fiche** (`pages/AvocatDetail.jsx`) : fil d'Ariane, titre, badges (statut, qualité), ligne mono pour le numéro, rangée d'actions (l. 137-165), puis `Tabs`. La rangée d'actions est ce que O2 remplace par boutons-icônes et menu.
3. **Réglages à onglets** (`pages/Parametres.jsx`) : `Tabs` de premier niveau, sous-onglets, panneaux en `bpn-card` avec `FormSection`.
4. **Tableau de bord** (`pages/Dashboard.jsx`) : grilles de `StatCard` (1, 2 puis 4 colonnes), cartes à listes `max-h-80 divide-y overflow-y-auto`, barres de progression `h-1.5 rounded bg-grisM`.
5. **Document public ou imprimable** (`pages/TableauOrdre.jsx`, `pages/VerificationPublique.jsx`) : en-tête institutionnel, zone imprimable, actions `bpn-no-print`.
6. **Deux volets** (`pages/Messagerie.jsx`) : liste dans une carte, fil à droite, `EmptyState` en attente de sélection.

## 4. Comportement à 360 px

- Gouttières `px-4` (16 px) sous `md`, `md:px-8` au-delà ; contenu centré jusqu'à 1500 px (`BarreauLayout.jsx` l.49).
- Barre latérale (`layout/Sidebar.jsx`, 260 px, `fixed`) : tiroir hors écran sous `xl` (1280), voile `bg-navy-3/60` ; au-dessus elle est fixe. Le tiroir s'ouvre depuis `Topbar.jsx`.
- Cibles tactiles : 44 px minimum sous `sm` (`min-h-[44px] sm:min-h-0`), à reprendre pour tout nouveau bouton.
- Tableaux : `overflow-x-auto` local ; le reste de la page ne défile pas horizontalement. Un panneau flottant doit porter `max-w-[calc(100vw-2rem)]`.
- Grilles : toujours `grid-cols-1` d'abord, puis `sm:`, `md:`, `lg:`.
- Modales : `p-4` autour, `w-full max-w-2xl`, donc plein écran moins 32 px à 360 px.
- Espace avocat : `layout/EspaceAvocatLayout.jsx`, navigation en liens sur une ligne à partir de 1400 px (`nav`), menu déroulant en dessous.

## 5. Règles de cohérence pour la mission

1. Pas de nouveau jeton : couleurs, polices, rayons et ombres de la section 1 uniquement. Texte or sur fond clair : `text-or-fonce`.
2. Icônes : heroicons `24/outline`, `h-4 w-4` dans les boutons, `h-6 w-6` dans les états vides.
3. Aucun composant de bulle, de menu ou de bouton-icône générique n'existe : en créer UN de chaque (`MenuActions.jsx`, bouton-icône) en copiant les classes du menu d'export de `Avocats.jsx` et des boutons de `AvocatDetail.jsx`, puis les réutiliser partout.
4. Chaque icône seule : `aria-label` et `title`. Chaque badge : libellé et point.
5. Quatre états couverts sur tout nouvel écran : chargement, vide, erreur, succès.
6. Contrôle automatisé à 360 px : `document.documentElement.scrollWidth <= innerWidth`.
7. Points d'attention relevés, à traiter dans le point 5 de la mission sans changer le design : polices chargées depuis Google Fonts (dépendance réseau, voir la charte pour l'auto-hébergement, hors périmètre ici) ; `text-[28px]` dans `.bpn-stat-value` et `text-[Npx]` éventuels résiduels à vérifier par grep ; `@material-tailwind/react` inutilisé hors config.

## 6. Hors périmètre de ce relevé

Aucune capture n'a été prise (les captures « avant » de la mission précédente sont dans `docs/captures/avant-*.png` ; celles du point 5 seront prises par la tâche d'audit). Aucun fichier de `src/` n'a été modifié.
