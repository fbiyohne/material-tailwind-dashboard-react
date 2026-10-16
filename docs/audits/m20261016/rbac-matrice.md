# Audit RBAC : matrice réelle et matrice attendue (M-20261016, tâches T8 et T9)

Date : 16/10/2026. Branche `feat/parametres-pdf-espace-avocat-droits` (base `ada3e30`). Base de test `barreau_pn_test` uniquement.
T8 n'a modifié aucun code de production. T9 a corrigé côté serveur les écarts permissifs E1 à E5, E7 et F1 (section 10). L'alignement du front revient à T10.

## 1. Méthode

- **Matrice réelle, côté serveur.** Elle est extraite de la pile Express (`app._router.stack`, Express 4.21) par `server/test/rbac-matrice.test.ts`. Un `vi.mock` du module `middleware/auth.js` étiquette chaque garde `requireRole(...)` et `requirePermission(...)` avec ses paramètres. Pour chaque route, le test évalue les gardes de routeur (`router.use`), puis celles de la route, puis `confinementAvocat` (app.ts:134), et le fait pour chaque rôle. Le module `lib/rbac.ts` fournit les valeurs par défaut (`DEFAUTS`, `ACTIONS_DEFAUT`) : la table `RolePermission` est ramenée à ces valeurs pendant le test, puis restaurée et vérifiée. Le tableau de l'annexe donne la garde de chaque route avec sa référence fichier:ligne.
- **Preuve HTTP.** Les requêtes sont envoyées par supertest, rôle par rôle, à chacune des 218 routes :
  - sans jeton, la réponse doit être 401 ;
  - pour un rôle non autorisé, elle doit être 403 ;
  - pour un rôle autorisé, sur les GET seulement, elle ne doit être ni 401 ni 403.
- **Écritures.** Une écriture n'est envoyée que si les gardes la refusent avant le gestionnaire : le refus intervient alors sans effet de bord. Il y a une seule exception, signalée sur sa ligne : un refus dans le gestionnaire, avant toute écriture (`membres.ts:801`). Les routes DELETE, `reinitialiser-donnees`, `tester/:canal`, les paiements et le webhook ne reçoivent **jamais** le jeton d'un rôle qui passe les gardes.
- **Test de couverture.** Il échoue si une route Express n'a pas de ligne dans la matrice, et inversement. Un second test échoue si un écart de garde apparaît sans être répertorié dans `ECARTS`. Une route ajoutée plus tard ne peut donc pas échapper à l'audit.
- **Front.** L'audit couvre le champ `perm` de `src/barreau/routes.jsx` et la fonction `aAcces` (l.137), les `Routes` de `layout/EspaceAvocatLayout.jsx` (l.178-190) et les boutons conditionnés par rôle (`peutGerer`, `estAdmin`…).
- **Comptes de test.** SG, BAT, TRES et ADMIN viennent du seed. SECRETAIRE_ADJOINT, CONSULTATION et ACCUEIL, ainsi qu'un AVOCAT et un AVOCAT de qualité STAGIAIRE, sont créés en `beforeAll` avec la marque « E2E T8 » et supprimés en `afterAll`. La suppression est vérifiée : il ne reste aucun compte `e2e-t8-*`.

Pour reproduire :

```
cd server && timeout 300 npx vitest run test/rbac-matrice.test.ts
# export JSON de la matrice réelle (base des tableaux de l'annexe) :
MATRICE_JSON=/chemin/matrice.json npx vitest run test/rbac-matrice.test.ts
```

Résultat T8 : 229 réussis, 55 en échec attendu, 1 ignoré, 4 `it.todo`.
Résultat après T9 (16/10/2026) : **245 tests réussis, 42 en échec attendu (`it.fails`, uniquement les écarts restrictifs à valider par Fabrice), 1 ignoré (export `MATRICE_JSON` en `runIf`), 0 `it.todo`**. Les 15 couples route × rôle corrigés sont prouvés en 403 par le bloc « RBAC T9 — écarts permissifs corrigés ». S'y ajoutent les 9 tests de `server/test/rbac-journal-refus.test.ts`.

## 2. Rôles et légende

| Abrév. | Rôle | Remarque |
|---|---|---|
| SG | SECRETAIRE_GENERAL | Accès complet aux modules, non modifiable (`ROLES_COMPLET`) ; actions R-42 limitées à la saisine et à l'admission directe |
| BAT | BATONNIER | Rôle éditable (`ROLES_MATRICE`) ; détient les actions de décision (discipline_decider, stage_valider, omission_prononcer) |
| TRES | TRESORIERE | Éditable ; modules finances et messagerie par défaut |
| ADM | ADMIN | Tout en code (`permissionsDeRole`) ; `requireRole` l'admet toujours |
| SA | SECRETAIRE_ADJOINT | Éditable ; absent du seed |
| CONS | CONSULTATION | Éditable ; lecture seule attendue |
| ACC | ACCUEIL | Éditable ; membres et documents par défaut |
| AV | AVOCAT | Hors matrice ; limité à `/api/espace` et `/api/auth` (confinementAvocat) |
| STAG | AVOCAT de qualité STAGIAIRE | Pas de rôle distinct (H6) : mêmes gardes que AV, restrictions métier dans les gestionnaires (éligibilité) |

Actions : **L** lecture, **C** création, **M** modification, **S** suppression ou annulation, **V** validation ou décision.
Dans les matrices condensées, une **majuscule** indique que l'action est permise sur toutes les routes du module, une minuscule sur une partie seulement, et « — » qu'aucune n'est permise.
Dans l'annexe, **A** signifie que la route est admise par les gardes, **-** qu'elle est refusée en 403, **A\*** qu'elle passe les gardes et que le refus éventuel se fait dans le gestionnaire. **!En** renvoie à l'écart n de la section 5.

## 3. Matrice attendue

Elle reprend l'hypothèse H7 du PM, corrigée par l'avis juridique, avec RolePermission qui fait foi pour l'accès aux modules des rôles éditables :

- ADMIN et SG ont tous les droits fonctionnels, **sauf le contenu des messages et des pièces, refusé à l'ADMIN** (secret professionnel : R-58, loi 026-92 art. 52 ; Creatic est sous-traitant au sens de la loi 29-2019, art. 63). Les suppressions de pièces probantes (membre, quitus, cotisation, dossier disciplinaire, timbre, utilisateur) et `reinitialiser-donnees` sont réservées à l'ADMIN, comme dans le code.
- Discipline et casier : les rôles TRESORIERE, ACCUEIL et CONSULTATION reçoivent 403 (R-62, loi 29-2019 art. 16 et 37). L'instruction (PATCH) relève des mêmes titulaires que la saisine (`discipline_saisir`). La décision et la réformation relèvent de `discipline_decider` (BAT, ADMIN).
- BATONNIER : lecture du périmètre de ses modules, validations (décisions, stage, radiation, statut des publications, publication des résultats de scrutin), règles de décision dans Paramètres. Pas de test des canaux techniques.
- TRESORIERE : écriture sur les finances (cotisations, reçus, quitus, timbres, paiements, droits).
- SECRETAIRE_ADJOINT : comme le SG sur ses modules, sans système (rbac, utilisateurs, paramètres techniques), sans suppressions et sans actions R-42.
- CONSULTATION : lecture seule de ses modules.
- ACCUEIL : lecture de ses modules et dépôt de pièces (H7).
- AVOCAT et STAGIAIRE : `/api/espace` seulement, cloisonné sur le `membreId` du jeton.
- Annuaire (`GET /api/membres`), tableau de bord (indicateurs filtrés), `GET /api/parametres` (vue filtrée), signatures et mes-notifications : ouverts à tout rôle interne. Le journal d'audit, y compris son extrait du tableau de bord, est réservé aux titulaires de `audit`.

La matrice attendue route par route est le tableau déclaratif `MATRICE` de `server/test/rbac-matrice.test.ts` ; elle figure aussi dans la colonne « Attendu » de l'annexe. Sa forme condensée :

