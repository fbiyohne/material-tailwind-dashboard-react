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

### POST /api/membres/export
Journalise un export produit dans le navigateur (CSV, XLSX, TXT, ou PDF de repli `pdf-local`) : le client l'appelle **avant** de générer le fichier et n'exporte rien si l'appel échoue.
- Garde : permission « membres » (AVOCAT → 403).
- Corps : `{ "format": "csv"|"xlsx"|"txt"|"pdf-local", "filtre": "≤ 200 caractères", "lignes": 0..100000 }` → **204**.
- Journal d'audit : « Export de la liste des avocats — Avocat (format=…; filtre=…; lignes=…) », avec l'agent, l'IP et l'horodatage.

### DELETE /api/membres/:id
Admin seul. **409** « Suppression impossible : pièces comptables à conserver 10 ans (OHADA) ; utilisez radiation ou décès » dès que le membre a au moins un reçu, un paiement ou un quitus. Sans pièce (erreur de saisie, doublon), la suppression est définitive.

### POST /api/membres/import

**Statuts RADIE / DECEDE (R1-9)** : l'import refuse tout changement de statut vers ou depuis radié/décédé (erreur de ligne, aucune écriture). Ces transitions passent par `/radier`, `/deces` ou la fiche (PATCH), qui valident la date et journalisent chaque acte. Un fichier ré-importé avec le statut déjà en base reste accepté (aller-retour).

**Machine à états du cycle de vie (R2-4, `server/src/lib/cycleVie.ts`)** : PATCH, `/radier` et `/deces` passent par `appliquerCycleVie`. Invariant : `dateRadiation`/`motifRadiation` n'existent que pour RADIE, `dateDeces` que pour DECEDE ; toute donnée d'acte d'un autre statut est effacée (rétablissement, ou décès après radiation). RADIE et DECEDE exigent leur date (400). Un décédé ne peut pas être radié (409) ; `/radier` sur un radié et `/deces` sur un décédé renvoient 409 (correction par PATCH). L'import n'écrit plus `dateRadiation`, `motifRadiation`, `dateDeces`.
Upsert par `num`, aucune suppression, champs absents du fichier non écrasés, 2 000 lignes maximum. Chaque ligne est validée à part : une ligne invalide (ex. `num` non numérique) est rapportée sans bloquer les autres.
Réponse : `{ "total": 3, "crees": 1, "maj": 1, "erreurs": [{ "ligne": 3, "message": "num : …" }] }`.
- Colonnes étendues : `dateRadiation`, `motifRadiation` (tronqué à 300), `dateDeces`. Une date invalide est ignorée sans faire échouer la ligne.
- Statut `décédé` (aussi `decede`, `décédée`, `decedee`) → `DECEDE`. Si le statut change sur un membre existant, l'accès espace est resynchronisé.
- Journal d'audit : « Import du tableau — Avocat (N ligne(s), X créé(s), Y mis à jour, Z erreur(s)) ».

### Changement de situation et situation à une date (T5, `src/lib/cycleVie.ts`)
- `changerSituation({ membreId, type, demande, donnees, dateEffet, annee, motif, reference, pieceId, dossierId, details, acteur })` : point d'écriture unique d'un changement de situation. Dans **une** transaction : `appliquerCycleVie`, mise à jour de la fiche, création d'un `EvenementSituation` (statut avant/après, acteur, motif, référence, pièce). Tout est annulé si une écriture échoue. Ensuite : `synchroniserAccesAuStatut` si le statut change, puis signal temps réel `{ type: "tableau" }` à tous les clients (`realtimeTous`, `src/lib/realtime.ts`).
- `situationADate(membre, evenements, dossiers, recus, D)` : fonction pure (D10). Statut du dernier événement daté au plus tard de D, à défaut statut d'avant le premier événement postérieur, à défaut statut courant (limite PO-20) ; `null` si inscrit après D ; un inscrit sous interdiction ferme couvrant D compte `SUSPENDU` (avec sursis : reste inscrit, `sursis: true`) ; peine accessoire en cours → `ineligible: true` ; cotisation payée à D = reçus de cotisation de l'exercice de D datés au plus tard de D (sans reçu : la ligne si `datePaiement ≤ D`). D est inclusive : passer la fin de journée.
- Tests : `test/cycleVie-situation.test.ts`.

