# Cycle de vie des avocats et exports — spécification UI

**Mission :** M-20261009-avocats-cycle-de-vie — tâche T2 (design)
**Date :** 2026-10-09
**Auteur :** Designer UI/UX, Team Creatic
**Statut :** spécification prête pour les ingénieurs frontend (T5) et backend (gabarit PDF, T3)
**Charte appliquée :** `~/.creatic/team/CHARTE-UI.md` ; skills `impeccable` (`shape`, `critique`), `frontend-design`
**Périmètre :** fiche `AvocatDetail`, liste `Avocats`, `ImportMembresModal`, `EditMembreModal`, badge de statut, gabarit PDF de liste. Aucun code dans ce document.

---

## 0. Sortie des skills `impeccable` — `shape` puis `critique`

### 0.1 `shape` — direction et contraintes retenues

- **Mode : Operate.** Le visiteur (secrétaire général, agent d'accueil, trésorière) accomplit une tâche administrative, souvent sur téléphone, parfois en plein soleil. Scanabilité, cohérence avec le reste du back-office et attentes natives priment sur toute expression visuelle. La marque (navy / or, Playfair Display pour les titres, DM Sans pour le texte, DM Mono pour les numéros) vit dans les détails, pas dans de nouveaux effets.
- **Autorité visuelle : l'implémentation en place.** Pas de `PRODUCT.md` ni de `DESIGN.md` dans le dépôt ; le design system incarné par `public/css/tailwind.css` (classes `bpn-*`), `tailwind.config.js` (jetons de couleur et de police) et `src/barreau/components/` fait foi. Cette tâche est une **extension** du monde visuel existant, jamais une refonte : on préserve l'identité, les libellés et les comportements hors périmètre.
- **Thèse d'interaction :** un acte administratif grave (radiation, décès) mérite **un seul écran complet** — date, référence, rappel juridique, conséquences, bouton d'engagement — plutôt qu'une boîte de confirmation générique enchaînée à un formulaire. L'utilisateur voit en une fois ce qu'il enregistre et ce que cela déclenche.
- **Signature retenue :** le bandeau juridique en tête de modale (composant `Notice` existant, ton `bleu` pour la radiation, ton `rouge` pour le décès). C'est le seul élément « remarquable » : le reste de la modale est volontairement quiet.
- **Contraintes binaires :** aucune nouvelle police, aucune nouvelle icône hors Heroicons 24 outline déjà installé, aucun nouveau jeton, aucun nouveau composant de design system hors `ActeStatutModal` ; mobile 360 px sans défilement horizontal ; cibles tactiles ≥ 44 px ; clavier complet ; textes français avec typographie française (espace insécable avant `: ; ? !`, guillemets « »).
- **Anti-objectifs :** pas de menu contextuel « maison » avec gestion de clic extérieur en JS ; pas de double confirmation empilée (modale sur modale) ; pas d'émoji en guise d'icône (les `✅ ♻️ ⚠️` du résumé d'import actuel sont remplacés par des icônes Heroicons) ; pas de mode sombre dans cette mission (le projet n'en a pas, hors périmètre).

### 0.2 `critique` — revue des écrans en place

> ⚠️ DEGRADED: single-context (aucun outil de sous-agent exposé dans cette session ; évaluation A faite par lecture du code, évaluation B = détecteur `detect.mjs` exécuté sur `Avocats.jsx`, `AvocatDetail.jsx`, `ImportMembresModal.jsx`, `Modal.jsx` → **0 constat mécanique**). Pas d'inspection navigateur : les écrans cibles n'existent pas encore et le serveur de développement requiert la base de test.

Constats sur l'existant qui conditionnent la spécification :

| # | Constat | Gravité | Réponse dans cette spécification |
|---|---------|---------|----------------------------------|
| C1 | Radiation = `useConfirm` générique sans date ni référence : la fiche affiche « Radié » sans trace de la décision (RB-01 de l'avis juridique). | Haute | § 2 : `ActeStatutModal` mode radiation avec date de la décision et référence. |
| C2 | L'en-tête de `AvocatDetail` porte jusqu'à 5 boutons (Modifier, Accès espace, Attestation, Radier, Supprimer) ; sur 360 px ils passent sur 2 à 3 lignes sans hiérarchie. | Moyenne | § 3 : ordre fixe, un seul primaire, actions dangereuses regroupées en fin, masquage par statut (un décédé n'a plus que Modifier / Supprimer). |
| C3 | `Avocats.jsx` : « Export CSV » et « Exporter la sélection (CSV) » sont deux boutons séparés ; ajouter 3 formats × 2 contextes donnerait 8 boutons. | Haute | § 4 : un disclosure natif `<details>` « Exporter » par contexte, 4 entrées. |
| C4 | Aperçu d'import : les lignes sans numéro ou sans nom disparaissent en silence ; le résumé utilise des émojis comme icônes (interdit par la charte). | Moyenne | § 5 : compteur « retenues / ignorées », icônes Heroicons, liste des erreurs par ligne. |
| C5 | Cibles tactiles : `.bpn-btn` mesure ≈ 38 px de haut, `.bpn-btn-sm` ≈ 26 px. | Moyenne | § 7 : `min-h-[44px]` (44 px, utilitaire Tailwind existant) sur les boutons de pied de modale et les entrées de menu en dessous de `sm`. |
| C6 | `Modal` donne le focus au conteneur du dialogue ; le premier `Tab` atteint la croix de fermeture, le second le premier champ. | Faible | Conservé (pattern ARIA valide). Ordre de tabulation documenté § 2.6. |
| C7 | Polices chargées depuis Google Fonts par `<link>` (la charte demande l'auto-hébergement). | Faible | Hors périmètre de la mission ; consigné au § 9 pour une mission ultérieure. |

---

## 1. Inventaire des composants réutilisés

| Composant existant | Fichier | Utilisé pour |
|---|---|---|
| `Modal` | `src/barreau/components/Modal.jsx` | enveloppe d'`ActeStatutModal` (dialogue accessible, piège du focus, Échap, voile) |
| `FormField` | `components/FormField.jsx` | champs date, référence, avec `error` relié par `aria-describedby` |
| `Button` | `components/Button.jsx` | boutons de pied (`variant="ghost"` / `"danger"`, prop `loading`) |
| `Notice` | `components/Notice.jsx` | bandeaux juridiques (ton `bleu` / `rouge`), compteur de lignes ignorées (ton `or`), repli PDF (ton `gris`) |
| `Badge`, `StatutBadge` | `components/Badge.jsx`, `StatutBadge.jsx` | badge « Décédé » (ton `gris`, pastille) |
| `ConfirmDialog` (`useConfirm`) | `components/ConfirmDialog.jsx` | suppression définitive (inchangée) |
| `DataTable` | `components/DataTable.jsx` | liste des avocats, barre de sélection (`renderBulkActions`) |
| `Toast` (`useToast`) | `components/Toast.jsx` | succès / erreur / information de chaque action |
| `TableSkeleton`, `ErrorState`, `EmptyState` | `components/Skeleton.jsx`, `ErrorState.jsx`, `EmptyState.jsx` | états de la liste (inchangés) |
| `PageHeader` | `components/PageHeader.jsx` | zone d'actions de la liste et de la fiche |
| `ImportMembresModal` | `components/ImportMembresModal.jsx` | import (modifié : accept `.txt`, compteur, résultat) |
| `EditMembreModal` | `components/EditMembreModal.jsx` | correction des dates/motif par le SG |
| Icônes | `@heroicons/react/24/outline` | `NoSymbolIcon` (radier), `HeartIcon` (décès), `ArrowDownTrayIcon` (exporter), `ArrowUpTrayIcon` (importer), `TableCellsIcon` (Excel), `DocumentTextIcon` (CSV, TXT), `DocumentIcon` (PDF), `CheckCircleIcon`, `ArrowPathIcon`, `ExclamationTriangleIcon`, `ScaleIcon` (bandeau radiation), `InformationCircleIcon` |
| Utilitaires | `utils/format.js` (`formatDate` → JJ/MM/AAAA), `utils/exportCsv.js`, `utils/exports.js` | affichage des dates, exports |

**Seul composant nouveau :** `src/barreau/components/ActeStatutModal.jsx` (exporté dans `components/index.js`). Le menu « Exporter » n'est pas un composant du design system : c'est une fonction locale `MenuExport` privée au module `pages/Avocats.jsx` (elle y est rendue deux fois : en-tête et barre de sélection), construite sur `<details>` natif et les classes `bpn-btn`.

---

## 2. `ActeStatutModal` — radiation et décès (un composant, deux modes)

### 2.1 Contrat

```
<ActeStatutModal mode="radiation" | "deces" membre={membre} open onClose onDone />
```

- `membre` : objet normalisé (`id`, `nom`, `statut`) ; `onDone` est appelé après succès (la fiche se recharge).
- Appels API : `radierMembre(id, { dateRadiation, motifRadiation })` et `declarerDeces(id, dateDeces)` (`api/resources.js`).
- Largeur : celle de `Modal` (`max-w-2xl`), le contenu reste sur une seule colonne (pas de grille `sm:grid-cols-2`) : deux champs seulement.

### 2.2 Anatomie commune (de haut en bas)

1. **Titre** (`Modal title`) : « Radier Me {nom} » / « Déclarer le décès de Me {nom} ».
2. **Bandeau juridique** (`Notice`, en tête du corps).
3. **Champ date** (`FormField` + `<input type="date" className="bpn-input">`, `max` = aujourd'hui au format AAAA-MM-JJ).
4. **Champ texte** (radiation seulement).
5. **Rappel des conséquences** (`Notice` ton `gris`, icône `InformationCircleIcon`), une phrase.
6. **Pied** (`Modal footer`) : `Button variant="ghost"` « Annuler » puis `Button variant="danger"` d'engagement.

Un seul écran : le bouton d'engagement **est** la confirmation. On n'empile pas `useConfirm` par-dessus (deux dialogues `z-[60]` superposés, double piège de focus). Le ton `danger` du bouton, le bandeau et le rappel des conséquences portent la gravité.

### 2.3 Mode `radiation`

| Élément | Spécification |
|---|---|
| Titre | « Radier Me {nom} » |
| Bandeau | `Notice ton="bleu" icon={ScaleIcon}` : **« La radiation est prononcée par le Conseil siégeant en matière disciplinaire (art. 36 loi n° 026-92). Enregistrez ici la date et la référence de la décision notifiée (art. 39). »** |
| Champ 1 | `FormField label="Date de la décision" required htmlFor="radiation-date"` — `<input type="date">`, valeur par défaut aujourd'hui, `max` aujourd'hui |
| Champ 2 | `FormField label="Référence et motif de la décision" hint="facultatif, 300 caractères" htmlFor="radiation-motif"` — `<textarea rows={2} maxLength={300} className="bpn-input">`, placeholder « Ex. : Décision du Conseil n° 12 du 01/10/2026 » ; compteur `{n}/300` en `text-xs text-gris` aligné à droite sous le champ, visible dès 250 caractères |
| Conséquences | « L'avocat sera retiré du tableau de l'Ordre, du corps électoral et des cotisations ; son accès à l'espace avocat sera désactivé. » |
| Bouton | `Button variant="danger"` « Radier » (icône `NoSymbolIcon` 16 px) |
| Toast succès | « Me {nom} radié(e) — décision du {JJ/MM/AAAA}. » |

### 2.4 Mode `deces`

| Élément | Spécification |
|---|---|
| Titre | « Déclarer le décès de Me {nom} » |
| Bandeau | `Notice ton="rouge" icon={ExclamationTriangleIcon}` : **« Enregistrement sur présentation de l'acte de décès. Le compte espace sera désactivé et l'avocat retiré du tableau, du corps électoral et des cotisations. »** |
| Champ 1 | `FormField label="Date du décès" required hint="date portée sur l'acte de décès" htmlFor="deces-date"` — `<input type="date">`, **vide par défaut** (une date de décès ne se pré-remplit pas), `max` aujourd'hui |
| Conséquences | pas de second encart : le bandeau les contient déjà (règle « un élément, un rôle ») |
| Bouton | `Button variant="danger"` « Déclarer le décès » (icône `HeartIcon` 16 px) ; **désactivé tant que la date est vide** |
| Toast succès | « Décès de Me {nom} enregistré au {JJ/MM/AAAA}. » |

### 2.5 États

| État | Comportement |
|---|---|
| Ouverture | formulaire réinitialisé à chaque ouverture (date du jour en radiation, vide en décès, motif vide) |
| Validation locale (avant appel) | date vide → `error="Indiquez la date."` ; date > aujourd'hui → `error="La date ne peut pas être postérieure à aujourd'hui."` ; le message s'affiche sous le champ (`FormField error`, classe `is-invalid` sur l'input) et le focus revient sur le champ |
| Chargement | `Button loading` sur le bouton d'engagement (spinner inline existant, `aria-busy`), « Annuler » et la croix désactivés, Échap ignoré pendant l'appel (`onBeforeClose` renvoie `false`) |
| Erreur serveur | 400 → message serveur dans `FormField error` du champ date ; 403 / 404 / réseau → `toast.error(message)` et la modale reste ouverte avec la saisie intacte |
| Succès | fermeture, `toast.success` (§ 2.3 / 2.4), `onDone()` → la fiche recharge et affiche le badge et la ligne d'état (§ 3) |
| Vide | sans objet (formulaire) |

### 2.6 Clavier, lecteur d'écran, mobile

- Ordre de tabulation : croix de fermeture → date → (motif) → Annuler → bouton d'engagement ; `Tab` boucle (piège existant de `Modal`) ; `Échap` ferme (hors chargement) ; `Entrée` dans le champ date soumet (le formulaire est un `<form onSubmit>`).
- Le bandeau porte `role="note"` ; le message d'erreur est annoncé (`role="alert"` de `FormField`) ; le titre libelle le dialogue (`aria-labelledby` existant).
- `<input type="date">` natif : clavier numérique et sélecteur système sur Android/iOS, aucune bibliothèque.
- 360 px : `Modal` est déjà `w-full` avec `p-4` de marge ; le pied passe en colonne (`flex-col-reverse sm:flex-row`) avec les deux boutons pleine largeur et `min-h-[44px]` ; le bandeau reste lisible (`text-xs`, ligne ≤ 70 caractères par retour naturel).
- Mouvement : aucun ajout ; `Modal` n'anime pas, les toasts utilisent `fadeIn` 200 ms déjà neutralisé par `prefers-reduced-motion`.

---

## 3. Fiche `AvocatDetail` — en-tête, badge, ligne d'état

### 3.1 Actions de l'en-tête (`PageHeader children`), ordre fixe de gauche à droite

| Ordre | Bouton | Variante | Visible si |
|---|---|---|---|
| 1 | Modifier (`PencilSquareIcon`) | `ghost` | SG ou ADMIN |
| 2 | Accès espace (`KeyIcon`) | `ghost` | SG ou ADMIN **et** statut ∉ {`radie`, `decede`} |
| 3 | Attestation (`DocumentPlusIcon`) | `primary` (seul primaire) | SG ou ADMIN, qualité ≠ stagiaire **et** statut ∉ {`radie`, `decede`} |
| 4 | Radier (`NoSymbolIcon`) | `ghost` rouge (classes existantes `text-rouge hover:!bg-rougeL hover:!text-rouge`) | SG ou ADMIN **et** statut ∉ {`radie`, `decede`} → ouvre `ActeStatutModal mode="radiation"` |
| 5 | Déclarer le décès (`HeartIcon`) | `ghost` rouge | SG ou ADMIN **et** statut ≠ `decede` (un radié peut décéder) → ouvre `ActeStatutModal mode="deces"` |
| 6 | Supprimer (`TrashIcon`) | `ghost` rouge | ADMIN seul ; comportement inchangé (`useConfirm` danger « irréversible ») |

- Rôle BATONNIER, TRESORIERE, CONSULTATION, ACCUEIL : aucun de ces boutons (lecture seule), comme aujourd'hui.
- Membre `decede` : il ne reste que Modifier (SG/ADMIN) et Supprimer (ADMIN).
- Erreur 409 de la suppression (pièces comptables à conserver, avis juridique C-06) : `toast.error` avec le message serveur, rien d'autre.
- 360 px : les boutons passent à la ligne (`flex-wrap` existant) ; l'ordre ci-dessus garantit que le primaire reste en première ligne et les actions rouges en fin.

### 3.2 Badge de statut

- `STATUT_MEMBRE_META_DEFAUT` (`data/derivations.js`) reçoit `decede: { label: "Décédé", ton: "gris" }`. `StatutBadge` l'affiche automatiquement avec la pastille (information jamais portée par la seule couleur). L'éditeur de libellés de Paramètres l'expose sans travail supplémentaire.
- Le badge apparaît dans le sous-titre de `PageHeader` (déjà en place), dans la liste `Avocats`, `Stagiaires`, l'Annuaire et le Dashboard (`STATUT_LABEL.DECEDE = "Décédés"`).

### 3.3 Ligne d'état dans la carte « Identité & coordonnées »

Après « Date d'inscription », via le composant local `Ligne` existant :

- statut `radie` : `label="Radié le"`, `value="{JJ/MM/AAAA} — {motifRadiation}"` ; sans motif : `"{JJ/MM/AAAA}"` ; sans date (donnée historique) : `"—"`.
- statut `decede` : `label="Décédé le"`, `value="{JJ/MM/AAAA}"` (ou `"—"`).
- Le motif n'apparaît **que** sur la fiche (GET `/membres/:id`), jamais dans la liste ni dans les exports (avis juridique C-03).

### 3.4 `EditMembreModal` (correction par le SG)

- `<select>` Statut : option « Décédé » ajoutée en dernier.
- Quand statut = `radie` : deux champs supplémentaires dans la section « Identité & statut » — « Date de la décision » (`type="date"`) et « Référence et motif de la décision » (`textarea`, 300 car.).
- Quand statut = `decede` : champ « Date du décès » (`type="date"`, `max` aujourd'hui).
- Ces champs apparaissent/disparaissent sans animation ; ils conservent leur valeur si l'utilisateur change de statut puis revient.

---

## 4. Liste `Avocats` — menu « Exporter » et exports

### 4.1 Menu « Exporter » (fonction locale `MenuExport` dans `pages/Avocats.jsx`)

Markup natif, sans gestion de clic extérieur en JavaScript :

```
<details class="relative">
  <summary class="bpn-btn bpn-btn-ghost list-none cursor-pointer" aria-label="Exporter la liste">
    <ArrowDownTrayIcon /> Exporter <ChevronDownIcon />
  </summary>
  <div class="absolute right-0 z-20 mt-1 w-56 rounded border border-grisM bg-white p-1 shadow-card" role="group" aria-label="Formats d'export">
    <button type="button" class="… min-h-[44px] w-full …"><TableCellsIcon /> Excel (.xlsx)</button>
    <button type="button" …><DocumentTextIcon /> CSV (.csv)</button>
    <button type="button" …><DocumentTextIcon /> Texte (.txt)</button>
    <button type="button" …><DocumentIcon /> PDF (.pdf)</button>
  </div>
</details>
```

- Deux instances : (a) en-tête de page (`PageHeader children`), libellé « Exporter », exporte la **liste filtrée courante** (recherche + statut) ; (b) barre de sélection du `DataTable` (`renderBulkActions`), libellé « Exporter la sélection », exporte les **lignes cochées** (PDF via `ids=`). Même markup, même ordre des 4 formats ; l'instance (b) utilise `bpn-btn-sm` sur le `summary` mais garde `min-h-[44px]` sur les entrées.
- Désactivé (`summary` avec `aria-disabled` et classe `opacity-40 pointer-events-none`) quand la liste affichée est vide.
- Le `<details>` se referme après le clic sur une entrée (`open = false` dans le gestionnaire, une ligne) et à `Échap` (gestionnaire `onKeyDown` sur le `details`, une ligne). Le focus revient sur le `summary`.
- Position : `right-0` pour ne jamais déborder à droite sur 360 px ; largeur 224 px ; la zone d'en-tête `PageHeader` est déjà `flex-wrap`.
- Entrées : `inline-flex items-center gap-2 rounded px-3 text-sm text-encre hover:bg-grisL focus-visible:…` (focus or global existant) ; icône 16 px à gauche, extension du fichier en `font-mono text-xs text-gris` à droite.

### 4.2 Contenu des exports (identique dans les 4 formats)

- **Ligne 1 (CSV, TXT) / cellule A1 (XLSX) / en-tête et pied (PDF)** — mention de confidentialité mot pour mot :
  **« Barreau de Pointe-Noire — Document interne confidentiel — Liste arrêtée au JJ/MM/AAAA — Diffusion interdite hors des organes de l'Ordre. »**
- **Ligne 2 (ligne 1 du tableau XLSX après A1)** : en-têtes, exactement : `N°`, `N° inscription`, `Nom`, `Qualité`, `Statut`, `Cabinet`, `Téléphone`, `Email`, `Date d'inscription`, `Date de radiation`, `Date de décès`. Nom brut sans « Me » ; statut en libellé français (`STATUT_MEMBRE_META[statut].label`) ; dates AAAA-MM-JJ ; valeurs vides = cellule vide (pas « — »).
- **Aller-retour :** l'import (§ 5) reconnaît la mention en première ligne (préfixe « Barreau de Pointe-Noire — Document interne ») et la saute sans la compter parmi les lignes ignorées.
- Noms de fichiers : `Avocats-AAAA-MM-JJ.xlsx|csv|txt|pdf` ; sélection : `Avocats-selection-AAAA-MM-JJ.*`.
- Le motif de radiation n'est dans aucun export.

### 4.3 PDF (gabarit serveur `listeAvocatsHtml`, repli client)

- En-tête institutionnel du gabarit `documentHtml` (identité Paramètres), **sans cachet**.
- Titre : « Liste des avocats — {libellé du filtre} — arrêtée au JJ/MM/AAAA — Document interne » ; libellé du filtre : « Tous les statuts », « Inscrits », « Radiés »…, suivi de « — recherche : “{q}” » si une recherche est active, ou « Sélection ({n}) ».
- Bandeau de confidentialité (§ 4.2) sous le titre, en `text-xs` ; pied de chaque page : la même mention abrégée « Document interne confidentiel — Barreau de Pointe-Noire » + « page X / Y ».
- Tableau 11 colonnes, police du gabarit, en-tête de tableau répété à chaque page (`thead` + `display: table-header-group`), lignes alternées très légères, numéros en chiffres tabulaires.
- Signataire en fin : « Le Secrétaire Général », nom de l'identité Paramètres.
- Repli client : `Avocats.jsx` rend hors écran (`position:absolute; left:-9999px`, `id="zone-impression-avocats"`, `aria-hidden`) un tableau HTML simple avec la mention en première ligne et les mêmes 11 colonnes ; si l'appel serveur échoue, `exporterPdf("Avocats-…", "#zone-impression-avocats")` en mode flux puis `toast.info("PDF généré sur cet appareil (serveur indisponible) : qualité réduite.")`.

### 4.4 États du menu et des exports

| État | Comportement |
|---|---|
| Liste en chargement | `summary` désactivé (liste vide) ; le `DataTable` affiche le `TableSkeleton` existant |
| Liste vide / erreur | `summary` désactivé ; `EmptyState` / `ErrorState` existants |
| Export client en cours (XLSX, import dynamique de `xlsx`) | l'entrée cliquée passe en `aria-busy` avec le spinner inline (même markup que `Button loading`), les autres entrées désactivées ; < 1 s attendu |
| Export PDF serveur en cours | idem, libellé « Génération du PDF… » ; le menu reste ouvert jusqu'à la fin ; 140 lignes ≈ 2–3 s |
| Succès (CSV/XLSX/TXT) | aucun toast : le téléchargement est le retour visible ; le menu se referme |
| Succès PDF serveur | menu refermé, pas de toast |
| Repli PDF client | `toast.info` (§ 4.3) |
| Erreur (réseau, 403, Blob) | `toast.error("Export impossible : {message}.")`, menu refermé, liste intacte |
| Sélection | la barre bleue du `DataTable` « N sélectionné(s) » porte le second menu ; 0 sélection → barre absente |

### 4.5 Filtre « Décédé »

- `FILTRES` de `Avocats.jsx` : `{ value: "decede", label: "Décédé" }` ajouté après « Radié ».
- Rien d'autre ne change dans la barre de filtres ; le `<select>` natif reste (360 px : pleine largeur, pattern existant).

---

## 5. `ImportMembresModal` — aperçu, compteurs, résultat

### 5.1 Zone de dépôt

- Libellé : « Choisir un fichier .xlsx, .csv ou .txt » ; `accept=".xlsx,.xls,.csv,.txt"`.
- Texte d'aide (`text-sm text-gris`) : « Les avocats sont mis à jour par numéro d'inscription ; les nouveaux sont créés, rien n'est supprimé. Colonnes reconnues : num, nom, qualité, statut (dont « décédé »), cabinet, téléphone, email, dates d'inscription, de radiation et de décès, référence de radiation. Séparateur CSV/TXT détecté automatiquement (; , ou tabulation). »
- La zone de dépôt est un `<label>` : `Entrée`/`Espace` ouvrent le sélecteur ; la zone reçoit le focus or global.

### 5.2 Aperçu (avant « Importer »)

- En-tête du cadre d'aperçu : **« Aperçu — {N} lignes retenues, {M} lignes ignorées (sans numéro ou sans nom) »** ; quand M = 0 : « Aperçu — {N} lignes retenues ». La ligne de confidentialité d'un fichier exporté par l'application (§ 4.2) n'est pas comptée.
- Si M > 0 : `Notice ton="or" icon={ExclamationTriangleIcon}` sous l'en-tête : « {M} ligne(s) ne seront pas importées : numéro ou nom manquant. Complétez le fichier si elles doivent l'être. »
- Tableau d'aperçu : colonnes N°, Nom, Qualité, Statut (existant) ; le statut « décédé » s'affiche tel quel ; 8 premières lignes puis « … et {N − 8} autres. » (pluriel français sans parenthèses).
- Fichier sans aucune ligne valide : pas de tableau ; `Notice ton="rouge"` « Aucune ligne valide : colonnes « num » et « nom » requises. » (remplace le `toast.error` actuel, l'information doit rester visible).

### 5.3 États

| État | Comportement |
|---|---|
| Lecture du fichier | libellé de la zone « Lecture de {nom}… », `aria-busy` ; XLSX chargé dynamiquement |
| Erreur de lecture | `Notice ton="rouge"` dans la modale : « Lecture impossible : {message}. » |
| Import en cours | bouton primaire `loading`, libellé « Import en cours… », croix et « Fermer » désactivés, Échap ignoré ; une barre d'attente n'est pas nécessaire (≤ 2 000 lignes, un seul POST) |
| Coupure réseau | `Notice ton="rouge"` : « Import interrompu : vérifiez la connexion puis relancez. Les lignes déjà traitées ne seront pas dupliquées. » ; bouton « Importer » réactivé |
| Succès | cadre « Résultat de l'import » : trois lignes avec icônes `CheckCircleIcon` (vert) « {crees} créé(s) », `ArrowPathIcon` (navy) « {maj} mis à jour », `ExclamationTriangleIcon` (rouge) « {erreurs} ligne(s) en erreur » ; sous cette dernière, liste `max-h-40 overflow-auto` « Ligne {n} : {message} » ; toast existant conservé ; `onDone()` recharge la liste |
| Vide | état initial : zone de dépôt seule, bouton « Importer » désactivé |

### 5.4 Mobile 360 px

- La modale occupe la largeur ; le tableau d'aperçu est dans `overflow-auto` (défilement horizontal **interne** au cadre, pas de la page).
- Pied : « Fermer » et « Importer N lignes » pleine largeur, `min-h-[44px]`, empilés (`flex-col-reverse sm:flex-row`).

---

## 6. Textes (copy) — récapitulatif, à reprendre mot pour mot

| Clé | Texte |
|---|---|
| Bandeau radiation | La radiation est prononcée par le Conseil siégeant en matière disciplinaire (art. 36 loi n° 026-92). Enregistrez ici la date et la référence de la décision notifiée (art. 39). |
| Bandeau décès | Enregistrement sur présentation de l'acte de décès. Le compte espace sera désactivé et l'avocat retiré du tableau, du corps électoral et des cotisations. |
| Mention exports | Barreau de Pointe-Noire — Document interne confidentiel — Liste arrêtée au JJ/MM/AAAA — Diffusion interdite hors des organes de l'Ordre. |
| Conséquences radiation | L'avocat sera retiré du tableau de l'Ordre, du corps électoral et des cotisations ; son accès à l'espace avocat sera désactivé. |
| Erreur date vide | Indiquez la date. |
| Erreur date future | La date ne peut pas être postérieure à aujourd'hui. |
| Toast radiation | Me {nom} radié(e) — décision du {JJ/MM/AAAA}. |
| Toast décès | Décès de Me {nom} enregistré au {JJ/MM/AAAA}. |
| Toast repli PDF | PDF généré sur cet appareil (serveur indisponible) : qualité réduite. |
| Toast erreur export | Export impossible : {message}. |
| Aperçu import | Aperçu — {N} lignes retenues, {M} lignes ignorées (sans numéro ou sans nom) |
| Notice lignes ignorées | {M} ligne(s) ne seront pas importées : numéro ou nom manquant. Complétez le fichier si elles doivent l'être. |
| Notice import interrompu | Import interrompu : vérifiez la connexion puis relancez. Les lignes déjà traitées ne seront pas dupliquées. |
| Titre PDF | Liste des avocats — {filtre} — arrêtée au JJ/MM/AAAA — Document interne |
| Ligne fiche radié | Radié le {JJ/MM/AAAA} — {référence} |
| Ligne fiche décédé | Décédé le {JJ/MM/AAAA} |

Règles : verbe d'action identique du bouton au titre, au bouton d'engagement et au toast (« Radier » → « Radier » → « radié(e) » ; « Déclarer le décès » → « Déclarer le décès » → « Décès … enregistré »). Espace insécable avant `:` `;` et dans « n° 12 » ; guillemets « ».

---

## 7. Accessibilité, cibles, mouvement — règles transverses

- **Cibles ≥ 44 px :** entrées du menu Exporter `min-h-[44px]` toujours ; boutons de pied des modales et bouton « Importer » `min-h-[44px] sm:min-h-0` ; boutons rouges de l'en-tête de fiche conservent `bpn-btn` (≈ 38 px) sur bureau et `min-h-[44px]` sous `sm`. Utilitaire Tailwind existant, aucun jeton nouveau.
- **Focus visible :** règles globales `:focus-visible` (halo or) et `.bpn-btn:focus-visible` existantes ; les entrées du menu sont des `<button>` donc couvertes.
- **Noms accessibles :** `summary` → `aria-label="Exporter la liste"` / `"Exporter la sélection"` ; boutons d'icône seule (`TrashIcon`) gardent `title` + `aria-label` ; icônes décoratives `aria-hidden`.
- **Régions vivantes :** toasts (`role=status`/`alert` existants) ; erreurs de champ (`role=alert` de `FormField`) ; compteur d'aperçu dans un `<p aria-live="polite">`.
- **Contraste :** tons existants (`text-gris` #7A756A sur blanc ≈ 4,6:1 AA ; `text-rouge` #8B1A1A ≈ 8:1 ; badge gris `bg-grisL text-gris` ≈ 4,2:1 sur fond — accepté pour un texte ≥ 12 px gras ; ne pas réduire la taille).
- **Mouvement :** aucune animation nouvelle ; ouverture du `<details>` instantanée (le sélecteur natif n'anime pas) ; `prefers-reduced-motion` déjà global.
- **Clavier du menu :** `Entrée`/`Espace` sur `summary` ouvre ; `Tab` parcourt les 4 entrées ; `Échap` referme et rend le focus au `summary` ; après un export, le `<details>` se referme et le focus reste sur le `summary`.

---

## 8. Recette visuelle à joindre (ingénieur frontend, Playwright)

Captures 360 × 800 et 1280 × 800, connecté SG, à déposer avec le résultat de T5 :

1. `/avocats/:id` — modale « Radier Me … » vide, puis avec erreur « La date ne peut pas être postérieure à aujourd'hui. », puis état `loading`.
2. `/avocats/:id` — modale « Déclarer le décès de Me … » (bouton désactivé sans date, actif avec date).
3. `/avocats/:id` d'un membre décédé : en-tête (badge « Décédé », seuls Modifier/Supprimer), ligne « Décédé le ».
4. `/avocats` — menu Exporter ouvert (en-tête) ; barre de sélection avec menu « Exporter la sélection » ouvert ; filtre « Décédé » sélectionné.
5. `ImportMembresModal` — aperçu avec « 12 lignes retenues, 2 lignes ignorées (sans numéro ou sans nom) » ; résultat avec erreurs par ligne.
6. PDF serveur ouvert (page 1 et dernière page) ; vérifier bandeau, en-tête répété, pied « page X / Y ».

Puis `node …/impeccable/scripts/detect.mjs --json` sur les fichiers modifiés et `web-design-guidelines` ; aucun constat majeur attendu.

---

## 9. Hypothèses et décisions prises sans question

- H-U1 — Un seul écran par acte : le bouton `danger` de la modale vaut confirmation ; pas de `useConfirm` empilé. Interprétation de « puis confirmation » (CA-04).
- H-U2 — Date de décès vide par défaut (jamais pré-remplie) ; date de décision de radiation pré-remplie à aujourd'hui (cas courant : saisie le jour de la notification).
- H-U3 — Menu « Exporter » = disclosure natif `<details>` dans une fonction locale du module `Avocats.jsx`, rendue deux fois ; ce n'est pas un composant du design system (contrainte « aucun nouveau composant »). Si une troisième page en a besoin, il deviendra `components/MenuExport.jsx`.
- H-U4 — La mention de confidentialité est en **première ligne** des CSV/TXT et en **A1** du XLSX (avis juridique C-04 appliqué à la lettre) ; l'import la reconnaît par son préfixe et la saute sans la compter. Cela ajoute une règle de 3 lignes à l'import et conserve l'aller-retour CA-10 sans erreur ni ligne ignorée.
- H-U5 — Statut `decede` ou `radie` masque Attestation et Accès espace (H-09 du cadrage) ; « Déclarer le décès » reste possible pour un radié.
- H-U6 — Le résumé d'import remplace les émojis par des icônes Heroicons (charte § 3) ; les erreurs par ligne sont listées dans la modale (max 10 rem de hauteur, défilement interne).
- H-U7 — Aucun toast sur un export client réussi (le téléchargement est le retour) ; toast d'information uniquement pour le repli PDF ; toast d'erreur sinon.
- H-U8 — Contraste du badge gris (≈ 4,2:1) accepté tel qu'existant (texte 12 px semi-gras, pastille, libellé) ; ne pas l'alléger.
- H-U9 — Mode sombre et auto-hébergement des polices (charte § 2 et § 4) sont hors périmètre de cette mission : aucun jeton ni police ne sont touchés ; à traiter dans une mission « socle design » dédiée.
- H-U10 — La modale radiation/décès est proposée sur la fiche de tout membre (avocat, honoraire, stagiaire) puisque `AvocatDetail` est commune (H-A du cadrage).

---

## 10. Suivi

- 2026-10-09 — spécification initiale (T2). Prochaines tâches dépendantes : T5 (frontend : `ActeStatutModal`, `Avocats`, `AvocatDetail`, `ImportMembresModal`, `EditMembreModal`, `derivations`), T3 (backend : gabarit `listeAvocatsHtml`, bandeau et pied de page PDF).
