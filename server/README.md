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

## Reste à faire (prochaines itérations)
Modules institutionnels (réunions, assemblées, discipline + journalisation
RG-13, publications), droits de plaidoirie, attestations/PDF serveur
(Puppeteer), archives, paramètres, et le branchement du front sur l'API.
