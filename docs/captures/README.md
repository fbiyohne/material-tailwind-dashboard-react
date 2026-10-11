# Captures de recette (T29)

Instance : http://localhost:4100, base `barreau_pn_test`, identité « Barreau de démonstration ». Jamais `barreau_pn`.

## Relancer la recette

1. Jeu de démonstration (garde-fou : seule `barreau_pn_test` est acceptée) :
   `cd server`, `DATABASE_URL` = `TEST_DATABASE_URL` de `server/.env`, puis `npm run demo -- --identite=demonstration`.
2. Instance : `.\scripts\relancer-test.ps1`. Sous PowerShell 5.1 lancé par un outil, `prisma generate` écrit sur stderr et le
   script s'arrête avant le démarrage (`$ErrorActionPreference = "Stop"`) : enchaîner alors à la main `npm run build`, puis dans `server`
   `npx prisma generate`, `npx prisma migrate deploy` et `PORT=4100 STATIC_DIR=<racine>/dist npm start`.
3. Volet API des 12 parcours : `cd server && npx vitest run test/parcours.test.ts` (13 tests). Il remet l'identité « Barreau de Pointe-Noire » :
   relancer l'étape 1 avant une démonstration.
4. Volet interface : serveur MCP Playwright, comptes et enchaînement de `docs/DEMO-CONGRES.md` ; captures `parcours-NN-*-1280.png` et `-360.png`.

## État de la recette interface (11 octobre 2026)

| Parcours | Rejoué dans l'interface | Captures |
|----------|-------------------------|----------|
| 1 Import, erreurs, doublons, annulation | oui, rien écrit après annulation | parcours-01-* |
| 2 Stagiaire vers tableau, tri par inscription | oui (BALORIN Aline) | parcours-02-* |
| 3 Admission directe par le bâtonnier | oui, après correction (voir ci-dessous) | parcours-03-* |
| 4 Circuit d'omission | rappel, mise en demeure, transmission (SG), omission (bâtonnier) rejoués ; réinscription non rejouée | parcours-04-* |
| 5 Discipline, sursis, radiation | lecture seule : fiche avec sursis, fiche radiée, liste | parcours-05-* |
| 6 Droits SG / bâtonnier | non rejoué dans l'interface (couvert par parcours.test.ts) | aucune |
| 7 Tableau | lecture seule, 360 px | parcours-07-tableau-360 |
| 8 Messagerie | lecture seule, 360 px | parcours-08-messagerie-360 |
| 9 Pièces | lecture seule, 360 px | parcours-09-pieces-360 |
| 10 Corps électoral | non capturé | aucune |
| 11 Reçu personnalisé | non rejoué | aucune |
| 12 Journal d'audit | lecture seule, 360 px | parcours-12-journal-audit-360 |
| Timbre et vote | élections 360 px seulement | parcours-T-elections-360 |

Les parcours 6, 10 et 11, les captures 1280 px des parcours 7 à 12 et les captures « après » (Avocats, AvocatDetail, Tableau, Messagerie)
restent à faire : l'outil de capture a été refusé en cours de session. La comparaison avec les captures `avant-*` (CA13) n'est donc pas faite.

## Défauts trouvés et corrigés (avec test)

- Parcours 3 : le bâtonnier (action `admission_directe`) n'avait pas le bouton « Avocat ». Test `InscriptionModalBatonnier.test.jsx`.
- Parcours 4 : l'omission d'un impayé 2025 enregistrée en 2026 donnait 409, l'écran n'envoyant pas l'exercice des étapes. Test `SituationExercice.test.jsx`.

## Points relevés, non corrigés

- L'écran de connexion et le titre de l'onglet gardent l'identité de base : l'identité paramétrée n'est lue qu'après connexion.
- Import : une qualité inconnue est ramenée à « avocat » sans erreur (seul un statut inconnu est signalé).
- La recette a laissé dans `barreau_pn_test` : PILETTE Yannick (DEMO-0080) en statut OMIS, BALONDE Aline (DEMO-0021) OMIS, BALORIN Aline inscrite,
  DEMOADMIS Claire admise. Remise à l'état de départ : instantané `pg_restore` de DEMO-CONGRES.md § 5, ou correction manuelle à valider.
