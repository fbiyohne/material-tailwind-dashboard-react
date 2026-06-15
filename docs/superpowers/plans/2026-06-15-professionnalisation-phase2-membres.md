# Professionnalisation — Phase 2 (Membres) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Professionnaliser la gestion des membres — Avocats, Stagiaires, Corps électoral et la fiche détaillée AvocatDetail — sur le socle Phase 0.

**Architecture:** Tables → `DataTable` (avec **sélection + actions groupées** côté Avocats : export et attestations), états, formats unifiés, export CSV. La fiche AvocatDetail reçoit un **fil d'Ariane**, des états de chargement, et des tableaux internes cohérents.

**Tech Stack:** React + Vite + Tailwind, Vitest.

**Prérequis :** **Phases 0 et 1 livrées.** Recette de conversion : voir le plan Phase 1 (§ Recette). Spec : `…/2026-06-15-professionnalisation-socle-design.md`.

---

## Task 1: Avocats — `DataTable` + sélection + actions groupées

**Files:** Modify `src/barreau/pages/Avocats.jsx`

- [ ] **Step 1: Lire** — `grep -n "listerMembres\|getCotisations\|sort\|toggleSort\|<table\|SortTh\|StatutBadge\|AttestationModal\|ImportMembres\|filtre\|search" src/barreau/pages/Avocats.jsx`. Noter les champs (`num`, `nom`, `cabinet`, `qualite`, `statut`) et la map cotisation par membre.

- [ ] **Step 2: Recette A** sur `listerMembres({...})` (états `chargement`/`erreur`).

- [ ] **Step 3: Colonnes** :
```jsx
import { formatDate, formatFCFA } from "../utils/format";
import { DataTable, StatutBadge, Badge } from "../components";

const colonnes = [
  { key: "num", label: "N°", sortable: true, sortValue: (m) => m.num,
    cell: (m) => <span className="font-mono text-xs text-or">{m.num}</span> },
  { key: "nom", label: "Avocat", sortable: true, sortValue: (m) => m.nom,
    cell: (m) => <a href={`/avocats/${m.id}`} className="font-medium text-encre hover:text-navy">Me {m.nom}</a> },
  { key: "cabinet", label: "Cabinet", sortable: true, sortValue: (m) => m.cabinet, cell: (m) => m.cabinet || "—" },
  { key: "qualite", label: "Qualité", cell: (m) => <Badge ton="gris">{m.qualite}</Badge> },
  { key: "statut", label: "Statut", sortable: true, sortValue: (m) => m.statut, cell: (m) => <StatutBadge statut={m.statut} /> },
  { key: "cotis", label: `Cotisation ${EXERCICE_COURANT}`, cell: (m) => /* badge à jour/retard depuis la map cotisations */ null },
];
```
Réinjecter la logique « à jour/en retard » de la colonne cotisation (map `cotisations[m.id]`).

- [ ] **Step 4: `DataTable` avec sélection + actions groupées** (recette B + sélection) :
```jsx
<DataTable columns={colonnes} rows={membresFiltres} getRowId={(m) => m.id}
  loading={chargement} error={erreur} onRetry={charger}
  emptyTitle="Aucun avocat" emptyDescription="Aucun avocat ne correspond aux filtres."
  selectable libelle="avocats" initialSort={{ key: "nom", dir: "asc" }}
  renderBulkActions={(ids) => (
    <button type="button" className="bpn-btn bpn-btn-ghost !py-1 text-xs"
      onClick={() => telechargerCsv("Avocats", [
        { label: "N°", valeur: (m) => m.num },
        { label: "Avocat", valeur: (m) => `Me ${m.nom}` },
        { label: "Cabinet", valeur: (m) => m.cabinet },
        { label: "Qualité", valeur: (m) => m.qualite },
        { label: "Statut", valeur: (m) => m.statut },
      ], membresFiltres.filter((m) => ids.includes(m.id)))}>
      Exporter la sélection (CSV)
    </button>
  )} />
```