| Module | SG | BAT | TRES | ADM | SA | CONS | ACC | AV | STAG |
|---|---|---|---|---|---|---|---|---|---|
| health | public | public | public | public | public | public | public | public | public |
| installation | public | public | public | public | public | public | public | public | public |
| auth | LM | LM | LM | LM | LM | LM | LM | LM | LM |
| membres | LCMsv | lV | lv | LCMSV | lCmv | l | lc | — | — |
| users | LCM | — | — | LCMS | — | — | — | — | — |
| demandes-acces | LV | — | — | LV | — | — | — | — | — |
| pieces | LSV | L | — | lSV | — | — | — | — | — |
| notifications | L | — | — | L | — | — | — | — | — |
| mes-notifications | LM | LM | LM | LM | LM | LM | LM | — | — |
| rbac | LM | — | — | LM | — | — | — | — | — |
| paiements | LCV | — | LCV | LCV | — | — | — | — | — |
| cotisations | LC | — | LCV | LCSV | — | — | — | — | — |
| recus | LS | — | LS | LS | — | — | — | — | — |
| quitus | LC | — | LC | LCS | — | — | — | — | — |
| droits | LC | — | LC | LCS | — | — | — | — | — |
| timbres | LC | — | LC | LCS | — | — | — | — | — |
| discipline | LCM | LCMV | — | LCMSV | L | — | — | — | — |
| reunions | LCMS | L | — | LCMS | LCM | — | — | — | — |
| assemblees | LCMS | L | — | LCMS | LCM | — | — | — | — |
| publications | LCMSV | LcV | — | LCMSV | LCM | L | L | — | — |
| archives | LCS | LC | — | LCS | LC | L | L | — | — |
| parametres | LM | Lm | L | LMS | L | L | L | — | — |
| corps-electoral | L | L | — | L | L | L | — | — | — |
| dashboard | L | L | l | L | L | L | l | — | — |
| audit | L | L | — | L | L | L | — | — | — |
| tableau | LV | L | — | LV | LV | L | L | — | — |
| scrutins | LCMSV | Lv | — | LCMSV | LCMV | — | — | — | — |
| signatures | L | L | L | L | L | L | L | — | — |
| conseil | LCMS | L | — | LCMS | LCM | — | — | — | — |
| cabinets | LCMS | L | — | LCMS | LCM | L | L | — | — |
| calendrier-editorial | LM | LM | — | LM | LM | L | L | — | — |
| espace | — | — | — | — | — | — | — | LCMSV | LCMSV |
| messagerie | LC | LC | LC | l | LC | — | — | — | — |
| verifier | public | public | public | public | public | public | public | public | public |

## 4. Matrice réelle (extraite du code, valeurs par défaut de RolePermission), état après T9

Les rôles éditables suivent les valeurs par défaut de RolePermission (`DEFAUTS` et `ACTIONS_DEFAUT`, lib/rbac.ts). En production, la table éditée dans « Rôles et sécurité » fait foi : il faut relancer le test sur une copie de la matrice de production pour la vérifier. Le détail par route, avec chaque garde en fichier:ligne, est en annexe (section 9).

| Module | SG | BAT | TRES | ADM | SA | CONS | ACC | AV | STAG |
|---|---|---|---|---|---|---|---|---|---|
| health | public | public | public | public | public | public | public | public | public |
| installation | public | public | public | public | public | public | public | public | public |
| auth | LM | LM | LM | LM | LM | LM | LM | LM | LM |
| membres | LCMsv | lV | lv | LCMSV | l | l | l | — | — |
| users | LCM | — | — | LCMS | — | — | — | — | — |
| demandes-acces | LV | — | — | LV | — | — | — | — | — |
| pieces | LSV | L | — | lSV | — | — | — | — | — |
| notifications | L | — | — | L | — | — | — | — | — |
| mes-notifications | LM | LM | LM | LM | LM | LM | LM | — | — |
| rbac | LM | — | — | LM | — | — | — | — | — |
| paiements | LCV | — | LCV | LCV | — | — | — | — | — |
| cotisations | LC | — | LCV | LCSV | — | — | — | — | — |
| recus | LS | — | LS | LS | — | — | — | — | — |
| quitus | LC | — | L | LCS | — | — | — | — | — |
| droits | LC | — | LC | LCS | — | — | — | — | — |
| timbres | LC | — | LC | LCS | — | — | — | — | — |
| discipline | LCM | LCMV | — | LCMSV | L | — | — | — | — |
| reunions | LCMS | L | — | LCMS | L | — | — | — | — |
| assemblees | LCMS | L | — | LCMS | L | — | — | — | — |
| publications | LCMSV | LcV | — | LCMSV | L | L | L | — | — |
| archives | LCS | LC | — | LCS | LC | L | L | — | — |
| parametres | LM | Lm | L | LMS | L | L | L | — | — |
| corps-electoral | L | L | — | L | L | L | — | — | — |
| dashboard | L | L | l | L | L | L | l | — | — |
| audit | L | L | — | L | L | L | — | — | — |
| tableau | LV | L | — | LV | L | L | L | — | — |
| scrutins | LCMSV | L | — | LCMSV | L | — | — | — | — |
| signatures | L | L | L | L | L | L | L | — | — |
| conseil | LCMS | L | — | LCMS | L | — | — | — | — |
| cabinets | LCMS | L | — | LCMS | L | L | L | — | — |
| calendrier-editorial | LM | LM | — | LM | LM | L | L | — | — |
| espace | — | — | — | — | — | — | — | LCMSV | LCMSV |
| messagerie | LC | LC | LC | l | LC | — | — | — | — |
| verifier | public | public | public | public | public | public | public | public | public |


## 5. Écarts (serveur)

On appelle **permissif** un écart où le serveur admet un rôle que la matrice attendue refuse : il est corrigé côté serveur (T9) avec un test 403. Un écart **restrictif** est l'inverse : le serveur refuse un rôle que la matrice attendue admet. Il n'est pas élargi (D17) : le front est aligné (T10) et l'élargissement est soumis à Fabrice.
Chaque écart correspond à un `it.fails` ou à un `it.todo` qui porte son numéro dans `rbac-matrice.test.ts`. Le jour où le correctif est appliqué, l'`it.fails` échoue : il faut alors retirer l'entrée de `ECARTS`.

