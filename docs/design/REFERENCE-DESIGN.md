# Référence du design actuel (mission M-20261010-audit-ordre-avocats, T1)

Relevé du design EXISTANT du logiciel du Barreau. Ce document n'en propose aucun nouveau : il fixe ce à quoi tout développement suivant doit s'aligner. Aucune refonte, aucun changement d'identité.
Sources : `tailwind.config.cjs`, `public/css/tailwind.css`, `src/barreau/components/`. Captures « avant » : `docs/captures/avant-*.png`.

## 1. Identité

Institutionnelle marine et or, serif de titre, sans-serif de texte. Fond crème, cartes blanches à bordure `grisM`, rayon `rounded-xl` (cartes et pastilles) / `rounded` (boutons). Barre latérale marine très foncé, bandeau supérieur blanc.

## 2. Jetons (tailwind.config.cjs, seule source)

| Famille | Jetons |
|---|---|
| Marine | `navy` #1A3A6B, `navy-2` #0d2247, `navy-3` #0a1a36 |
| Or | `or` #C4990A (boutons, bordures, accents, texte sur marine), `or-2` #e8bc3a, `or-3` #f5d878, `or-L` #FDF6E3 (fonds), `or-fonce` #8A6D08 (TEXTE or sur fond clair) |
| Neutres | `creme` #FAF8F3 (fond de page), `grisL` #F2EFE8, `grisM` #E0DBD0 (bordures), `gris` #7A756A (texte secondaire), `encre` #1C1C18 (texte) |
| Sémantiques | `rouge` #8B1A1A, `vert` #1A5C3A ; fonds `rougeL` #f4e6e6, `vertL` #e6f4ee, `bleuL` #e6edf4 |
| Variables CSS | `--bpn-navy`, `--bpn-or`, `--bpn-vert`, `--bpn-rouge`, `--bpn-gris` (utilisées par StatCard) |
| Ombres | `shadow-card`, `shadow-card-hover`, `shadow-modal` |
| Points de rupture | défaut Tailwind + `nav` 1400px (barre de l'espace avocat) ; `max-w-container` 1500px |
| Animations | `animate-spin-slow`, `animate-pulse-dot`, `fadeIn`, `bpnTileIn` ; `prefers-reduced-motion` géré globalement |

Typographie : `font-display` Playfair Display (titres, valeurs de StatCard), `font-sans` DM Sans (corps), `font-mono` DM Mono (références, numéros). Échelle nommée : `2xs` 12px, `xs` 13px, `sm` 15px, `base` 17px, `lg` 19px. Règle de la config : aucune taille `text-[Npx]` arbitraire dans les pages.
Icônes : `@heroicons/react` 2.0.18, surtout `24/outline` (87 fichiers), `24/solid` en second plan (8 fichiers). Aucune autre bibliothèque.
Focus : halo or 2px (`:focus-visible`), `bpn-btn` en ombre or 3px.

## 3. Classes `bpn-*` (public/css/tailwind.css)

- Titres : `bpn-eyebrow` (capitales or-fonce, filet or), `bpn-title` (Playfair navy, 28 à 44px fluide).
- Cartes : `bpn-card`, `bpn-card-header`, `bpn-card-heading`.
- Indicateurs : `bpn-stat`, `bpn-stat-label`, `bpn-stat-value`, `bpn-stat-sub`.
- Badges : `bpn-badge` + `-vert` `-rouge` (plein, blanc) `-or` `-gris` `-bleu`, `bpn-badge-dot`.
- Boutons : `bpn-btn` + `-primary` (navy) `-or` `-ghost` `-danger`, `-sm` ; désactivé 40 %.
- Tableau : `bpn-table` (en-tête navy, capitales, survol `grisL/60`).
- Formulaires : `bpn-input`, `bpn-input-dark`, `bpn-label`.
- Contenu riche : `bpn-doc`. Chargement : `bpn-skeleton`. Impression : `bpn-print-zone`, `bpn-no-print`.
- Les autres occurrences `bpn-navy`, `bpn-or`, `bpn-rouge`, `bpn-vert`, `bpn-gris` sont des variables CSS, pas des classes de composant.

## 4. Composants réutilisables (src/barreau/components/, export via `index.js`)

| Composant | Rôle |
|---|---|
| `PageHeader.jsx` | eyebrow, titre, sous-titre, fil d'Ariane, actions à droite (`children`) |
| `DataTable.jsx`, `SortTh.jsx`, `Pagination.jsx` | tableau triable, densité `confort` ou `compact` |
| `Tabs.jsx` | onglets WAI-ARIA, actif marine + liseré or, `content` nœud ou fonction |
| `Modal.jsx` | dialogue accessible (focus piégé, Échap), props `open onClose title footer` |
| `ConfirmDialog.jsx` | `ConfirmProvider` + `useConfirm()` : confirmation avant toute action irréversible |
| `FormSection.jsx`, `FormField.jsx` | section icône + titre + grille 1 ou 2 colonnes ; libellé, requis, indice, erreur reliée (`aria-describedby`) |
| `StatCard.jsx` | tuile indicateur à liseré gauche coloré (`accent`) |
| `Badge.jsx`, `StatutBadge.jsx` | pastille avec point (jamais la couleur seule) ; statut de membre avec infobulle |
| `Notice.jsx` | encart bordé à gauche, tons or, rouge, vert, bleu, gris |
| `EmptyState.jsx`, `ErrorState.jsx`, `Skeleton.jsx`, `Toast.jsx` | états vide, erreur, chargement, retour |
| `Frise.jsx`, `MentionJuridique.jsx`, `BandeauExperimental.jsx`, `StatutMessage.jsx` | ajoutés par dd9f2dd (section 6) |

Composants métier existants à réutiliser avant d'en créer : `StagePanel`, `InscriptionModal`, `ImportMembresModal`, `MatriceAcces`, `PiecesDossier`, `MessageBulle`, `RecuDocument`, `QuitusDocument`, `AttestationModal`, `PaiementModal`, `EtatImprimable`.

## 5. Motifs d'écran de référence

1. **Liste** (Avocats, `docs/captures/avant-avocats-*.png`) : `PageHeader` (eyebrow, titre Playfair, sous-titre, actions Exporter/Importer), barre recherche + filtre, `DataTable` à en-tête navy, `StatutBadge`, actions `bpn-btn-sm bpn-btn-ghost` par ligne.
2. **Fiche** (AvocatDetail) : fil d'Ariane, titre, badges (statut, qualité), ligne mono, barre d'actions (secondaires ghost, principale `bpn-btn-primary`, danger en contour rouge), puis `Tabs` (Identité, Cotisations, Documents, Discipline), contenu en `bpn-card` à lignes libellé/valeur.
3. **Document public ou imprimable** (Tableau de l'Ordre) : en-tête institutionnel, `bpn-table`, zone `bpn-print-zone`, actions masquées à l'impression (`bpn-no-print`).
4. **Deux volets** (Messagerie) : liste de conversations dans une `bpn-card` à gauche, fil à droite, `EmptyState` tant que rien n'est sélectionné, bulles `MessageBulle` (marine pour l'utilisateur).

Motif transversal : une action sensible ouvre un `Modal` (ou `useConfirm`) avec `FormSection` + `FormField`, pied de modale avec `bpn-btn-ghost` (Annuler) et `bpn-btn-primary` ou `bpn-btn-danger`.

## 6. Composants dd9f2dd : contrôle d'alignement

| Composant | Verdict | Remarque |
|---|---|---|
| `Frise` | aligné | marine plein pour franchi, anneau `or-fonce` pour en cours, pointillé `gris` à venir ; heroicons ; sens porté par le texte et la forme |
| `MentionJuridique` | aligné | tons existants, icône `ScaleIcon` heroicons |
| `BandeauExperimental` | aligné | `border-or bg-or-L text-encre`, icône `BeakerIcon`, gabarit identique à `Notice` or |
| `StatutMessage` | aligné | `text-2xs`, `text-navy` ou `text-encre/70`, `text-or-2` sur bulle marine, coches heroicons |
| `StatutBadge` étendu | aligné | passe par `Badge` et `STATUT_MEMBRE_META` ; l'omission se distingue par un contour pointillé |

Aucune couleur, police, ombre ni bibliothèque nouvelle.

### Décision `.bpn-badge-or` : CONSERVÉ en `text-or-fonce`

`git diff 76958a4 -- tailwind.config.cjs public/css/tailwind.css` : aucune ligne dans `tailwind.config.cjs` ; dans `tailwind.css`, exactement la ligne `.bpn-badge-or` (`text-or` devient `text-or-fonce`) et son commentaire, rien d'autre.

Mesure WCAG (luminance relative) du texte sur le fond du badge `or-L` #FDF6E3 :

| Texte | Contraste | AA (4,5:1) |
|---|---|---|
| `or` #C4990A (avant) | 2,46:1 | échec |
| `or-fonce` #8A6D08 (après) | 4,56:1 | réussi |

Écart perçu : même teinte or, un peu plus sombre, sur la même pastille pâle ; `or-fonce` est déjà utilisé par `bpn-eyebrow` et dans une dizaine d'écrans. Rien qui ressemble à une refonte : on ne rétablit pas `text-or`.

## 7. Liste de contrôle CA13 (à passer à chaque tâche front)

- [ ] `git diff 76958a4 -- tailwind.config.cjs` ne montre aucune ligne.
- [ ] `git diff 76958a4 -- public/css/tailwind.css` ne montre que la ligne `.bpn-badge-or` de dd9f2dd.
- [ ] `package.json` : aucune nouvelle dépendance UI ; aucune nouvelle police.
- [ ] Couleurs uniquement via les jetons (pas de `#hex`, pas de `bg-[#...]`) ; tailles via `2xs` à `lg` ; texte or sur fond clair = `or-fonce`.
- [ ] Icônes `@heroicons/react/24/outline` uniquement.
- [ ] Écrans assemblés avec `PageHeader`, `DataTable`, `Tabs`, `Modal` ou `useConfirm`, `FormSection`/`FormField`, `StatCard`, `Badge`/`StatutBadge`, `Notice`, `EmptyState` ; aucun composant dupliqué.
- [ ] Badges : libellé écrit + point ; jamais la couleur seule.
- [ ] États couverts : chargement (`Skeleton`), vide (`EmptyState`), erreur (`ErrorState`), succès (`Toast`), désactivé.
- [ ] Rendu à 360 px sans défilement horizontal ; focus visible.
- [ ] Captures « après » à 360 et 1280 px comparées aux `avant-*.png` : aucune différence hors ajouts fonctionnels.
- [ ] Textes en français ; mentions juridiques via `MentionJuridique` ; prototypes via `BandeauExperimental`.

## 8. Captures « avant »

Instance http://localhost:4100, base barreau_pn_test, compte Secrétaire Général : `docs/captures/avant-avocats-{360,1280}.png`, `avant-avocat-detail-{360,1280}.png` (fiche n° 1), `avant-tableau-{360,1280}.png`, `avant-messagerie-{360,1280}.png`. Viewports 1280x900 et 360x780, première vue sans défilement.
Observation : la liste Messagerie contient des fils de tests automatisés (« E2E msgA ») ; ne pas photographier le jeu de démonstration sur cette base sans en tenir compte.