### Fin de stage, admission directe et écritures de statut (T8, X-04, F-03)
- `POST /api/membres/:id/valider-stage` — permission d'action `stage_valider` (bâtonnier par défaut ; SG → 403). Corps **facultatif** : `{ dateDecision?, dateDemande?, dateCertificat?, refCertificat? }` (dates `AAAA-MM-JJ`, `dateDecision` et `dateCertificat` non futures). Effet : qualité `AVOCAT`, statut `INSCRIT`, **`dateInscription` = `dateDecision`** (défaut : aujourd'hui), événement `PASSAGE_TABLEAU` daté de la décision (référence = `refCertificat` ; `details` : organe « Bâtonnier national (loi n° 026-92, art. 29) », durée requise, dates de demande et de certificat). Règles relues en Paramètres à chaque appel : si `dateServment` est connue et que `dateServment + stage.dureeMois` dépasse la décision → **409** ; si `stage.certificatObligatoire` vaut `true`, `dateCertificat` et `refCertificat` sont exigés → **400**.
- `POST /api/membres/admission-directe` — permission `admission_directe` (SG et bâtonnier par défaut). Corps : identité (`nom`, `sexe`, `cabinet`, `tel`, `email`, `rccm`, `cnss`, `adresse`, `observations`, `dateNaissance`) + `{ cas, ancienneteAns, reference, dateDecision? }`. `cas` doit figurer dans `regles.admissionDirecte.cas` et `ancienneteAns` atteindre son `ancienneteMinAns`, sinon **400**. Crée un avocat `INSCRIT` (`dateInscription` = décision) et son événement `ADMISSION_DIRECTE` dans la même écriture ; réponse 201.
- `GET /api/membres?sort=dateInscription` : tri accepté (X-04).
- `PATCH /api/membres/:id` : si le statut change, écriture par `changerSituation` (événement `RADIATION`, `DECES` ou `CHANGEMENT_STATUT`) ; sinon mise à jour simple, sans événement. `/radier` (événement `RADIATION`, référence = motif de la décision) et `/deces` (événement `DECES`, sans motif : donnée de santé) passent aussi par `changerSituation`.
- Tests : `test/situation-stage.test.ts`.

### Constante et libellés d'audit
- `STATUTS_SORTIS = ["RADIE", "DECEDE", "DEMISSIONNAIRE", "RETRAITE", "CESSATION"]` (`src/lib/business.ts`) : exclus du tableau de l'Ordre, des convocations, de la génération de cotisations **et des relances**, inéligibles au corps électoral (raison `statut`), sans attestation ni accès à l'espace avocat, et sans validation de stage possible (`POST /membres/:id/valider-stage` → 409). `STATUTS_HORS_TABLEAU = ["RADIE", "DECEDE"]` ne désigne plus que les actes datés (radiation, décès) contrôlés à l'import.
- `STATUTS_ANNUAIRE = ["INSCRIT", "STAGIAIRE", "HONORAIRE"]` : statuts visibles dans l'annuaire de l'espace avocat (X-01).
- `estRecuDroit(objet)` : règle unique « l'objet du reçu contient *droit* → droit de plaidoirie, sinon cotisation » (annulation de reçu, corps électoral à une date).
- Libellés ajoutés dans `src/middleware/audit.ts` : « Radiation d'un avocat », « Déclaration de décès », « Import du tableau », « Export de la liste des avocats ».

### Chromium pour le PDF
`trouverChromium` (`src/lib/pdf.ts`) cherche dans l'ordre : `PUPPETEER_EXECUTABLE_PATH`, le cache Puppeteer, Playwright, les binaires Linux (`/usr/bin/chromium`, `google-chrome`…), puis sous Windows `C:/Program Files/Google/Chrome/Application/chrome.exe` et `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`. Sans binaire, les routes PDF répondent en erreur et les tests PDF s'ignorent.

## Journal d'audit (T18, CA10)

