# Audit de l'espace avocat (M-20261016, T11)

Ce document vérifie que l'espace avocat a suivi les fonctionnalités livrées depuis le 9 octobre 2026. Relevé fait le 2026-10-16 sur `ada3e30`, la branche de production. Les sources auditées n'ont pas changé sur `feat/parametres-pdf-espace-avocat-droits`.

**Périmètre.**

- Les 220 commits de `git log --since=2026-10-09 ada3e30`, regroupés selon les 12 familles de l'énoncé.
- Le serveur : `server/src/routes/espace.ts`, 41 routes, toutes sous `requireAuth` et `requireAvocat` (l.31), avec `membreId` tiré du jeton (l.34).
- Le front : `src/barreau/layout/EspaceAvocatLayout.jsx` (NAV l.29-40, Routes l.178-190), `src/barreau/pages/espace/*` et `src/barreau/api/resources.js` (l.284-331).

**Cadre juridique** (avis du juriste de la mission) :

- l'avocat voit ses propres données (loi n° 29-2019, art. 43 à 46) ;
- il ne voit jamais celles d'un autre membre ;
- aucune session n'est rouverte pour un radié ou un décédé ;
- les pièces d'instruction non notifiées sont exclues ;
- pour une omission pour maladie, seul le code d'article apparaît (R-15).

Fait établi qui commande plusieurs justifications : tout statut de `STATUTS_BLOQUANTS` désactive le compte User (`server/src/lib/acces.ts:11` et `:26-29`, appelé par `changerSituation` dans `server/src/lib/cycleVie.ts:129`). Ces statuts sont SUSPENDU, RADIE, OMIS, DECEDE, DEMISSIONNAIRE, RETRAITE et CESSATION. Un avocat connecté est donc toujours INSCRIT, STAGIAIRE ou HONORAIRE.

## 1. Tableau d'audit

