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

## Cycle de vie des avocats (radiation, décès, suppression, export, import)

### POST /api/membres/:id/radier
Corps **optionnel** (un corps vide reste valide) :
```json
{ "dateRadiation": "2026-10-01", "motifRadiation": "Décision du Conseil n° 12" }
```
- `dateRadiation` : `AAAA-MM-JJ`, non postérieure à aujourd'hui ; défaut = date du jour.
- `motifRadiation` : texte libre de 300 caractères maximum (référence et motif de la décision) ; défaut `null`.
- Effet : statut `RADIE`, compte espace désactivé et jetons révoqués (`synchroniserAccesAuStatut`).
- Le serveur n'enregistre qu'une décision déjà prononcée par le Conseil (loi 026-92, art. 36). Réponse 200 : le membre mis à jour.

### POST /api/membres/:id/deces
Requête (SG / Admin) :
```http
POST /api/membres/42/deces
Authorization: Bearer <jeton>
Content-Type: application/json

{ "dateDeces": "2026-09-15" }
```
Réponse 200 (extrait) :
```json
{ "id": 42, "num": 42, "nom": "…", "statut": "DECEDE", "dateDeces": "2026-09-15T00:00:00.000Z" }
```
Erreurs : 400 (date absente, invalide ou postérieure à aujourd'hui), 403 (rôle non autorisé), 404 (membre inconnu).
Effet : statut `DECEDE`, compte espace désactivé, jetons révoqués. Un membre décédé est exclu du tableau de l'Ordre, du corps électoral, des cotisations et des relances.

### GET /api/membres/export/pdf
Liste des avocats en PDF A4 (Puppeteer, gabarit `listeAvocatsHtml`, en-tête institutionnel, sans cachet).
- Garde : permission « membres » (l'espace AVOCAT est refusé en 403).
- Paramètres : `q`, `statut` (ex. `INSCRIT`, `DECEDE`), `qualite`, `qualiteNot` — mêmes filtres que `GET /api/membres` ; `ids` = identifiants séparés par des virgules (200 maximum) pour exporter une sélection.
- Colonnes : projection annuaire uniquement (jamais le motif de radiation, l'adresse, la date de naissance, RCCM, CNSS, observations).
- Chaque export est journalisé (« Export de la liste des avocats », format, filtre, nombre de lignes) **avant** l'envoi ; si l'audit échoue, aucun PDF n'est livré (500).
```http
GET /api/membres/export/pdf?statut=INSCRIT&qualiteNot=STAGIAIRE
→ 200 application/pdf   Content-Disposition: attachment; filename="Avocats-2026-10-10.pdf"
```
- Repli : si Chromium est absent, la route échoue et le client produit lui-même le PDF (`exporterPdf`, qualité réduite).

### DELETE /api/membres/:id
Admin seul. **409** « Suppression impossible : pièces comptables à conserver 10 ans (OHADA) ; utilisez radiation ou décès » dès que le membre a au moins un reçu, un paiement ou un quitus. Sans pièce (erreur de saisie, doublon), la suppression est définitive.

### POST /api/membres/import
Upsert par `num`, aucune suppression, champs absents du fichier non écrasés, 2 000 lignes maximum. Chaque ligne est validée à part : une ligne invalide (ex. `num` non numérique) est rapportée sans bloquer les autres.
Réponse : `{ "total": 3, "crees": 1, "maj": 1, "erreurs": [{ "ligne": 3, "message": "num : …" }] }`.
- Colonnes étendues : `dateRadiation`, `motifRadiation` (tronqué à 300), `dateDeces`. Une date invalide est ignorée sans faire échouer la ligne.
- Statut `décédé` (aussi `decede`, `décédée`, `decedee`) → `DECEDE`. Si le statut change sur un membre existant, l'accès espace est resynchronisé.
- Journal d'audit : « Import du tableau — Avocat (N ligne(s), X créé(s), Y mis à jour, Z erreur(s)) ».

### Constante et libellés d'audit
- `STATUTS_HORS_TABLEAU = ["RADIE", "DECEDE"]` (`src/lib/business.ts`) : exclus du tableau de l'Ordre, des convocations, de la génération de cotisations **et des relances**, et inéligibles au corps électoral (raison `statut`).
- Libellés ajoutés dans `src/middleware/audit.ts` : « Radiation d'un avocat », « Déclaration de décès », « Import du tableau », « Export de la liste des avocats ».

### Chromium pour le PDF
`trouverChromium` (`src/lib/pdf.ts`) cherche dans l'ordre : `PUPPETEER_EXECUTABLE_PATH`, le cache Puppeteer, Playwright, les binaires Linux (`/usr/bin/chromium`, `google-chrome`…), puis sous Windows `C:/Program Files/Google/Chrome/Application/chrome.exe` et `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`. Sans binaire, les routes PDF répondent en erreur et les tests PDF s'ignorent.

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