Routeur `src/routes/audit.ts`, middleware `src/middleware/audit.ts`, écran
`src/barreau/pages/JournalAudit.jsx`.

- `GET /api/audit` (permission `audit`) : `q` (action, chemin, cible, acteur, IP),
  `userId` (entier, sinon 400), `action` (libellé partiel, insensible à la casse),
  `from` / `to` (jour inclusif), `page` / `pageSize` (≤ 100). La réponse porte aussi
  `acteurs` (utilisateurs connus du journal, pour le sélecteur de l'écran).
- **Lecture seule** : aucune route POST, PUT, PATCH ni DELETE sur `/api/audit`
  (404). En base, le trigger `journal_audit_immuable` refuse UPDATE et DELETE
  (voir « Journal d'audit non modifiable » plus bas). `TRUNCATE` n'est pas couvert
  et n'est pas annoncé comme garanti.
- **Jamais de contenu** : le middleware n'enregistre que méthode, chemin, libellé,
  cible (`#id`), statut HTTP, IP et acteur. `res.locals.auditDetail` ne porte qu'un
  identifiant ou un comptage, jamais un corps de message ni une pièce (secret
  professionnel, art. 52 loi 026-92, R-58).
- Libellés messagerie : « Envoi d'un message — Messagerie (message #id) » pour
  `POST /espace/messagerie`, `POST /espace/messagerie/:id` et `POST /messagerie/:id`.
- Lecture sensible journalisée malgré la méthode GET : `GET /discipline/:id` →
  « Consultation — Dossier disciplinaire » (cible `#id`), en plus du journal métier
  `JournalDiscipline` (R-62).
- Désactivation du trigger par un DBA (purge de conservation, jamais depuis l'API) :
  `ALTER TABLE "JournalAudit" DISABLE TRIGGER journal_audit_immuable;` … `ENABLE TRIGGER`.

Test : `test/audit-journal.test.ts` (envoi d'un message au texte unique : une ligne
par envoi, texte absent de toutes les colonnes ; lecture disciplinaire tracée ;
filtres ; 404 sur toute écriture ; 403 pour un avocat). Front :
`src/barreau/pages/__tests__/JournalAudit.test.jsx`.

## Permissions d'action (RBAC, R-42 provisoire)

En plus des modules (`membres`, `finances`…), la matrice `RolePermission` porte
des **actions d'enregistrement** (`lib/rbac.ts`, catalogue `ACTIONS`) :
`discipline_decider`, `discipline_saisir`, `stage_valider`, `omission_prononcer`,
`admission_directe`. Le logiciel enregistre les décisions des organes compétents,
il ne les prononce pas.

- Défauts : décision disciplinaire, validation du stage et omission → **bâtonnier** ;
  saisine et admission directe → **SG et bâtonnier**. L'ADMIN a toujours tout
  (anti-verrouillage) ; le SG garde tous les modules mais ses actions sont fixes.
- Vérification : `requirePermission("discipline_decider")` comme pour un module.
- `PUT /rbac` accepte les clés de modules et d'actions dans `permissions` ; une
  clé inconnue renvoie 400. `GET /rbac` expose `actions` et la matrice par rôle.
- Repli **par catégorie** : un rôle qui a des lignes de modules en base mais
  aucune ligne d'action retombe sur les actions par défaut (bases existantes
  non amorcées). Conséquence : on ne peut pas retirer *toutes* les actions d'un
  rôle, le minimum étant les défauts.

Tests : `test/rbac-actions.test.ts`.

## Discipline : décision enregistrée (T11, X-02, art. 36 loi n° 026-92)

Le logiciel **enregistre** la décision du conseil de discipline, il ne la prononce
pas. Routes de `routes/discipline.ts` :

- `POST /api/discipline` — saisine : action `discipline_saisir` (SG et bâtonnier par défaut).
- `PATCH /api/discipline/:id` — instruction (rapporteur, convocation, audience, recours,
  champs de procédure `origine`, `dateDesignationRapporteur`, `dateRapport`,
  `conclusionRapport`, `orientation` CLASSEMENT|POURSUITE, `juridiction`,
  `dateNotification`). Modifier `decision`, `sanction` ou passer `statut` à `DECISION`
  exige `discipline_decider` (403 sinon) ; renvoyer ces champs à l'identique reste permis
  (le formulaire les renvoie toujours).
- `POST /api/discipline/:id/decision` — action `discipline_decider` (bâtonnier par défaut).
  Corps : `sanctionCode` (catalogue `regles.sanctions`), `dureeMois` (obligatoire pour une
  interdiction, ≤ `dureeMaxMois`), `sursis` (seulement si `regles.sursisAutorise` et
  `sursisPossible`), `peineAccessoireMois` (≤ `peineAccessoireMaxMois`), `motivation`
  (obligatoire, 10 caractères au moins), `decision` (texte), `reference`, `decidePar`
  (défaut : « Conseil de discipline (art. 36, loi n° 026-92) »), `dateDecision`,
  `dateNotification`. Une seule décision par dossier (409), `membreId` exigé (400).
  Le champ texte `sanction` reçoit le libellé (« Interdiction temporaire (6 mois, avec sursis) »).

Effets, tous écrits par `changerSituation` (événement d'historique avec `dossierId`) :

| Sanction | Effet |
|---|---|
| effet `AUCUN` (avertissement, réprimande) | événement `SANCTION`, statut inchangé |
| interdiction temporaire ferme | `SUSPENDU`, `sanctionDebut`/`sanctionFin` posés, événement `SUSPENSION` |
| interdiction avec sursis | reste `INSCRIT` (au tableau), événement `SANCTION` portant la mention |
| radiation, `regles.effetRadiation = ENREGISTREMENT` | `RADIE` (date = `dateDecision`, motif = libellé + référence), retiré du tableau et de l'annuaire, événement `RADIATION` |
| radiation, `EXPIRATION_RECOURS` | événement `SANCTION` seul, statut inchangé (point ouvert) |

La fin d'une interdiction ferme ne rétablit pas le statut : un événement `REPRISE` manuel
est nécessaire. Le PDF de décision affiche « Sanction enregistrée — organe, décision du … ».
La lecture d'un dossier (`GET /discipline/:id`) est tracée dans `JournalAudit` par le
middleware d'audit (R-62, CA10).

Tests : `test/discipline-decision.test.ts`.

## Règles juridiques paramétrables (`lib/regles.ts`)

Seule source des valeurs juridiques : `REGLES_DEFAUT`, reprise de
`docs/juridique/regles-reference.md` (loi n° 026-92). Aucune autre valeur ne doit
être écrite en dur dans les routes.

- Stockage : `Parametres.data.regles` (admission directe, délais des impayés,
  catalogue des peines de l'art. 36 avec durée maximale et sursis, effet de la
  radiation, peine accessoire, corps électoral, éligibilité par type de scrutin)
  et la clé historique `Parametres.data.stage` (`dureeMois`, `certificatObligatoire`).
- Lecture : `await reglesActuelles()` relit la base à chaque appel et complète
  clé par clé avec les défauts ; un changement en Paramètres agit sans redémarrage.
- Écriture : `PUT /api/parametres` (SG) ; `regles` exige l'objet **complet**
  (schéma `reglesSchema`, sinon 400) ; `stage` accepte une mise à jour partielle
  fusionnée avec la valeur enregistrée.
- Valeurs « provisoires » (sursis, circuit d'omission, cotisation à jour pour
  voter…) : à confirmer par les textes, voir `docs/audit/POINTS-OUVERTS.md`.

Identité (`lib/identiteDocuments.ts`) : `identite().ville` (défaut « Pointe-Noire »)
et `identite().modeDemonstration` (mention C-13, `MENTION_DEMONSTRATION`).
`POST /api/parametres/reinitialiser-donnees` conserve désormais `JournalAudit`.

Tests : `test/regles.test.ts`.

## Schéma de l'audit de conformité (migrations T2)

Deux migrations additives et idempotentes (`IF NOT EXISTS` ou contrôle du catalogue,
aucune suppression ni renommage), rejouables :

- `20261010090000_enums_audit_conformite` : statuts `DEMISSIONNAIRE`, `RETRAITE`,
  `CESSATION` et scrutin `CONSEIL_BARREAU` (fichier séparé : une valeur d'enum ne
  s'utilise pas dans la transaction qui la crée) ;
- `20261010090100_audit_conformite` : tables `EvenementSituation` (historique des
  situations) et `TimbreExterne` (référence unique, import idempotent),
  `Membre.updatedAt`, procédure et sanction structurées de `DossierDisciplinaire`
  (le texte `sanction` est conservé), `Scrutin.dateScrutin`, pièce jointe, empreinte
  et accusés de `Message`, attestation de `Conversation`, index
  `JournalAudit(userId, quand)`.

**Journal d'audit non modifiable** : le trigger `journal_audit_immuable` refuse tout
`UPDATE` ou `DELETE` sur `JournalAudit` (erreur 42501). `TRUNCATE` n'est pas couvert.
Une purge de conservation légitime se fait par un DBA, explicitement :
`ALTER TABLE "JournalAudit" DISABLE TRIGGER journal_audit_immuable;` puis
`ENABLE TRIGGER` aussitôt après.

Test : `test/migrations.test.ts` (rejeu double des deux SQL sur `barreau_pn_test`,
absence de dérive schéma/base, immuabilité du journal).

## Sécurité & production
- **Auth** : access token (15 min) + refresh token (7 j, rotation), `/auth/refresh`, `/auth/logout`
- **Rate-limit** sur `/auth/login` + limiteur global par IP (600 requêtes / 15 min sans jeton ou avec jeton invalide ; 3000 avec un JWT valide, vérifié par signature ; `/health`, `/notifications` et `/mes-notifications` exclus ; mesuré : environ 13 appels `/api` par page en rechargement complet, soit plus de 200 pages / 15 min) ; 429 = `{ erreur, retryAfter }` + en-tête `Retry-After`, le client ne déconnecte que sur 401 ; en-têtes **helmet**
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

La base de test `barreau_pn_test` est celle du socle Docker `creatic-shared`
(conteneur `creatic-postgres`, publié sur `127.0.0.1:5432`) : `TEST_DATABASE_URL`
par défaut la vise, et `test/globalSetup.ts` y applique les migrations sous un verrou
consultatif qui sérialise les suites concurrentes. Le serveur MCP `creatic-postgres-dev`
interroge une autre instance (172.18.0.2, 279 membres) : ses mesures ne décrivent pas
la base vue par la suite.

Plusieurs blocs de `api.test.ts` n'ont pas de `afterAll` et laissent leurs fixtures en
base à chaque exécution (mesuré le 2026-10-10 : 4 679 fixtures pour 20 membres réels du
seed). Effets : passé 200 RADIE le test C-03 (`pageSize=200`) échoue, les restes « R25 »
entrent en collision de `numInscription` avec R2-5, et un reçu accroché à « T10 Hostile »
bloque le `afterAll` de T10. `prisma/purger-restes-tests.ts` supprime les seuls membres
dont le nom porte un préfixe de fixture (liste `PREFIXES_FIXTURES`), tous statuts
confondus, avec leurs reçus, paiements et quitus ; les membres du seed ne sont jamais
touchés et toute base autre que `barreau_pn_test` est refusée.

```bash
npx tsx prisma/purger-restes-tests.ts              # simulation : effectifs ciblés, rien supprimé
npx tsx prisma/purger-restes-tests.ts --executer   # suppression (validation de Fabrice)
PURGER_RESTES_TESTS=1 npx vitest run               # purge automatique avant la suite, sous le verrou
```

Sans `PURGER_RESTES_TESTS=1`, `globalSetup` se contente d'afficher les effectifs de
restes. Ne pas lancer la purge manuelle pendant une exécution de la suite.

## Variables d'environnement complémentaires
`ACCESS_TTL`, `REFRESH_TTL_DAYS`, `PUPPETEER_EXECUTABLE_PATH`, `SMTP_*`,
`MAIL_FROM`, `SIGNATURE_SECRET` (voir `.env.example`).
