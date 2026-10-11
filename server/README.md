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

### Circuit d'omission, réinscription et sorties volontaires (T9, CA7, CA8)
Le logiciel **enregistre** les décisions, il ne les prononce pas : aucune omission automatique (R-13, R-16).
- `GET /api/membres/:id/evenements` — historique des situations, le plus récent d'abord (SG / bâtonnier, comme la fiche).
- `POST /api/membres/:id/evenements` — corps `{ type, dateEffet?, annee?, cause?, motif?, reference?, pieceId? }` (`dateEffet` non future, défaut aujourd'hui ; `annee` = exercice, défaut année de `dateEffet` ; `pieceId` doit appartenir au dossier du membre). Réponse 201 : `{ evenement }` pour une étape, `{ membre, evenement }` pour un changement de statut.

| Type | Droit | Effet |
|---|---|---|
| `RAPPEL`, `MISE_EN_DEMEURE`, `TRANSMISSION` | permission `finances` | Statut et fiche inchangés. 409 si le membre est à jour (ou exonéré) pour l'exercice, ou sorti. |
| `OMISSION` | action `omission_prononcer` (bâtonnier par défaut) | → `OMIS`. `reference` obligatoire (400). `cause` ∈ `35-1`…`35-5` (défaut `35-4`, impayés). Motif enregistré : « Art. 35-x° loi n° 026-92 » ; en `35-1` (maladie), tout motif libre est refusé (R-15). `details.organe` = Conseil de l'Ordre national. |
| `REINSCRIPTION` | action `omission_prononcer` | `OMIS` → `INSCRIT` (409 sinon), `reference` obligatoire. |
| `DEMISSIONNAIRE`, `RETRAITE`, `CESSATION` | SG (et ADMIN) | Sortie volontaire hors tableau ; 409 si déjà sorti. |
| `REPRISE` | SG (et ADMIN) | Fin de suspension : `SUSPENDU` → `INSCRIT` (409 sinon). |

Ordre et délais (cause 35-4° et chaque étape) : l'étape *k* exige l'étape *k−1* **du même exercice**, datée au plus tard de (sa date − délai), postérieure à la dernière `REINSCRIPTION` du membre. Délais relus à chaque appel dans `regles.impayes` (Paramètres) : `delaiRappelJours` (rappel → mise en demeure, 30 j), `delaiMiseEnDemeureJours` (mise en demeure → transmission, 15 j) ; l'omission suit la transmission sans délai. Sinon **409**. Une omission revérifie toute la chaîne avec les règles du moment. `POST /api/cotisations/relances` (e-mail aux retardataires) est inchangé et n'écrit aucune étape.
- Tests : `test/omission.test.ts`.

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
  `JournalDiscipline` (R-62). Même traitement pour `GET /discipline/:id/convocation/pdf`,
  `GET /discipline/:id/decision/pdf` et le casier d'un membre
  (`GET /discipline?membreId=` → « … (casier membre #id) »).
- Désactivation du trigger par un DBA (purge de conservation, jamais depuis l'API) :
  `ALTER TABLE "JournalAudit" DISABLE TRIGGER journal_audit_immuable;` … `ENABLE TRIGGER`.
- **Limites, à ne pas présenter autrement** : (1) `TRUNCATE` n'est pas couvert par le
  trigger. (2) Le rôle de connexion de l'application est aussi celui qui applique les
  migrations Prisma, donc **propriétaire** de la table : une exécution SQL arbitraire
  obtenue via l'application (injection, serveur compromis) pourrait désactiver le
  trigger. L'immuabilité vaut donc contre l'API, l'ORM et l'erreur humaine, pas contre
  un accès SQL au nom du propriétaire. En production, utiliser un rôle d'exécution
  distinct, sans `ALTER` ni droit de propriétaire, limité à `SELECT`/`INSERT` sur
  `JournalAudit` (migrations lancées par le rôle propriétaire) : à valider par Fabrice.
  (3) L'adresse IP journalisée est `req.ip`, soit `X-Forwarded-For` avec `TRUST_PROXY`
  (défaut 1, un mandataire). En exposition directe, mettre `TRUST_PROXY=0`, sinon un
  client forge l'IP inscrite au journal. (4) L'écriture asynchrone du journal est en
  « fail-open » (avertissement dans les logs, réponse déjà envoyée) sauf pour les exports,
  qui attendent la ligne avant de livrer (C-04).

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

## Messagerie : pièce jointe, empreinte, accusés, Contacter (T13, F-32 à F-34)

Fichiers : `src/lib/messagerie.ts` (helpers partagés), `src/lib/storage.ts`
(`typeReel`), `src/lib/templates.ts` (`accuseReceptionHtml`, `clauseAccuse`),
`src/routes/espace.ts`, `src/routes/messagerie.ts`. Test : `test/messagerie-pj.test.ts`.

**Pièce jointe** — une pièce par message, champ facultatif `piece: { nomFichier, donnees }`
(base64 sans préfixe `data:`) sur `POST /espace/messagerie`, `POST /espace/messagerie/:id`,
`POST /messagerie` et `POST /messagerie/:id`. Limite 5 Mo (413) ; la limite JSON globale
de 8 Mo d'`app.ts` est inchangée (écart assumé face au R-60, PO-26). Le type n'est
jamais déclaré par le client : `typeReel(buffer)` le lit dans les octets de signature
(PDF `%PDF`, PNG, JPEG `FF D8 FF`, DOCX = zip contenant `word/`) et refuse tout le reste
en 400 — un exécutable renommé en `.pdf` est rejeté. Même contrôle sur `POST /espace/pieces`
(F-36) : le `mimeType` enregistré est le type réel. Stockage `enregistrerFichier("messagerie")`,
fichier retiré si l'écriture en base échoue. Nom assaini (guillemets, retours à la ligne,
séparateurs de chemin). Téléchargement : `GET /espace/messagerie/messages/:id/piece`
(participant du fil, sinon 403) et `GET /messagerie/messages/:id/piece` (fil avec
l'administration, sinon 404), `X-Content-Type-Options: nosniff`, `inline` pour PDF et
images, `attachment` pour le DOCX.

**Empreinte** — `Message.empreinte` = SHA-256 hexadécimal du corps (UTF-8) suivi des
octets de la pièce, calculée à l'envoi, exposée dans les réponses de fil.

**Statuts envoyé / reçu / lu** — `recuAt` est posé quand le destinataire charge sa liste
(`GET /espace/messagerie`, `GET /messagerie`), `luAt` quand il ouvre le fil (`GET …/:id`,
qui pose aussi `recuAt` s'il manquait). Les deux sont écrits par `updateMany … IS NULL` :
jamais réécrits. Le destinataire est « quiconque n'est pas l'auteur » (`messageNonDeMoi`
côté avocat, `MESSAGE_DE_AVOCAT` côté administration) : relire ses propres messages ne
pose rien. Les fils sont 1-1 ou avec l'administration, donc une colonne par message suffit.

**Accusé de lecture** — `GET /espace/messagerie/messages/:id/accuse/pdf` (participants) et
`GET /messagerie/messages/:id/accuse/pdf` (administration, fils administration seulement).
Titre « Accusé de lecture de la plateforme » ; contenu : expéditeur, destinataire, sujet,
dates d'envoi, de réception et de première ouverture à l'heure de Brazzaville (UTC+1),
pièce et empreinte ; **jamais le corps du message** ; pied = clause C-01 mot pour mot
(`clauseAccuse()`), sans signature ni cachet. Il ne vaut ni lettre recommandée ni
notification (art. 39 et 42, loi n° 026-92) : aucune valeur probatoire n'est revendiquée.

**Contacter** — `POST /messagerie { membreId, sujet, corps, piece? }` (permission
`messagerie`) ouvre un fil administration → membre, déjà lu côté administration ; 404 si
le membre n'existe pas, 409 s'il est sorti (`STATUTS_SORTIS`, plus d'accès à l'espace).
Le journal d'audit ne reçoit que `message #id`. Les réponses de liste et de fil portent
désormais `membreId` (lien vers la fiche).

**Demandes d'attestation (T14, F-35)** — `POST /espace/attestations/demandes { type:
"INSCRIPTION" | "NON_REDEVANCE", precisions? }` (avocat ; 409 si sorti) ouvre un fil
administration portant `attestationType`. `POST /messagerie/:id/attestation` (permission
`messagerie` ; avocat → 403 ; fil sans demande → 404 ; non-redevance → 409 si cotisation de
l'exercice non soldée) délivre en **une seule transaction** : verrou du fil (seconde délivrance
→ 409), numéro `ATT-AAAA-NNN` (compteur existant), PDF joint en réponse de l'administration,
`archiver()` et `attestationNumero`. Tout échec (PDF, base) annule l'ensemble, compteur compris :
pas de PDF envoyé sans numéro, pas de trou de numérotation (`test/attestations.test.ts`).

**Cloisonnement (R-58)** — l'administration, ADMIN compris, ne voit jamais un fil entre
confrères : liste filtrée, fil, pièce et accusé répondent 404.

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
Coordonnées des reçus et quitus : `courriel`, `site`, `telephones` (séparés par « / »),
paramétrables en Paramètres › Identité ; un bloc vide n'est pas affiché. Adresse et
coordonnées par défaut ne valent que pour la ville par défaut : un barreau d'une autre
ville qui ne les saisit pas n'hérite d'aucune coordonnée du barreau de base (adresse
remplacée par sa ville). Test : `test/identite-documents.test.ts` (texte extrait du PDF
rendu par `envoyerDocumentPdf`, via `pdftotext` ; sauté si Chromium ou pdftotext absent).
`POST /api/parametres/reinitialiser-donnees` conserve désormais `JournalAudit`.

Tests : `test/regles.test.ts`.

## Corps électoral à la date du scrutin et éligibilité des candidats (T12, X-03)

Le corps électoral n'est plus figé sur l'exercice courant : il est **calculé à une
date** (`situationADate`, `lib/cycleVie.ts`) selon les règles de `Parametres.data.regles`.

- `GET /api/corps-electoral?date=AAAA-MM-JJ` : statut (événements d'historique,
  interdiction temporaire ferme couvrant la date), peine accessoire et cotisation
  (reçus de cotisation de l'exercice datés au plus tard de la date) appréciés à
  cette date, fin de journée UTC. `?scrutinId=` prend la `dateScrutin` du scrutin
  (sinon son ouverture, sinon aujourd'hui). `?annee=` est conservé : date au 31/12
  de l'exercice, même liste que la règle historique. Date mal formée → 400.
  Réponse : `date` ajoutée, `statutADate` et `sursis` sur chaque ligne ; les
  stagiaires n'apparaissent que si `regles.electoral.qualites` les admet.
- `electeursADate(where, D, regles?)` (`lib/cycleVie.ts`) : point unique partagé par
  le corps électoral, la candidature et le vote de l'espace. Quatre requêtes, calcul
  en mémoire ; sans journalisation antérieure, le statut courant fait foi (PO-20).
- `eligibiliteElectorale(membre, cot, tarifs?, regles?)` : avec `regles`, qualités
  admises, statuts exclus, cotisation exigée et honoraires viennent des Paramètres ;
  sans `regles`, règle historique inchangée (appels existants et tests de 76958a4).
- Scrutins : type `CONSEIL_BARREAU` ; `dateScrutin` (jour civil) à la création et
  en préparation. `POST /api/scrutins/:id/candidats` avec `membreId` répond **409
  motivé** si l'avocat n'est pas inscrit au tableau à la date, si une peine accessoire
  d'inéligibilité est en cours (`exclurePeineAccessoire`) ou si l'ancienneté
  `regles.eligibilite[type]` n'est pas atteinte (`stricte` : « plus de 8 ans » refuse
  le jour anniversaire exact ; comptée en jours civils). Un candidat libre (sans
  fiche) n'est pas contrôlé. Changer `ancienneteMinAns` en Paramètres change l'issue
  sans redéploiement (CA8).
- Espace avocat : `GET /espace/scrutins` expose `eligible` par scrutin (et
  `dateScrutin`) ; `POST /espace/scrutins/:id/voter` apprécie l'électeur à la date
  de référence du scrutin. Le mécanisme de vote (anonymat, unicité) est inchangé.

Tests : `test/corps-electoral-date.test.ts` (CA9 : deux dates encadrant un paiement
ou une sanction donnent deux listes différentes ; `?annee=` égal à la règle
historique ; bâtonnat 8 ans exacts → 409, 8 ans et 1 jour → 201, seuil modifié en
Paramètres → 409 ; peine accessoire → 409 ; vote à la `dateScrutin`). Sur 76958a4,
`?date=` est ignoré et les deux listes sont identiques : le test y échoue.

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

## Jeu de démonstration du congrès (`npm run demo`, T25, CA15)

Données **entièrement fictives** (mention C-13), réinstallables par une seule commande sur `barreau_pn_test`.

**Congrès : schéma vierge `demo` de `barreau_pn_test` (R1-13).** La démonstration ne se joue jamais dans le schéma
`public`, partagé avec vitest et la recette (des milliers de fixtures y faussent tableau, corps électoral et listes ;
`--identite=demonstration` y affiche un AVERTISSEMENT). Elle se joue avec `DATABASE_URL=…/barreau_pn_test?schema=demo`,
schéma créé par `npx prisma migrate deploy`, sans seed : le script y crée les comptes du scénario (noms de fonction).
Aucune nouvelle base à provisionner ; `barreau_pn_demo` reste acceptée si elle est provisionnée un jour. Instance :
`.\scripts\relancer-test.ps1 -Demo` (port 4200). Preuve : `test/demo-base-vierge.test.ts` (schéma jetable `demo_vierge` :
migrations, demo.ts, seuls membres DEMO, 4 comptes de l'Ordre avec leur rôle, connexion SG par l'API, schéma `public`
inchangé, clés étrangères recréées par la migration `20261011120000_fk_evenement_schema_courant`). Procédure complète :
`docs/DEMO-CONGRES.md` § 1.

Le script lit **uniquement `DATABASE_URL`**. Celui du `.env` vise `barreau_pn` : il est refusé. On désigne
donc la base de test explicitement (dotenv ne remplace pas une variable déjà définie) :

```bash
# Git Bash
DATABASE_URL="postgresql://barreau:…@127.0.0.1:5432/barreau_pn_test?schema=public" npm run demo
DATABASE_URL="…/barreau_pn_test?schema=public" npm run demo -- --identite=demonstration  # + identité « Barreau de démonstration »
DATABASE_URL="…/barreau_pn_test?schema=public" npm run demo -- --identite=pointe-noire   # retour à l'identité de base + mot de passe commun
# PowerShell
$env:DATABASE_URL = "postgresql://barreau:…@127.0.0.1:5432/barreau_pn_test?schema=public"; npm run demo
```

- **Garde-fou** : le script refuse, avec un code non nul et avant toute connexion, tout `DATABASE_URL` absent, illisible ou dont le nom de base n'est pas exactement `barreau_pn_test` ou `barreau_pn_demo` (donc `barreau_pn`, `barreau_pn_test_ci` et toute autre). `TEST_DATABASE_URL` n'est jamais lu ; l'ancienne option `--base-test` est sans effet. Test : `test/demo-garde.test.ts` (11 cas, aucune connexion ouverte ; `barreau_pn_demo` accepté ; avertissement sur le schéma `public`, aucun sur `demo`).
- **Idempotent et cloisonné** : upsert sur clés naturelles (num 800001 à 800200, numInscription `DEMO-…`, dossiers `DEMO-2026-NN`, sujets `[DEMO] …`, références `DEMO-…`). Un membre déjà créé n'est pas réécrit ; les autres membres ne sont jamais modifiés. Preuve versionnée : `test/demo-idempotence.test.ts` (dans `npm test`, ignoré si la base n'est pas `barreau_pn_test`) lance le script deux fois, compare les deux lignes `EFFECTIFS` et l'empreinte des membres hors DEMO, prise avant et après par la requête de comptage :
  ```sql
  SELECT count(*)::int AS n, max(id)::int AS max, md5(string_agg(m::text, '|' ORDER BY id)) AS h
    FROM "Membre" m WHERE num NOT BETWEEN 800001 AND 800200;
  ```
  Relevé du 2026-10-11 sur `barreau_pn_test` : 5 982 membres hors DEMO (dont environ 5 900 restes de fixtures de tests, non purgés : leur purge attend l'accord de Fabrice), identiques avant et après ; deux exécutions donnent la même ligne :
  `EFFECTIFS {"membres":{"AVOCAT/RADIE":1,"HONORAIRE/HONORAIRE":1,"STAGIAIRE/STAGIAIRE":15,"AVOCAT/INSCRIT":64},"cabinets":10,"cotisations":80,"recus":62,"dossiers":4,"evenements":6,"scrutins":1,"fils":4,"messages":7,"timbres":12,"timbresExternes":18}`
- **Contenu** : 60 avocats courants, 4 avocats suivis en discipline et 1 en omission (soit 64 inscrits, 1 radié), 15 stagiaires, 1 honoraire, 10 cabinets ; cotisations de l'exercice courant à jour, partielles et en retard, encaissées par `encaisser()` (reçus et archives cohérents, aucun e-mail envoyé) ; 4 dossiers `DEMO-2026-01` à `04` (classement, avertissement, interdiction temporaire de 6 mois avec sursis, radiation enregistrée) ; 1 omission au stade de la transmission (rappel, mise en demeure, transmission horodatés, exercice précédent) ; scrutin test « conseil du barreau » (dateScrutin 12/12/2026, 3 candidats) ; 4 fils de messagerie dont une demande d'attestation en attente ; 12 timbres internes et 18 timbres externes (import MTN) ; compte de l'espace avocat `avocat.demo@demo.invalid`.
- **Fictif** : noms assemblés par syllabes, e-mails `@demo.invalid`, téléphones `+242 00 000 …`. Aucun casier judiciaire ni pièce téléversé.
- **Identité** : `--identite=demonstration` pose la dénomination, la ville, les signataires et le logo `assets/demo/logo-demonstration.png` (remplaçable) dans les Paramètres et active `modeDemonstration`. **Brazzaville n'est pas activable** (identité refusée) : aucun nom ni logo d'un barreau réel sans son accord écrit (PO-22). Un serveur déjà démarré garde l'identité en cache : le redémarrer ou enregistrer les Paramètres.
- **Mots de passe des 5 comptes** (bâtonnier, SG, trésorière, admin, `avocat.demo`) : `--mots-de-passe-aleatoires` tire un mot de passe par compte et l'affiche une seule fois, puis verrouille **tous les autres comptes actifs** (dont `avocat@barreau-pn.cg` du seed) par un mot de passe aléatoire non affiché ; `--mots-de-passe-defaut` rétablit le mot de passe commun de la base de test sur les 5 comptes et sur `avocat@barreau-pn.cg`, attendus par la suite et par `scripts/recette-ui.ts` (les autres comptes, reliquats de tests, restent verrouillés). Sans option, `--identite=demonstration` implique les aléatoires et `--identite=pointe-noire` le défaut ; sinon rien ne change. Les deux options ensemble sont refusées avant connexion. Test : `test/demo-mots-de-passe.test.ts` (remet le défaut et les Paramètres en `afterAll`).
- **Écoute** : `HOST` (défaut `0.0.0.0`) est passé à `listen` ; `scripts/relancer-test.ps1` pose `HOST=127.0.0.1`, l'instance de démonstration n'est donc pas joignable depuis le réseau du lieu. Test : `test/ecoute-hote.test.ts` (lance l'API avec `HOST=127.0.0.1`, réponse sur 127.0.0.1, refus sur l'adresse réseau du poste).
- **Suite de tests** : lancer la démonstration avec `--identite=pointe-noire` avant `npm test` (identité de base et mot de passe commun) (certains tests de PDF attendent l'identité de base). Les données `DEMO` ne gênent pas la suite. Comparaison A/B du 2026-10-11, même machine, même code (92b5b7a), deux copies de `barreau_pn_test` qui ne diffèrent que par les lignes DEMO : 307/307 verts dans les deux cas (134,1 s sans DEMO, 134,8 s avec). Les échecs observés auparavant (R1-6 à 30 s, PDF en `TimeoutError`) tenaient à la charge de la machine et au rendu PDF qui attendait un réseau au repos : corrigés dans `routes/droits.ts` (relances par lots de 5, 38,7 s ramenées à 12 s pour 2 360 cibles) et `lib/pdf.ts` (`load` borné puis polices bornées, test `test/pdf-chargement.test.ts`). `npx vitest run test/demo-garde.test.ts` prend moins de 20 s, mais attend d'abord le verrou de la suite (`globalSetup`) si une autre suite serveur tourne sur la même base.

## Sécurité & production
- **Auth** : access token (15 min) + refresh token (7 j, rotation), `/auth/refresh`, `/auth/logout`
- **Rate-limit** sur `/auth/login` + limiteur global (600 requêtes / 15 min par IP sans jeton ou avec jeton invalide ; 3000 par utilisateur avec un JWT authentique, vérifié par signature, même expiré : il reçoit alors 401 et le client rafraîchit sa session au lieu de rester bloqué en 429, R2-13 ; `/health`, `/notifications` et `/mes-notifications` exclus ; `/auth/refresh` exclu du limiteur global et limité à part à 300 / 15 min par IP, pour qu'une salle derrière un seul NAT ne fasse pas perdre les sessions, R2-13 ; mesuré : environ 13 appels `/api` par page en rechargement complet, soit plus de 200 pages / 15 min) ; 429 = `{ erreur, retryAfter }` + en-tête `Retry-After`, le client ne déconnecte que sur 401 ; en-têtes **helmet**
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
npx vitest run test/parcours.test.ts   # recette des 12 parcours du §5 du cahier (CA5)
```

`test/parcours.test.ts` rejoue les 12 parcours de recette de bout en bout par l'API (un
`describe` par parcours : import, passage au tableau, admission directe, omission,
discipline jusqu'au sursis puis à la radiation, droits bâtonnier / SG, tableau temps réel
et PDF, messagerie, rejet de pièce, corps électoral à une date, reçu personnalisé, journal
d'audit). Les volets PDF exigent Chromium et `pdftotext` (sautés sinon). Fixtures préfixées
« E2E PARCOURS », retirées en fin de fichier ; Paramètres restaurés.

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

### Suite de référence sur une base sans restes (`barreau_pn_test_ci`)

La suite n'est verte de façon reproductible que sur une base **sans restes de fixtures** :
sur `barreau_pn_test` polluée (plus de 400 RADIE), C-03 et R1-6 échouent sans aucune
régression de code. Le socle attribue au projet une seconde base de test,
`barreau_pn_test_ci` (même rôle `barreau`, inscrite au `registre.json` du socle), réservée
à la recette : on la vise par `TEST_DATABASE_URL`. La garde des scripts (`estBaseDeTest`,
`prisma/purger-restes-tests.ts`) accepte `barreau_pn_test` et ses variantes suffixées
`barreau_pn_test_<suffixe>`, jamais `barreau_pn`.

```bash
# Mise en place (une fois) : migrations + seed sur la base vierge du socle
DATABASE_URL="postgresql://barreau:barreau_dev@127.0.0.1:5432/barreau_pn_test_ci?schema=public" npx prisma migrate deploy
DATABASE_URL="postgresql://barreau:barreau_dev@127.0.0.1:5432/barreau_pn_test_ci?schema=public" npm run seed
# Recette (preuve « Test Files / Tests » à joindre au rapport)
TEST_DATABASE_URL="postgresql://barreau:barreau_dev@127.0.0.1:5432/barreau_pn_test_ci?schema=public" npm test
```

Résultat de référence du 2026-10-10 sur `barreau_pn_test_ci` : 14 fichiers, 245 tests,
tous verts (deux exécutions successives, la seconde sur la base déjà utilisée une fois).
Si cette base accumule à son tour des restes, la remettre à zéro par
`npm run seed` (après validation de Fabrice : le seed supprime les données de la base visée).

## Variables d'environnement complémentaires
`ACCESS_TTL`, `REFRESH_TTL_DAYS`, `PUPPETEER_EXECUTABLE_PATH`, `SMTP_*`,
`MAIL_FROM`, `SIGNATURE_SECRET` (voir `.env.example`).
