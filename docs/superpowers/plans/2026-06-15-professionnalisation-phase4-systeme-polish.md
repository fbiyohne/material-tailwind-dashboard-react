# Professionnalisation — Phase 4 (Système & polish global) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Convertir les derniers modules (Paramètres, Utilisateurs) sur le socle, puis passes transverses : responsive, balayage de cohérence, audit contraste, et revue taste finale de toute l'application.

**Architecture:** Mêmes primitives Phase 0. La valeur de cette phase est surtout le **balayage de cohérence piloté par `grep`** (chasse aux dernières dates ISO brutes, `<ul>` de registre, `<table>` hors `DataTable`, `eyebrow` résiduels, `bpn-btn-or` mal placés) et les **passes responsive/contraste** sur l'ensemble.

**Tech Stack:** React + Vite + Tailwind, Vitest.

**Prérequis :** **Phases 0–3 livrées.** Recette « liste → DataTable » : plan Phase 1 (§ Recette).

---

## Task 1: Paramètres — tables en `DataTable` + cohérence

**Files:** Modify `src/barreau/pages/Parametres.jsx`

- [ ] **Step 1: Lire** — `grep -n "getParametres\|getNotifications\|Tabs\|<table\|FormField\|grid" src/barreau/pages/Parametres.jsx`. Repérer les 2 `bpn-table` (journaux/paramètres) et les onglets.

- [ ] **Step 2: Recette A** sur les chargements (`getParametres`, `getNotifications`).

- [ ] **Step 3:** Convertir les `bpn-table` en `DataTable` (recette B du plan Phase 1) avec des colonnes adaptées au contenu réel (ex. journal des notifications : Date `formatDate`, Type, Destinataire, Canal, Statut). Conserver `Tabs`, `FormField` et les grilles de réglages.

- [ ] **Step 4: En-tête v2** — retirer `eyebrow`. Dates via `formatDate`.

- [ ] **Step 5: Vérifier** — `npm run build`. Visuel `/parametres` : onglets, tables socle, états.

- [ ] **Step 6: Commit** — `git commit -am "feat: Paramètres sur le socle (DataTable, états, formats)"`

---

## Task 2: Utilisateurs — demandes + comptes en `DataTable`

**Files:** Modify `src/barreau/pages/Utilisateurs.jsx`

- [ ] **Step 1: Lire** — `grep -n "listerUsers\|listerDemandesAcces\|<ul\|<table\|majUser\|role\|approuver\|refuser" src/barreau/pages/Utilisateurs.jsx`. Deux listes : demandes d'accès (`<ul>`) et comptes (`bpn-table`).

- [ ] **Step 2: Recette A** sur `listerUsers()` et `listerDemandesAcces("EN_ATTENTE")`.

- [ ] **Step 3: Comptes → `DataTable`** :
```jsx
const colUsers = [
  { key: "nom", label: "Nom", sortable: true, sortValue: (u) => u.nom, cell: (u) => <span className="font-medium">{u.nom}</span> },
  { key: "email", label: "Email", cell: (u) => <span className="font-mono text-xs text-gris">{u.email}</span> },
  { key: "role", label: "Rôle", cell: (u) => /* sélecteur de rôle existant (majUser) */ null },
  { key: "statut", label: "Statut", cell: (u) => <Badge ton={u.actif ? "vert" : "gris"}>{u.actif ? "Actif" : "Désactivé"}</Badge> },
  { key: "actions", label: "", align: "right", cell: (u) => /* reset mot de passe / désactiver existants */ null },
];
```
Réinjecter le sélecteur de rôle et les actions (reset/désactiver) déjà présents.

- [ ] **Step 4: Demandes d'accès** — le `<ul>` peut rester (file d'attente courte, actions approuver/refuser) **ou** devenir un `DataTable` léger (cohérence). Recommandé : `DataTable` avec colonnes Nom/Email/Date/Actions pour aligner sur le reste. Ajouter états + `EmptyState` « Aucune demande en attente ».

- [ ] **Step 5: En-tête v2** — retirer `eyebrow`.

- [ ] **Step 6: Vérifier** — `npm run build`. Visuel `/utilisateurs` : demandes + comptes cohérents, états, changement de rôle, reset.

- [ ] **Step 7: Commit** — `git commit -am "feat: Utilisateurs sur le socle (DataTable demandes + comptes)"`

---

## Task 3: Passe responsive (mobile/tablette)

**Files:** Modify `src/barreau/layout/*` (sidebar/topbar), vérifier `DataTable`/pages

- [ ] **Step 1: Audit largeurs** — ouvrir l'app à 375px et 768px (DevTools) sur 4 écrans clés (`/`, `/cotisations`, `/avocats`, `/avocats/:id`). Noter débordements horizontaux et cibles tactiles < 44px.

