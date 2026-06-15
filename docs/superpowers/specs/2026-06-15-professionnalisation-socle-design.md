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

- **Non-objectif :** refonte du langage visuel (couleurs/typo de marque conservées).
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

### 4.1 Discipline des tokens & rôles de couleur

**Échelles.** Formaliser dans `tailwind.config` / CSS :
- Échelle typographique de ratio **1.25** (ex. 12 · 14 · 16 · 20 · 25 · 31 px),
  exposée en classes/usages cohérents ; corps ≥ 14px, interlignage 1.4‑1.6.
- Échelle d'espacement **8px** (4, 8, 12, 16, 24, 32, 48, 64) ; bannir les
  valeurs hors grille.

**Rôles de couleur (60‑30‑10).**
- **60 % neutre** : fonds grisL/blanc/encre (inchangé).
- **30 % secondaire** : **navy** = couleur *interactive / action primaire*.
- **10 % accent** : **or** = *accent de marque & emphase rare* — **plus jamais**
  comme couleur de bouton d'action primaire générique.
- **Décision clé :** le **bouton d'action primaire passe au navy** (`bpn-btn-primary`).
  L'or (`bpn-btn-or`) est conservé mais réservé aux moments « cérémonie » (générer
  un quitus/reçu officiel), pas aux actions courantes (Enregistrer, Filtrer…).
- Statuts sémantiques (vert/rouge) inchangés ; vérifier **contraste WCAG AA**
  (≥ 4.5:1 texte normal, ≥ 3:1 grand texte) sur tous les couples texte/fond.

**Critères d'acceptation :**
- Une page de référence documente l'échelle typo, l'échelle d'espacement et les
  rôles de couleur.
- Aucune action courante n'utilise l'or comme fond de bouton primaire.
- Audit de contraste : 0 couple sous le seuil AA sur les écrans convertis.

### 4.2 Chrome de page unifié (`PageHeader` v2)

Un seul composant d'en-tête de page :
- **Fil d'Ariane** (wayfinding) sur les pages de détail.
- **Titre compact** (taille réduite vs actuel, poids structurel) ; eyebrow
  décoratif **réduit** (supprimé ou transformé en libellé de section discret).
- **Zone d'actions** alignée à droite, hiérarchisée (1 action primaire navy max).

**Critères :** les 22 pages utilisent le même `PageHeader` ; les détails affichent
un fil d'Ariane ; une seule action primaire visuelle par en-tête.

### 4.3 Composant `DataTable` unique

Un primitif de table réutilisable remplaçant **toutes** les tables ad hoc **et**
les registres en `<ul>` (Reçus, etc.).

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

Convertir **Cotisations** de bout en bout avec le socle (PageHeader v2, DataTable,
états, formatage, a11y, export, **relances groupées** des retardataires). Sert de
preuve que le socle tient avant propagation.

**Critères :** Cotisations coche tous les « critères de professionnel » (§5) ;
aucun pattern du socle inventé hors d'un usage réel.

---

## 5. Définition de « professionnel » (acceptance globale)

Une vue/module est « professionnel » quand :
1. elle gère **chargement / vide / erreur** ;
2. elle utilise le **`DataTable` unique** (si liste) ;
3. **un seul** format de date et de montant ;
4. **fil d'Ariane** sur les pages de détail ;
5. l'**or n'est plus** le CTA primaire ;
6. **contraste AA** respecté ;
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
