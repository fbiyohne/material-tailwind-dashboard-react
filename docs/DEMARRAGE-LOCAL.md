# Démarrage local

Application de gestion du Secrétariat Général du **Barreau de Pointe-Noire**
(front **React + Vite + Tailwind**, back **Node + Express + Prisma + PostgreSQL**).

Cette procédure lance l'application **entièrement en local**, sans aucun compte
externe : email et SMS tournent en **simulation**, les paiements en **sandbox**.

> 🌐 Pour une **URL publique de démo** (gratuite), voir
> [`DEPLOIEMENT-RENDER.md`](DEPLOIEMENT-RENDER.md).

---

## Prérequis

- **Node.js ≥ 18** et **npm**
- **PostgreSQL ≥ 14** (service démarré)
- *(optionnel)* **Chromium** pour la génération des PDF côté serveur
  (`PUPPETEER_EXECUTABLE_PATH` dans `server/.env`)

---

## Option 1 — Script de bootstrap (recommandé)

Depuis la racine du dépôt :

```bash
./scripts/bootstrap-local.sh
```

Le script : crée la base `barreau_pn`, génère `server/.env` (avec `DATABASE_URL`
et un `JWT_SECRET` de dev), installe les dépendances front + back, applique les
migrations et charge les données de démonstration.

Base sur un autre hôte/identifiant ? Passez `DATABASE_URL` :

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/barreau_pn?schema=public" \
  ./scripts/bootstrap-local.sh
```

Puis démarrez l'application (voir **Lancer** plus bas).

---

## Option 2 — Étapes manuelles

```bash
# 1. Dépendances
npm install                 # frontend (racine)
cd server && npm install    # backend

# 2. Base de données
createdb barreau_pn         # ou via votre client SQL

# 3. Configuration backend
cp .env.example .env        # dans server/
#   DATABASE_URL = postgresql://USER:PASS@localhost:5432/barreau_pn?schema=public
#   JWT_SECRET   = n'importe quelle valeur
#   SMTP_* / SMS_* / PAYMENT_* laissés VIDES → simulation / sandbox

# 4. Migrations + données de démo
npx prisma migrate deploy
npm run seed
```

---

## Lancer

Deux terminaux :

```bash
# Terminal 1 — API
cd server && npm run dev      # → http://localhost:4000

# Terminal 2 — Front
npm run dev                   # → http://localhost:5173  (proxy /api → :4000)
```

Ouvrir **http://localhost:5173**.

---

## Comptes de démonstration

Mot de passe : **`barreau`**

| Rôle | Email |
|------|-------|
| Secrétaire Général | `sg@barreau-pn.cg` |
| Trésorière | `tresoriere@barreau-pn.cg` |
| Bâtonnier | `batonnier@barreau-pn.cg` |
| Administrateur | `admin@barreau-pn.cg` |

La page publique **« Demander un accès »** est accessible depuis l'écran de
connexion (sans authentification).

---

## Modes simulation / sandbox (par défaut)

Aucun service externe n'est requis pour tester l'intégralité des parcours :

| Domaine | Sans configuration | Pour passer en réel |
|---|---|---|
| **Email** | Simulation (journalisée) | `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` |
| **SMS** | Simulation (journalisée) | `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER` |
| **Paiements** | Sandbox (succès/échec simulés) | `PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET` |
| **Lettre du Bâtonnier (IA)** | Gabarit local | `ANTHROPIC_API_KEY` |

Le journal des notifications et l'état des canaux sont visibles dans
**Paramètres → Notifications**.

---

## Vérifications & tests

```bash
cd server && npm test        # tests d'intégration (vitest)
npm run build                # build de production du front (racine)
```

---

## Dépannage

- **`Variable d'environnement manquante : DATABASE_URL`** → `server/.env` absent
  ou non renseigné (voir étape 3).
- **Échec de connexion PostgreSQL** → vérifier que le service tourne et que
  `DATABASE_URL` correspond à vos identifiants ; créer la base `barreau_pn`.
- **Le front affiche des erreurs réseau** → l'API (`:4000`) doit tourner ; le
  proxy Vite redirige `/api` vers `http://localhost:4000`.
- **PDF non générés** → renseigner `PUPPETEER_EXECUTABLE_PATH` vers un binaire
  Chromium installé.
