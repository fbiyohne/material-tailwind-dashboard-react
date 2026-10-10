# Change Log

## [2.2.0] 2026-10-10 — Barreau PN : cycle de vie des avocats
- Radiation motivée : date de la décision et référence/motif (300 caractères) ; corps de `POST /api/membres/:id/radier` optionnel.
- Décès : nouveau statut `DECEDE` + date de décès (`POST /api/membres/:id/deces`), badge « Décédé », filtre sur la page Avocats ; compte espace désactivé et jetons révoqués.
- Migration Prisma additive `20261009120000_membre_deces_radiation` (valeur d'enum + 3 colonnes nullables).
- Export de la liste filtrée ou de la sélection en CSV, Excel, TXT et PDF (serveur `GET /api/membres/export/pdf`, repli client) ; mention de confidentialité ; export journalisé ; motif de radiation jamais exporté.
- Import étendu : `.txt`, statut « décédé », dates de radiation et de décès, motif ; aperçu des lignes ignorées ; erreurs par ligne sans rejet du lot ; aller-retour export → import sans modification.
- **Changement de comportement — relances** : `POST /cotisations/relances` n'excluait aucun statut ; les membres RADIE et DECEDE n'en reçoivent plus (constante `STATUTS_HORS_TABLEAU`, aussi appliquée au tableau, aux cotisations, aux convocations et au corps électoral).
- **Changement de comportement — suppression** : `DELETE /api/membres/:id` répond désormais **409** si le membre a des reçus, paiements ou quitus (conservation comptable 10 ans, OHADA) ; utiliser la radiation ou le décès.
- Documentation : `server/README.md`, `src/barreau/README.md`, `docs/juridique/cycle-de-vie-avocats.md`.

## [2.1.0] 2023-11-14
- Upgrade to Material Tailwind `v2`

## [2.0.1] 2023-03-29

- Add nepcha scripts

## [2.0.0] 2022-11-02

- Update the entire structure
- Migration to vite
- Migration to React 18
- Migration to React Router DOM 6
- Migration to @material-tailwind/react latest version
- Migration from chart.js to apexcharts
- Add global context support

## [1.1.0] 2021-06-10

### New Features

- Add the download button

### Bug Fixing

- Fix the dropdown of admin navbar

## [1.0.0] 2021-06-08

### Original Release

- Started project from [Material Tailwind Dashboard React](https://www.creative-tim.com/product/material-tailwind-dashboard-react?ref=changelog-mtdr)
- Updated all dependencies from [Material Tailwind Dashboard React](https://www.creative-tim.com/product/material-tailwind-dashboard-react?ref=changelog-mtdr) and those dependencies that were not working with the new React v17+ API, were deleted and/or replaced

### Warning

_Warnings might appear while doing a clean npm install - they do not affect the UI or the functionality of the product, and they appear because of NodeJS and not from the product itself._
_This product was designed and developed using NodeJS version 14.16.0 LTS, so please make sure to have a compatible version of NodeJS._