- [ ] **Step 5: Export global** (recette C, tout le tableau filtré) dans l'en-tête, à côté de « Importer » (qui garde `ImportMembresModal`). Bouton « + Avocat » / Import en **navy**.

- [ ] **Step 6: En-tête v2** — retirer `eyebrow`. Conserver la recherche multicritères et les filtres existants (ils alimentent `membresFiltres`).

- [ ] **Step 7: Vérifier** — `npm run build && npm test`. Visuel `/avocats` : états, tri, filtres, sélection → export sélection, export global, lien vers fiche, focus clavier.

- [ ] **Step 8: Commit** — `git commit -am "feat: Avocats sur le socle (DataTable, sélection, export)"`

---

## Task 2: Stagiaires — table simple en `DataTable`

**Files:** Modify `src/barreau/pages/Stagiaires.jsx`

- [ ] **Step 1: Lire** — `grep -n "listerMembres\|<table\|<th\|serment\|maitre\|statut" src/barreau/pages/Stagiaires.jsx`. La table actuelle est un `<table className="w-full text-sm">` (non-`bpn-table`). Noter les champs (`num`, `nom`, `cabinet`, `serment`/date, `maitreStage`, `statut`).

- [ ] **Step 2: Recette A** sur `listerMembres({ qualite: "STAGIAIRE" })`.

- [ ] **Step 3: Colonnes** :
```jsx
const colonnes = [
  { key: "num", label: "N°", sortable: true, sortValue: (m) => m.num,
    cell: (m) => <span className="font-mono text-xs text-or">{m.num}</span> },
  { key: "nom", label: "Stagiaire", sortable: true, sortValue: (m) => m.nom,
    cell: (m) => <a href={`/avocats/${m.id}`} className="font-medium hover:text-navy">Me {m.nom}</a> },
  { key: "cabinet", label: "Cabinet", cell: (m) => m.cabinet || "—" },
  { key: "serment", label: "Serment", cell: (m) => formatDate(m.dateSerment) },
  { key: "maitre", label: "Maître de stage", cell: (m) => m.maitreStage || "—" },
  { key: "statut", label: "Statut", cell: (m) => <Badge ton="gris">{m.statut}</Badge> },
];
```
(Adapter `dateSerment`/`maitreStage` aux champs réels.)

- [ ] **Step 4: `DataTable`** (recette B), `libelle="stagiaires"`. Export CSV (recette C) optionnel.

- [ ] **Step 5: En-tête v2** — retirer `eyebrow`.

- [ ] **Step 6: Vérifier** — `npm run build`. Visuel `/stagiaires` : table cohérente (en-tête navy comme les autres), états, dates formatées.

- [ ] **Step 7: Commit** — `git commit -am "feat: Stagiaires sur le socle (DataTable, formats)"`

---

## Task 3: Corps électoral — tables par onglet en `DataTable`

**Files:** Modify `src/barreau/pages/CorpsElectoral.jsx`

- [ ] **Step 1: Lire** — `grep -n "getCorpsElectoral\|Tabs\|<table\|<th\|electeurs\|exclus\|StatCard" src/barreau/pages/CorpsElectoral.jsx`. Structure : 3 `StatCard` + `Tabs` (Électeurs / Exclus cotisation / Exclus statut), chaque onglet a une `bpn-table`.

- [ ] **Step 2: Recette A** sur `getCorpsElectoral(exercice)`.

