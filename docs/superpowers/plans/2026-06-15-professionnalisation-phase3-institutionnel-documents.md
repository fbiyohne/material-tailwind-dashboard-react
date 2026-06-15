# Professionnalisation — Phase 3 (Institutionnel & Documents) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Professionnaliser les modules institutionnels (Réunions, Assemblées, Discipline) et documentaires (Archives, Annuaire, Publications, Lettre du Bâtonnier) + leurs pages de détail.

**Architecture:** Deux profils de pages :
- **Listes de données** (Discipline, Archives, Annuaire) → `DataTable` + états + export.
- **Pages contenu/workflow** (Réunions, Assemblées, Publications, Lettre) → on **garde les cartes** (appropriées au contenu séquentiel/éditorial — cf. design-taste § cartes), mais on ajoute états, formats unifiés, a11y, et **fil d'Ariane** sur les pages de détail.

**Tech Stack:** React + Vite + Tailwind, Vitest.

**Prérequis :** **Phases 0–2 livrées.** Recette « liste → DataTable » : voir plan Phase 1 (§ Recette).

---

## Recette « page contenu » (référence, pour Réunions/Assemblées/Publications/Lettre)

**A. États** : entourer le chargement de la liste avec `chargement`/`erreur` (cf. Phase 1 § Recette A), et rendre :
- chargement → `<TableSkeleton rows={4} cols={2} />` (ou quelques cartes squelette) ;
- erreur → `<ErrorState onRetry={charger} />` ;
- vide → `<EmptyState title=… description=… />`.

**B. Formats** : toutes les dates via `formatDate`, tous les montants via `formatFCFA`.

**C. Détail** : `PageHeader` avec `breadcrumb={[{ label: "<Liste>", to: "<route>" }, { label: <titre> }]}`, sans `eyebrow`. États `undefined`/`false` de l'entité (skeleton / ErrorState « introuvable »).

**D. A11y** : boutons-icônes avec `aria-label`, focus visibles (hérités du socle).

---

## Task 1: Discipline (liste) + DossierDetail

**Files:** Modify `src/barreau/pages/Discipline.jsx`, `src/barreau/pages/DossierDetail.jsx`

- [ ] **Step 1: Lire** — `grep -n "listerDossiers\|useDataTable\|SortTh\|<table\|reference\|avocat\|saisine\|statut" src/barreau/pages/Discipline.jsx`.

- [ ] **Step 2: Recette A** sur `listerDossiers()`.

- [ ] **Step 3: Colonnes Discipline** :
```jsx
const colonnes = [
  { key: "reference", label: "Référence", sortable: true, sortValue: (d) => d.reference,
    cell: (d) => <a href={`/discipline/${d.id}`} className="font-mono text-xs text-or hover:underline">{d.reference}</a> },
  { key: "avocat", label: "Avocat mis en cause", sortable: true, sortValue: (d) => d.avocat,
    cell: (d) => <span className="font-medium">Me {d.avocat}</span> },
  { key: "saisine", label: "Saisine", sortable: true, sortValue: (d) => d.dateSaisine,
    cell: (d) => formatDate(d.dateSaisine) },
  { key: "statut", label: "Statut", cell: (d) => <Badge ton="gris">{d.statut}</Badge> },
];
```
(Adapter `dateSaisine`/`avocat` aux champs réels.)

- [ ] **Step 4: `DataTable`** (recette B), `getRowId={(d)=>d.id}`, `libelle="dossiers"`, `initialSort={{ key:"saisine", dir:"desc" }}`. Conserver le caractère **confidentiel** (en-tête « Confidentiel », accès journalisé) — ne pas exposer plus de données qu'avant ; **pas d'export CSV** ici (donnée sensible).