| N° | Sens | Gravité | Route(s) | Rôle(s) | Constat et chemin d'attaque (preuve) | Correctif minimal proposé | Statut |
|---|---|---|---|---|---|---|---|
| E1 | permissif | **haute** | `GET /api/messagerie`, `GET /api/messagerie/:id`, `GET /api/messagerie/messages/:id/piece`, `GET /api/pieces/:id/fichier` | ADM | `requirePermission("messagerie")` (messagerie.ts:20) et `requireRole` (pieces.ts:54) admettent toujours l'ADMIN. Un jeton ADMIN lit le corps d'un fil avocat ↔ administration (test « E1 — l'ADMIN ne lit pas le corps d'un fil » : 200 avec le corps), l'aperçu de 140 caractères de la liste et les pièces jointes. Cela viole le secret professionnel (avis juridique, condition 1). Le GET de la liste pose en outre l'accusé de réception (messagerie.ts:60). | Refus explicite `if (req.user.role === "ADMIN") 403` sur ces 4 routes, ou garde `requireRole` qui n'admet pas l'ADMIN. `non-lus` et `accuse/pdf` (métadonnées) restent ouverts. Front : masquer le menu Messagerie à l'ADMIN. | **corrigé T9** : garde `refuserAdmin` (auth.ts:88) sur messagerie.ts:50, :93, :109 et pieces.ts:55 ; 403 prouvé sur un fil et une pièce réels |
| E2 | permissif | haute | `POST /api/messagerie`, `POST /api/messagerie/:id`, `POST /api/messagerie/:id/attestation` | ADM | Même cause : l'ADMIN écrit dans un fil confidentiel. Écriture non envoyée par le test (`it.todo`). | Même garde qu'E1. | **corrigé T9** : `refuserAdmin` sur messagerie.ts:153, :185, :218 ; 403 envoyé (refus avant le gestionnaire), aucun message ajouté |
| E3 | permissif | moyenne | `GET /api/dashboard/journal` | TRES, ACC | Le routeur n'a que `requireAuth` (dashboard.ts:9). Les 50 dernières lignes du journal d'audit (action, cible, acteur, date) sont lisibles sans la permission `audit`. Une ligne « Radiation » ou « Consultation du casier » révèle une donnée disciplinaire à l'ACCUEIL (R-62). Preuve : 200 pour TRES et ACC. | `requirePermission("audit")` sur la route (dashboard.ts:126). Front : ne pas appeler `getJournalAudit` sans `audit` (Dashboard.jsx:110 ; l'appel retombe déjà sur `[]` en cas d'erreur). | **corrigé T9** (dashboard.ts:128) ; front T10 |
| E4 | permissif | moyenne | `PATCH /api/discipline/:id` | SA | La route n'a que la garde de routeur `perm discipline` (discipline.ts:16). SA, qui a le module discipline par défaut mais pas `discipline_saisir`, modifie l'instruction d'un dossier (statut, plaignant, rapporteur, dates, conclusions), alors qu'il ne peut pas le saisir. Preuve : 404 sur un dossier inexistant, au lieu de 403 : le gestionnaire est atteint. | `requirePermission("discipline_saisir")` sur la route (discipline.ts:115). | **corrigé T9** (discipline.ts:117) |
| E5 | permissif | moyenne | `POST /api/archives`, `PATCH /api/calendrier-editorial/:mois` | CONS, ACC | Seule la permission `documents` est exigée (archives.ts:9, calendrierEditorial.ts:12) : les rôles en lecture seule créent des archives et modifient le calendrier de la Lettre. Preuve : 400 (validation) au lieu de 403. | `requireRole("SECRETAIRE_GENERAL", "SECRETAIRE_ADJOINT")` sur POST /archives (archives.ts:20) ; `requireRole("SECRETAIRE_GENERAL", "SECRETAIRE_ADJOINT", "BATONNIER")` sur PATCH /calendrier-editorial (l.34). Front : LettreBatonnier ne propose pas l'édition sans ces rôles. | **corrigé T9** : archives.ts:23 et calendrierEditorial.ts:36 en `requireRole(SG, SA, BAT)` ; front T10 |
| E6 | permissif | faible | `POST /api/archives` | BAT | Le Bâtonnier crée des archives ; H7 lui donne la lecture et les validations seulement. | Couvert par le correctif d'E5 si Fabrice confirme. | **reclassé T9 (non-écart)** : le Bâtonnier archive sa Lettre (LettreBatonnier.jsx:68, :88) et les convocations disciplinaires (DossierDetail.jsx:473). Le refuser casserait ce parcours (R4). La matrice attendue est corrigée : BAT admis sur `POST /api/archives`. À valider par Fabrice |
| E7 | permissif | faible | `POST /api/parametres/tester/:canal` | BAT | `requireRole(SG, BAT)` (parametres.ts:249) : le Bâtonnier déclenche la vérification SMTP avec le mot de passe déchiffré, alors que les sections smtp et passerelles relèvent de la permission `parametres` qu'il n'a pas. Aucun message n'est envoyé, aucun secret n'est renvoyé. Envoi non testé (route d'envoi, `it.todo`). | `requirePermission("parametres")` à la place de `requireRole(SG, BAT)`. | **corrigé T9** (parametres.ts:249) ; restriction nouvelle pour le Bâtonnier, à valider par Fabrice |
| E8 | restrictif | — | `GET /api/membres/:id`, `GET /api/membres/:id/rapports` | SA, CONS, ACC | `requireRole(SG, BAT)` (membres.ts:246, :934) alors que la matrice éditable leur donne `membres`. Le menu « Avocats inscrits » est visible, mais l'ouverture d'une fiche renvoie 403. | Ne pas élargir (RG-15 : la fiche porte adresse, naissance, RCCM, CNSS). Front : ne pas rendre la ligne cliquable sans SG, BAT ou ADM. | front T10 + à valider Fabrice |
| E9 | restrictif | — | 31 écritures de gestion réservées par `requireRole("SECRETAIRE_GENERAL")` (membres, réunions, assemblées, publications, tableau, scrutins, conseil, cabinets ; liste exacte dans `ECARTS.E9`), plus les deux GET d'attestation | SA | Le code réserve ces actes au SG ; H7 les donne aussi au SA. Preuve : 403 pour SA, avant le gestionnaire. | Aucun élargissement sans décision. Si Fabrice confirme : remplacer `requireRole("SECRETAIRE_GENERAL")` par `requireRole("SECRETAIRE_GENERAL", "SECRETAIRE_ADJOINT")` sur ces routes. | à valider Fabrice |
| E10 | restrictif | — | `POST /api/membres/:id/evenements` (sorties volontaires, reprise) | SA | Garde dans le gestionnaire : `role === "SECRETAIRE_GENERAL"` (membres.ts:800). | Comme E9. | à valider Fabrice |
| E11 | restrictif | — | `POST /api/membres/:id/pieces` | ACC | H7 donne le dépôt de pièces à l'ACCUEIL ; le code le réserve au SG (membres.ts:289). | À décider : un dépôt par l'accueil exposerait les pièces de casier à la saisie. | à valider Fabrice |
| E12 | restrictif | — | `POST /api/quitus`, `POST /api/quitus/lot` | TRES | Émission réservée au SG (quitus.ts:124, :140) ; H7 la donne à la Trésorière. | Possible séparation des tâches voulue (le SG signe le quitus). | à valider Fabrice |
| E13 | restrictif | — | `POST /api/scrutins/:id/publier` | BAT | Publication des résultats réservée au SG (scrutins.ts:192) ; H7 la donne au Bâtonnier. | À décider. | à valider Fabrice |

Aucun écart ne touche une écriture anonyme : toutes les routes non publiques renvoient 401 sans jeton (test « chaque route d'écriture non publique exige l'authentification »).

## 6. Constats hors matrice HTTP (gestionnaires et conception)

| N° | Gravité | Constat | Proposition | Statut |
|---|---|---|---|---|
| F1 | moyenne (conditionnelle) | **Escalade par la gestion des comptes.** `interdireEscaladeAdmin` (users.ts:25) ne protège que ADMIN et BATONNIER. Un rôle éditable qui recevrait la permission `utilisateurs` (par exemple SA, à qui le SG ou l'ADMIN l'aurait accordée dans « Rôles et sécurité ») peut créer ou promouvoir un compte SECRETAIRE_GENERAL, qui a tous les modules sans pouvoir être restreint. Le chemin d'attaque suppose que l'ADMIN ou le SG ait d'abord accordé `utilisateurs` ; il est inexploitable avec les valeurs par défaut. | Ajouter `SECRETAIRE_GENERAL` à `PROTEGES` pour tout acteur non SG ni ADMIN, ou exiger que l'acteur soit dans `ROLES_COMPLET` pour attribuer un rôle de `ROLES_COMPLET`. Test 403 associé. | **corrigé T9** (users.ts:31) : seuls l'ADMIN et le SG créent, promeuvent ou reprennent un compte SG ; test « F1 » |
| F2 | moyenne | **Détail disciplinaire servi en entier dans l'espace avocat.** `GET /api/espace/discipline` et `/discipline/:id` (espace.ts:447, :462) renvoient l'objet complet : rapporteur, `conclusionRapport`, `orientation`, plaignant, dates de rapport, y compris avant `dateNotification`. L'avis juridique (condition 4, HJ-M6) exclut les pièces d'instruction non notifiées. Le cloisonnement par membreId est correct : seul l'avocat concerné voit son dossier. | Projection minimale (référence, objet, statut, dates de convocation, d'audience et de notification, décision et sanction une fois notifiées). | T9/T10, à valider Fabrice (HJ-M6) |
| F3 | faible | `GET /api/espace/archives` rattache les documents nominatifs par `membreNom` (espace.ts:574). Deux confrères homonymes verraient chacun les archives de l'autre. | Rattacher par identifiant (champ `membreId` sur Archive) lors d'une évolution du modèle. Migration additive, hors périmètre T8. | à valider Fabrice |
| F4 | info | `confinementAvocat` refuse aussi à un jeton AVOCAT les routes publiques hors `/api/espace` et `/api/auth` (`/api/health`, `/api/verifier/*`, `/api/installation/etat`). C'est un refus par défaut, sans risque ; la page `/v/...` n'est pas concernée. | Aucune. | — |
| F5 | info | Lectures disciplinaires journalisées : `GET /api/discipline/:id` et ses PDF (audit.ts:31), la consultation du casier (discipline.ts:29). La liste complète `GET /api/discipline` et `GET /discipline/journal` ne le sont pas. | Ajouter ces deux chemins à `LECTURES_SENSIBLES` si l'obligation « toute lecture d'un dossier disciplinaire » doit couvrir la liste. | **corrigé T9** (audit.ts:31) : la liste et le journal disciplinaires sont désormais journalisés |
| F6 | à valider | SA a le module `discipline` par défaut (`DEFAUTS`, rbac.ts) ; l'avis juridique ne nomme que le Bâtonnier et le SG. L'ADMIN (sous-traitant technique) lit aussi les dossiers disciplinaires. La matrice attendue suit RolePermission pour SA et le code pour l'ADMIN ; seul le contenu des messages et des pièces est retiré à l'ADMIN (E1). | Décision de Fabrice : retirer `discipline` des défauts du SA et/ou refuser la lecture disciplinaire à l'ADMIN. | à valider Fabrice |
| F7 | info | `DELETE /api/recus/:id` est une **annulation** motivée (statut ANNULE, recus.ts:60), ouverte à TRES, SG et ADMIN. Le numéro et les données du reçu restent intacts (AUDCIF). Ce n'est pas un écart. | Aucune. | — |
| F8 | info | `GET /api/messagerie` pose un accusé de réception (messagerie.ts:60) : un GET avec effet de bord. Ce n'est pas exploitable en CSRF (jeton Bearer, pas de cookie). | Aucune. | — |

