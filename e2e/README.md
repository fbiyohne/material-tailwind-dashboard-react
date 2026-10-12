# Parcours de bout en bout (Playwright)

Parcours M-20261011 : radiation en Discipline, fiche avocat, timbre (presse-papiers PNG), QR de quitus vers `/v/...`, Paramètres, 360 px.

```bash
npx vite build                      # à la racine : le serveur de test sert dist/
cd e2e && npm ci && npx playwright test
```

- `serveur.mjs` lance une instance privée (port 4110) du code courant sur `barreau_pn_test` (`TEST_DATABASE_URL` de `server/.env`, refus si la base n'est pas celle de test).
- `E2E_URL=http://localhost:4100` vise une instance déjà lancée (code à jour requis).
- Chromium : celui du poste (`E2E_CHROMIUM` pour en indiquer un autre), sinon `npx playwright install chromium`.
- Rapport HTML dans `e2e/rapport/` (non versionné). Les données créées portent le marqueur « E2E <horodatage> » dans la base de test.
