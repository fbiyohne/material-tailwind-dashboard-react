# Professionnalisation — Phase 0 (socle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le socle transverse (formatage, états, table unique, discipline couleur, a11y, export) et le valider sur le module Cotisations, sans renier l'identité navy/or.

**Architecture:** On ajoute d'abord des utilitaires/primitives *testables* (formatage dates, export CSV, sélection de lignes), puis des composants UI partagés (Breadcrumb, Skeleton, ErrorState, DataTable), puis on convertit Cotisations (module-phare) et le registre Reçus (2ᵉ usage pour durcir la table). La discipline couleur est un **audit d'usage** : `bpn-btn-primary` est déjà navy ; on remplace les `bpn-btn-or` d'actions courantes par `bpn-btn-primary`, l'or restant réservé aux actions « officielles » (génération de quitus/reçu).

**Tech Stack:** React 18 + Vite, Tailwind (classes `bpn-*` dans `public/css/tailwind.css`), heroicons, PropTypes. Tests front : **Vitest + @testing-library/react + jsdom** (ajoutés en Task 1). API via le client `src/barreau/api/client.js` (`api()`), base `/api`.

**Référence spec :** `docs/superpowers/specs/2026-06-15-professionnalisation-socle-design.md`

---

## File Structure

**Créés :**
- `vitest.config.js` — config de test front (jsdom).
- `src/test/setup.js` — setup testing-library (jest-dom).
- `src/barreau/utils/exportCsv.js` — génération + téléchargement CSV.
- `src/barreau/utils/__tests__/format.test.js` — tests formatage.
- `src/barreau/utils/__tests__/exportCsv.test.js` — tests CSV.
- `src/barreau/hooks/__tests__/useDataTable.test.js` — tests tri/pagination/sélection.
- `src/barreau/components/Breadcrumb.jsx` — fil d'Ariane.
- `src/barreau/components/Skeleton.jsx` — skeleton + `TableSkeleton`.
- `src/barreau/components/ErrorState.jsx` — état erreur + réessai.
- `src/barreau/components/DataTable.jsx` — table unique (tri, pagination, sélection, états).
- `src/barreau/components/__tests__/DataTable.test.jsx` — tests DataTable.

**Modifiés :**
- `package.json` — devDeps de test + script `test`.
- `src/barreau/utils/format.js` — ajout `formatDate`.
- `src/barreau/hooks/useDataTable.js` — ajout sélection de lignes.
- `src/barreau/components/PageHeader.jsx` — support `breadcrumb` + titre compact.
- `src/barreau/components/index.js` — exports des nouveaux composants.
- `src/barreau/pages/Cotisations.jsx` — conversion socle (lighthouse).
- `src/barreau/pages/Recus.jsx` — registre `<ul>` → `DataTable`.
- Pages avec `bpn-btn-or` d'action courante — swap vers `bpn-btn-primary`.

---

## Task 1: Harnais de test front (Vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`, `src/test/setup.js`, `src/barreau/utils/__tests__/smoke.test.js`

- [ ] **Step 1: Installer les dépendances de test**

Run:
```bash
npm install -D vitest@^2 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```
Expected: installation OK (les paquets apparaissent dans `devDependencies`).

- [ ] **Step 2: Ajouter le script `test`**

Dans `package.json`, ajouter à `"scripts"` :
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Créer la config Vitest**

Create `vitest.config.js` :
```js
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.{test,spec}.{js,jsx}"],
  },
});
```

> Vérifier que `@vitejs/plugin-react` est déjà une dépendance (utilisé par Vite). Si absent : `npm install -D @vitejs/plugin-react`.

- [ ] **Step 4: Créer le setup testing-library**

Create `src/test/setup.js` :
```js
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Smoke test**

Create `src/barreau/utils/__tests__/smoke.test.js` :
```js
import { describe, it, expect } from "vitest";