- [ ] **Step 3: Colonnes électeurs** (réutilisables par onglet, adapter la dernière colonne au motif d'exclusion) :
```jsx
const colElecteurs = [
  { key: "num", label: "N°", sortable: true, sortValue: (m) => m.num,
    cell: (m) => <span className="font-mono text-xs text-or">{m.num}</span> },
  { key: "nom", label: "Avocat électeur", sortable: true, sortValue: (m) => m.nom,
    cell: (m) => <span className="font-medium">Me {m.nom}</span> },
  { key: "cabinet", label: "Cabinet", cell: (m) => m.cabinet || "—" },
  { key: "depuis", label: "Inscrit depuis", cell: (m) => formatDate(m.dateInscription) },
];
const colExclus = [...colElecteurs, { key: "motif", label: "Motif d'exclusion", cell: (m) => m.motif || "—" }];
```

- [ ] **Step 4:** Remplacer chaque `bpn-table` d'onglet par un `DataTable` (recette B) avec les colonnes adaptées (`colElecteurs` / `colExclus`). Conserver `StatCard` et `Tabs`. `loading`/`error` partagés. Export CSV de la liste des électeurs (recette C) dans l'en-tête.

- [ ] **Step 5: En-tête v2** — retirer `eyebrow`.

- [ ] **Step 6: Vérifier** — `npm run build`. Visuel `/corps-electoral` : onglets, états, tri, export électeurs, dates formatées.

- [ ] **Step 7: Commit** — `git commit -am "feat: Corps électoral sur le socle (DataTable par onglet, export)"`

---

## Task 4: AvocatDetail — fil d'Ariane + états + tableaux internes

**Files:** Modify `src/barreau/pages/AvocatDetail.jsx`

- [ ] **Step 1: Lire** — `grep -n "getMembre\|getDroits\|PageHeader\|Tabs\|<table\|<ul\|formatDate\|String(" src/barreau/pages/AvocatDetail.jsx`. Repérer l'en-tête, les onglets, les tables internes (cotisations/droits).

- [ ] **Step 2: État de chargement de la fiche** :
```jsx
// `membre` vaut undefined (chargement) | false (erreur/introuvable) | objet.
if (membre === undefined) return <div className="p-6"><TableSkeleton rows={4} cols={3} /></div>;
if (membre === false) return <div className="p-6"><ErrorState title="Avocat introuvable" onRetry={() => location.reload()} /></div>;
```
(Importer `TableSkeleton`, `ErrorState`.)

- [ ] **Step 3: Fil d'Ariane** dans le `PageHeader` :
```jsx
<PageHeader breadcrumb={[{ label: "Avocats inscrits", to: "/avocats" }, { label: `Me ${membre.nom}` }]}
  titre={`Me ${membre.nom}`} sousTitre={…} >…</PageHeader>
```
Retirer l'`eyebrow`.

- [ ] **Step 4: Dates** — remplacer tout `String(x).slice(0,10)` / format ISO par `formatDate(x)` (inscription, serment, paiements…).

- [ ] **Step 5: Tableaux internes** — homogénéiser les `<table className="w-full text-sm">` (cotisations/droits par exercice) : mêmes paddings et alignements à droite des montants via `formatFCFA`. (Pas besoin de `DataTable` pour ces mini-tables à faible volume ; viser la cohérence visuelle.)

- [ ] **Step 6: Vérifier** — `npm run build`. Visuel `/avocats/:id` : fil d'Ariane cliquable, skeleton au chargement, erreur si id inconnu, dates/montants formatés, onglets OK.

- [ ] **Step 7: Commit** — `git commit -am "feat: AvocatDetail — fil d'Ariane, états, formats"`

---

## Task 5: Vérification de phase

- [ ] **Step 1:** `npm test && npm run build && (cd server && npm run typecheck)` → vert.
- [ ] **Step 2:** Parcours `/avocats` (sélection/export), `/stagiaires`, `/corps-electoral`, `/avocats/:id` : états, tri, export, fil d'Ariane, clavier.
- [ ] **Step 3:** `git push -u origin claude/file-context-analysis-ixq8w3`

## Self-Review (couverture)
- Avocats → Task 1 (DataTable + sélection + actions groupées) · Stagiaires → Task 2 · Corps électoral → Task 3 · AvocatDetail → Task 4 (fil d'Ariane critère §5.4).
- Critères §5 couverts : états, DataTable, formats, fil d'Ariane (détail), export, actions groupées (Avocats), a11y héritée.