Légende de la colonne « Présent » : **oui** (complet), **partiel** (manque comblable), **non**, **s.o.** (sans objet, ne concerne pas l'avocat).

| # | Fonctionnalité (commits de référence) | Concerne l'avocat | Présent dans l'espace | Preuve (fichier:ligne) | Suite |
|---|---|---|---|---|---|
| 1 | **Cycle de vie** : statuts de sortie, machine à états `changerSituation`, historique des situations (8b268f7, 592d811, 8f65731, 08858b6, b01497a) | oui | **partiel** | `GET /espace/moi` renvoie `membre.statut` (`espace.ts:74`), mais `MaSituation.jsx:103-111` n'affiche que la qualité et le numéro, jamais le statut. L'historique `EvenementSituation` n'est servi qu'au back-office (`membres.ts:766-773`, réservé à SG et Bâtonnier). Aucune route /espace ne le sert. | Correctif E1 et E2 |
| 2 | **Radiation et décès** : radiation motivée, décès déclaré, radiation exécutoire et réformation (6788a9c, f3545fc, 828b09f, ddde7d8, b381912) | non pour le radié ou le décédé (compte désactivé). Oui pour la trace d'une réformation chez un membre rétabli | **s.o.** (justifié) | `acces.ts:11` et `:26-29` désactivent le compte dès RADIE ou DECEDE ; `attestation/*` refuse RADIE et DECEDE (`espace.ts:129`, `:147`). Si une réformation rétablit le membre, l'événement REFORMATION (`discipline.ts:280`) apparaîtra dans le parcours (E2). | Justification J1 ; couvert par E2 |
| 3 | **Parcours** : fin de stage datée, admission directe, onglet Parcours de la fiche, rapports de stage (1da5b00, 0ac8288, 8f856f1, c4f910a) | oui (surtout pour le stagiaire) | **non** | `/espace/moi` ne sélectionne ni `dateServment`, ni `dureeMois`, ni `maitreStage`, ni `stageValideAt` (`espace.ts:68-80`). L'onglet Parcours n'existe qu'au back-office. | Correctif E2 ; rapports de stage : J6 |
| 4 | **Messagerie complète et accusés** : pièce jointe vérifiée, empreinte SHA-256, statuts reçu et lu, accusé de lecture PDF, « Contacter », relais externes neutres (2e4dcd6, d443924, 923d50d, 2cd740d) | oui | **oui** | Serveur : `espace.ts:624-843` (accusé `:722-728`, pièce `:716-719`, anti-IDOR `monMessage` `:709-713`, réception `:638`, lecture `:676`). Front : `EspaceMessagerie.jsx:323` → `PiedMessage` (`components/PieceJointe.jsx:69-90` : statut et accusé PDF), `ChampPieceJointe` `:111`, « Contacter » `:30` et `:197`, mention loi 29-2019 `:168-170`. | — |
| 5 | **Attestations** : self-service inscription et non-redevance, refus des omis et des sortis, demande via la messagerie, attestation de sortie (63ab522, 4df48fa, 94685b4, 85ce9f7, 847d147) | oui, sauf l'attestation de sortie | **oui** | Serveur : `espace.ts:124-160` (gardes `peutAttesterInscription` et `STATUTS_SORTIS`), demande `espace.ts:783-811`. Front : `MesDocuments.jsx:203-237` (bouton non-redevance désactivé si solde > 0), « Demander une attestation » `EspaceMessagerie.jsx:117-170` et `:251`. L'attestation de sortie n'existe qu'au back-office (`membres.ts:1118`). | Attestation de sortie : J2 |
| 6 | **Pièces et rejets motivés** : rejet motivé obligatoire, notification de l'avocat, type réel des octets (F-36) (a255e95) | oui | **oui** | Serveur : `espace.ts:491-555` (cloisonnement `:533`, `:549`), notification `PIECE_REJETEE` vers `/documents` (`pieces.ts:78`, `:108`). Front : motif affiché `MesDocuments.jsx:182`, cloche `EspaceAvocatLayout.jsx:118`. | — |
| 7 | **Timbre copiable et QR** : copier, PNG, SVG avec QR signé, usage journalisé, timbre déclaré utilisé et « Déjà utilisé » sur /v (b3d7aa0, ffdb690, d84c00e, d47eb4d) | oui | **partiel** | Copie, PNG, SVG et traçage : `MesTimbres.jsx:56-71`, `:106`, `espace.ts:197-207`. La route `POST /espace/timbres/:id/utilise` existe (`espace.ts:213-224`), mais le front n'a aucun client API (`resources.js:299-301`) ni aucun bouton. Le badge affiche « Valide » pour un timbre UTILISE (`MesTimbres.jsx:137`). | Correctif E3 |
| 8 | **Quitus et reçus à QR** : QR signé, `verif` en URL absolue, validité du quitus figée à la délivrance, reçus annulés logiquement (f1f66f6, d84c00e, 8d3c3d4, e3036bc, 684853e) | oui | **partiel** | Les PDF portent le QR (`espace.ts:345-364`), les reçus ANNULE sont exclus (`espace.ts:263`, `:349`) et l'API renvoie `verif` et `finValidite` (`espace.ts:267-271`). En revanche, `MesDocuments.jsx:89-133` n'affiche ni la date de fin de validité du quitus, ni le lien de vérification, ni l'état « expiré ». | Correctif E4 |
| 9 | **Cotisations et omission** : circuit rappel → mise en demeure → transmission → omission (art. 35), réinscription, cotisation non due pour les sortis (ab0cbb2, 5ff8d63, 1fcd870, 0ca5d7f) | oui pour les étapes de recouvrement (l'avocat est encore INSCRIT). Non pour l'omission elle-même (compte désactivé) | **partiel** | Cotisations, droits et paiement : `espace.ts:42-90` et `:307-342`, `MaSituation.jsx:113-128`. Les étapes RAPPEL, MISE_EN_DEMEURE et TRANSMISSION de l'exercice (`membres.ts:776-790`) ne sont ni exposées ni signalées dans l'espace. | Correctif E1 (bandeau de recouvrement) et E2 ; omission : J3 |
| 10 | **Élections et éligibilité** : corps électoral à la date du scrutin (X-03), éligibilité paramétrable, bandeaux expérimentaux, refus de candidature motivé, suppression d'un scrutin passé (5b65720, 50aed69, fef04b5, c66a3c1) | oui pour le vote et l'éligibilité. Non pour les candidatures et la suppression (gestion interne) | **partiel** | Vote et éligibilité : `espace.ts:848-929` (`eligible` `:876`), `EspaceScrutins.jsx:54-78` (Notice d'inéligibilité `:76`), `BandeauExperimental` `:3`. La date du scrutin, renvoyée par l'API (`espace.ts:874`), n'est pas affichée (`EspaceScrutins.jsx:64` montre le titre seul). Les candidatures sont enregistrées par le SG (`scrutins.ts:127`). | Correctif E5 ; candidatures et suppression : J4 |
| 11 | **Anciens membres** : registre `sortis=1`, page Anciens membres, consultation tracée, CL-ANCIENS-MEMBRES (c674ccd, 958f266, 7242638, b62b628) | non | **s.o.** (justifié) | Registre interne du Secrétariat (`routes.jsx`, chemin `/anciens-membres`). L'annuaire de l'espace exclut déjà les sortis (`espace.ts:376-398`, `STATUTS_ANNUAIRE`). | Justification J5 |
| 12 | **Paramètres** : 9 onglets, identité paramétrée, mode démonstration (C-13), validité du quitus, modules masqués, rôle Avocat en lecture seule dans la matrice (eb617f4, eceb49b, 17decaf, 22f7aca, 8580dce) | partiellement : identité, mode démo, validité du quitus et modules masqués | **partiel** | Identité et mode démo : `GET /auth/identite` (`auth.ts:27-30`) chargé par `chargerIdentite` (`AuthContext.jsx:41-52`), `BandeauDemonstration` dans le layout (`EspaceAvocatLayout.jsx:8`). Validité du quitus : voir #8. Modules masqués : appliqués à la seule Sidebar (`Sidebar.jsx`, commit eceb49b). L'espace ne les reçoit pas, car `/api/parametres` est hors confinement avocat (`app.ts:133-134`) et `/auth/identite` ne les renvoie pas. NAV n'est pas filtrée (`EspaceAvocatLayout.jsx:29-40`). | Correctif E6 (à valider) ; écran Paramètres : J7 |
| 13 | **Discipline** : décision structurée, sursis, peine accessoire, notification, lecture tracée (200cef9, 2ccb863, 0482329, 8adce0e) | oui (décisions qui lui sont notifiées) | **partiel, avec un écart de confidentialité** | `GET /espace/discipline` et `/:id` (`espace.ts:446-466`) renvoient l'objet Prisma COMPLET : `plaignant`, `rapporteur`, `conclusionRapport`, `orientation`, `pieces`, `motivation`, `decision`, `sanction`, quelle que soit `dateNotification`. Le PDF de décision est servi dès que `decision` est non nul (`espace.ts:474`). Côté front, `EspaceDiscipline.jsx:56-70` n'affiche ni le sursis, ni la période de sanction, ni la date de notification. | Correctif E7 (prioritaire, sécurité) |

Lecture de la colonne « Suite » : les familles 4, 5 et 6 sont complètes. Les familles 1, 3, 7, 8, 9, 10, 12 et 13 sont comblées par les correctifs E1 à E7. Les familles 2 et 11 sont justifiées.

## 2. Correctifs à réaliser (T12 serveur, T13 front)

Ces correctifs ne créent aucun module, aucune migration ni aucune dépendance. Chaque route reprend le motif existant : `monMembreId(req)` dans le `where`, 404 si l'objet n'appartient pas à l'avocat. Composants réutilisés : Badge, Notice, PageHeader, EmptyState, DataTable ou liste `divide-y`, jetons existants.

### Routes /espace (T12)

| Réf. | Méthode | Chemin | Cloisonnement | Contenu | Page cible |
|---|---|---|---|---|---|
| E2 | GET | `/api/espace/parcours` (nouvelle, lecture seule) | `prisma.evenementSituation.findMany({ where: { membreId: monMembreId(req) } })`, tri `dateEffet desc, id desc` | **Événements** : projection `type, statutAvant, statutApres, dateEffet, annee, reference, motif`. Exclus : `acteurId`, `acteurNom`, `pieceId`, `dossierId`, `details`. Le motif d'une OMISSION de cause 35-1 est déjà réduit au code d'article par `membres.ts:813-814` et `:863`. Tout motif d'un événement lié à un dossier disciplinaire non notifié est masqué (voir E7). **Stage** (qualité STAGIAIRE ou `stageValideAt` non nul) : `dateServment, dureeMois, maitreStage, finPrevue = dateServment + dureeMois, stageValideAt`, lus sur la fiche `monMembreId(req)`. | `MaSituation.jsx` : carte « Mon parcours » (liste `divide-y` avec libellés de `STATUT_MEMBRE_META`) et, pour un stagiaire, bloc « Mon stage » |
| E1 | GET | `/api/espace/moi` (existante, enrichie) | inchangé (`where: { id }`) | Ajouter `recouvrement` : dernière étape RAPPEL, MISE_EN_DEMEURE ou TRANSMISSION de l'exercice courant (`type, dateEffet`). Elle est lue par `evenementSituation.findFirst({ where: { membreId: id, annee, type: { in: [...] } } })`. Pas de nouvelle route. | `MaSituation.jsx` : Badge de statut dans le `sousTitre` (l.105-110) ; Notice ton « or » « Mise en demeure du JJ/MM/AAAA pour l'exercice N : régularisez votre cotisation » au-dessus des cartes |
| E7 | GET | `/api/espace/discipline` et `/api/espace/discipline/:id` (existantes, resserrées) | inchangé (`membreId: monMembreId(req)`, 404 sinon, `espace.ts:451` et `:463`) | Remplacer l'objet complet par une projection `select`. Toujours servi : `id, reference, objet, statut, dateSaisine, dateConvocation, dateAudience`. Seulement si `dateNotification` est non nul : `decision, sanction, sursis, sanctionDebut, sanctionFin, peineAccessoireMois, dateDecision, dateNotification, decidePar, recours, dateRecours`. Jamais servi : `plaignant, rapporteur, conclusionRapport, orientation, origine, pieces, motivation, dateRapport, dateDesignationRapporteur`. | `EspaceDiscipline.jsx` : afficher « Sursis », « Du … au … », « Notifiée le … » ; si la décision n'est pas notifiée, Notice « Décision en attente de notification » ; mention « Document consultable par vous seul… » (clause de l'avis juridique) |
| E7 bis | GET | `/api/espace/discipline/:id/decision/pdf` (existante, resserrée) | inchangé (`espace.ts:473`) | 404 « Décision non disponible » tant que `dateNotification` est nul, en plus de `!d.decision` | `EspaceDiscipline.jsx:67-70` : bouton PDF conditionné à `dateNotification` |
| E6 | GET | `/api/auth/identite` (existante, publique) | sans objet (aucune donnée personnelle) | Ajouter au même niveau que `identite` : `modules: { masques }`, la seule liste des chemins masqués (déjà publique par nature, menu). Le test `identite-publique.test.ts:25` porte sur les clés de `body.identite` et reste vert. | `EspaceAvocatLayout.jsx:29-40` : filtrer `NAV` par `moduleMasque(to)` (`data/config.js`). Les chemins de l'espace (`/timbres`, `/messagerie`, `/annuaire`, `/assemblees`, `/elections`, `/publications`, `/archives`) coïncident avec ceux du back-office. `/`, `/documents` et `/discipline` restent toujours visibles (`MODULES_OBLIGATOIRES`). |

### Affichages sans route nouvelle (T13)

| Réf. | Page | Changement | Donnée déjà servie par |
|---|---|---|---|
| E3 | `MesTimbres.jsx:137` + `resources.js:301` | Ajouter `declarerTimbreUtilise = (id) => api(\`/espace/timbres/${id}/utilise\`, { method: "POST" })`. Badge à 3 états : Valide (vert), Déjà utilisé (gris), Annulé (rouge). Bouton « Déclarer utilisé » passé par `useConfirm` (action irréversible), masqué si le statut n'est pas VALIDE. | `espace.ts:213-224`, `GET /espace/timbres` (`t.statut`) |
| E4 | `MesDocuments.jsx:89-133` | Quitus : « Valable jusqu'au JJ/MM/AAAA » (`q.finValidite`), Badge « Expiré » si la date est passée, lien « Vérifier » (`q.verif`, `target=_blank`). Reçus : lien « Vérifier » (`r.verif`). Même motif que `MesTimbres.jsx:142`. | `espace.ts:267-271` |
| E5 | `EspaceScrutins.jsx:64` | Date du scrutin `formatDate(s.dateScrutin)` à côté du titre | `espace.ts:874` |

### Tests attendus

- **T12 (serveur)**, nouveau `server/test/espace-audit.test.ts` sur `barreau_pn_test`, qui vérifie que :
  - `GET /espace/parcours` ne renvoie que les événements du jeton ;
  - pour un jeton AVOCAT A et un événement de B, aucune fuite (la liste ne contient pas l'id) ;
  - aucun champ `acteurNom` ni `details` n'est renvoyé ;
  - `GET /espace/discipline/:id` ne renvoie pas `plaignant`, `rapporteur` ni `conclusionRapport`, et ne renvoie pas `decision` sans `dateNotification` ;
  - `decision/pdf` renvoie 404 sans notification ;
  - `discipline/:id` d'un autre membre renvoie 404 ;
  - `/auth/identite` contient `modules.masques`.
- **T13 (front)**, tests vitest des composants :
  - MaSituation : badge de statut, notice de mise en demeure, parcours ;
  - MesTimbres : badge « Déjà utilisé » et bouton « Déclarer utilisé » ;
  - MesDocuments : fin de validité et lien Vérifier ;
  - EspaceDiscipline : sursis, et notice si la décision n'est pas notifiée ;
  - EspaceAvocatLayout : un module masqué disparaît de la NAV.
- **Parcours e2e** en compte AVOCAT sur http://localhost:4100.

## 3. Justifications (manques non comblés)

- **J1. Radiation et décès.** Le compte est désactivé dès le changement de statut (`acces.ts:26-29`) et aucune session n'est rouverte (avis juridique, cycle-de-vie-avocats.md). L'espace ne doit donc rien proposer au radié ni au décédé. Les ayants droit et les attestations passent par le Secrétariat.
- **J2. Attestation de sortie.** Elle n'est délivrée qu'à un membre sorti (démissionnaire, retraité, cessation, radié), dont le compte est désactivé. Elle reste délivrée par le Secrétariat (`membres.ts:1118`), conformément à l'avis : pas de libre-service.
- **J3. Omission (décision).** Un avocat omis n'a plus de session (OMIS dans `STATUTS_BLOQUANTS`), si bien que la décision d'omission n'est jamais vue dans l'espace. Les étapes qui la précèdent le sont (E1). Après une réinscription, l'événement apparaît dans le parcours (E2), avec le seul code d'article pour la cause 35-1 (R-15, loi 29-2019 art. 14 et 17).
- **J4. Candidatures, refus motivé et suppression d'un scrutin.** Ce sont des actes de gestion du Secrétariat (`scrutins.ts:127`, `requireRole('SECRETAIRE_GENERAL')`). L'espace montre les candidats retenus et l'éligibilité au vote. Aucun dépôt de candidature en ligne n'a été livré (hors périmètre : nouvelle fonctionnalité).
- **J5. Anciens membres.** C'est un registre interne, consulté sous traçabilité. Il ne concerne pas l'avocat en exercice et ne doit pas rouvrir d'accès pour un sorti.
- **J6. Rapports et appréciations de stage.** Ce sont des évaluations du maître de stage et du Secrétariat (`membres.ts:933-940`, SG et Bâtonnier). Le droit d'accès (art. 43 à 46) plaide pour leur communication au stagiaire, mais leur affichage en libre-service relève d'un choix de l'Ordre. Ils sont donc mis à valider et non exposés par E2, qui ne donne que les dates et le maître de stage.
- **J7. Écran Paramètres.** C'est un réglage d'administration. L'avocat n'en reçoit que les effets : identité, mode démonstration, validité du quitus, modules masqués. Sa ligne dans la matrice RBAC est en lecture seule (eb617f4).

## 4. Points de sécurité relevés

- **Discipline sur-exposée (E7).** C'est le seul écart de confidentialité trouvé. La donnée appartient à l'avocat lui-même, il n'y a donc pas d'IDOR. Mais les éléments d'instruction (plaignant, rapporteur, conclusions, pièces) et les décisions non notifiées sont servis, ce que l'avis juridique exclut (HJ-M6).
- **Cloisonnement par identifiant vérifié, aucune fuite trouvée** : timbres `:203` et `:218` (403), paiement `:338`, reçus `:349`, quitus `:360`, discipline `:463` et `:473`, pièces `:533` et `:549`, messagerie `:681`, `:711` et `:826` (404 ou 403). Les assemblées et les publications (`:411-441`, `:596-603`) sont institutionnelles, non nominatives. Les archives filtrent sur `membreNom` et excluent les catégories disciplinaires (`:560-583`). Écart mineur noté pour T14 : l'appariement se fait par nom, donc deux homonymes verraient leurs archives respectives. Le corriger exigerait un `membreId` dans Archive, c'est-à-dire une migration, hors périmètre.

## 5. Mise à jour T13 : affichage des manques comblés (front)

Tous les manques « partiel » ou « non » des familles 1, 3, 7, 8, 9, 10, 12 et 13 passent à **oui**. Tests : `src/barreau/pages/__tests__/EspaceManques.test.jsx` (11 tests : donnée, état vide, erreur, mention d'accès). Aucun nouveau jeton, police ni dépendance.

| # | Famille | Présent (après T13) | Preuve |
|---|---|---|---|
| 1 | Cycle de vie | oui : badge de statut à côté de la qualité | `MaSituation.jsx:146`, `:156` |
| 3 | Parcours et stage | oui : cartes « Mon parcours » et « Mon stage » (`GET /espace/parcours`), états chargement, vide, erreur | `MaSituation.jsx:85-135`, `:188` |
| 7 | Timbre | oui : badge « Utilisé », bouton « Marquer utilisé » (`POST /espace/timbres/:id/utilise`) | `MesTimbres.jsx:142`, `:147` ; `resources.js:302` |
| 8 | Quitus et reçus | oui : « Valable jusqu'au », badge « Expiré », lien « Vérifier » | `MesDocuments.jsx:99-103`, `:130` |
| 9 | Cotisations et omission | oui : Notice du dernier acte de recouvrement tant que le solde est dû | `MaSituation.jsx:162` |
| 10 | Élections | oui : « Scrutin du JJ/MM/AAAA » | `EspaceScrutins.jsx:66` |
| 12 | Paramètres | oui : menu de l'espace filtré par les modules masqués (affichage seulement ; `/` et `/discipline` obligatoires) | `EspaceAvocatLayout.jsx:58`, `:100` |
| 13 | Discipline | oui : sursis, période, inéligibilité, organe, notification, recours ; avis d'attente et PDF masqué tant que non notifiée | `EspaceDiscipline.jsx:67-78` |
| 6 | Rejet motivé | mention d'accès ajoutée | `MesDocuments.jsx:192` ; constante `MENTION_ACCES_PERSONNEL` (`data/institutionnel.js`) |
