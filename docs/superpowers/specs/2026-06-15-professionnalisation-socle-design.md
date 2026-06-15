# Professionnalisation — Phase 0 : socle transverse

**Date :** 2026-06-15
**Statut :** Spec validée (design) — prêt pour le plan d'implémentation
**Périmètre de CE document :** Phase 0 uniquement (le socle). Les phases 1‑4
(déploiement par module) feront chacune leur propre cycle spec → plan.

---

## 1. Contexte & objectif

L'application du Secrétariat Général du Barreau de Pointe-Noire est **belle et
cohérente** : palette institutionnelle navy/or, système de composants unifié,
hiérarchie visuelle claire. Mais elle se lit aujourd'hui comme une *plaquette
institutionnelle élégante* plutôt que comme un *instrument métier professionnel*.

**Objectif :** élever l'application au rang d'outil de back-office professionnel
**sans renier l'ADN navy/or**, en traitant ensemble la **rigueur visuelle** et la
**profondeur fonctionnelle**.

**Décisions cadre (validées avec le commanditaire) :**
- Commencer par le **socle transverse**, puis déployer par modules.
- **Conserver** l'identité navy + or, en la **raffinant** (pas de refonte du langage).
- Viser **les deux** axes : craft visuel ET profondeur fonctionnelle.
- Approche **hybride** : construire le socle ET le valider immédiatement sur un
  module-phare réel (**Cotisations**) avant de propager.

---

## 2. Diagnostic (audit « taste »)

Forces réelles : palette cohérente, composants unifiés, hiérarchie lisible.

Écarts qui font « pas assez pro », regroupés par dimension :

**Design / craft**
- Grands titres serif + « eyebrows » dorés décoratifs (`— FINANCES`) sur chaque
  page → registre *éditorial*, pas *opérationnel*.
- L'or joue trois rôles : marque + CTA primaire + statut → dilue le signal
  « action primaire » (règle 60‑30‑10 enfreinte).
- Densité confortable mais pas *intentionnelle* (échelles typo/espacement ad hoc).

**Cohérence (Design + Communication)**
- Patterns divergents : registre Quitus = **table triable**, registre Reçus =
  **`<ul>`** ; dates affichées tantôt `2026-05-20`, tantôt `20 mai 2026`.

**Profondeur produit (Product)**
- États manquants : pas de skeletons de chargement, états vides/erreur inégaux.
- Pas d'**actions groupées** (ex. relancer tous les retardataires).
- Pas de **filtres avancés / vues**, pas d'**export CSV/Excel**.
- Accessibilité partielle (focus, ARIA, clavier).

---

## 3. Non-objectifs & garde-fous

