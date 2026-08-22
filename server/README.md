# API — Secrétariat Général du Barreau de Pointe-Noire (V2)

Backend de l'application : **Node.js + Express + Prisma + PostgreSQL**, avec
authentification **JWT** et contrôle d'accès par rôles (**RBAC**). Les règles
métier (BR-01, BR-03, BR-06, BR-07/08…) sont appliquées côté serveur.

## Prérequis
- Node.js ≥ 20, PostgreSQL ≥ 14

## Installation
```bash
cd server
cp .env.example .env          # renseigner DATABASE_URL et JWT_SECRET
npm install
npx prisma migrate deploy     # applique le schéma
npm run seed                  # données d'exemple + 4 comptes
npm run dev                   # API sur http://localhost:4000/api
```

## Comptes de démonstration (mot de passe : `barreau`)
| Rôle | Email |
|------|-------|
| Secrétaire Général | `sg@barreau-pn.cg` |
| Bâtonnier | `batonnier@barreau-pn.cg` |
| Trésorière | `tresoriere@barreau-pn.cg` |
| Administrateur | `admin@barreau-pn.cg` |

## Points d'entrée principaux
| Méthode | Route | Rôle requis |
|--------|-------|-------------|
| POST | `/api/auth/login` | — |
| GET | `/api/auth/me` | authentifié |
| GET | `/api/membres` (`?q=&statut=&qualite=&page=&pageSize=`) | authentifié |
| GET | `/api/membres/:id` | authentifié |
| POST | `/api/membres` (inscription) | SG / Admin |
| PATCH | `/api/membres/:id` | SG / Admin |
| POST | `/api/membres/:id/radier` | SG / Admin |
| GET | `/api/cotisations?annee=` | authentifié |
| POST | `/api/cotisations/paiement` (BR-03) | SG / Trésorière |
| POST | `/api/cotisations/:membreId/valider` | Trésorière |
| GET | `/api/recus?annee=` | authentifié |
| GET | `/api/quitus/eligibles?annee=` | authentifié |
| POST | `/api/quitus` (BR-01) | SG / Admin |

## Sécurité & production
- **Auth** : access token (15 min) + refresh token (7 j, rotation), `/auth/refresh`, `/auth/logout`
- **Rate-limit** sur `/auth/login` + limiteur global ; en-têtes **helmet**
- **PDF serveur** (Puppeteer) : `GET /recus/:id/pdf`, `GET /quitus/:id/pdf` (vectoriel)
- **Relances email** : `POST /cotisations/relances?annee=` (SMTP réel ou simulation)
- **Signature électronique** (HMAC) : `GET /quitus/:id/signature`, `POST /signatures/verifier`

## Tests
```bash
# Base de test (une fois)
createdb -O barreau barreau_pn_test
DATABASE_URL=postgresql://barreau:barreau_dev@localhost:5432/barreau_pn_test npx prisma migrate deploy
DATABASE_URL=postgresql://barreau:barreau_dev@localhost:5432/barreau_pn_test npm run seed
# Lancer
npm test          # vitest + supertest (auth, BR-01/03, RBAC, RG-13)
```

## Variables d'environnement complémentaires
`ACCESS_TTL`, `REFRESH_TTL_DAYS`, `PUPPETEER_EXECUTABLE_PATH`, `SMTP_*`,
`MAIL_FROM`, `SIGNATURE_SECRET` (voir `.env.example`).
