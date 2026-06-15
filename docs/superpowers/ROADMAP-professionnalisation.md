# Feuille de route — Professionnalisation de l'application

Objectif : élever l'app du Barreau de « belle plaquette » à « instrument métier
professionnel », **sans renier l'identité navy/or**.

> **⚠️ Périmètre design (2026-06-15) :** on **ne change PAS le design visuel** des
> pages de liste (couleurs, typo, en-têtes, styles conservés). On professionnalise
> **uniquement (a) les fonctionnalités** (tri, sélection, actions groupées, export,
> états) **et (b) la présentation des données** (formats unifiés, listes en
> tableaux cohérents). Les **améliorations de design visuel sont réservées aux
> pages de détail**.

**Spec maîtresse :** [`specs/2026-06-15-professionnalisation-socle-design.md`](specs/2026-06-15-professionnalisation-socle-design.md)

## Ordre d'exécution

Les phases sont **séquentielles** : 1–4 dépendent des primitives du socle (Phase 0).

| Phase | Plan | Contenu | Statut |
|------|------|---------|--------|
| **0** | [socle](plans/2026-06-15-professionnalisation-socle.md) | Tests front, formatage, export CSV, sélection, **DataTable** (style `.bpn-table` conservé), états, Breadcrumb (pour pages de détail), a11y. Validé sur **Cotisations** (+ registre Reçus). *Design inchangé.* | ⬜ À faire |
| **1** | [finances](plans/2026-06-15-professionnalisation-phase1-finances.md) | Quitus, Reçus, Droits de plaidoirie. | ⬜ À faire |
| **2** | [membres](plans/2026-06-15-professionnalisation-phase2-membres.md) | Avocats (+ sélection/actions groupées), Stagiaires, Corps électoral, AvocatDetail (fil d'Ariane). | ⬜ À faire |
| **3** | [institutionnel & documents](plans/2026-06-15-professionnalisation-phase3-institutionnel-documents.md) | Discipline, Archives, Annuaire (tables→DataTable) ; Réunions, Assemblées, Publications, Lettre (cartes conservées) ; 4 pages de détail (fils d'Ariane). | ⬜ À faire |
| **4** | [système & polish](plans/2026-06-15-professionnalisation-phase4-systeme-polish.md) | Paramètres, Utilisateurs ; passes responsive, balayage de cohérence (grep), audit contraste, revue taste finale. | ⬜ À faire |

## Définition de « professionnel » (rappel, §5 du spec)

Une vue/module est conforme quand : ① états chargement/vide/erreur · ② `DataTable`
unique (si liste), **style visuel inchangé** · ③ un seul format date/montant ·
④ fil d'Ariane (détails) · ⑤ **design des pages de liste inchangé** (améliorations
de design réservées aux détails) · ⑥ contraste AA vérifié · ⑦ opérable au clavier ·
⑧ export sur les registres · ⑨ actions groupées là où l'ops en a besoin.

## Garde-fous (toutes phases)

Identité navy/or conservée · pas de grosse dépendance · zones print/PDF préservées
(`.bpn-print-zone`) · `npm run typecheck` (serveur) + CI verts · chaque phase
livrable indépendamment.

## Méthode

Construit via les skills *taste-quality* (audit), *superpowers:brainstorming*
(spec) et *superpowers:writing-plans* (plans). Exécution recommandée :
*superpowers:subagent-driven-development* (un sous-agent par tâche, revue entre
chaque). Cocher la colonne **Statut** au fil de l'avancement.