> **⚠️ Périmètre design (mise à jour 2026-06-15) :** on **ne change PAS le design
> visuel** des pages de liste/gestion (couleurs, typographie, espacements, allure
> des composants, en-têtes restent **tels quels**). On professionnalise **uniquement
> (a) les fonctionnalités** (tri, filtres, sélection, actions groupées, export,
> états chargement/vide/erreur) **et (b) la présentation des données** (formatage
> unique des dates/montants, présenter les vraies listes comme des tableaux
> cohérents). **Les améliorations de design visuel sont autorisées uniquement dans
> les pages de détail.** Toute instruction de ce document modifiant le design d'une
> page de liste (changement de couleur de bouton, titre compact, retrait d'eyebrow)
> est **annulée** par cette note.

- **Non-objectif :** refonte ou retouche du **design visuel des pages de liste**
  (couleurs, typo, en-têtes, allure des composants — conservés à l'identique).
- **Non-objectif :** changement de la couleur des boutons (l'or reste où il est).
- **Non-objectif :** nouvelles fonctionnalités métier hors « professionnalisation »
  (pas de nouveau module).
- **Garde-fous :**
  - Pas de dépendance lourde nouvelle (export via lib légère ou génération maison).
  - Préserver les zones d'impression / export PDF (`.bpn-print-zone`).
  - `npm run typecheck` (serveur) et la CI restent verts.
  - Chaque livraison reste indépendamment déployable (pas de big-bang).
  - Suivre les patterns existants ; n'améliorer que ce qui sert l'objectif.

---

## 4. Spec détaillée — Phase 0

### 4.1 Couleurs & tokens — INCHANGÉS (hors périmètre)

> **Annulé par la note de périmètre (§3).** Aucun changement de design : pas de
> nouvelle échelle typo/espacement, **pas de changement de couleur de bouton**
> (l'or reste exactement où il est aujourd'hui). On **vérifie** seulement le
> contraste WCAG AA (≥ 4.5:1 texte normal, ≥ 3:1 grand texte) à titre
> d'accessibilité ; tout correctif éventuel doit rester invisible pour le design
> (sinon, consigner sans appliquer). Les nouveaux **boutons fonctionnels** ajoutés
> (export, relances) réutilisent les **classes existantes** (`bpn-btn-primary` /
> `bpn-btn-ghost`) telles quelles — c'est un usage des styles en place, pas un
> restylage.

### 4.2 `PageHeader` — fil d'Ariane pour les pages de détail uniquement

L'en-tête des **pages de liste reste tel quel** (eyebrow, titre, taille inchangés).
On ajoute seulement au composant `PageHeader` un **support optionnel de fil
d'Ariane** (`breadcrumb`), utilisé **uniquement sur les pages de détail** (où les
améliorations de design sont autorisées) pour le wayfinding.

**Critères :** les pages de détail affichent un fil d'Ariane ; les en-têtes des
pages de liste sont visuellement **identiques** à l'existant.

### 4.3 Composant `DataTable` unique

Un primitif de table réutilisable remplaçant **toutes** les tables ad hoc **et**
les registres en `<ul>` (Reçus, etc.).

> **Design conservé :** le `DataTable` **reproduit exactement** le style visuel
> actuel (`.bpn-table` : en-tête navy, lignes, hover). Il apporte de la *fonction*
> (tri partout, sélection, états, densité), **pas un nouveau style**.

Capacités :
- Tri par colonne (réutilise/absorbe `SortTh`), pagination (absorbe `Pagination`).
- **Sélection de lignes** + barre d'**actions groupées** contextuelle.
- En-tête **collant** (sticky) ; **densité** réglable (confort/compact).
- **Badges de statut** unifiés (un seul mapping statut → couleur/intitulé).
- États intégrés : chargement (skeleton), vide, erreur (cf. 4.4).
- Colonnes configurables (accessor, label, alignement, formateur, tri on/off).
- Accessible : `<table>` sémantique, `scope`, navigation clavier, focus visibles.

**Critères :** Quitus, Reçus, Cotisations, Avocats utilisent le même `DataTable` ;
le registre Reçus n'est plus un `<ul>` ; un seul mapping de badges de statut.

### 4.4 États standard (chargement / vide / erreur)

Trois primitives partagées, utilisées par toute vue de données :
- `Loading` : **skeletons** calqués sur la forme du contenu (lignes de table,
  cartes), pas de spinner nu < 200ms.
- `EmptyState` : standardiser l'existant — message utile + 1 action, sans théâtre.
- `ErrorState` : message clair + bouton **Réessayer** ; jamais d'écran blanc.

**Critères :** chaque vue chargeant des données via l'API gère les trois états ;
plus aucun « pop-in » brut.

### 4.5 Formatage unique (dates & montants)

- **Un** formateur de date → `15 juin 2026` (et variantes courtes documentées).
- **Un** formateur FCFA → séparateurs cohérents.
- Remplacer tous les `String(date).slice(0,10)` et formats ISO bruts.

**Critères :** `grep` ne trouve plus de date ISO brute affichée ; 100 % des
dates/montants passent par les utilitaires.

### 4.6 Socle d'accessibilité

- **Focus visibles** (anneau) sur tous les éléments interactifs.
- **ARIA** sur boutons-icônes, modales (rôle/focus-trap), tables.
- **Navigation clavier** : tables (tri, sélection), modales (Échap, Tab), menus.
- `prefers-reduced-motion` respecté ; transitions 150‑300ms, easing cohérent.
- Cibles tactiles ≥ 44×44px.

**Critères :** parcours clavier complet sur un module converti ; pas de piège de
focus dans les modales ; audit Lighthouse/axe sans erreur bloquante sur Cotisations.

### 4.7 Export partagé

- Utilitaire d'export **CSV** (et Excel si trivial) à partir des colonnes d'une
  `DataTable`, branché sur les registres.
- Implémentation **légère** (génération CSV maison ou micro-lib) — pas de grosse
  dépendance ; respecte le périmètre filtré/trié courant.

**Critères :** au moins un registre (Reçus ou Cotisations) exporte un CSV correct
reflétant le filtre courant.

### 4.8 Module-phare de validation : Cotisations

Convertir **Cotisations** de bout en bout avec le socle (DataTable, états,
formatage, a11y, export, **relances groupées** des retardataires) — **sans toucher
au design de la page** (en-tête, couleurs, styles conservés). Sert de preuve que le
socle tient avant propagation.

**Critères :** Cotisations coche tous les « critères de professionnel » (§5) ;
aucun pattern du socle inventé hors d'un usage réel.

---

## 5. Définition de « professionnel » (acceptance globale)

Une vue/module est « professionnel » quand :
1. elle gère **chargement / vide / erreur** ;
2. elle utilise le **`DataTable` unique** (si liste), au **style visuel inchangé** ;
3. **un seul** format de date et de montant ;
4. **fil d'Ariane** sur les pages de détail ;
5. le **design visuel des pages de liste est inchangé** (couleurs, en-têtes,
   styles conservés ; améliorations de design réservées aux pages de détail) ;
6. **contraste AA** vérifié (correctifs uniquement s'ils n'altèrent pas le design) ;
7. **opérable au clavier**, focus visibles ;
8. **export** disponible sur les registres ;
9. **actions groupées** là où l'ops en a besoin.

---

## 6. Déploiement (vue d'ensemble, hors périmètre détaillé)

- **Phase 1 — Cœur finances :** Quitus, Reçus, Droits (Cotisations fait en Phase 0).
- **Phase 2 — Membres :** Avocats, Stagiaires, Corps électoral + fiches détail.
- **Phase 3 — Institutionnel & Documents :** Réunions, Assemblées, Discipline,
  Archives, Annuaire, Publications, Lettre du Bâtonnier.
- **Phase 4 — Système & polish :** Paramètres, Utilisateurs, passes responsive,
  discipline du mouvement, balayage final de cohérence.

Chaque phase = son propre spec → plan → implémentation, livrable indépendamment.

---

## 7. Vérification

- Build front (`npm run build`) + typecheck serveur verts ; CI verte.
- Validation visuelle (navigateur) de Cotisations dans les états chargement/vide/
  erreur/plein, et du parcours clavier.
- Audit contraste sur les écrans convertis.
- Revue « taste » de Cotisations (Design + Product) avant de déclarer la Phase 0
  terminée.

---

## 8. Risques & atténuations

- **Risque :** le passage du CTA primaire au navy surprend visuellement.
  *Atténuation :* changement assumé et documenté ; l'or reste pour les actions
  « officielles » ; revue visuelle avant propagation.
- **Risque :** un `DataTable` trop générique devient une usine à gaz.
  *Atténuation :* le faire émerger de 2 usages réels (Cotisations + un registre),
  pas dans l'abstrait ; API de colonnes minimale.
- **Risque :** régressions sur les zones print/PDF.
  *Atténuation :* ne pas toucher `.bpn-print-zone` ; tests visuels d'impression.
- **Risque :** périmètre qui enfle.
  *Atténuation :* Phase 0 = socle + Cotisations uniquement ; le reste = phases
  séparées.
