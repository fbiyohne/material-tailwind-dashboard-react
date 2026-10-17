# Professionnalisation — Phase 1 (Cœur finances) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Appliquer le socle (Phase 0) aux modules financiers restants — Quitus, Reçus, Droits de plaidoirie — pour atteindre les 9 critères « professionnel » du spec.

**Architecture:** Réutilise les primitives de la Phase 0 (`DataTable`, `Skeleton`/`ErrorState`/`EmptyState`, `formatDate`/`formatFCFA`, `telechargerCsv`, `PageHeader` v2). Chaque module : registre/table → `DataTable`, états chargement/erreur/vide branchés, formats unifiés, export CSV. L'or reste réservé aux CTA de génération de documents (déjà acté Phase 0).

**Tech Stack:** React + Vite + Tailwind, Vitest. Client API `api()`.

**Prérequis :** **Phase 0 livrée** (socle + Cotisations). Spec : `docs/superpowers/specs/2026-06-15-professionnalisation-socle-design.md`.

> **⚠️ PÉRIMÈTRE DESIGN — autoritaire :** **aucun changement de design** sur ces
> pages (couleurs, en-têtes, styles conservés). On ajoute seulement **fonctions**
> (états, tri, export) et **présentation des données** (formats unifiés, tableaux
> cohérents). Toute mention ci-dessous de « retirer eyebrow » / « en-tête v2 » /
> « bouton navy » est **annulée** : les en-têtes restent **tels quels** et les
> nouveaux boutons fonctionnels réutilisent les **classes existantes** (`bpn-btn-ghost`
> pour Export, etc.). Le design n'évolue que dans les **pages de détail**.

---

## Recette de conversion d'une liste en `DataTable` (référence)

Chaque tâche s'appuie sur cette recette ; seules les **colonnes** et **features** changent.

**A. États autour du chargement** (remplacer un `.then(setX).catch(()=>{})` nu) :
```jsx
const [chargement, setChargement] = useState(true);
const [erreur, setErreur] = useState(false);
const charger = useCallback(() => {
  setChargement(true); setErreur(false);
  APPEL_API()                                  // ex. listerQuitus()
    .then(setDonnees)
    .catch(() => setErreur(true))
    .finally(() => setChargement(false));
}, [/* deps, ex. annee */]);
useEffect(() => { charger(); }, [charger]);
```

**B. Rendu** (remplacer `<table className="bpn-table">…</table>` + pagination locale) :
```jsx
<DataTable columns={colonnes} rows={donnees} getRowId={(r) => r.id}
  loading={chargement} error={erreur} onRetry={charger}
  emptyTitle="…" emptyDescription="…" libelle="…" initialSort={{ key: "…", dir: "asc" }} />
```

**C. Export CSV** : bouton **fonctionnel** (classe existante `bpn-btn-ghost`) dans la
zone d'actions du `PageHeader` appelant `telechargerCsv(nom, colonnesCsv, donnees)`
où `colonnesCsv = [{ label, valeur:(r)=>… }]`.