## 7. Front (menus, routes, boutons)

- `aAcces` (routes.jsx:137) : ADMIN et SG voient tout. Les autres rôles voient un item s'il porte une `perm` qu'ils détiennent. Les items sans `perm` (Tableau de bord, Annuaire) sont visibles par tous les internes. Le front ne fait que refléter les permissions : chaque refus est tenu par le serveur, comme le prouvent les 403 ci-dessus.
- Espace avocat : `EspaceAvocatLayout.jsx:178-190` déclare 11 routes. Chacune n'appelle que `/api/espace/*`, et le confinement serveur (app.ts:134) refuse tout le reste à un jeton AVOCAT, que ce soit sur le menu ou sur l'URL.
- Désalignements à traiter en T10 : le serveur refuse déjà l'action, seul l'affichage est trompeur.
  1. « Vérification des pièces » (`perm: "membres"`, routes.jsx:87) est visible pour SA, CONS et ACC, alors que `GET /api/pieces` est réservé à SG et BAT (pieces.ts:36) : page en 403. Proposition : `roles: ["SECRETAIRE_GENERAL", "BATONNIER"]` sur l'item.
  2. « Avocats inscrits » : la fiche (`/avocats/:id`) renvoie 403 pour SA, CONS et ACC (E8). Proposition : ligne non cliquable sans SG, BAT ou ADM.
  3. Tableau de bord : le widget journal appelle `/dashboard/journal` pour tous (Dashboard.jsx:110). Il faut le masquer sans `audit` (E3).
  4. Messagerie : l'item est visible pour l'ADMIN. Il faut le masquer après E1.
  5. Lettre du Bâtonnier : l'édition du calendrier (`PATCH /calendrier-editorial`, appelée depuis LettreBatonnier.jsx) est proposée à CONS et ACC. Il faut la masquer après E5.
- Les boutons de gestion (`peutGerer = SG || ADMIN` dans Archives, Assemblées, Cabinets, Conseil, Élections, Pièces, Publications ; `peutValider` dans Cotisations et PublicationDetail ; `peutDecider` dans DossierDetail via `discipline_decider`) sont cohérents avec les gardes serveur. Ils masquent aussi les actions au SA, ce qui est cohérent avec E9 tant que Fabrice n'a pas tranché.

## 8. Cloisonnement de l'espace avocat (IDOR)

Le test crée trois membres E2E : A, l'avocat connecté ; S, un stagiaire ; B, la victime. B reçoit un reçu, un quitus, un timbre, une pièce, un dossier disciplinaire, un fil de messagerie avec un message, et une archive nominative. Aucun accès de A aux objets de B n'aboutit :