- [ ] **Step 2: Sidebar mobile** — vérifier que la navigation latérale se replie/ouvre proprement sur mobile (hamburger), sans recouvrir le contenu. Corriger si la nav force un scroll horizontal.

- [ ] **Step 3: Tables sur mobile** — `DataTable` enveloppe déjà la table dans `overflow-x-auto` (scroll horizontal contrôlé). Vérifier que c'est suffisant ; sinon, masquer 1–2 colonnes secondaires < 640px via une prop `hideBelow` (n'ajouter cette prop que si réellement nécessaire — YAGNI).

- [ ] **Step 4: Cibles tactiles** — porter les boutons-icônes d'action (≥ 44×44px) avec padding suffisant et `aria-label`.

- [ ] **Step 5: Vérifier** — `npm run build`. Re-tester à 375px/768px : pas de scroll horizontal parasite, cibles confortables.

- [ ] **Step 6: Commit** — `git commit -am "fix: passes responsive (nav mobile, tables, cibles tactiles)"`

---

## Task 4: Balayage de cohérence (piloté par grep)

**Files:** Multiples (corrections ciblées)

- [ ] **Step 1: Dates ISO brutes résiduelles**
Run: `grep -rn "slice(0, *10)\|toISOString()\.slice\|\.split(\"T\")" src/barreau/pages src/barreau/components`
Pour chaque affichage de date trouvé : remplacer par `formatDate(...)`. (Ignorer les usages techniques non affichés, ex. clés/`value` d'input `type=date`.)

- [ ] **Step 2: Registres encore en `<ul>`**
Run: `grep -rn "<ul " src/barreau/pages`
Pour chaque **liste de données tabulaires** restante (hors listes de contenu/cartes légitimes) : migrer vers `DataTable`.

- [ ] **Step 3: Tables hors `DataTable`**
Run: `grep -rln "<table" src/barreau/pages`
Pour chaque page listée non encore convertie (hors mini-tables de détail à faible volume) : migrer vers `DataTable`.

- [ ] **Step 4: Eyebrows dorés résiduels**
Run: `grep -rn "eyebrow=" src/barreau/pages`
Confirmer que les pages principales sont passées en titre compact (sans eyebrow). Laisser l'eyebrow uniquement si un choix éditorial le justifie (à arbitrer page par page).

- [ ] **Step 5: Or hors génération de documents**
Run: `grep -rn "bpn-btn-or\|variant=\"or\"" src/barreau`
Confirmer que seules les actions de **génération de quitus/reçu** utilisent l'or.

- [ ] **Step 6: Vérifier** — `npm run build && npm test` → vert.

- [ ] **Step 7: Commit** — `git commit -am "refactor: balayage de cohérence (dates, listes, or, eyebrows)"`

---

## Task 5: Audit contraste + revue taste finale

**Files:** corrections ciblées CSS/pages si besoin ; aucune nouvelle dépendance

- [ ] **Step 1: Contraste** — passer un audit (DevTools « Contrast » ou extension axe) sur Dashboard, Cotisations, Avocats, un détail, Paramètres. Corriger tout couple texte/fond < 4.5:1 (normal) / 3:1 (grand). Suspects : `text-white/90` sur navy, `text-gris` sur grisL, or pâle sur blanc.

- [ ] **Step 2: Revue taste transverse** — relire l'app avec la grille Design (hiérarchie, typo, espacement, couleur, cohérence) + Product (états, actions groupées, export). Lister les écarts résiduels.

- [ ] **Step 3:** Corriger les écarts rapides ; consigner les éventuels reliquats non bloquants en bas du spec (« Suivi »).

- [ ] **Step 4: Commit** — `git commit -am "polish: contraste AA + corrections taste finales"`

---

## Task 6: Vérification finale & clôture

**Files:** Modify `docs/superpowers/specs/2026-06-15-professionnalisation-socle-design.md`

- [ ] **Step 1:** `npm test && npm run build && (cd server && npm run typecheck)` → tout vert.

- [ ] **Step 2: Checklist globale §5** — vérifier les 9 critères « professionnel » sur un échantillon par section (finances, membres, institutionnel, documents, système).

- [ ] **Step 3:** Mettre à jour le `Statut` du spec → « Professionnalisation livrée (Phases 0–4) ». Ajouter une section « Suivi » avec les reliquats éventuels.

- [ ] **Step 4: Commit & push**
```bash
git commit -am "docs: professionnalisation livrée (phases 0–4)"
git push -u origin claude/file-context-analysis-ixq8w3
```

## Self-Review (couverture)
- Paramètres → T1 · Utilisateurs → T2 · Responsive → T3 · Cohérence transverse → T4 · Contraste + taste → T5 · Clôture → T6.
- Les critères §5 (états, DataTable, formats, fil d'Ariane, or non-CTA, contraste AA, clavier, export, actions groupées) sont vérifiés globalement en T6. Le balayage grep (T4) garantit qu'aucun module n'a été oublié.