**D. En-tête** : **inchangé** (eyebrow, titre, styles conservés à l'identique). On
n'ajoute que les boutons fonctionnels dans la zone d'actions.

---

## Task 1: Quitus — registre en `DataTable` + export + états

**Files:** Modify `src/barreau/pages/Quitus.jsx`

- [ ] **Step 1: Lire la structure** — `grep -n "registreTable\|useDataTable\|listerQuitus\|<table\|SortTh\|formatDate\|String(" src/barreau/pages/Quitus.jsx`. Repérer l'état `registre`, le `useDataTable` local, la colonne « Authenticité » existante.

- [ ] **Step 2: Appliquer la recette A** au chargement `listerQuitus()` (états `chargement`/`erreur` sur `registre`).

- [ ] **Step 3: Définir les colonnes** (reprend la colonne Vérifier déjà présente) :
```jsx
import { formatDate } from "../utils/format";
import { DataTable } from "../components";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

const colonnes = [
  { key: "numero", label: "N°", sortable: true, sortValue: (q) => q.numero,
    cell: (q) => <span className="font-mono text-xs text-or">{q.numero}</span> },
  { key: "nom", label: "Avocat", sortable: true, sortValue: (q) => q.membre?.nom,
    cell: (q) => <span className="font-medium">Me {q.membre?.nom}</span> },
  { key: "annee", label: "Exercice", sortable: true, sortValue: (q) => q.annee,
    cell: (q) => <span className="font-mono text-xs text-gris">{q.annee}</span> },
  { key: "date", label: "Date", sortable: true, sortValue: (q) => q.dateEmission,
    cell: (q) => formatDate(q.dateEmission) },
  { key: "verif", label: "Authenticité", align: "right",
    cell: (q) => (
      <a href={`/verifier/quitus/${encodeURIComponent(q.numero)}`} target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-navy transition hover:text-or">
        <ShieldCheckIcon className="h-4 w-4" /> Vérifier
      </a>
    ) },
];
```

- [ ] **Step 4: Rendre `DataTable`** (recette B) en remplacement de la table + `Pagination` + `useDataTable` locaux. `getRowId={(q)=>q.numero}`, `initialSort={{ key:"numero", dir:"desc" }}`, `libelle="quitus"`. Supprimer l'import `SortTh`/`Pagination` devenus inutiles ici.

- [ ] **Step 5: Export CSV** (recette C) dans l'en-tête du registre :
```jsx
onClick={() => telechargerCsv(`Quitus-${new Date().getFullYear()}`, [
  { label: "N°", valeur: (q) => q.numero },
  { label: "Avocat", valeur: (q) => `Me ${q.membre?.nom}` },
  { label: "Exercice", valeur: (q) => q.annee },
  { label: "Date", valeur: (q) => formatDate(q.dateEmission) },
], registre)}
```
(Importer `telechargerCsv` depuis `../utils/exportCsv`.)

- [ ] **Step 6: En-tête inchangé** — ne rien modifier (eyebrow/titre/styles conservés ; le bouton « Générer & archiver » garde sa couleur actuelle).

- [ ] **Step 7: Vérifier** — `npm run build && npm test` (verts). Visuel `/quitus` : skeleton au chargement, tri, « Vérifier » OK, export CSV correct, dates « 15 juin 2026 ».

- [ ] **Step 8: Commit** — `git commit -am "feat: Quitus sur le socle (DataTable, états, export)"`

---

## Task 2: Reçus — états du registre + export

**Files:** Modify `src/barreau/pages/Recus.jsx`

> Le registre Reçus a déjà été converti en `DataTable` en Phase 0 (Task 10). Cette tâche finalise : états de chargement/erreur + export CSV + en-tête v2.

- [ ] **Step 1: Lire** — `grep -n "chargerRecus\|listerRecus\|DataTable\|colonnesRecus\|PageHeader" src/barreau/pages/Recus.jsx`.

- [ ] **Step 2: Recette A** sur `chargerRecus` (`listerRecus()`), passer `loading`/`error`/`onRetry` au `DataTable` Reçus.

- [ ] **Step 3: Export CSV** (recette C) dans l'en-tête du registre :
```jsx
onClick={() => telechargerCsv(`Recus-${new Date().getFullYear()}`, [
  { label: "N°", valeur: (r) => r.numero },
  { label: "Avocat", valeur: (r) => `Me ${r.membre?.nom}` },
  { label: "Montant", valeur: (r) => r.montant },
  { label: "Exercice", valeur: (r) => r.annee },
  { label: "Date", valeur: (r) => formatDate(r.date) },
], recus)}
```

- [ ] **Step 4: En-tête inchangé** — ne rien modifier au design de l'en-tête (eyebrow/titre/styles et le bouton « Imprimer & archiver » conservés).

- [ ] **Step 5: Vérifier** — `npm run build && npm test`. Visuel `/recus` : états OK, export OK.

- [ ] **Step 6: Commit** — `git commit -am "feat: Reçus — états du registre + export CSV"`

---

## Task 3: Droits de plaidoirie — table en `DataTable`

**Files:** Modify `src/barreau/pages/DroitsPlaidoirie.jsx`

- [ ] **Step 1: Lire** — `grep -n "getDroits\|useDataTable\|toggleSort\|sortKey\|<table\|SortTh\|StatCard\|formatFCFA\|EtatImprimable" src/barreau/pages/DroitsPlaidoirie.jsx`. Noter les champs réels (`num`, `nom`/`membre.nom`, `montantDu`/`du`, `montantPaye`/`paye`, `solde`).

- [ ] **Step 2: Recette A** sur `getDroits(exercice)`.

- [ ] **Step 3: Colonnes** (adapter les noms de champs au Step 1) :
```jsx
const colonnes = [
  { key: "num", label: "N°", sortable: true, sortValue: (d) => d.membre?.num ?? d.num,
    cell: (d) => <span className="font-mono text-xs text-or">{d.membre?.num ?? d.num}</span> },
  { key: "nom", label: "Avocat", sortable: true, sortValue: (d) => d.membre?.nom ?? d.nom,
    cell: (d) => <span className="font-medium">Me {d.membre?.nom ?? d.nom}</span> },
  { key: "du", label: "Droit dû", align: "right", sortable: true, sortValue: (d) => d.montantDu,
    cell: (d) => formatFCFA(d.montantDu) },
  { key: "paye", label: "Perçu", align: "right", sortable: true, sortValue: (d) => d.montantPaye,
    cell: (d) => formatFCFA(d.montantPaye) },
  { key: "solde", label: "Solde", align: "right", sortable: true, sortValue: (d) => d.solde,
    cell: (d) => formatFCFA(d.solde) },
  { key: "actions", label: "", align: "right", cell: (d) => /* bouton paiement existant (PaiementModal) */ null },
];
```
Réinjecter dans `actions` le déclencheur de `PaiementModal` déjà présent.

- [ ] **Step 4: Rendre `DataTable`** (recette B). Conserver les 3 `StatCard` (Dus/Perçus/Arriérés) au-dessus. `libelle="avocats"`, `initialSort={{ key:"nom", dir:"asc" }}`.

- [ ] **Step 5: Export CSV** (recette C) — N°, Avocat, Dû, Perçu, Solde.

- [ ] **Step 6: En-tête inchangé** — conserver `EtatImprimable` (état général imprimable) ; ne pas modifier le design de l'en-tête.

- [ ] **Step 7: Vérifier** — `npm run build && npm test`. Visuel `/droits-plaidoirie` : StatCards + table socle, états, tri, paiement, export.

- [ ] **Step 8: Commit** — `git commit -am "feat: Droits de plaidoirie sur le socle (DataTable, états, export)"`

---

## Task 4: Vérification de phase

- [ ] **Step 1:** `npm test && npm run build && (cd server && npm run typecheck)` → tout vert.
- [ ] **Step 2:** Parcours visuel + clavier de `/quitus`, `/recus`, `/droits-plaidoirie` : états, tri, export, focus visibles, dates formatées, or absent des actions courantes.
- [ ] **Step 3:** `git push -u origin claude/file-context-analysis-ixq8w3`

## Self-Review (couverture)
- Quitus → Task 1 · Reçus → Task 2 · Droits → Task 3.
- Critères §5 (états, DataTable, formats, or non-CTA, export, a11y héritée du socle) couverts par module ; actions groupées non requises ici (registres en lecture/génération).