| Famille | Route | Résultat avec l'id de B | Contrôle (code) |
|---|---|---|---|
| reçu | `GET /api/espace/recus/:id/pdf` | 404 | espace.ts:349 |
| quitus | `GET /api/espace/quitus/:id/pdf` | 404 | espace.ts:360 |
| timbre | `POST /api/espace/timbres/:id/usage`, `/utilise` | 403, statut inchangé | espace.ts:203, :218 |
| pièce | `GET /api/espace/pieces/:id/fichier` 404 ; `DELETE /api/espace/pieces/:id` non envoyé (D15), contrôle d'objet par le code | 404 en lecture | espace.ts:533, :549 |
| document disciplinaire | `GET /api/espace/discipline/:id`, `/decision/pdf` | 404 (son propre dossier : 200) | espace.ts:463, :473 |
| message | `GET /api/espace/messagerie/:id`, `POST /api/espace/messagerie/:id`, pièce jointe, accusé | 404 / 404 / 403 / 403, aucun message ajouté, corps non divulgué | espace.ts:675-684, :709, :826 |
| document (archives) | `GET /api/espace/archives` | archive de B absente, celle de A présente | espace.ts:571-575 (voir F3) |
| scrutin | `POST /api/espace/scrutins/:id/voter` avec `membreId` de B dans le corps | 404 ; aucun émargement pour B (l'émargement est lié au jeton) | espace.ts:895, :921 |
| paiement | `POST /api/espace/paiement/:ref/confirmer-sandbox` | non envoyé (route de paiement, D15) ; contrôle `p.membreId !== monMembreId` → 404 | espace.ts:338 |
| stagiaire | `GET /api/espace/moi` 200 ; dossier de A 404 ; `GET /api/membres` 403 | même confinement que l'avocat | auth.ts (middleware) `requireAvocat`, `confinementAvocat` |

Toutes les routes `/api/espace/*` refusent les rôles internes, ADMIN compris (`requireAvocat`, espace.ts:31 ; 403 prouvé par la matrice).

## 9. Annexe : matrice réelle détaillée (route × rôle, gardes avec fichier:ligne)

La colonne « Gardes » liste la garde de routeur (`router.use`) puis celle de la route. « déclarée f:l » signifie que la route n'a pas de garde propre, ou seulement `requireAuth` en ligne (auth.ts). « confinementAvocat » s'applique à toute route `/api` hors `/api/espace` et `/api/auth`.

| Route | Act. | Gardes serveur (fichier:ligne) | Attendu | SG | BAT | TRES | ADM | SA | CONS | ACC | AV | STAG |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `GET /api/health` | L | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `GET /api/installation/etat` | L | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `POST /api/installation` | C | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `POST /api/installation/test-email` | C | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `GET /api/auth/identite` | L | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `POST /api/auth/login` | C | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `POST /api/auth/demande-acces` | C | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `GET /api/auth/activation/:token` | L | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `POST /api/auth/activer` | M | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `POST /api/auth/forgot-password` | C | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `GET /api/auth/reset/:token` | L | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `POST /api/auth/reset` | M | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `POST /api/auth/refresh` | C | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `POST /api/auth/logout` | S | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `GET /api/auth/me` | L | déclarée auth.ts:238 | SG, BAT, TRES, ADM, SA, CONS, ACC, AV, STAG | A | A | A | A | A | A | A | A | A |
| `POST /api/auth/password` | M | déclarée auth.ts:254 | SG, BAT, TRES, ADM, SA, CONS, ACC, AV, STAG | A | A | A | A | A | A | A | A | A |
| `GET /api/membres` | L | auth (membres.ts:20) ; déclarée membres.ts:100 ; confinementAvocat (app.ts:134) | SG, BAT, TRES, ADM, SA, CONS, ACC | A | A | A | A | A | A | A | - | - |
| `GET /api/membres/export/pdf` | L | auth (membres.ts:20) ; perm membres (membres.ts:180) ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA, CONS, ACC | A | A | - | A | A | A | A | - | - |
| `POST /api/membres/export` | L | auth (membres.ts:20) ; perm membres (membres.ts:231) ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA, CONS, ACC | A | A | - | A | A | A | A | - | - |
| `GET /api/membres/:id` | L | auth (membres.ts:20) ; role SG, BAT (membres.ts:246) ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA, CONS, ACC | A | A | - | A | **-!E8** | **-!E8** | **-!E8** | - | - |
| `GET /api/membres/:id/pieces` | L | auth (membres.ts:20) ; role SG, BAT (membres.ts:280) ; confinementAvocat (app.ts:134) | SG, BAT, ADM | A | A | - | A | - | - | - | - | - |
| `POST /api/membres/:id/pieces` | C | auth (membres.ts:20) ; role SG (membres.ts:289) ; confinementAvocat (app.ts:134) | SG, ADM, SA, ACC | A | - | - | A | **-!E9** | - | **-!E11** | - | - |
| `POST /api/membres` | C | auth (membres.ts:20) ; role SG (membres.ts:348) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `POST /api/membres/import` | C | auth (membres.ts:20) ; role SG (membres.ts:445) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `PATCH /api/membres/:id` | M | auth (membres.ts:20) ; role SG (membres.ts:609) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `POST /api/membres/:id/radier` | V | auth (membres.ts:20) ; perm discipline_decider (membres.ts:692) ; confinementAvocat (app.ts:134) | BAT, ADM | - | A | - | A | - | - | - | - | - |
| `POST /api/membres/:id/deces` | M | auth (membres.ts:20) ; role SG (membres.ts:730) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `GET /api/membres/:id/evenements` | L | auth (membres.ts:20) ; role SG, BAT (membres.ts:768) ; confinementAvocat (app.ts:134) | SG, BAT, ADM | A | A | - | A | - | - | - | - | - |
| `POST /api/membres/:id/evenements` | V | auth (membres.ts:20) ; déclarée membres.ts:788 ; confinementAvocat (app.ts:134) ; gestionnaire membres.ts:801 | SG, ADM, BAT, TRES, SA | A* | A* | A* | A* | **A*!E10** | A* | A* | - | - |
| `POST /api/membres/admission-directe` | V | auth (membres.ts:20) ; perm admission_directe (membres.ts:888) ; confinementAvocat (app.ts:134) | SG, BAT, ADM | A | A | - | A | - | - | - | - | - |
| `GET /api/membres/:id/rapports` | L | auth (membres.ts:20) ; role SG, BAT (membres.ts:934) ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA, CONS, ACC | A | A | - | A | **-!E8** | **-!E8** | **-!E8** | - | - |
| `POST /api/membres/:id/rapports` | C | auth (membres.ts:20) ; role SG (membres.ts:943) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `DELETE /api/membres/:id/rapports/:rid` | S | auth (membres.ts:20) ; role SG (membres.ts:958) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `POST /api/membres/:id/valider-stage` | V | auth (membres.ts:20) ; perm stage_valider (membres.ts:985) ; confinementAvocat (app.ts:134) | BAT, ADM | - | A | - | A | - | - | - | - | - |
| `DELETE /api/membres/:id` | S | auth (membres.ts:20) ; role ADMIN (membres.ts:1031) ; confinementAvocat (app.ts:134) | ADM | - | - | - | A | - | - | - | - | - |
| `POST /api/membres/:id/acces` | M | auth (membres.ts:20) ; role SG (membres.ts:1069) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `POST /api/membres/:id/attestation` | C | auth (membres.ts:20) ; role SG (membres.ts:1079) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `GET /api/membres/:id/attestation/pdf` | L | auth (membres.ts:20) ; role SG (membres.ts:1100) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `GET /api/membres/:id/attestation-sortie/pdf` | L | auth (membres.ts:20) ; role SG (membres.ts:1119) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `GET /api/users` | L | auth, perm(utilisateurs) (users.ts:15) ; déclarée users.ts:33 ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `POST /api/users` | C | auth, perm(utilisateurs) (users.ts:15) ; déclarée users.ts:47 ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `PATCH /api/users/:id` | M | auth, perm(utilisateurs) (users.ts:15) ; déclarée users.ts:71 ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `DELETE /api/users/:id` | S | auth, perm(utilisateurs) (users.ts:15) ; role ADMIN (users.ts:105) ; confinementAvocat (app.ts:134) | ADM | - | - | - | A | - | - | - | - | - |
| `POST /api/users/:id/password` | M | auth, perm(utilisateurs) (users.ts:15) ; déclarée users.ts:122 ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `GET /api/demandes-acces` | L | auth, perm(utilisateurs) (demandesAcces.ts:20) ; déclarée demandesAcces.ts:22 ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `POST /api/demandes-acces/:id/approuver` | V | auth, perm(utilisateurs) (demandesAcces.ts:20) ; déclarée demandesAcces.ts:48 ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `POST /api/demandes-acces/:id/approuver-espace` | V | auth, perm(utilisateurs) (demandesAcces.ts:20) ; déclarée demandesAcces.ts:59 ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `POST /api/demandes-acces/:id/refuser` | V | auth, perm(utilisateurs) (demandesAcces.ts:20) ; déclarée demandesAcces.ts:103 ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `GET /api/pieces` | L | auth (pieces.ts:15) ; role SG, BAT (pieces.ts:36) ; confinementAvocat (app.ts:134) | SG, BAT, ADM | A | A | - | A | - | - | - | - | - |
| `GET /api/pieces/:id/fichier` | L | auth (pieces.ts:15) ; role SG, BAT (pieces.ts:54) ; sansAdmin (pieces.ts:55) ; confinementAvocat (app.ts:134) | SG, BAT | A | A | - | - | - | - | - | - | - |
| `POST /api/pieces/:id/verifier` | V | auth (pieces.ts:15) ; role SG (pieces.ts:85) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `POST /api/pieces/:id/rejeter` | V | auth (pieces.ts:15) ; role SG (pieces.ts:100) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `DELETE /api/pieces/:id` | S | auth (pieces.ts:15) ; role SG (pieces.ts:116) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `GET /api/notifications` | L | auth, perm(parametres) (notifications.ts:13) ; déclarée notifications.ts:15 ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `GET /api/mes-notifications` | L | auth (mesNotifications.ts:12) ; déclarée mesNotifications.ts:15 ; confinementAvocat (app.ts:134) | SG, BAT, TRES, ADM, SA, CONS, ACC | A | A | A | A | A | A | A | - | - |
| `POST /api/mes-notifications/lu-tout` | M | auth (mesNotifications.ts:12) ; déclarée mesNotifications.ts:25 ; confinementAvocat (app.ts:134) | SG, BAT, TRES, ADM, SA, CONS, ACC | A | A | A | A | A | A | A | - | - |
| `POST /api/mes-notifications/:id/lu` | M | auth (mesNotifications.ts:12) ; déclarée mesNotifications.ts:34 ; confinementAvocat (app.ts:134) | SG, BAT, TRES, ADM, SA, CONS, ACC | A | A | A | A | A | A | A | - | - |
| `GET /api/rbac` | L | auth, role(SECRETAIRE_GENERAL, ADMIN) (rbac.ts:18) ; déclarée rbac.ts:21 ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `PUT /api/rbac` | M | auth, role(SECRETAIRE_GENERAL, ADMIN) (rbac.ts:18) ; déclarée rbac.ts:45 ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `POST /api/paiements/webhook` | V | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `POST /api/paiements/initier` | C | auth, perm(finances) (paiements.ts:40) ; déclarée paiements.ts:51 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `GET /api/paiements/:ref` | L | auth, perm(finances) (paiements.ts:40) ; déclarée paiements.ts:67 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `POST /api/paiements/:ref/confirmer-sandbox` | V | auth, perm(finances) (paiements.ts:40) ; déclarée paiements.ts:79 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `POST /api/cotisations/relances` | C | auth, perm(finances) (cotisations.ts:14) ; role SG, TRES (cotisations.ts:19) ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `GET /api/cotisations` | L | auth, perm(finances) (cotisations.ts:14) ; déclarée cotisations.ts:59 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `POST /api/cotisations/generer` | C | auth, perm(finances) (cotisations.ts:14) ; role SG, TRES (cotisations.ts:99) ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `POST /api/cotisations/paiement` | C | auth, perm(finances) (cotisations.ts:14) ; role SG, TRES (cotisations.ts:134) ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `DELETE /api/cotisations/:membreId/:annee` | S | auth, perm(finances) (cotisations.ts:14) ; role ADMIN (cotisations.ts:156) ; confinementAvocat (app.ts:134) | ADM | - | - | - | A | - | - | - | - | - |
| `POST /api/cotisations/:membreId/valider` | V | auth, perm(finances) (cotisations.ts:14) ; role TRES (cotisations.ts:172) ; confinementAvocat (app.ts:134) | TRES, ADM | - | - | A | A | - | - | - | - | - |
| `GET /api/recus/:id/pdf` | L | auth, perm(finances) (recus.ts:12) ; déclarée recus.ts:15 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `GET /api/recus` | L | auth, perm(finances) (recus.ts:12) ; déclarée recus.ts:27 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `DELETE /api/recus/:id` | S | auth, perm(finances) (recus.ts:12) ; déclarée recus.ts:48 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `GET /api/quitus/:id/pdf` | L | auth, perm(finances) (quitus.ts:31) ; déclarée quitus.ts:34 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `GET /api/quitus/eligibles` | L | auth, perm(finances) (quitus.ts:31) ; déclarée quitus.ts:45 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `GET /api/quitus/:id/signature` | L | auth, perm(finances) (quitus.ts:31) ; déclarée quitus.ts:58 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `GET /api/quitus` | L | auth, perm(finances) (quitus.ts:31) ; déclarée quitus.ts:69 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `POST /api/quitus` | C | auth, perm(finances) (quitus.ts:31) ; role SG (quitus.ts:124) ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | **-!E12** | A | - | - | - | - | - |
| `POST /api/quitus/lot` | C | auth, perm(finances) (quitus.ts:31) ; role SG (quitus.ts:140) ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | **-!E12** | A | - | - | - | - | - |
| `DELETE /api/quitus/:id` | S | auth, perm(finances) (quitus.ts:31) ; role ADMIN (quitus.ts:174) ; confinementAvocat (app.ts:134) | ADM | - | - | - | A | - | - | - | - | - |
| `POST /api/droits/relances` | C | auth, perm(finances) (droits.ts:14) ; role SG, TRES (droits.ts:19) ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `GET /api/droits` | L | auth, perm(finances) (droits.ts:14) ; déclarée droits.ts:61 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `POST /api/droits/paiement` | C | auth, perm(finances) (droits.ts:14) ; role SG, TRES (droits.ts:114) ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `DELETE /api/droits/:membreId/:annee` | S | auth, perm(finances) (droits.ts:14) ; role ADMIN (droits.ts:136) ; confinementAvocat (app.ts:134) | ADM | - | - | - | A | - | - | - | - | - |
| `POST /api/timbres` | C | auth, perm(finances) (timbres.ts:20) ; déclarée timbres.ts:32 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `POST /api/timbres/externes` | C | auth, perm(finances) (timbres.ts:20) ; déclarée timbres.ts:59 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `GET /api/timbres/stats` | L | auth, perm(finances) (timbres.ts:20) ; déclarée timbres.ts:73 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `GET /api/timbres` | L | auth, perm(finances) (timbres.ts:20) ; déclarée timbres.ts:93 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `GET /api/timbres/:id` | L | auth, perm(finances) (timbres.ts:20) ; déclarée timbres.ts:105 ; confinementAvocat (app.ts:134) | SG, ADM, TRES | A | - | A | A | - | - | - | - | - |
| `POST /api/timbres/:id/annuler` | S | auth, perm(finances) (timbres.ts:20) ; role ADMIN (timbres.ts:120) ; confinementAvocat (app.ts:134) | ADM | - | - | - | A | - | - | - | - | - |
| `GET /api/discipline` | L | auth, perm(discipline) (discipline.ts:16) ; déclarée discipline.ts:21 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `GET /api/discipline/journal` | L | auth, perm(discipline) (discipline.ts:16) ; déclarée discipline.ts:40 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `GET /api/discipline/:id` | L | auth, perm(discipline) (discipline.ts:16) ; déclarée discipline.ts:47 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `POST /api/discipline` | C | auth, perm(discipline) (discipline.ts:16) ; perm discipline_saisir (discipline.ts:69) ; confinementAvocat (app.ts:134) | SG, BAT, ADM | A | A | - | A | - | - | - | - | - |
| `PATCH /api/discipline/:id` | M | auth, perm(discipline) (discipline.ts:16) ; perm discipline_saisir (discipline.ts:117) ; confinementAvocat (app.ts:134) | SG, BAT, ADM | A | A | - | A | - | - | - | - | - |
| `POST /api/discipline/:id/decision` | V | auth, perm(discipline) (discipline.ts:16) ; perm discipline_decider (discipline.ts:180) ; confinementAvocat (app.ts:134) | BAT, ADM | - | A | - | A | - | - | - | - | - |
| `POST /api/discipline/:id/reformation` | V | auth, perm(discipline) (discipline.ts:16) ; perm discipline_decider (discipline.ts:264) ; confinementAvocat (app.ts:134) | BAT, ADM | - | A | - | A | - | - | - | - | - |
| `DELETE /api/discipline/:id` | S | auth, perm(discipline) (discipline.ts:16) ; role ADMIN (discipline.ts:307) ; confinementAvocat (app.ts:134) | ADM | - | - | - | A | - | - | - | - | - |
| `GET /api/discipline/:id/convocation/pdf` | L | auth, perm(discipline) (discipline.ts:16) ; déclarée discipline.ts:319 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `GET /api/discipline/:id/decision/pdf` | L | auth, perm(discipline) (discipline.ts:16) ; déclarée discipline.ts:331 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `GET /api/reunions/:id/convocation/pdf` | L | auth, perm(reunions_assemblees) (reunions.ts:15) ; déclarée reunions.ts:18 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `POST /api/reunions/:id/convoquer` | C | auth, perm(reunions_assemblees) (reunions.ts:15) ; role SG (reunions.ts:27) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `GET /api/reunions/:id/feuille-presence/pdf` | L | auth, perm(reunions_assemblees) (reunions.ts:15) ; déclarée reunions.ts:50 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `GET /api/reunions/:id/pv/pdf` | L | auth, perm(reunions_assemblees) (reunions.ts:15) ; déclarée reunions.ts:57 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `GET /api/reunions` | L | auth, perm(reunions_assemblees) (reunions.ts:15) ; déclarée reunions.ts:65 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `GET /api/reunions/:id` | L | auth, perm(reunions_assemblees) (reunions.ts:15) ; déclarée reunions.ts:69 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `POST /api/reunions` | C | auth, perm(reunions_assemblees) (reunions.ts:15) ; role SG (reunions.ts:82) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `PATCH /api/reunions/:id` | M | auth, perm(reunions_assemblees) (reunions.ts:15) ; role SG (reunions.ts:97) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `DELETE /api/reunions/:id` | S | auth, perm(reunions_assemblees) (reunions.ts:15) ; role SG (reunions.ts:104) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `GET /api/assemblees/:id/convocation/pdf` | L | auth, perm(reunions_assemblees) (assemblees.ts:17) ; déclarée assemblees.ts:20 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `POST /api/assemblees/:id/convoquer` | C | auth, perm(reunions_assemblees) (assemblees.ts:17) ; role SG (assemblees.ts:29) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `GET /api/assemblees/:id/pv/pdf` | L | auth, perm(reunions_assemblees) (assemblees.ts:17) ; déclarée assemblees.ts:52 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `GET /api/assemblees` | L | auth, perm(reunions_assemblees) (assemblees.ts:17) ; déclarée assemblees.ts:60 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `GET /api/assemblees/:id` | L | auth, perm(reunions_assemblees) (assemblees.ts:17) ; déclarée assemblees.ts:64 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `POST /api/assemblees` | C | auth, perm(reunions_assemblees) (assemblees.ts:17) ; role SG (assemblees.ts:77) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `PATCH /api/assemblees/:id` | M | auth, perm(reunions_assemblees) (assemblees.ts:17) ; role SG (assemblees.ts:92) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `DELETE /api/assemblees/:id` | S | auth, perm(reunions_assemblees) (assemblees.ts:17) ; role SG (assemblees.ts:99) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `POST /api/publications/lettre/generer` | C | auth, perm(documents) (publications.ts:11) ; role SG, BAT (publications.ts:17) ; confinementAvocat (app.ts:134) | SG, BAT, ADM, SA | A | A | - | A | **-!E9** | - | - | - | - |
| `GET /api/publications` | L | auth, perm(documents) (publications.ts:11) ; déclarée publications.ts:25 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA, CONS, ACC | A | A | - | A | A | A | A | - | - |
| `GET /api/publications/:id` | L | auth, perm(documents) (publications.ts:11) ; déclarée publications.ts:29 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA, CONS, ACC | A | A | - | A | A | A | A | - | - |
| `POST /api/publications` | C | auth, perm(documents) (publications.ts:11) ; role SG (publications.ts:37) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `PATCH /api/publications/:id` | M | auth, perm(documents) (publications.ts:11) ; role SG (publications.ts:43) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `POST /api/publications/:id/statut` | V | auth, perm(documents) (publications.ts:11) ; role SG, BAT (publications.ts:52) ; confinementAvocat (app.ts:134) | SG, BAT, ADM | A | A | - | A | - | - | - | - | - |
| `DELETE /api/publications/:id` | S | auth, perm(documents) (publications.ts:11) ; role SG (publications.ts:70) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `POST /api/archives` | C | auth, perm(documents) (archives.ts:9) ; role SG, SA, BAT (archives.ts:23) ; confinementAvocat (app.ts:134) | SG, ADM, SA, BAT | A | A | - | A | A | - | - | - | - |
| `GET /api/archives` | L | auth, perm(documents) (archives.ts:9) ; déclarée archives.ts:32 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA, CONS, ACC | A | A | - | A | A | A | A | - | - |
| `DELETE /api/archives/:id` | S | auth, perm(documents) (archives.ts:9) ; role SG (archives.ts:56) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `GET /api/parametres` | L | auth (parametres.ts:19) ; déclarée parametres.ts:83 ; confinementAvocat (app.ts:134) | SG, BAT, TRES, ADM, SA, CONS, ACC | A | A | A | A | A | A | A | - | - |
| `PUT /api/parametres` | M | auth (parametres.ts:19) ; role SG, BAT (parametres.ts:173) ; confinementAvocat (app.ts:134) | SG, BAT, ADM | A | A | - | A | - | - | - | - | - |
| `POST /api/parametres/tester/:canal` | M | auth (parametres.ts:19) ; perm parametres (parametres.ts:249) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `POST /api/parametres/reinitialiser-donnees` | S | auth (parametres.ts:19) ; role ADMIN (parametres.ts:291) ; confinementAvocat (app.ts:134) | ADM | - | - | - | A | - | - | - | - | - |
| `GET /api/corps-electoral` | L | auth, perm(corps_electoral) (corpsElectoral.ts:11) ; déclarée corpsElectoral.ts:19 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA, CONS | A | A | - | A | A | A | - | - | - |
| `GET /api/dashboard` | L | auth (dashboard.ts:9) ; déclarée dashboard.ts:12 ; confinementAvocat (app.ts:134) | SG, BAT, TRES, ADM, SA, CONS, ACC | A | A | A | A | A | A | A | - | - |
| `GET /api/dashboard/agenda` | L | auth (dashboard.ts:9) ; déclarée dashboard.ts:106 ; confinementAvocat (app.ts:134) | SG, BAT, TRES, ADM, SA, CONS, ACC | A | A | A | A | A | A | A | - | - |
| `GET /api/dashboard/journal` | L | auth (dashboard.ts:9) ; perm audit (dashboard.ts:128) ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA, CONS | A | A | - | A | A | A | - | - | - |
| `GET /api/audit` | L | auth, perm(audit) (audit.ts:12) ; déclarée audit.ts:20 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA, CONS | A | A | - | A | A | A | - | - | - |
| `GET /api/tableau` | L | auth, perm(membres) (tableau.ts:15) ; déclarée tableau.ts:36 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA, CONS, ACC | A | A | - | A | A | A | A | - | - |
| `GET /api/tableau/pdf` | L | auth, perm(membres) (tableau.ts:15) ; déclarée tableau.ts:81 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA, CONS, ACC | A | A | - | A | A | A | A | - | - |
| `POST /api/tableau/publier` | V | auth, perm(membres) (tableau.ts:15) ; role SG (tableau.ts:92) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `GET /api/scrutins` | L | auth, perm(elections) (scrutins.ts:19) ; déclarée scrutins.ts:42 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `GET /api/scrutins/:id` | L | auth, perm(elections) (scrutins.ts:19) ; déclarée scrutins.ts:47 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `POST /api/scrutins` | C | auth, perm(elections) (scrutins.ts:19) ; role SG (scrutins.ts:63) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `PATCH /api/scrutins/:id` | M | auth, perm(elections) (scrutins.ts:19) ; role SG (scrutins.ts:74) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `DELETE /api/scrutins/:id` | S | auth, perm(elections) (scrutins.ts:19) ; role SG (scrutins.ts:89) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `GET /api/scrutins/:id/pv/pdf` | L | auth, perm(elections) (scrutins.ts:19) ; déclarée scrutins.ts:106 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `POST /api/scrutins/:id/candidats` | C | auth, perm(elections) (scrutins.ts:19) ; role SG (scrutins.ts:127) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `DELETE /api/scrutins/:id/candidats/:cid` | S | auth, perm(elections) (scrutins.ts:19) ; role SG (scrutins.ts:148) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `POST /api/scrutins/:id/ouvrir` | V | auth, perm(elections) (scrutins.ts:19) ; role SG (scrutins.ts:157) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `POST /api/scrutins/:id/voix` | M | auth, perm(elections) (scrutins.ts:19) ; role SG (scrutins.ts:169) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `POST /api/scrutins/:id/clore` | V | auth, perm(elections) (scrutins.ts:19) ; role SG (scrutins.ts:181) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `POST /api/scrutins/:id/publier` | V | auth, perm(elections) (scrutins.ts:19) ; role SG (scrutins.ts:192) ; confinementAvocat (app.ts:134) | SG, ADM, SA, BAT | A | **-!E13** | - | A | **-!E9** | - | - | - | - |
| `GET /api/signatures/cle-publique` | L | auth (signatures.ts:8) ; déclarée signatures.ts:11 ; confinementAvocat (app.ts:134) | SG, BAT, TRES, ADM, SA, CONS, ACC | A | A | A | A | A | A | A | - | - |
| `POST /api/signatures/verifier` | L | auth (signatures.ts:8) ; déclarée signatures.ts:18 ; confinementAvocat (app.ts:134) | SG, BAT, TRES, ADM, SA, CONS, ACC | A | A | A | A | A | A | A | - | - |
| `GET /api/conseil` | L | auth, perm(elections) (conseil.ts:13) ; déclarée conseil.ts:20 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA | A | A | - | A | A | - | - | - | - |
| `POST /api/conseil` | C | auth, perm(elections) (conseil.ts:13) ; role SG (conseil.ts:58) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `PATCH /api/conseil/:id` | M | auth, perm(elections) (conseil.ts:13) ; role SG (conseil.ts:77) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `DELETE /api/conseil/:id` | S | auth, perm(elections) (conseil.ts:13) ; role SG (conseil.ts:102) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `GET /api/cabinets` | L | auth, perm(membres) (cabinets.ts:14) ; déclarée cabinets.ts:38 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA, CONS, ACC | A | A | - | A | A | A | A | - | - |
| `POST /api/cabinets` | C | auth, perm(membres) (cabinets.ts:14) ; role SG (cabinets.ts:68) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `PATCH /api/cabinets/:id` | M | auth, perm(membres) (cabinets.ts:14) ; role SG (cabinets.ts:92) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `DELETE /api/cabinets/:id` | S | auth, perm(membres) (cabinets.ts:14) ; role SG (cabinets.ts:114) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `POST /api/cabinets/:id/membres/:membreId` | M | auth, perm(membres) (cabinets.ts:14) ; role SG (cabinets.ts:126) ; confinementAvocat (app.ts:134) | SG, ADM, SA | A | - | - | A | **-!E9** | - | - | - | - |
| `DELETE /api/cabinets/:id/membres/:membreId` | S | auth, perm(membres) (cabinets.ts:14) ; role SG (cabinets.ts:141) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `POST /api/cabinets/purge` | S | auth, perm(membres) (cabinets.ts:14) ; role SG (cabinets.ts:156) ; confinementAvocat (app.ts:134) | SG, ADM | A | - | - | A | - | - | - | - | - |
| `GET /api/calendrier-editorial` | L | auth, perm(documents) (calendrierEditorial.ts:12) ; déclarée calendrierEditorial.ts:15 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, SA, CONS, ACC | A | A | - | A | A | A | A | - | - |
| `PATCH /api/calendrier-editorial/:mois` | M | auth, perm(documents) (calendrierEditorial.ts:12) ; role SG, SA, BAT (calendrierEditorial.ts:36) ; confinementAvocat (app.ts:134) | SG, ADM, SA, BAT | A | A | - | A | A | - | - | - | - |
| `GET /api/espace/moi` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:42 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `PATCH /api/espace/moi` | M | auth, avocat (espace.ts:31) ; déclarée espace.ts:102 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/attestation/inscription/pdf` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:124 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/attestation/non-redevance/pdf` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:142 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/timbres` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:165 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `POST /api/espace/timbres` | C | auth, avocat (espace.ts:31) ; déclarée espace.ts:181 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `POST /api/espace/timbres/:id/usage` | M | auth, avocat (espace.ts:31) ; déclarée espace.ts:197 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `POST /api/espace/timbres/:id/utilise` | M | auth, avocat (espace.ts:31) ; déclarée espace.ts:213 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/notifications` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:229 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `POST /api/espace/notifications/lu-tout` | M | auth, avocat (espace.ts:31) ; déclarée espace.ts:239 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `POST /api/espace/notifications/:id/lu` | M | auth, avocat (espace.ts:31) ; déclarée espace.ts:248 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/documents` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:258 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `POST /api/espace/paiement` | C | auth, avocat (espace.ts:31) ; déclarée espace.ts:307 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `POST /api/espace/paiement/:ref/confirmer-sandbox` | V | auth, avocat (espace.ts:31) ; déclarée espace.ts:332 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/recus/:id/pdf` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:345 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/quitus/:id/pdf` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:356 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/annuaire` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:376 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/assemblees` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:403 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/assemblees/:id` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:411 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/assemblees/:id/convocation/pdf` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:421 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/assemblees/:id/pv/pdf` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:432 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/discipline` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:446 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/discipline/:id` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:459 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/discipline/:id/decision/pdf` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:469 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/pieces` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:491 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `POST /api/espace/pieces` | C | auth, avocat (espace.ts:31) ; déclarée espace.ts:504 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/pieces/:id/fichier` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:529 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `DELETE /api/espace/pieces/:id` | S | auth, avocat (espace.ts:31) ; déclarée espace.ts:545 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/archives` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:567 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/publications` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:588 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/publications/:id` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:596 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/messagerie` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:624 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/messagerie/non-lus` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:658 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/messagerie/:id` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:669 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/messagerie/messages/:id/piece` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:716 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/messagerie/messages/:id/accuse/pdf` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:722 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `POST /api/espace/messagerie` | C | auth, avocat (espace.ts:31) ; déclarée espace.ts:739 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `POST /api/espace/attestations/demandes` | C | auth, avocat (espace.ts:31) ; déclarée espace.ts:783 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `POST /api/espace/messagerie/:id` | C | auth, avocat (espace.ts:31) ; déclarée espace.ts:816 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/espace/scrutins` | L | auth, avocat (espace.ts:31) ; déclarée espace.ts:848 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `POST /api/espace/scrutins/:id/voter` | V | auth, avocat (espace.ts:31) ; déclarée espace.ts:891 | AV, STAG | - | - | - | - | - | - | - | A | A |
| `GET /api/messagerie/non-lus` | L | auth, perm(messagerie) (messagerie.ts:20) ; déclarée messagerie.ts:35 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, TRES, SA | A | A | A | A | A | - | - | - | - |
| `GET /api/messagerie` | L | auth, perm(messagerie) (messagerie.ts:20) ; sansAdmin (messagerie.ts:50) ; confinementAvocat (app.ts:134) | SG, BAT, TRES, SA | A | A | A | - | A | - | - | - | - |
| `GET /api/messagerie/messages/:id/piece` | L | auth, perm(messagerie) (messagerie.ts:20) ; sansAdmin (messagerie.ts:93) ; confinementAvocat (app.ts:134) | SG, BAT, TRES, SA | A | A | A | - | A | - | - | - | - |
| `GET /api/messagerie/messages/:id/accuse/pdf` | L | auth, perm(messagerie) (messagerie.ts:20) ; déclarée messagerie.ts:96 ; confinementAvocat (app.ts:134) | SG, ADM, BAT, TRES, SA | A | A | A | A | A | - | - | - | - |
| `GET /api/messagerie/:id` | L | auth, perm(messagerie) (messagerie.ts:20) ; sansAdmin (messagerie.ts:109) ; confinementAvocat (app.ts:134) | SG, BAT, TRES, SA | A | A | A | - | A | - | - | - | - |
| `POST /api/messagerie` | C | auth, perm(messagerie) (messagerie.ts:20) ; sansAdmin (messagerie.ts:153) ; confinementAvocat (app.ts:134) | SG, BAT, TRES, SA | A | A | A | - | A | - | - | - | - |
| `POST /api/messagerie/:id` | C | auth, perm(messagerie) (messagerie.ts:20) ; sansAdmin (messagerie.ts:185) ; confinementAvocat (app.ts:134) | SG, BAT, TRES, SA | A | A | A | - | A | - | - | - | - |
| `POST /api/messagerie/:id/attestation` | C | auth, perm(messagerie) (messagerie.ts:20) ; sansAdmin (messagerie.ts:218) ; confinementAvocat (app.ts:134) | SG, BAT, TRES, SA | A | A | A | - | A | - | - | - | - |
| `GET /api/verifier/quitus/:numero` | L | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `GET /api/verifier/recu/:numero` | L | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `GET /api/verifier/timbre/:code` | L | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |
| `GET /v/:t/:ref` | L | aucune (publique) | public | pub | pub | pub | pub | pub | pub | pub | pub | pub |

## 10. Correctifs T9 (serveur) et restrictions nouvelles

Correctifs appliqués sans migration ni dépendance ; `espace.ts` n'est pas modifié.

| Écart | Correctif | Preuve |
|---|---|---|
| E1, E2 | Nouvelle garde `refuserAdmin` (auth.ts:88) : 403 pour l'ADMIN sur le contenu des messages (liste avec aperçu, fil, pièce jointe, envoi, réponse, attestation délivrée dans un fil) et sur le fichier d'une pièce (pieces.ts:55). Les métadonnées restent ouvertes à l'ADMIN : `non-lus`, `accuse/pdf`, `GET /api/pieces`, `GET /api/membres/:id/pieces`, vérification et rejet des pièces. | rbac-matrice « E1 corrigé », « E2 corrigé » ; rbac-journal-refus « secret professionnel » (fil et pièce réels, aucun message ajouté) ; messagerie-pj et parcours alignés (le SG reçoit toujours 404 sur un fil entre confrères) |
| E3 | `requirePermission("audit")` sur `GET /api/dashboard/journal` (dashboard.ts:128). | « E3 corrigé » (TRES, ACC) |
| E4 | `requirePermission("discipline_saisir")` sur `PATCH /api/discipline/:id` (discipline.ts:117). | « E4 corrigé » (SA) |
| E5 | `requireRole(SG, SA, BAT)` sur `POST /api/archives` (archives.ts:23) et `PATCH /api/calendrier-editorial/:mois` (calendrierEditorial.ts:36). | « E5 corrigé » (CONS, ACC) |
| E7 | `requirePermission("parametres")` sur `POST /api/parametres/tester/:canal` (parametres.ts:249). | « E7 corrigé » (BAT) ; parametres-secrets vert |
| F1 | users.ts:31 : seuls l'ADMIN et le SG créent, promeuvent ou reprennent (mot de passe) un compte SECRETAIRE_GENERAL. | rbac-journal-refus « F1 » (un SA doté de `utilisateurs` reçoit 403, aucun compte n'est créé) |
| F5 | `LECTURES_SENSIBLES` (audit.ts:31) couvre aussi `GET /api/discipline` et `GET /api/discipline/journal`. | « la lecture d'un dossier et de la liste écrit une ligne » (Bâtonnier) |
| D18 | audit.ts:73 : une écriture (méthode autre que GET) refusée en 403 écrit « Accès refusé — <ressource> » dans JournalAudit, avec l'auteur, la méthode, le chemin, le statut et l'IP, jamais le corps de la requête. Les GET refusés ne sont pas journalisés. | « un POST refusé écrit… sans le corps », « un GET refusé n'est pas journalisé », « PUT /rbac écrit toujours sa ligne » |
| Message 403 | `requireRole` et `requirePermission` répondent « Vous n'avez pas les droits nécessaires pour accéder à cette ressource. » (constante `REFUS`, auth.ts:59). | assertion sur le corps de la réponse |