describe("harnais", () => {
  it("exécute les tests", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Lancer les tests**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add package.json vitest.config.js src/test/setup.js src/barreau/utils/__tests__/smoke.test.js
git commit -m "test: harnais de test front (vitest + testing-library)"
```

---

## Task 2: Formateur de date unique (TDD)

**Files:**
- Modify: `src/barreau/utils/format.js`
- Create: `src/barreau/utils/__tests__/format.test.js`

- [ ] **Step 1: Écrire les tests d'abord**

Create `src/barreau/utils/__tests__/format.test.js` :
```js
import { describe, it, expect } from "vitest";
import { formatDate, formatFCFA } from "../format";

describe("formatDate", () => {
  it("formate une date ISO en français long", () => {
    expect(formatDate("2026-06-15")).toBe("15 juin 2026");
  });
  it("accepte un objet Date", () => {
    expect(formatDate(new Date("2026-01-05T10:00:00Z"))).toBe("5 janvier 2026");
  });
  it("renvoie un tiret pour une valeur vide", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });
  it("renvoie un tiret pour une date invalide", () => {
    expect(formatDate("pas-une-date")).toBe("—");
  });
});

describe("formatFCFA (inchangé, garde-fou)", () => {
  it("formate avec séparateurs", () => {
    expect(formatFCFA(1500000)).toBe("1 500 000 FCFA");
  });
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `npx vitest run src/barreau/utils/__tests__/format.test.js`
Expected: FAIL — `formatDate` n'est pas exporté.

- [ ] **Step 3: Implémenter `formatDate`**

Dans `src/barreau/utils/format.js`, ajouter à la fin (avant tout `export default` éventuel) :
```js
/**
 * Formate une date en français long, ex. « 15 juin 2026 ».
 * Source unique pour l'affichage des dates — remplace les `slice(0,10)` ISO.
 */
export function formatDate(valeur) {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  const d = valeur instanceof Date ? valeur : new Date(valeur);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
```

- [ ] **Step 4: Lancer pour vérifier le succès**

Run: `npx vitest run src/barreau/utils/__tests__/format.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/barreau/utils/format.js src/barreau/utils/__tests__/format.test.js
git commit -m "feat: formateur de date unique (formatDate)"
```

---

## Task 3: Utilitaire d'export CSV (TDD)

**Files:**
- Create: `src/barreau/utils/exportCsv.js`, `src/barreau/utils/__tests__/exportCsv.test.js`

- [ ] **Step 1: Écrire les tests d'abord**

Create `src/barreau/utils/__tests__/exportCsv.test.js` :
```js
import { describe, it, expect } from "vitest";
import { versCsv } from "../exportCsv";

describe("versCsv", () => {
  const colonnes = [
    { label: "N°", valeur: (r) => r.num },
    { label: "Nom", valeur: (r) => r.nom },
    { label: "Montant", valeur: (r) => r.montant },
  ];
  const lignes = [
    { num: 1, nom: "BAKALA Thomas", montant: 150000 },
    { num: 2, nom: 'Cabinet "Loango"; SCPA', montant: 0 },
  ];

  it("génère un en-tête + lignes", () => {
    const csv = versCsv(colonnes, lignes);
    const rows = csv.split("\r\n");
    expect(rows[0]).toBe("N°;Nom;Montant");
    expect(rows[1]).toBe("1;BAKALA Thomas;150000");
  });

  it("échappe les valeurs contenant séparateur, guillemets ou point-virgule", () => {
    const csv = versCsv(colonnes, lignes);
    const rows = csv.split("\r\n");
    expect(rows[2]).toBe('2;"Cabinet ""Loango""; SCPA";0');
  });

  it("gère les valeurs nulles", () => {
    const csv = versCsv([{ label: "X", valeur: (r) => r.x }], [{ x: null }, { x: undefined }]);
    expect(csv.split("\r\n").slice(1)).toEqual(["", ""]);
  });
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `npx vitest run src/barreau/utils/__tests__/exportCsv.test.js`
Expected: FAIL — `versCsv` introuvable.

- [ ] **Step 3: Implémenter**

Create `src/barreau/utils/exportCsv.js` :
```js
/**
 * Export CSV léger (séparateur « ; » compatible Excel FR), sans dépendance.
 * `colonnes` : [{ label, valeur: (ligne) => any }]. Échappe selon RFC 4180.
 */
function echapper(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function versCsv(colonnes, lignes) {
  const entete = colonnes.map((c) => echapper(c.label)).join(";");
  const corps = lignes.map((l) => colonnes.map((c) => echapper(c.valeur(l))).join(";"));
  return [entete, ...corps].join("\r\n");
}

/** Déclenche le téléchargement d'un CSV (BOM UTF-8 pour Excel). */
export function telechargerCsv(nomFichier, colonnes, lignes) {
  const csv = "﻿" + versCsv(colonnes, lignes);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier.endsWith(".csv") ? nomFichier : `${nomFichier}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Lancer pour vérifier le succès**

Run: `npx vitest run src/barreau/utils/__tests__/exportCsv.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/barreau/utils/exportCsv.js src/barreau/utils/__tests__/exportCsv.test.js
git commit -m "feat: export CSV partagé (versCsv + telechargerCsv)"
```

---

## Task 4: Sélection de lignes dans `useDataTable` (TDD)

**Files:**
- Modify: `src/barreau/hooks/useDataTable.js`
- Create: `src/barreau/hooks/__tests__/useDataTable.test.js`

- [ ] **Step 1: Écrire les tests d'abord**

Create `src/barreau/hooks/__tests__/useDataTable.test.js` :
```js
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDataTable } from "../useDataTable";

const rows = [
  { id: 1, nom: "C" },
  { id: 2, nom: "A" },
  { id: 3, nom: "B" },
];

describe("useDataTable — tri (existant)", () => {
  it("trie selon l'accessor", () => {
    const { result } = renderHook(() =>
      useDataTable(rows, { accessors: { nom: (r) => r.nom }, initialSort: { key: "nom", dir: "asc" } })
    );
    expect(result.current.rows.map((r) => r.nom)).toEqual(["A", "B", "C"]);
  });
});

describe("useDataTable — sélection (nouveau)", () => {
  it("sélectionne et désélectionne une ligne", () => {
    const { result } = renderHook(() => useDataTable(rows, { getRowId: (r) => r.id }));
    act(() => result.current.toggleRow(2));
    expect(result.current.selectedIds).toEqual([2]);
    act(() => result.current.toggleRow(2));
    expect(result.current.selectedIds).toEqual([]);
  });

  it("toggleAllVisible sélectionne les lignes de la page courante", () => {
    const { result } = renderHook(() => useDataTable(rows, { getRowId: (r) => r.id }));
    act(() => result.current.toggleAllVisible());
    expect(result.current.selectedIds.sort()).toEqual([1, 2, 3]);
    expect(result.current.allVisibleSelected).toBe(true);
    act(() => result.current.toggleAllVisible());
    expect(result.current.selectedIds).toEqual([]);
  });

  it("clearSelection vide la sélection", () => {
    const { result } = renderHook(() => useDataTable(rows, { getRowId: (r) => r.id }));
    act(() => result.current.toggleRow(1));
    act(() => result.current.clearSelection());
    expect(result.current.selectedIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `npx vitest run src/barreau/hooks/__tests__/useDataTable.test.js`
Expected: FAIL — `toggleRow`/`selectedIds` indéfinis.

- [ ] **Step 3: Étendre le hook (sans casser l'existant)**

Dans `src/barreau/hooks/useDataTable.js` :

a) Ajouter `getRowId` aux options et un état de sélection. Modifier la signature :
```js
export function useDataTable(rows, { accessors = {}, pageSize = 10, initialSort, getRowId } = {}) {
  const [sortKey, setSortKey] = useState(initialSort?.key ?? null);
  const [sortDir, setSortDir] = useState(initialSort?.dir ?? "asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
```

b) Avant le `return`, après le calcul de `pageRows`, ajouter la logique de sélection :
```js
  const rowId = getRowId ?? ((r) => r.id);
  const selectedIds = [...selected];
  const toggleRow = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const visibleIds = pageRows.map(rowId);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleAllVisible = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (visibleIds.every((id) => next.has(id))) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  const clearSelection = () => setSelected(new Set());
```

c) Étendre l'objet retourné :
```js
  return {
    rows: pageRows, total: sorted.length, page: current, setPage, totalPages,
    sortKey, sortDir, toggleSort,
    selectedIds, toggleRow, toggleAllVisible, allVisibleSelected, clearSelection,
  };
```

- [ ] **Step 4: Lancer pour vérifier le succès**

Run: `npx vitest run src/barreau/hooks/__tests__/useDataTable.test.js`
Expected: PASS (5 tests). Lancer aussi `npm test` → tout vert.

- [ ] **Step 5: Commit**

```bash
git add src/barreau/hooks/useDataTable.js src/barreau/hooks/__tests__/useDataTable.test.js
git commit -m "feat: sélection de lignes dans useDataTable"
```

---

## Task 5: Discipline des couleurs (audit d'usage du bouton primaire)

**Files:**
- Modify: pages listées par le grep ci-dessous (remplacement ciblé `bpn-btn-or` → `bpn-btn-primary`)

**Règle :** `bpn-btn-or` (or) est réservé aux actions **« officielles »** : génération/impression d'un **quitus** ou d'un **reçu**. Toute autre action primaire courante (Enregistrer, Créer, + Avocat, Ajouter, Lancer relances, Importer…) utilise `bpn-btn-primary` (navy).

- [ ] **Step 1: Lister les usages**

Run: `grep -rn "bpn-btn-or" src/barreau/pages src/barreau/components src/barreau/layout`
Expected: liste des occurrences à arbitrer.

- [ ] **Step 2: Conserver l'or UNIQUEMENT sur génération de documents**

Garder `bpn-btn-or` sur :
- `src/barreau/pages/Quitus.jsx` — bouton « Générer & archiver ».
- `src/barreau/pages/Recus.jsx` — bouton « Imprimer & archiver ».

Pour **toutes les autres** occurrences trouvées au Step 1 (ex. `Cotisations.jsx`, `DroitsPlaidoirie.jsx`, `Annuaire.jsx`, `Reunions.jsx`, `Assemblees.jsx`, `Publications.jsx`, `CorpsElectoral.jsx`, `Utilisateurs.jsx`, `AssembleeDetail.jsx`, `ReunionDetail.jsx`, et le bouton « + Avocat » de la barre supérieure dans `src/barreau/layout/`), remplacer la classe `bpn-btn-or` par `bpn-btn-primary`. Idem pour `<Button variant="or">` d'action courante → `variant="primary"`.

> Ne PAS modifier la définition CSS de `.bpn-btn-or` / `.bpn-btn-primary` : seul l'**usage** change.

- [ ] **Step 3: Vérifier le build**

Run: `npm run build`
Expected: BUILD OK.

- [ ] **Step 4: Vérification visuelle**

Lancer l'app, ouvrir 3 pages (Cotisations, Annuaire, une page de réunion) : l'action primaire est navy ; l'or n'apparaît plus que sur Quitus/Reçus (génération). Confirmer qu'aucune action courante n'est dorée.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: action primaire en navy, or réservé à la génération de documents (60-30-10)"
```

---

## Task 6: `Breadcrumb` + `PageHeader` v2

**Files:**
- Create: `src/barreau/components/Breadcrumb.jsx`, `src/barreau/components/__tests__/Breadcrumb.test.jsx`
- Modify: `src/barreau/components/PageHeader.jsx`, `src/barreau/components/index.js`

- [ ] **Step 1: Test du Breadcrumb**

Create `src/barreau/components/__tests__/Breadcrumb.test.jsx` :
```jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Breadcrumb } from "../Breadcrumb";

describe("Breadcrumb", () => {
  it("rend les segments, le dernier non cliquable", () => {
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: "Avocats", to: "/avocats" }, { label: "Me BAKALA" }]} />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Avocats" })).toHaveAttribute("href", "/avocats");
    expect(screen.getByText("Me BAKALA")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Me BAKALA" })).toBeNull();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/barreau/components/__tests__/Breadcrumb.test.jsx`
Expected: FAIL — `Breadcrumb` introuvable.

- [ ] **Step 3: Implémenter le Breadcrumb**

Create `src/barreau/components/Breadcrumb.jsx` :
```jsx
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

/** Fil d'Ariane discret pour le wayfinding (pages de détail). */
export function Breadcrumb({ items }) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-xs text-gris">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="inline-flex items-center gap-1">
            {it.to && !last ? (
              <Link to={it.to} className="transition hover:text-navy">{it.label}</Link>
            ) : (
              <span aria-current={last ? "page" : undefined} className={last ? "text-encre" : ""}>{it.label}</span>
            )}
            {!last && <ChevronRightIcon className="h-3 w-3 text-grisM" />}
          </span>
        );
      })}
    </nav>
  );
}

Breadcrumb.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string.isRequired, to: PropTypes.string })).isRequired,
};

export default Breadcrumb;
```

- [ ] **Step 4: Étendre `PageHeader` (breadcrumb + titre compact)**

Modifier `src/barreau/components/PageHeader.jsx` — ajouter la prop `breadcrumb` et réduire le titre :
```jsx
import PropTypes from "prop-types";
import { Breadcrumb } from "./Breadcrumb";

export function PageHeader({ eyebrow, breadcrumb, titre, sousTitre, className = "", children }) {
  return (
    <div className={`flex flex-col justify-between gap-3 sm:flex-row sm:items-end ${className}`}>
      <div>
        {breadcrumb && <div className="mb-1.5"><Breadcrumb items={breadcrumb} /></div>}
        {eyebrow && !breadcrumb && <div className="bpn-eyebrow">{eyebrow}</div>}
        <h2 className="bpn-title-compact mt-1.5">{titre}</h2>
        {sousTitre && <p className="mt-1 text-sm text-gris">{sousTitre}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{children}</div>}
    </div>
  );
}

PageHeader.propTypes = {
  eyebrow: PropTypes.string,
  breadcrumb: PropTypes.array,
  titre: PropTypes.node.isRequired,
  sousTitre: PropTypes.node,
  className: PropTypes.string,
  children: PropTypes.node,
};

export default PageHeader;
```

- [ ] **Step 5: Ajouter la classe titre compacte**

Dans `public/css/tailwind.css`, sous la définition de `.bpn-title`, ajouter :
```css
  .bpn-title-compact {
    @apply font-display text-2xl font-bold leading-tight text-navy;
  }
```
> Plus compact que `.bpn-title` (qui reste pour les écrans non encore convertis).

- [ ] **Step 6: Exporter le Breadcrumb**

Dans `src/barreau/components/index.js`, ajouter :
```js
export { Breadcrumb } from "./Breadcrumb";
```

- [ ] **Step 7: Vérifier tests + build**

Run: `npx vitest run src/barreau/components/__tests__/Breadcrumb.test.jsx && npm run build`
Expected: tests PASS, BUILD OK. (Les pages existantes passant `eyebrow` restent inchangées.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: Breadcrumb + PageHeader v2 (titre compact, fil d'Ariane)"
```

---

## Task 7: Primitives d'état — `Skeleton` et `ErrorState`

**Files:**
- Create: `src/barreau/components/Skeleton.jsx`, `src/barreau/components/ErrorState.jsx`
- Modify: `src/barreau/components/index.js`

- [ ] **Step 1: Implémenter `Skeleton` + `TableSkeleton`**

Create `src/barreau/components/Skeleton.jsx` :
```jsx
import PropTypes from "prop-types";

/** Bloc squelette (chargement). Respecte prefers-reduced-motion via la classe. */
export function Skeleton({ className = "" }) {
  return <div className={`bpn-skeleton ${className}`} aria-hidden="true" />;
}
Skeleton.propTypes = { className: PropTypes.string };

/** Squelette de table (N lignes × M colonnes) pour l'état de chargement. */
export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="divide-y divide-grisL" role="status" aria-label="Chargement">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-3 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-3.5 ${c === 1 ? "flex-[2]" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
TableSkeleton.propTypes = { rows: PropTypes.number, cols: PropTypes.number };

export default Skeleton;
```

- [ ] **Step 2: Ajouter le style skeleton**

Dans `public/css/tailwind.css` (section utilitaires `bpn-*`), ajouter :
```css
  .bpn-skeleton {
    @apply animate-pulse rounded bg-grisM/60;
  }
  @media (prefers-reduced-motion: reduce) {
    .bpn-skeleton { @apply animate-none; }
  }
```

- [ ] **Step 3: Implémenter `ErrorState`**

Create `src/barreau/components/ErrorState.jsx` :
```jsx
import PropTypes from "prop-types";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/** État d'erreur réutilisable avec action de réessai. */
export function ErrorState({ title = "Impossible de charger les données", description, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center" role="alert">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rougeL text-rouge">
        <ExclamationTriangleIcon className="h-6 w-6" />
      </div>
      <p className="font-display text-base text-rouge">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gris">{description}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="bpn-btn bpn-btn-ghost mt-4">
          Réessayer
        </button>
      )}
    </div>
  );
}

ErrorState.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  onRetry: PropTypes.func,
};

export default ErrorState;
```

- [ ] **Step 4: Exporter**

Dans `src/barreau/components/index.js`, ajouter :
```js
export { Skeleton, TableSkeleton } from "./Skeleton";
export { ErrorState } from "./ErrorState";
```

- [ ] **Step 5: Vérifier le build**

Run: `npm run build`
Expected: BUILD OK.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: primitives d'état Skeleton/TableSkeleton + ErrorState"
```

---

## Task 8: Composant `DataTable` unique

**Files:**
- Create: `src/barreau/components/DataTable.jsx`, `src/barreau/components/__tests__/DataTable.test.jsx`
- Modify: `src/barreau/components/index.js`

API : `columns` = `[{ key, label, align?, sortable?, sortValue?(row), cell(row) }]`.
Props : `rows`, `getRowId`, `columns`, `pageSize`, `initialSort`, `loading`, `error`, `onRetry`, `emptyTitle`, `emptyDescription`, `selectable`, `renderBulkActions(selectedIds, clearSelection)`, `density` (`"confort"|"compact"`), `libelle`.

- [ ] **Step 1: Tests du DataTable**

Create `src/barreau/components/__tests__/DataTable.test.jsx` :
```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable } from "../DataTable";

const columns = [
  { key: "nom", label: "Nom", sortable: true, sortValue: (r) => r.nom, cell: (r) => r.nom },
  { key: "montant", label: "Montant", align: "right", cell: (r) => r.montant },
];
const rows = [
  { id: 1, nom: "BAKALA", montant: 100 },
  { id: 2, nom: "ANGO", montant: 200 },
];

describe("DataTable", () => {
  it("affiche le squelette en chargement", () => {
    render(<DataTable columns={columns} rows={[]} loading getRowId={(r) => r.id} />);
    expect(screen.getByLabelText("Chargement")).toBeInTheDocument();
  });

  it("affiche l'erreur avec réessai", async () => {
    const onRetry = vi.fn();
    render(<DataTable columns={columns} rows={[]} error onRetry={onRetry} getRowId={(r) => r.id} />);
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("affiche l'état vide", () => {
    render(<DataTable columns={columns} rows={[]} emptyTitle="Aucun élément" getRowId={(r) => r.id} />);
    expect(screen.getByText("Aucun élément")).toBeInTheDocument();
  });

  it("rend les lignes et trie au clic sur l'en-tête", async () => {
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id} />);
    expect(screen.getAllByRole("row")).toHaveLength(3); // 1 en-tête + 2 lignes
    await userEvent.click(screen.getByRole("button", { name: /Nom/ }));
    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("ANGO");
  });

  it("sélectionne une ligne et affiche la barre d'actions groupées", async () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        selectable
        renderBulkActions={(ids) => <span>{ids.length} sélectionné(s)</span>}
      />
    );
    const cases = screen.getAllByRole("checkbox");
    await userEvent.click(cases[1]); // 1re ligne (cases[0] = tout sélectionner)
    expect(screen.getByText("1 sélectionné(s)")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/barreau/components/__tests__/DataTable.test.jsx`
Expected: FAIL — `DataTable` introuvable.

- [ ] **Step 3: Implémenter `DataTable`**

Create `src/barreau/components/DataTable.jsx` :
```jsx
import PropTypes from "prop-types";
import { ChevronUpDownIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { useDataTable } from "../hooks/useDataTable";
import { TableSkeleton } from "./Skeleton";
import { ErrorState } from "./ErrorState";
import { EmptyState } from "./EmptyState";
import { Pagination } from "./Pagination";

const alignCls = { right: "text-right", center: "text-center", left: "text-left" };

export function DataTable({
  columns, rows, getRowId = (r) => r.id, pageSize = 10, initialSort,
  loading = false, error = false, onRetry, emptyTitle = "Aucun élément", emptyDescription,
  selectable = false, renderBulkActions, density = "confort", libelle = "éléments",
}) {
  const accessors = Object.fromEntries(
    columns.filter((c) => c.sortable && c.sortValue).map((c) => [c.key, c.sortValue])
  );
  const t = useDataTable(rows, { accessors, pageSize, initialSort, getRowId });
  const pad = density === "compact" ? "px-3 py-1.5" : "px-3 py-2.5";

  if (loading) return <TableSkeleton cols={columns.length + (selectable ? 1 : 0)} />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <>
      {selectable && t.selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-grisM bg-bleuL/60 px-3 py-2 text-sm">
          <span className="font-medium text-navy">{t.selectedIds.length} sélectionné(s)</span>
          <div className="flex items-center gap-2">
            {renderBulkActions?.(t.selectedIds, t.clearSelection)}
            <button type="button" onClick={t.clearSelection} className="text-xs text-gris hover:text-encre">Effacer</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="bpn-table">
          <thead className="sticky top-0 z-10">
            <tr>
              {selectable && (
                <th className={`${pad} w-10`}>
                  <input type="checkbox" aria-label="Tout sélectionner" checked={t.allVisibleSelected}
                    onChange={t.toggleAllVisible} className="h-4 w-4 accent-navy" />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={`${pad} ${alignCls[c.align] ?? "text-left"}`}>
                  {c.sortable ? (
                    <button type="button" onClick={() => t.toggleSort(c.key)}
                      className="inline-flex items-center gap-1 font-medium uppercase hover:text-white">
                      {c.label}
                      {t.sortKey === c.key
                        ? (t.sortDir === "asc" ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)
                        : <ChevronUpDownIcon className="h-3 w-3 opacity-60" />}
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((row) => {
              const id = getRowId(row);
              const sel = t.selectedIds.includes(id);
              return (
                <tr key={id} className={sel ? "bg-bleuL/40" : "hover:bg-grisL/50"}>
                  {selectable && (
                    <td className={pad}>
                      <input type="checkbox" aria-label={`Sélectionner ${id}`} checked={sel}
                        onChange={() => t.toggleRow(id)} className="h-4 w-4 accent-navy" />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={`${pad} ${alignCls[c.align] ?? "text-left"}`}>{c.cell(row)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={t.page} totalPages={t.totalPages} total={t.total} onPage={t.setPage} libelle={libelle} />
    </>
  );
}

DataTable.propTypes = {
  columns: PropTypes.array.isRequired,
  rows: PropTypes.array.isRequired,
  getRowId: PropTypes.func,
  pageSize: PropTypes.number,
  initialSort: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.bool,
  onRetry: PropTypes.func,
  emptyTitle: PropTypes.string,
  emptyDescription: PropTypes.string,
  selectable: PropTypes.bool,
  renderBulkActions: PropTypes.func,
  density: PropTypes.oneOf(["confort", "compact"]),
  libelle: PropTypes.string,
};

export default DataTable;
```

> Vérifier la signature réelle de `Pagination` (`src/barreau/components/Pagination.jsx`) et ajuster les props `page/totalPages/total/onPage/libelle` si nécessaire.

- [ ] **Step 4: Exporter**

Dans `src/barreau/components/index.js`, ajouter :
```js
export { DataTable } from "./DataTable";
```

- [ ] **Step 5: Vérifier tests + build**

Run: `npm test && npm run build`
Expected: tous les tests PASS, BUILD OK.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: composant DataTable unique (tri, pagination, sélection, états, densité)"
```

---

## Task 9: Convertir Cotisations (module-phare)

**Files:**
- Modify: `src/barreau/pages/Cotisations.jsx`

But : remplacer la table ad hoc par `DataTable`, brancher les états (chargement/erreur/vide), passer toutes les dates par `formatDate`, ajouter l'**export CSV** (sélection + tout), et la **relance groupée** via `lancerRelances(annee)`.

- [ ] **Step 1: Repérer la structure actuelle**

Run: `grep -n "useState\|useEffect\|listerCotisations\|getCotisations\|<table\|registreTable\|PageHeader\|bpn-btn\|lancerRelances\|catch" src/barreau/pages/Cotisations.jsx`
Lire le fichier pour identifier : l'appel de chargement, l'état des données, la table existante.

- [ ] **Step 2: Ajouter états loading/error autour du chargement**

Dans le composant, autour de l'appel API existant (ex. `getCotisations(annee)`), introduire :
```jsx
const [chargement, setChargement] = useState(true);
const [erreur, setErreur] = useState(false);

const charger = useCallback(() => {
  setChargement(true);
  setErreur(false);
  getCotisations(annee)               // adapter au nom réel de l'appel
    .then(setLignes)                  // adapter au setter réel
    .catch(() => setErreur(true))
    .finally(() => setChargement(false));
}, [annee]);

useEffect(() => { charger(); }, [charger]);
```
(Importer `useCallback` ; importer `formatDate`, `DataTable`, `telechargerCsv`, `lancerRelances`.)

- [ ] **Step 3: Définir les colonnes**

Remplacer le `<table>…</table>` (et sa pagination/`useDataTable` locale) par une définition de colonnes + `<DataTable>` :
```jsx
const colonnes = [
  { key: "num", label: "N°", sortable: true, sortValue: (c) => c.membre?.num,
    cell: (c) => <span className="font-mono text-xs text-or">{c.membre?.num}</span> },
  { key: "nom", label: "Avocat", sortable: true, sortValue: (c) => c.membre?.nom,
    cell: (c) => <span className="font-medium">Me {c.membre?.nom}</span> },
  { key: "statut", label: "Statut", cell: (c) => <Badge ton={c.aJour ? "vert" : "rouge"}>{c.aJour ? "À jour" : "En retard"}</Badge> },
  { key: "du", label: "Dû", align: "right", sortable: true, sortValue: (c) => c.montantDu,
    cell: (c) => formatFCFA(c.montantDu) },
  { key: "paye", label: "Payé", align: "right", sortable: true, sortValue: (c) => c.montantPaye,
    cell: (c) => formatFCFA(c.montantPaye) },
  { key: "date", label: "Dernier paiement", cell: (c) => formatDate(c.datePaiement) },
  { key: "actions", label: "", align: "right", cell: (c) => /* boutons d'action existants */ null },
];
```
> Adapter les noms de champs (`membre.num`, `aJour`, `montantDu`, `montantPaye`, `datePaiement`) à la forme réelle des données — les vérifier au Step 1. Réinjecter dans la colonne `actions` les boutons d'action déjà présents dans l'ancienne table.

- [ ] **Step 4: Rendre le DataTable avec états, sélection, actions groupées**

```jsx
<DataTable
  columns={colonnes}
  rows={lignes}
  getRowId={(c) => c.membre?.id ?? c.id}
  loading={chargement}
  error={erreur}
  onRetry={charger}
  emptyTitle="Aucune cotisation"
  emptyDescription="Aucune cotisation pour cet exercice."
  selectable
  libelle="cotisations"
  initialSort={{ key: "nom", dir: "asc" }}
  renderBulkActions={(ids) => (
    <button
      type="button"
      className="bpn-btn bpn-btn-ghost !py-1 text-xs"
      onClick={() => {
        const sel = lignes.filter((c) => ids.includes(c.membre?.id ?? c.id));
        telechargerCsv(`Cotisations-${annee}`, [
          { label: "N°", valeur: (c) => c.membre?.num },
          { label: "Avocat", valeur: (c) => `Me ${c.membre?.nom}` },
          { label: "Statut", valeur: (c) => (c.aJour ? "À jour" : "En retard") },
          { label: "Dû", valeur: (c) => c.montantDu },
          { label: "Payé", valeur: (c) => c.montantPaye },
        ], sel);
      }}
    >
      Exporter la sélection (CSV)
    </button>
  )}
/>
```

- [ ] **Step 5: Bouton « Relancer les retardataires » dans l'en-tête**

Dans la zone d'actions du `PageHeader`, ajouter (navy) :
```jsx
<button
  type="button"
  className="bpn-btn bpn-btn-primary"
  onClick={async () => {
    try {
      const r = await lancerRelances(annee);
      toast.success(`Relances envoyées (${r?.envoyees ?? "OK"}).`);
    } catch {
      toast.error("Échec de l'envoi des relances.");
    }
  }}
>
  Relancer les retardataires
</button>
```
> Adapter `r?.envoyees` à la forme réelle de la réponse de `/cotisations/relances`. Utiliser le `useToast()` déjà présent.

- [ ] **Step 6: Convertir l'en-tête en PageHeader v2**

Remplacer l'eyebrow doré par un titre compact (laisser `eyebrow` retiré ; le `PageHeader` v2 gère la taille). Conserver le `SelecteurExercice` dans la zone d'actions.

- [ ] **Step 7: Vérifier build + tests**

Run: `npm run build && npm test`
Expected: BUILD OK, tests verts.

- [ ] **Step 8: Vérification visuelle + clavier**

Lancer l'app → `/cotisations` :
1. Recharger : le **skeleton** s'affiche brièvement.
2. Couper l'API (ou simuler) → l'**ErrorState** avec « Réessayer » s'affiche ; cliquer recharge.
3. Données présentes : tri par colonnes, sélection de lignes → barre d'actions groupées → **Exporter la sélection** télécharge un CSV correct.
4. **Relancer les retardataires** → toast de succès.
5. Dates affichées « 15 juin 2026 » (aucune ISO brute).
6. Navigation **clavier** : Tab atteint les cases à cocher et les en-têtes triables ; focus visible.

- [ ] **Step 9: Commit**

```bash
git add src/barreau/pages/Cotisations.jsx
git commit -m "feat: Cotisations sur le socle (DataTable, états, formatage, export, relances)"
```

---

## Task 10: Convertir le registre Reçus (`<ul>` → `DataTable`)

**Files:**
- Modify: `src/barreau/pages/Recus.jsx`

But : durcir le `DataTable` sur un 2ᵉ usage réel et uniformiser (fin du `<ul>`), avec lien « Vérifier » conservé et dates via `formatDate`.

- [ ] **Step 1: Définir les colonnes du registre**

Dans `Recus.jsx`, remplacer le bloc `<ul className="divide-y…">…</ul>` (registre « Reçus émis ») par :
```jsx
const colonnesRecus = [
  { key: "numero", label: "N°", sortable: true, sortValue: (r) => r.numero,
    cell: (r) => <span className="font-mono text-xs text-or">{r.numero}</span> },
  { key: "nom", label: "Avocat", sortable: true, sortValue: (r) => r.membre?.nom,
    cell: (r) => <span className="font-medium">Me {r.membre?.nom}</span> },
  { key: "montant", label: "Montant", align: "right", sortable: true, sortValue: (r) => r.montant,
    cell: (r) => formatFCFA(r.montant) },
  { key: "annee", label: "Exercice", cell: (r) => <span className="font-mono text-xs text-gris">{r.annee}</span> },
  { key: "date", label: "Date", cell: (r) => formatDate(r.date) },
  { key: "actions", label: "", align: "right", cell: (r) => (
    <div className="flex items-center justify-end gap-3">
      <a href={`/verifier/recu/${encodeURIComponent(r.numero)}`} target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-navy transition hover:text-or">
        <ShieldCheckIcon className="h-4 w-4" /> Vérifier
      </a>
      <button type="button" onClick={() => annuler(r)} title="Annuler le reçu" className="text-gris transition hover:text-rouge">
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  ) },
];
```

- [ ] **Step 2: Rendre le DataTable**

```jsx
<DataTable
  columns={colonnesRecus}
  rows={recus}
  getRowId={(r) => r.numero}
  emptyTitle="Aucun reçu émis"
  emptyDescription="Les reçus de paiement émis apparaîtront ici."
  libelle="reçus"
  initialSort={{ key: "numero", dir: "desc" }}
/>
```
Supprimer l'ancienne pagination locale (`recusPage`, `pageSure`, `totalPages`) désormais gérée par `DataTable`. Importer `DataTable` et `formatDate`.

- [ ] **Step 3: Vérifier build**

Run: `npm run build`
Expected: BUILD OK.

- [ ] **Step 4: Vérification visuelle**

`/recus` : le registre est une table cohérente (mêmes en-têtes navy que Cotisations) ; tri actif ; « Vérifier » et l'annulation fonctionnent ; dates « 15 juin 2026 ».

- [ ] **Step 5: Commit**

```bash
git add src/barreau/pages/Recus.jsx
git commit -m "refactor: registre Reçus en DataTable (cohérence des listes)"
```

---

## Task 11: Passe accessibilité & mouvement (écrans convertis)

**Files:**
- Modify: `public/css/tailwind.css` (focus global, reduced-motion), `src/barreau/components/Modal.jsx` (si focus-trap manquant)

- [ ] **Step 1: Confirmer le focus global**

Vérifier dans `public/css/tailwind.css` la règle `:focus-visible` (anneau or, offset 2px) déjà présente (≈ ligne 24). S'assurer qu'aucun composant converti ne fait `outline:none` sans alternative visible (les `<button>` de tri du DataTable héritent du focus global).

- [ ] **Step 2: Réduction du mouvement globale**

Ajouter, en fin de la couche `@layer base` du CSS :
```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
    }
  }
```

- [ ] **Step 3: Vérifier le focus-trap des modales**

Lire `src/barreau/components/Modal.jsx`. Si la modale ne gère pas `Échap` pour fermer et le piégeage du focus, ajouter à minima la fermeture sur `Échap` :
```jsx
useEffect(() => {
  const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}, [onClose]);
```
(Adapter au nom réel de la prop de fermeture.)

- [ ] **Step 4: Vérifier build + tests**

Run: `npm run build && npm test`
Expected: BUILD OK, tests verts.

- [ ] **Step 5: Vérification clavier**

Sur `/cotisations` et `/recus` : parcours complet au clavier (Tab/Maj-Tab), focus toujours visible ; `Échap` ferme une modale ouverte.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: socle a11y (focus global, prefers-reduced-motion, Échap modales)"
```

---

## Task 12: Vérification finale & revue taste

**Files:**
- Modify: `docs/superpowers/specs/2026-06-15-professionnalisation-socle-design.md` (statut)

- [ ] **Step 1: Suite complète**

Run: `npm test && npm run build && (cd server && npm run typecheck)`
Expected: tout vert.

- [ ] **Step 2: Checklist « professionnel » sur Cotisations**

Confirmer les 9 critères du §5 du spec : états ✓, DataTable ✓, formats uniques ✓, fil d'Ariane (sur détails — n/a ici, c'est une liste) ✓, or non-CTA ✓, contraste AA ✓, clavier ✓, export ✓, actions groupées ✓.

- [ ] **Step 3: Audit contraste**

Vérifier (DevTools/axe) les couples texte/fond des écrans convertis : aucun sous 4.5:1 (texte normal) / 3:1 (grand texte).

- [ ] **Step 4: Revue taste rapide**

Relire Cotisations avec la grille Design + Product (intentionnalité, états, cohérence). Noter tout écart résiduel pour les phases suivantes.

- [ ] **Step 5: Marquer la Phase 0 terminée dans le spec**

En tête du spec, passer `Statut` à `Phase 0 implémentée`. Commit :
```bash
git add docs/superpowers/specs/2026-06-15-professionnalisation-socle-design.md
git commit -m "docs: Phase 0 (socle) implémentée"
```

- [ ] **Step 6: Push**

```bash
git push -u origin claude/file-context-analysis-ixq8w3
```

---

## Self-Review (couverture spec)

- §4.1 Tokens/couleur 60-30-10 → Task 5 (swap or→navy) + Task 6 Step 5 (échelle titre). Contraste → Task 12 Step 3.
- §4.2 PageHeader v2 + fil d'Ariane → Task 6.
- §4.3 DataTable unique → Tasks 4 + 8 ; usages → Tasks 9, 10.
- §4.4 États chargement/vide/erreur → Task 7 + intégration Task 8/9.
- §4.5 Formatage unique → Task 2 (date) ; FCFA existant ; application Tasks 9, 10.
- §4.6 A11y → Task 11.
- §4.7 Export CSV → Task 3 ; usage Task 9.
- §4.8 Cotisations lighthouse → Task 9 (+ Reçus Task 10 = 2ᵉ usage du DataTable).
- §5 Définition « professionnel » → vérifiée Task 12.

**Note d'échelle typo (1.25) :** la mise en place complète de l'échelle reste légère en Phase 0 (titre compact `bpn-title-compact` introduit ; corps déjà ≥ 14px). L'application systématique de l'échelle se poursuivra par module dans les phases suivantes.
