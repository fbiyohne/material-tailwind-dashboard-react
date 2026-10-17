# Wizard d'installation (déploiement VPS) — design

## Contexte & objectif

L'application (front React/Vite + API Express/Prisma + PostgreSQL) se déploie
aujourd'hui sur **Render** via `render.yaml` (build + migrations + **seed** qui
crée les comptes et des données de démonstration). Pour la **mise en production
sur un VPS**, on veut installer l'application **sans coder ni éditer de fichiers** :

1. **Provisionner le serveur** en une commande (Docker, PostgreSQL, Chromium, secrets, HTTPS).
2. **Configurer l'application** au premier lancement via un **assistant web** (compte
   administrateur, identité de l'institution, tarifs, email optionnel), aboutissant
   à une **base vide prête à l'emploi**.

> **Contrainte de périmètre (autoritaire).** L'assistant d'installation ne concerne
> **que le déploiement VPS**. Sur **Render**, rien ne change : le seed crée l'admin
> et les comptes, et l'assistant **ne s'affiche jamais**.

## Périmètre

- **Inclus** : `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `install.sh` ;
  routeur d'installation backend ; assistant web frontend ; gating VPS-only ;
  persistance SMTP en base ; tests d'intégration ; doc VPS.
- **Hors v1 (YAGNI)** : mises à jour/upgrades applicatives, sauvegardes
  automatisées (on documente seulement la persistance par volume Docker),
  multi-tenant, changement de domaine post-installation, IP-only sans domaine
  (supporté en repli HTTP simple, non prioritaire).

## Architecture

### A. Couche provisionnement (VPS, une commande)

Nouveaux fichiers à la racine du dépôt :

- **`Dockerfile`** — image unique servant l'API + le front compilé :
  base Node 22 (Debian slim), `apt-get install -y chromium` (Puppeteer),
  `npm ci` racine + `npm run build` (génère `dist/`), `npm ci --prefix server`,
  `prisma generate`. Variables fixées : `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`,
  `STATIC_DIR=../dist`. **Entrypoint** : `prisma migrate deploy` **puis** `npm start`
  (`--prefix server`). **Aucun `seed`** → base vide.
- **`docker-compose.yml`** — services :
  - `db` : `postgres:16-alpine`, volume `db-data` (persistance), mot de passe issu du `.env`.
  - `app` : build du `Dockerfile`, `depends_on: db (healthy)`, `env_file: .env`,
    expose `4000` en interne.
  - `caddy` : `caddy:2`, ports `80`/`443`, volumes certs + config, reverse-proxy
    vers `app:4000`, **HTTPS automatique** (Let's Encrypt) selon `${DOMAIN}`.
- **`Caddyfile`** — `{$DOMAIN} { reverse_proxy app:4000 }` (HTTPS auto ; repli
  `:80 { reverse_proxy app:4000 }` si `DOMAIN` vide).
- **`install.sh`** — bootstrap « une commande » :
  1. détecte/installe Docker + plugin Compose si absents (Ubuntu/Debian) ;
  2. demande le **domaine** (ou vide pour HTTP) ;
  3. **génère les secrets** : `JWT_SECRET`, `SIGNATURE_SECRET`, `POSTGRES_PASSWORD`
     (`openssl rand -hex 32`) ;
  4. écrit le **`.env`** (jamais committé) avec en plus **`INSTALL_WIZARD=1`** ;
  5. `docker compose up -d --build` ;
  6. affiche l'URL finale (« ouvrez https://DOMAINE pour finaliser l'installation »).
  Ré-exécutable sans écraser un `.env` existant (demande confirmation).

`.gitignore` : ajouter `.env`, `caddy_data/`, volumes locaux.

### B. Assistant web (premier lancement)

**Gating (VPS-only).** L'assistant est *actif* si et seulement si :
`process.env.INSTALL_WIZARD === "1"` **ET** aucun compte `ADMIN` n'existe **ET**
le flag `installe` n'est pas posé dans `Parametres`. Sur Render, `INSTALL_WIZARD`
est **absent** → assistant inactif → comportement identique à aujourd'hui.

**Backend** — nouveau routeur public `installation` (monté **avant** l'auth) :
- `GET /api/installation/etat` → `{ actif: boolean }` où
  `actif = wizardActif()` (voir gating). Le front affiche l'assistant ssi `actif`.
- `POST /api/installation` — **refusé en 409** si `!wizardActif()`. Sinon, dans une
  **transaction** : crée le compte **ADMIN** (email + bcrypt(mot de passe)) ;
  upsert `Parametres.data` avec `identite`, `tarifs`, `exerciceCourant`,
  `exercices.premier`, et (si fourni) `smtp` ; pose `installe: true`. Renvoie `{ ok }`.
- `POST /api/installation/test-email` — **refusé en 409** si `!wizardActif()` ;
  tente un envoi de test avec le SMTP fourni, renvoie succès/erreur (sans persister).
- **Validation** zod stricte : email valide, mot de passe ≥ 8 caractères, identité
  non vide, tarifs entiers positifs, exercices cohérents.

**Frontend** — composant `<Installation/>` plein écran (réutilise l'esthétique
split-screen marine/or des pages d'auth), étapes :
1. **Bienvenue** (présentation + bouton Commencer)
2. **Compte administrateur** (email, mot de passe + confirmation, critères live)
3. **Identité de l'institution** (dénomination, Ordre, Bâtonnier, Trésorière,
   Secrétaire Général, adresse) — pré-rempli avec des valeurs par défaut éditables
4. **Tarifs & exercice** (avocat/stagiaire/droit, exercice courant, premier exercice)
   — pré-remplis (BR-07/08), modifiables
5. **Email (optionnel)** — SMTP host/port/user/pass/expéditeur + bouton « Tester »,
   ou « Ignorer » (→ mode simulation)
6. **Récapitulatif + Installer** → `POST /installation` → succès → redirection vers
   `/auth/sign-in` (connexion avec le compte admin créé).

**Intégration routage** : au démarrage, `App`/`AuthContext` appelle
`GET /installation/etat`. Si `actif` → rend `<Installation/>` (hors layout authentifié) ;
sinon → application normale (login/routes). Pendant le chargement de l'état : splash.

### C. SMTP en base (décision validée)

Le SMTP est aujourd'hui lu depuis `process.env.SMTP_*`. Pour que l'assistant le
configure sans édition de fichier, on **persiste le SMTP dans `Parametres.data.smtp`**
(`{ host, port, user, pass, from, secure }`). Le service de notifications
(`server/src/lib/notifications.ts`) lit **la config en base en priorité, sinon
l'environnement** (repli simulation si ni l'un ni l'autre). Le mot de passe SMTP
réside donc en base — pratique courante pour ce type de réglage applicatif.

### D. Sécurité

- Endpoints d'installation **publics mais verrouillés** : toute mutation refusée
  (409) dès que `wizardActif()` est faux. La création du **premier** admin n'est
  possible qu'à ce moment ; ensuite, seule la création de comptes via le module
  **Utilisateurs** (ADMIN) subsiste.
- La **Zone de danger** (réinitialisation des données) **conserve le compte ADMIN**
  → l'app reste « installée » après un reset (l'assistant ne se redéclenche pas).
- **HTTPS** géré par Caddy (Let's Encrypt). Secrets **générés** (non committés),
  `.env` git-ignoré. CORS : `CLIENT_ORIGIN=https://${DOMAIN}` injecté par `install.sh`.