Discipline et casier (R-62) : TRESORIERE, ACCUEIL et CONSULTATION étaient déjà refusés en 403 sur tout `/api/discipline` et sur `GET /api/membres/:id/pieces`. La matrice le prouve, et rbac-journal-refus le vérifie en plus sur le casier (`?membreId=`).

**Restrictions nouvelles à valider par Fabrice** (chacune réduit un accès qui existait) :

1. ADMIN : il n'accède plus au contenu de la Messagerie, ni en lecture ni en envoi, ni au fichier des pièces (secret professionnel). Le compte ADMIN technique ne peut donc plus répondre à un avocat : la réponse passe par le SG, le Bâtonnier, la Trésorière ou le SA. Côté front (T10), il faut masquer à l'ADMIN le menu Messagerie et le bouton d'ouverture d'une pièce.
2. TRESORIERE et ACCUEIL : le widget « journal » du tableau de bord leur renvoie désormais 403 ; le front affiche alors une liste vide.
3. SECRETAIRE_ADJOINT : il ne modifie plus l'instruction d'un dossier disciplinaire sans l'action `discipline_saisir`.
4. CONSULTATION et ACCUEIL : ils ne créent plus d'archive et ne modifient plus le calendrier éditorial, même si la matrice leur donne `documents`. Ces deux routes sont désormais fixées par rôle (SG, SA, BAT) et ne suivent plus la matrice éditable.
5. BATONNIER : il ne lance plus le test des canaux techniques (SMTP, SMS, passerelles), sauf si la permission `parametres` lui est accordée.
6. Rôles éditables : même avec la permission `utilisateurs`, ils ne gèrent plus un compte Secrétaire général.

Restent à décider par Fabrice, sans changement de code : E6 (reclassé en non-écart), E8 à E13 (écarts restrictifs, non élargis selon D17), F2 (projection de la discipline dans l'espace avocat, traitée par la tâche espace avocat), F3 et F6.