- [ ] **Step 5: DossierDetail** — appliquer recette C (fil d'Ariane `[{ label:"Conseil de discipline", to:"/discipline" }, { label: dossier.reference }]`, états, `formatDate`).

- [ ] **Step 6: En-tête v2** — retirer `eyebrow` (garder la mention « Confidentiel » en sous-titre).

- [ ] **Step 7: Vérifier** — `npm run build`. Visuel `/discipline` (états, tri) et `/discipline/:id` (fil d'Ariane, états).

- [ ] **Step 8: Commit** — `git commit -am "feat: Discipline + DossierDetail sur le socle"`

---

## Task 2: Archives — `DataTable` + filtres + export

**Files:** Modify `src/barreau/pages/Archives.jsx`

- [ ] **Step 1: Lire** — `grep -n "listerArchives\|SortTh\|<table\|categorie\|titre\|date\|reference\|filtre\|search" src/barreau/pages/Archives.jsx`.

- [ ] **Step 2: Recette A** sur `listerArchives()`.

- [ ] **Step 3: Colonnes** :
```jsx
const colonnes = [
  { key: "date", label: "Date", sortable: true, sortValue: (a) => a.date, cell: (a) => formatDate(a.date) },
  { key: "categorie", label: "Catégorie", sortable: true, sortValue: (a) => a.categorie,
    cell: (a) => <Badge ton="gris">{a.categorie}</Badge> },
  { key: "titre", label: "Document", sortable: true, sortValue: (a) => a.titre, cell: (a) => a.titre },
  { key: "reference", label: "Référence", cell: (a) => <span className="font-mono text-xs text-gris">{a.reference}</span> },
];
```

- [ ] **Step 4: `DataTable`** (recette B), `getRowId={(a)=>a.id}`, `libelle="documents"`, `initialSort={{ key:"date", dir:"desc" }}`. Conserver la recherche par mot-clé et le filtre catégorie existants (alimentent `archivesFiltrees`).

- [ ] **Step 5: Export CSV** (recette C) — Date, Catégorie, Document, Référence.

- [ ] **Step 6: En-tête v2** — retirer `eyebrow`.

- [ ] **Step 7: Vérifier** — `npm run build`. Visuel `/archives` : filtre, tri, états, export.

- [ ] **Step 8: Commit** — `git commit -am "feat: Archives sur le socle (DataTable, filtres, export)"`

---

## Task 3: Annuaire — `DataTable` + export

**Files:** Modify `src/barreau/pages/Annuaire.jsx`

- [ ] **Step 1: Lire** — `grep -n "listerMembres\|<table\|interne\|cabinet\|email\|tel\|print" src/barreau/pages/Annuaire.jsx`. Noter le mode `interne` (avec coordonnées) vs public.

- [ ] **Step 2: Recette A** sur `listerMembres()`.

- [ ] **Step 3: Colonnes** (conditionner les colonnes coordonnées au mode `interne`) :
```jsx
const colonnes = [
  { key: "num", label: "N°", sortable: true, sortValue: (m) => m.num, cell: (m) => <span className="font-mono text-xs text-or">{m.num}</span> },
  { key: "nom", label: "Avocat", sortable: true, sortValue: (m) => m.nom, cell: (m) => <span className="font-medium">Me {m.nom}</span> },
  { key: "cabinet", label: "Cabinet", cell: (m) => m.cabinet || "—" },
  ...(interne ? [
    { key: "email", label: "Email", cell: (m) => m.email || "—" },
    { key: "tel", label: "Téléphone", cell: (m) => m.telephone || "—" },
  ] : []),
];
```

- [ ] **Step 4: `DataTable`** (recette B), `libelle="avocats"`, `initialSort={{ key:"nom", dir:"asc" }}`. Conserver l'impression existante (`bpn-print-zone` si présent) et la bascule interne/public.

- [ ] **Step 5: Export CSV** (recette C) reflétant le mode courant (colonnes coordonnées seulement si interne).

- [ ] **Step 6: En-tête v2** — retirer `eyebrow`.

- [ ] **Step 7: Vérifier** — `npm run build`. Visuel `/annuaire` : bascule interne/public, tri, export, impression intacte.

- [ ] **Step 8: Commit** — `git commit -am "feat: Annuaire sur le socle (DataTable, export)"`

---

## Task 4: Réunions + ReunionDetail (pages contenu)

**Files:** Modify `src/barreau/pages/Reunions.jsx`, `src/barreau/pages/ReunionDetail.jsx`

- [ ] **Step 1: Lire** — `grep -n "listerReunions\|grid\|<ul\|formatDate\|String(\|creerReunion\|PageHeader" src/barreau/pages/Reunions.jsx src/barreau/pages/ReunionDetail.jsx`.

- [ ] **Step 2: Réunions (liste cartes)** — recette « page contenu » A+B+D : états autour de `listerReunions()`, dates via `formatDate`, `aria-label` sur boutons-icônes. **Garder** la grille de cartes (planification/PV — contenu, pas tableau). En-tête v2 (retirer `eyebrow`).

- [ ] **Step 3: ReunionDetail** — recette C : fil d'Ariane `[{ label:"Réunions du Conseil", to:"/reunions" }, { label: reunion.titre ?? formatDate(reunion.date) }]`, états `undefined`/`false`, `formatDate` partout, tableau de présence interne homogénéisé.

- [ ] **Step 4: Vérifier** — `npm run build`. Visuel `/reunions` (états, dates) et `/reunions/:id` (fil d'Ariane, états).

- [ ] **Step 5: Commit** — `git commit -am "feat: Réunions + détail — états, formats, fil d'Ariane"`

---

## Task 5: Assemblées + AssembleeDetail (pages contenu)

**Files:** Modify `src/barreau/pages/Assemblees.jsx`, `src/barreau/pages/AssembleeDetail.jsx`

- [ ] **Step 1: Lire** — `grep -n "listerAssemblees\|getAssemblee\|grid\|<ul\|quorum\|formatDate\|PageHeader" src/barreau/pages/Assemblees.jsx src/barreau/pages/AssembleeDetail.jsx`.

- [ ] **Step 2: Assemblées (liste cartes)** — recette « page contenu » A+B+D. Garder les cartes (AGO/AGE, quorum). En-tête v2.

- [ ] **Step 3: AssembleeDetail** — recette C : fil d'Ariane `[{ label:"Assemblées générales", to:"/assemblees" }, { label: assemblee.titre }]`, états, `formatDate`. Suivi du quorum et décisions inchangés mais formats unifiés.

- [ ] **Step 4: Vérifier** — `npm run build`. Visuel `/assemblees` et `/assemblees/:id`.

- [ ] **Step 5: Commit** — `git commit -am "feat: Assemblées + détail — états, formats, fil d'Ariane"`

---

## Task 6: Publications + PublicationDetail (pages contenu)

**Files:** Modify `src/barreau/pages/Publications.jsx`, `src/barreau/pages/PublicationDetail.jsx`

- [ ] **Step 1: Lire** — `grep -n "listerPublications\|getPublication\|grid\|statut\|changerStatut\|formatDate\|PageHeader" src/barreau/pages/Publications.jsx src/barreau/pages/PublicationDetail.jsx`.

- [ ] **Step 2: Publications (liste cartes)** — recette « page contenu » A+B+D. Garder les cartes (avis/communiqués, statut de validation). Bouton de création en **navy** (déjà fait Phase 0 Task 5, vérifier). En-tête v2.

- [ ] **Step 3: PublicationDetail** — recette C : fil d'Ariane `[{ label:"Publications", to:"/publications" }, { label: publication.titre }]`, états, `formatDate`. Workflow de validation par le Bâtonnier inchangé.

- [ ] **Step 4: Vérifier** — `npm run build`. Visuel `/publications` et `/publications/:id`.

- [ ] **Step 5: Commit** — `git commit -am "feat: Publications + détail — états, formats, fil d'Ariane"`

---

## Task 7: Lettre du Bâtonnier (page éditoriale)

**Files:** Modify `src/barreau/pages/LettreBatonnier.jsx`

- [ ] **Step 1: Lire** — `grep -n "getCalendrierEditorial\|grid\|formatDate\|generer\|IA\|PageHeader" src/barreau/pages/LettreBatonnier.jsx`.

- [ ] **Step 2:** Recette « page contenu » A+B+D : états autour de `getCalendrierEditorial()`, dates via `formatDate`, `aria-label` sur les actions, focus visibles. Garder la grille éditoriale (calendrier mensuel + génération IA d'un projet d'article). En-tête v2.

- [ ] **Step 3: Vérifier** — `npm run build`. Visuel `/lettre-batonnier`.

- [ ] **Step 4: Commit** — `git commit -am "feat: Lettre du Bâtonnier — états, formats, a11y"`

---

## Task 8: Vérification de phase

- [ ] **Step 1:** `npm test && npm run build && (cd server && npm run typecheck)` → vert.
- [ ] **Step 2:** Parcours visuel + clavier des 7 modules + 4 pages de détail : états, fils d'Ariane, formats, focus.
- [ ] **Step 3:** `git push -u origin claude/file-context-analysis-ixq8w3`

## Self-Review (couverture)
- Discipline+DossierDetail → T1 · Archives → T2 · Annuaire → T3 · Réunions(+détail) → T4 · Assemblées(+détail) → T5 · Publications(+détail) → T6 · Lettre → T7.
- Listes de données → DataTable + états + export (sauf Discipline : pas d'export, donnée sensible).
- Pages contenu → cartes conservées (choix de design assumé) + états + formats + a11y.
- Fil d'Ariane sur toutes les pages de détail (critère §5.4).