## Flux de données (VPS, premier déploiement)

```
install.sh → .env (secrets + INSTALL_WIZARD=1) → docker compose up
  → app: prisma migrate deploy (base vide) → npm start
Navigateur https://DOMAINE
  → GET /installation/etat → { actif: true }   (INSTALL_WIZARD=1 & 0 admin)
  → assistant (6 étapes) → POST /installation
      → crée ADMIN + écrit Parametres (identite/tarifs/smtp) + installe=true
  → redirection login → connexion admin → app opérationnelle, base vide
```

Sur **Render** : `INSTALL_WIZARD` absent → `GET /installation/etat → { actif:false }`
→ login direct ; le seed (build) a déjà créé l'admin et les données de démo.

## Tests (vitest + supertest)

- `GET /installation/etat` : `actif:false` quand `INSTALL_WIZARD` absent ;
  `actif:true` quand `INSTALL_WIZARD=1` **et** aucun admin ; `actif:false` après
  création d'un admin.
- `POST /installation` : succès (crée admin, pose `installe`, écrit la config) ;
  **409** si `wizardActif()` faux (déjà installé / flag absent) ; **400** sur
  payload invalide (email/mot de passe/identité).
- `POST /installation/test-email` : 409 si inactif.
- Non-régression : avec `INSTALL_WIZARD` absent, l'app se comporte comme avant
  (login, RBAC) — le routeur d'installation n'interfère pas.

## Fichiers créés / modifiés

**Créés** : `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `install.sh`,
`server/src/routes/installation.ts`, `src/barreau/pages/Installation.jsx`
(+ éventuels sous-composants d'étape), `docs/DEPLOIEMENT-VPS.md`.

**Modifiés** : `server/src/app.ts` (monter `installationRouter`),
`server/src/lib/notifications.ts` (SMTP depuis `Parametres` puis env),
`src/main.jsx`/`App`/`AuthContext` (aiguillage vers l'assistant si `actif`),
`src/barreau/api/resources.js` (`getEtatInstallation`, `installer`, `testerEmail`),
`.gitignore`, `docs/DEPLOIEMENT-RENDER.md` (note : assistant inactif sur Render).

## Hors-périmètre (rappel)

Mises à jour applicatives, sauvegardes automatisées, multi-tenant, changement de
domaine post-installation. Documentés comme évolutions ultérieures.
