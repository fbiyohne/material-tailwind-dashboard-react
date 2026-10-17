# Référence de design : écrans touchés par la levée des restrictions ADMIN (M-20261016-admin-droit-a-tout, T1)

Relevé en lecture seule au HEAD 6cf62b9 (branche feat/parametres-pdf-espace-avocat-droits). Aucun fichier sous `src/` n'est modifié. Le design actuel fait foi : cette page ne propose aucun design nouveau.

Le cadrage parle de Material Tailwind : ce n'est pas le cas. `@material-tailwind/react` est installé mais inutilisé dans `src/barreau`. Les composants réels sont les classes `bpn-*` (`public/css/tailwind.css`), les composants maison de `src/barreau/components` et `@heroicons/react` 24/outline. Référence complète des jetons : `docs/design/REFERENCE-UI.md`.

## 1. Écrans relevés

| Écran | Fichier | Structure actuelle | Classes et composants réellement présents |
|---|---|---|---|
| Messagerie | `src/barreau/pages/Messagerie.jsx` | Wrapper `space-y-5` (l.73), puis `PageHeader` (l.74) avec `eyebrow="Institutionnel"` et `sousTitre`, puis grille `lg:grid-cols-[20rem_1fr]` | `PageHeader`, `bpn-card`, `bpn-card-header`, `bpn-card-heading`, `ChatBubbleLeftRightIcon`, `UserIcon` (`h-3.5 w-3.5 text-or`), `text-xs text-gris` |
| Pièces (page) | `src/barreau/pages/Pieces.jsx` | Wrapper `space-y-5` (l.121), `PageHeader` (l.122) avec `sousTitre`, barre de filtres `flex flex-col gap-3 sm:flex-row`, `DataTable` | `PageHeader`, `DataTable`, bouton « Voir » `bpn-btn bpn-btn-ghost bpn-btn-sm` + `EyeIcon h-3.5 w-3.5` (l.96-97), `text-xs text-gris` pour les sous-lignes |
| Pièces (dossier) | `src/barreau/components/PiecesDossier.jsx` | Liste `li` en `flex flex-col gap-2 px-4 py-3 sm:flex-row`, texte d'aide `text-xs text-gris` (l.89, « Aucun document. ») | Bouton « Voir » `bpn-btn bpn-btn-ghost !py-1.5 text-xs` + `EyeIcon h-3.5 w-3.5` (l.98-99), `Badge` |
| Fiche avocat | `src/barreau/pages/AvocatDetail.jsx` | Actions dans un menu d'actions : entrée `{ id: "acces", libelle: "Accès espace", Icon: KeyIcon }` (l.170), conditionnée par `peutGererAcces` (l.48) | `KeyIcon` (heroicons), `Link` `inline-flex items-center gap-1.5 text-sm text-` (l.99), boutons `btnIcone` `bpn-btn-ghost` / `bpn-btn-primary` (l.197-203) |
| Utilisateurs | `src/barreau/pages/Utilisateurs.jsx` | `space-y-5` (l.156), bouton « Nouveau compte » `bpn-btn bpn-btn-or shrink-0` (l.158), carte « Demandes d'accès » (l.164-167), bouton « Provisionner » `bpn-btn bpn-btn-or !py-1.5 text-xs` (l.187), « Refuser » `bpn-btn bpn-btn-ghost !py-1.5 text-xs` (l.190) | `bpn-card`, `bpn-card-header`, `bpn-card-heading flex items-center gap-2`, `InboxArrowDownIcon h-4 w-4 text-or`, `CheckIcon`/`XMarkIcon h-3.5 w-3.5`, choix de rôle `[["avocat", "Accès espace avocat"], ["personnel", "Compte du personnel"]]` (l.317) |

Conditions de rôle à lever (état HEAD, à confirmer par la tâche de code) : `src/barreau/pages/Pieces.jsx:95` (`user?.role !== "ADMIN" &&` autour du bouton Voir) et `src/barreau/components/PiecesDossier.jsx:97` (même condition, commentaire « 403 pour l'ADMIN »).

## 2. Motif de la ligne d'information « Les accès de l'administrateur à ce contenu sont journalisés. »

Motif existant, à reprendre tel quel : le composant `Notice` (`src/barreau/components/Notice.jsx`, exporté par `src/barreau/components/index.js` l.7). Il est déjà utilisé pour les textes d'information sur les écrans de paramétrage.

Source du motif : `src/barreau/components/ParametresModules.jsx` l.39 (ton `or` avec icône) et `src/barreau/components/ParametresCanaux.jsx` l.220 (ton `gris`, sans icône, phrase d'information de service).

Snippet à reprendre (ton neutre, comme ParametresCanaux l.220) :

```jsx
<Notice ton="gris" icon={LockClosedIcon}>Les accès de l'administrateur à ce contenu sont journalisés.</Notice>
```

Import à ajouter : `import { Notice } from "../components";` (Messagerie et Pièces importent déjà depuis `../components`). `LockClosedIcon` vient de `@heroicons/react/24/outline`, déjà utilisé dans `ParametresModules.jsx`.

Emplacement : juste après le `PageHeader` et avant le contenu, dans le wrapper `space-y-5` existant. Pour Messagerie, après la ligne 74. Pour Pièces, après la ligne 122. Pas de classe supplémentaire : l'espacement vient de `space-y-5`.

Rendu : `Notice` applique `flex items-start gap-2.5 rounded-md border-l-[3px] px-3 py-2.5 text-xs border-grisM bg-grisL text-encre`, avec l'icône `h-4 w-4 text-gris`. Le texte est en `text-xs` (13 px), ce qui correspond au texte d'aide de l'écran.

Pour `PiecesDossier` (composant embarqué dans la fiche avocat), la ligne n'est pas ajoutée : elle est déjà couverte par la page Pièces. Un seul ajout par écran suffit.

## 3. Règles à respecter pour l'implémentation

1. Aucun nouveau composant : seul `Notice` existant est utilisé.
2. Aucun nouveau jeton de couleur. Le ton `gris` est déjà dans la palette (`grisL`, `grisM`, `gris`, `encre`).
3. Texte d'aide en `text-xs text-gris` ou via `Notice` : pas de `text-[Npx]`.
4. Pour les boutons levés (Voir, Accès espace, rôles), reprendre les classes en place (`bpn-btn-ghost`, `bpn-btn-or`, `!py-1.5 text-xs`). Ne rien changer d'autre.
5. Pas de nouvel icône hors heroicons 24/outline.
6. Le menu Messagerie (`src/barreau/routes.jsx` l.109, `sauf: ["ADMIN"]`) et les masques de rôle décrits ci-dessus sont des changements de logique, pas de design : le design de ces éléments reste celui d'aujourd'hui.

## 4. Points de vigilance

- Accessibilité : `Notice` n'a pas de `role` par défaut. Pour une information statique, c'est acceptable. Ne pas ajouter `role="alert"`.
- Mobile : `PageHeader` passe les actions sous le titre sous `sm`. La ligne `Notice` est pleine largeur, sans débordement.
- Dark mode : l'application n'a pas de thème sombre dans `src/barreau` (fond `creme`). Aucun contrôle à faire.

## 5. Vérification

- Chaque classe citée existe dans le code : `grep -rn "bpn-btn-ghost\|bpn-btn-or\|bpn-card-heading" src/barreau` et définitions dans `public/css/tailwind.css` (l.132-163).
- `Notice` exporté : `src/barreau/components/index.js` l.7.
- `git diff --stat -- src/` est vide au moment du commit.
