# Audit de conformité — mission M-20261010-audit-ordre-avocats

Audit initial (tâche T1), réalisé le 2026-10-10 sur la branche `feat/audit-conformite-congres`, sans aucune modification du code applicatif.
Méthode : lecture du code avec chemin:ligne, rapprochement avec les tests existants, vérification de l'état des tests. Le pré-audit du schéma (hypothèse A1) n'a servi que de présomption : chaque statut ci-dessous est étayé par une preuve.

Légende : ✅ conforme (on ne touche pas) · ❌ incorrect (on corrige + test) · 🟡 basique (on professionnalise) · 🟠 partiel (on complète) · ⚪ absent (on construit si P1, sinon on reporte).
Priorités : P0 bloque un parcours de recette · P1 avant la présentation · P2 phase expérimentale · P3 évolution.
Tâches : `Tn` = n-ième sous-tâche de l'ordre arrêté par l'architecte (1 référence + audit ; 2 historique et statuts ; 3 RBAC actions ; 4 règles paramétrables ; 5 impayés, tableau de bord, timbres externes ; 6 messagerie et attestations ; 7 discipline ; 8 corps électoral ; 9 import et tableau ; 10 journal d'audit ; 11 bandeaux et stats timbre ; 12 jeu de démo, Playwright, scénario).

## 1. Référence avant modification

| Élément | Valeur |
|---|---|
| Commit de référence | `76958a4` (fix(api): valider-stage passe par la machine à états du cycle de vie), branche `feat/avocats-cycle-de-vie` |
| Branche de travail | `feat/audit-conformite-congres` (créée localement, aucun push) |
| Socle Docker | `socle_etat` : postgres (healthy), mysql, redis, mailhog actifs ; aucun conteneur jetable créé. Tests sur la base `barreau_pn_test` du socle (`TEST_DATABASE_URL`, migrations appliquées par `server/test/globalSetup.ts`) |
| `npm test` (racine, vitest + jsdom) | **13 fichiers, 63 tests, 63 passés, 0 échec** (durée 13,6 s) |
| `cd server && npm test` | **2 fichiers (`api.test.ts`, `installation.test.ts`), 153 tests, 153 passés, 0 échec** (durée 38,6 s ; relancé deux fois, vert deux fois) |
| Total de référence | **216 tests verts** — le nombre après livraison doit rester supérieur ou égal (CA2) |

Sortie des commandes (fin de sortie, couleurs retirées) :

```
$ npm test            (racine)
 Test Files  13 passed (13)
      Tests  63 passed (63)
   Duration  13.58s

$ cd server && npm test
 Test Files  2 passed (2)
      Tests  153 passed (153)
   Duration  38.63s
```

Remarque : le bruit de journal (réponse 409 avec en-têtes) visible dans la sortie serveur provient d'un test qui vérifie justement un refus 409 ; il ne signale pas un échec.

## 2. Comptage de contrôle (CA1)

| Comptage | Commande | Résultat |
|---|---|---|
| Cases `- [ ]` du §3 du cahier | `grep -c -- '- \[ \]' <cahier de mission M-20261010>.md` | **40** |
| Cases `- [ ]` (second comptage) | `grep -o -- '- \[ \]' … \| wc -l` | **40** |
| Lignes de fonctionnalité du présent rapport | `grep -c '^| F-' docs/audit/AUDIT-CONFORMITE.md` (tableaux §4) | **40** |

Écart signalé : le cadrage de la mission annonçait « 52 fonctionnalités ». Le cahier ne contient que 40 cases à cocher. Le rapport suit le cahier (40 lignes F-01 à F-40) ; les sous-points « À professionnaliser / compléter » du cahier sont traités dans le tableau complémentaire du §5 (lignes P-xx, hors comptage des 40).

## 3. Synthèse

| Statut | Nombre | Lignes |
|---|---|---|
| ✅ conforme | 7 | F-04, F-09, F-16, F-18, F-24, F-29, F-30 |
| ❌ incorrect | 6 | F-06, F-15, F-26, F-27, F-31, F-38 |
| 🟡 basique | 4 | F-08, F-36, F-39, F-40 |
| 🟠 partiel | 14 | F-02, F-05, F-07, F-10, F-11, F-14, F-17, F-21, F-22, F-25, F-28, F-33, F-35, F-37 |
| ⚪ absent | 9 | F-01, F-03, F-12, F-13, F-19, F-20, F-23, F-32, F-34 |
| **Total** | **40** | = nombre de cases `- [ ]` du cahier |

Anomalies ❌ confirmées (présomption A1 vérifiée) :
1. Annuaire de l'espace avocat qui liste les radiés, décédés et omis et expose leur téléphone et e-mail (X-01).
2. `PATCH /discipline/:id` qui laisse le Secrétaire Général enregistrer décision et sanction (X-02).
3. Corps électoral calculé à l'année civile, pas à la date du scrutin (X-03).
4. « Valider le stage » qui laisse la date d'inscription inchangée et tri par date d'inscription refusé par l'API (X-04).
5. Reçus et quitus qui écrivent « Pointe-Noire » en dur, donc faux avec un autre barreau (X-05).

## 4. Rapport par fonctionnalité

Chaque ligne suit le modèle du §2 du cahier : module, fonctionnalité, attendu, constaté, statut, décision, priorité, test de validation. Colonne « Preuve » = test ou chemin:ligne d'origine du constat ; colonne « Validation finale » = test ou capture qui clôturera la ligne (renvoi à la tâche correctrice pour les lignes non ✅).

### Module 1 — Membres et tableau

| ID | Fonctionnalité | Attendu (cahier §3) | Constaté | Statut | Décision | Prio | Preuve | Validation finale |
|---|---|---|---|---|---|---|---|---|
| F-01 | Suivi de l'entrée à la sortie, historique des changements de situation | Journal horodaté : qui, quand, pourquoi, pièce | Aucune table d'historique. Seul `JournalAudit` générique (action, chemin, acteur) sans statut avant/après, motif ni pièce (`server/src/middleware/audit.ts:30-40`) | ⚪ | construire | P1 | `server/prisma/schema.prisma` (aucun modèle d'événement) | T2 : table `EvenementSituation`, test « Parcours 4/5 » |
| F-02 | Inscription sur la liste du stage puis passage au grand tableau | Stagiaire inscrit, puis passage au tableau | Inscription de stagiaires possible (`POST /membres`, `membres.ts:231` ; import `qualiteDefaut`, `api.test.ts:532`). Passage par `POST /membres/:id/valider-stage` (`membres.ts:538`, Bâtonnier seul, `api.test.ts:500`). Pas de référence du certificat de fin de stage ni de date de demande (loi 026-92, art. 29 et 31) | 🟠 | compléter | P1 | `membres.ts:538-560` | T2 (certificat, historique), T4 (durée 24 mois paramétrable) |
| F-03 | Admission directe au tableau (dérogations) | Cas dérogatoires prévus par les textes | Aucune route ni champ : `POST /membres` n'a pas de notion d'admission directe (`membres.ts:231`) | ⚪ | construire | P1 | `membres.ts` (inscriptionSchema) | T2 (route, événement), T4 (liste des cas art. 32) ; « Parcours 3 » |
| F-04 | Rattachement à un cabinet et identification de ses membres | Cabinet lié aux membres | `Cabinet`, `Membre.cabinetId`, routes cabinets (`cabinets.ts:38-154`), effectif et titulaire | ✅ | ne pas toucher | P1 | `api.test.ts:673` | test existant |
| F-05 | Statuts de sortie : omission, démission, retraite, cessation, décès, radiation ; radié disparaît de la liste et du tableau | Six sorties gérées | Enum `StatutMembre` : OMIS, RADIE, DECEDE présents ; démission, retraite et cessation absents (`schema.prisma:41-49`). Radié et décédé exclus du tableau (`tableau.ts:25`, `business.ts:172`) mais la liste « Tous les statuts » les garde (`Avocats.jsx:13`, par conception de registre). Liste blanche de statuts dupliquée (`membres.ts:24`) à étendre | 🟠 | compléter | P1 | `schema.prisma:41`, `business.ts:172`, `api.test.ts:1217` | T2 (3 statuts, `STATUTS_HORS_TABLEAU`) ; décision à valider : radié visible ou non dans la liste (POINTS-OUVERTS) |
| F-06 | Passage stage → tableau depuis la fiche, sans import ; quitte la liste stage, apparaît parmi les inscriptions récentes | Parcours 2 | Le passage depuis la fiche fonctionne et sort le membre de `qualite=STAGIAIRE`. Mais `dateInscription` n'est pas modifiée (`membres.ts:550-553`) donc il n'apparaît pas parmi les dernières inscriptions, et `GET /membres` refuse le tri `dateInscription` (`TRI_AUTORISE`, `membres.ts:18`, repli silencieux sur `num`) | ❌ | corriger | P0 | `membres.ts:18`, `membres.ts:550` | T2 : « Parcours 2 », CA5 |
| F-07 | Omission ≠ radiation, mesure administrative temporaire (rappel, mise en demeure, transmission) | Circuit distinct, réversible | OMIS existe comme statut libre via `PATCH` (`membres.ts:407`) sans circuit, sans route de réinscription ; les relances sont un envoi en masse d'e-mails/SMS (`cotisations.ts:17-56`), sans trace d'étape. Séparation avec RADIE respectée (RADIE seulement par `/radier`, `membres.ts:448`) | 🟠 | compléter | P1 | `cotisations.ts:17`, `membres.ts:407` | T5 : « Parcours 4 », CA6 |
| F-08 | Imports Excel/CSV, listes tableau et stagiaires distinctes | Deux listes importables | Import par lot avec `qualiteDefaut` (tableau/stagiaires), plafond 2 000 lignes, erreurs ligne par ligne, dates FR/ISO, tests nombreux. Absents : modèle téléchargeable, prévisualisation avant validation, détection des doublons, annulation (`membres.ts:320-400` ; `ImportMembresModal.jsx:167` n'affiche qu'un aperçu des lignes lues) | 🟡 | professionnaliser | P1 | `api.test.ts:532, 1281, 1556-1650` | T9 : « Parcours 1 » |
| F-09 | Base de données partagée : persistance, synchronisation, aucune perte | Une base unique | PostgreSQL unique via Prisma, rejeu sur collision d'unicité (`business.ts` `avecRejeuUnicite`), anti-double-crédit testé (`api.test.ts:1092`), import idempotent par `num`. Synchronisation entre responsables = rechargement (le temps réel est traité en F-10) | ✅ | ne pas toucher | P1 | `api.test.ts:1092, 1586` ; 153 tests verts | test existant |
| F-10 | Tableau actualisé en temps réel, export PDF | Mise à jour en direct, PDF | Export PDF opérationnel, trié par ancienneté, sections, Conseil en en-tête, identité des Paramètres (`tableau.ts:34-88`, `api.test.ts:634, 747`). Mais pas de temps réel : `EvenementRealtime` ne connaît que `messagerie` et `notification` (`realtime.ts:30`), `TableauOrdre.jsx` n'écoute rien ; la date affichée est celle de génération, pas de dernière mise à jour (`templates.ts:177`) | 🟠 | compléter | P1 | `realtime.ts:30`, `templates.ts:177` | T9 : « Parcours 7 », CA du tableau |

### Module 2 — Discipline et droits associés

| ID | Fonctionnalité | Attendu | Constaté | Statut | Décision | Prio | Preuve | Validation finale |
|---|---|---|---|---|---|---|---|---|
| F-11 | Circuit saisine → enquêteur → rapport → classement/poursuite → juridiction | Étapes datées | Dossier avec référence AAAA-NN, plaignant, rapporteur, dates de convocation et d'audience, recours, statut OUVERT/INSTRUCTION/AUDIENCE/DECISION/CLASSE (`schema.prisma:366-385`, `discipline.ts:62-125`, `api.test.ts:461`). Absents : date de désignation, date et conclusion du rapport, orientation classement/poursuite, juridiction compétente, échéances de procédure (art. 37 à 42) | 🟠 | compléter | P1 | `schema.prisma:366` | T7 : « Parcours 5 » |
| F-12 | Sanctions : avertissement, suspension, radiation, sursis | Sanctions structurées | `sanction` est un texte libre (`schema.prisma:377`, `discipline.ts:107`) ; aucun catalogue, aucune durée, aucun sursis | ⚪ | construire | P1 | `schema.prisma:377` | T4 (catalogue paramétrable), T7 |
| F-13 | Suspension avec sursis visible sur la fiche, sans retrait du tableau | Avocat reste INSCRIT | Rien de structuré : un sursis ne peut être qu'écrit à la main dans le texte libre ; la fiche n'affiche aucune sanction | ⚪ | construire | P1 | `AvocatDetail.jsx` (pas de sanction) | T7 : « Parcours 5 », CA7 |
| F-14 | Radiation issue du disciplinaire, répercutée sur la fiche | Statut RADIE automatique | Le dossier ne touche jamais la fiche : la radiation se fait à part par `POST /membres/:id/radier` (`membres.ts:448`, testé `api.test.ts:1321`) et n'est liée à aucun dossier | 🟠 | compléter | P1 | `discipline.ts:99-125` (aucun `membre.update`) | T7 : « Parcours 5 », CA7 |
| F-15 | Droits d'accès et de validation bâtonnier / SG | Compétences distinguées | Le SG a implicitement toutes les permissions de module (`rbac.ts:93-94`). Seul `valider-stage` est limité au Bâtonnier (`membres.ts:539`, `api.test.ts:500`). `PATCH /discipline/:id` accepte `decision`, `sanction` et `statut` du SG sans garde d'action (`discipline.ts:99-125`) ; la saisine n'est pas distinguée. Matrice non modifiable pour le SG (`ROLES_COMPLET`) | ❌ | corriger | P0 | `discipline.ts:99`, `rbac.ts:46,93` | T3 : « Parcours 6 », CA8 (403 croisés) |

### Module 3 — Finances et timbres numériques

| ID | Fonctionnalité | Attendu | Constaté | Statut | Décision | Prio | Preuve | Validation finale |
|---|---|---|---|---|---|---|---|---|
| F-16 | Cotisations, quittances, reçus, droits, timbres de plaidoirie | Cycle financier complet | Cotisations, paiements, reçus R-AAAA-NNN, quitus Q-AAAA-NNN (« quittance » entendue comme quitus, hypothèse), droits de plaidoirie, timbres, RBAC finances (`cotisations.ts`, `business.ts:73-94`, `api.test.ts:63-115, 844, 1124`). Réserve personnalisation : voir X-05 / P-09 | ✅ | ne pas toucher | P1 | `api.test.ts:63-115, 844` | tests existants |
| F-17 | Tableau de bord : effectifs tableau et stage, à jour, retardataires | Effectifs + retardataires, stagiaires compris | `GET /dashboard` renvoie `inscrits` (AVOCAT actifs), `stagiaires`, `aJour`, `enRetard` agrégés toutes qualités confondues (`dashboard.ts:48-70`) ; pas de ventilation par qualité, honoraires exclus du calcul par exonération ; seul le sexe est testé (`api.test.ts:616`) | 🟠 | compléter | P1 | `dashboard.ts:12-98` | T5 : « Parcours 4 » |
| F-18 | Avocats et stagiaires inclus dans le suivi des impayés | Stagiaires comptés | Liste des cotisations et relances parcourent tous les membres hors radiés/décédés, stagiaires au tarif 75 000 FCFA (`cotisations.ts:59-75`, `cotisations.ts:23`, `business.ts:12`) | ✅ | ne pas toucher | P1 | lecture `cotisations.ts:23, 63` ; un test dédié stagiaire sera ajouté en T5 sans modifier le comportement | T5 (test de non-régression) |
| F-19 | Intégration des données externes de timbres | Suivi mensuel | Aucun import ni état mensuel : seul `GET /timbres` du registre interne (`timbres.ts:46`) | ⚪ | construire | P1 | `timbres.ts` | T5 : table `ReleveTimbreExterne`, état mensuel |
| F-20 | Lien cotisations → rappel / mise en demeure / transmission → omission | Circuit tracé étape par étape | Voir F-07 : `POST /cotisations/relances` envoie e-mail et SMS mais ne consigne ni étape, ni date, ni lien avec l'omission (`cotisations.ts:17-56`) | ⚪ | construire | P1 | `cotisations.ts:17` | T5 : « Parcours 4 », CA6 |
| F-21 | Timbre autonome : émission numérique | Prototype testable | Émission fonctionnelle (n° atomique, code unique, paiement sandbox) : `POST /timbres`, `emettreTimbre` (`timbres.ts:30`, `lib/timbres.ts`, `api.test.ts:1127`). Aucun bandeau « Expérimental » | 🟠 | compléter | P2 | `api.test.ts:1124-1165` | T11 : capture Playwright du bandeau (CA13) |
| F-22 | Timbre : vérification par QR code | Vérification publique | `GET /verifier/timbre/:code` public, limité en débit, signé, annulé = invalide (`verification.ts:81-108`, `api.test.ts:1138-1160`). Aucun bandeau | 🟠 | compléter | P2 | `api.test.ts:1138` | T11 : capture (CA13) |
| F-23 | Timbre : statistiques produites directement | Stats par mois et canal | Aucune route de statistiques (`timbres.ts` : 4 routes) | ⚪ | construire | P2 | `timbres.ts:30-71` | T11 : `GET /timbres/stats` |

### Module 4 — Élections et fonctionnement institutionnel

| ID | Fonctionnalité | Attendu | Constaté | Statut | Décision | Prio | Preuve | Validation finale |
|---|---|---|---|---|---|---|---|---|
| F-24 | Réunions, assemblées générales, conseils | Gestion complète | Routes réunions, assemblées (convocation, PV, feuille de présence), composition du Conseil (`reunions.ts`, `assemblees.ts`, `conseil.ts`, `api.test.ts:704, 802`). Réserve juridique (date de transmission de la délibération sous 8 jours, art. 23) renvoyée aux points ouverts | ✅ | ne pas toucher | P1 | `api.test.ts:704-730, 802-820` | tests existants |
| F-25 | Scrutins : bâtonnier, conseil de l'ordre, conseil du barreau, « autre » extensible | Quatre catégories | `TypeScrutin` = CONSEIL, BATONNIER, AUTRE (`schema.prisma:479`, `scrutins.ts:49`) ; « conseil du barreau » absent | 🟠 | compléter | P1 | `schema.prisma:479` | T8 : valeur `CONSEIL_BARREAU` |
| F-26 | Corps électoral généré depuis cotisations et discipline, à la date du scrutin | Calcul à la date | Calcul par année civile `?annee=` (`corpsElectoral.ts:15-18`), statut courant et cotisation de l'année ; le vote utilise `new Date().getFullYear()` (`espace.ts:756, 795`) ; `Scrutin` n'a pas de date de scrutin ; pas d'historique pour reconstituer la situation passée | ❌ | corriger | P0 | `corpsElectoral.ts:15`, `espace.ts:795` | T8 : « Parcours 10 », CA11 (dépend de T2) |
| F-27 | Conditions d'éligibilité paramétrables | Critères en Paramètres | Règle figée en code : honoraires et stagiaires exclus, statut, cotisation à jour (`business.ts:175-193`) ; aucun critère d'ancienneté, aucune lecture des Paramètres ; les candidatures ne sont pas contrôlées (`scrutins.ts:108`) | ❌ | corriger | P0 | `business.ts:175`, `scrutins.ts:108` | T4 (règles), T8 : « Parcours 10 », CA12 |
| F-28 | Vote électronique : présentiel ou distance, authentification, secret, suivi | Prototype | Modalités PRESENTIEL/EN_LIGNE, vote depuis l'espace authentifié, émargement séparé des voix, aucune trace du choix, voix masquées avant publication, double vote refusé en transaction (`espace.ts:786-826`, `espace.ts:770`, `api.test.ts:582`). Pas de bandeau « Expérimental », pas de contrôle de candidature, pas de suivi de participation | 🟠 | compléter | P2 | `api.test.ts:566-613` | T11 : capture (CA13) |
| F-29 | À tester : confidentialité du choix, fiabilité, informations pendant le vote | Constat de test | Le choix n'est jamais relié au votant (`espace.ts:809-819`) ; les voix ne sont servies qu'à PUBLIE ; la participation n'est pas affichée pendant le vote ; aucune garantie cryptographique, à ne pas promettre | ✅ (constat) | ne pas toucher le mécanisme ; documenter les limites | P2 | `espace.ts:770, 809` | T12 : CONFIDENTIALITE-EFFECTIVE.md |

### Module 5 — Messagerie et réseau privé des avocats (priorité majeure)

| ID | Fonctionnalité | Attendu | Constaté | Statut | Décision | Prio | Preuve | Validation finale |
|---|---|---|---|---|---|---|---|---|
| F-30 | Espace professionnel dédié : avocats entre eux et avec les autorités ordinales | Fils confrère et administration | Deux types de fils (`avecAdministration`), cloisonnement par participant, non-lus, temps réel, notifications (`espace.ts:593-745`, `messagerie.ts`, `api.test.ts:1029-1090`). Réserve confidentialité : l'e-mail de notification reproduit le corps du message (`messagerieNotif.ts:51`) | ✅ | ne pas toucher ; à documenter en T12 | P1 | `api.test.ts:1072` | CONFIDENTIALITE-EFFECTIVE.md (T12) |
| F-31 | Recherche d'un confrère et ouverture d'une conversation | Confrères inscrits uniquement | La recherche par nom/cabinet fonctionne (`espace.ts:342-358`). Mais l'annuaire n'exclut pas les radiés, décédés ni omis (seul `id ≠ moi`, `espace.ts:348`) et sert leur téléphone et e-mail ; `POST /espace/messagerie` accepte tout membre existant (`espace.ts:684-688`) | ❌ | corriger | P0 | `espace.ts:348, 684` | T6 : « Parcours 8 », CA9 |
| F-32 | Bouton « Contacter » depuis la fiche | Accès direct à la conversation | Aucune occurrence dans `src/barreau/pages` | ⚪ | construire | P1 | recherche textuelle dans `src/barreau` | T6 : « Parcours 8 » |
| F-33 | Envoi de correspondances, conclusions et pièces | Messages avec pièces | Messages texte (5 000 caractères) uniquement ; `Message` n'a que `corps` (`schema.prisma:588-602`) ; aucune pièce jointe | 🟠 | compléter | P1 | `schema.prisma:588`, `espace.ts:676` | T6 : « Parcours 8 », CA9 |
| F-34 | Accusés de réception horodatés et imprimables | PDF horodaté | Aucun : ni statut reçu/lu par message (seul `lastReadAt` écrasé à chaque lecture, `espace.ts:645`), ni PDF | ⚪ | construire | P1 | `schema.prisma:575-586` | T6 : « Parcours 8 », CA9, CA16 |
| F-35 | Demandes d'attestations, délivrance, archivage dans les dossiers | Demande → traitement → archive | Attestations d'inscription et de non-redevance délivrées immédiatement à l'avocat, numérotées ATT-AAAA-NNN, refusées pour radié/décédé (`espace.ts:124-163`, `membres.ts:607-640`, `api.test.ts:139`) ; pas de demande, pas de file de traitement ni de délivrance par l'Ordre | 🟠 | compléter | P1 | `espace.ts:124` | T6 : « Parcours 8 » |


### Module 6 — Documents, audit et personnalisation

| ID | Fonctionnalité | Attendu | Constaté | Statut | Décision | Prio | Preuve | Validation finale |
|---|---|---|---|---|---|---|---|---|
| F-36 | Téléversement des pièces du dossier par l'avocat | Dépôt de pièces | `POST /espace/pieces` (5 Mo, types énumérés, enregistrement disque, notification du Secrétariat), consultation de ses seules pièces (`espace.ts:442-505`). Le type est celui déclaré par le client, sans contrôle de signature binaire ; aucun test d'envoi | 🟡 | professionnaliser | P1 | `espace.ts:443-447` | T6/T10 : test dédié, « Parcours 9 » |
| F-37 | Validation ou rejet avec notification et corrections demandées | Rejet motivé + notification | `verifier` et `rejeter` existent, motif facultatif visible dans la liste de l'avocat (`pieces.ts:72-100`, `espace.ts:453`). Aucune notification à l'avocat (`pieces.ts` n'appelle jamais `notifier`) ; motif non obligatoire au rejet | 🟠 | compléter | P1 | `pieces.ts:72-100` | **Non couvert par le plan T2–T12** : à rattacher à T6 ; « Parcours 9 » |
| F-38 | Archives, annuaire, publications | Fonctionnement correct | Archives (`api.test.ts:823`) et publications avec workflow de validation (`api.test.ts:777`) conformes. Annuaire de l'espace non conforme : voir F-31 / X-01 | ❌ | corriger l'annuaire ; ne pas toucher archives et publications | P0 | `espace.ts:342-358` | T6 : « Parcours 8 » |
| F-39 | Journal d'audit sans accès aux conversations privées | Traçabilité sans contenu | Le middleware journalise toute mutation réussie sans corps de requête (`audit.ts:44-72`) ; les fils entre confrères ne sont jamais servis à l'administration (`messagerie.ts` filtre `avecAdministration`, `api.test.ts:1072`). Mais : pas de filtre explicite utilisateur/action (seule la recherche libre `q`, `routes/audit.ts:20-34`), libellés absents pour les nouvelles actions, journal modifiable en base, consultations non tracées | 🟡 | professionnaliser | P1 | `routes/audit.ts`, `middleware/audit.ts` | T10 : « Parcours 12 », CA10 |
| F-40 | Personnalisation par barreau : logo, identité, reçus, documents | Thème par barreau | Identité (dénomination, ordre, signataires, adresse, logo) en Paramètres, injectée dans les PDF (`identiteDocuments.ts`, `templates.ts:13`, `api.test.ts:436`). Mais reçus et quitus écrivent « Pointe-Noire » en dur (`documentsRiches.ts:142, 179, 186, 199`), l'e-mail d'activation et la relance aussi (`acces.ts:81`, `cotisations.ts`), et l'interface garde des libellés fixes (`src/barreau/data/config.js`, `AuthLayout.jsx`) | 🟡 | professionnaliser | P1 | `documentsRiches.ts:179` | T5 (reçus), T12 : « Parcours 11 » |

## 5. Compléments « À professionnaliser » du cahier (hors comptage des 40)

| ID | Point | Constaté | Statut | Prio | Tâche |
|---|---|---|---|---|---|
| P-01 | Import : modèle téléchargeable, contrôle des colonnes, doublons, prévisualisation, annulation | Rapport d'erreurs ligne par ligne ✅ ; le reste absent (voir F-08). Pas de dossier `public/modeles` | 🟡 | P1 | T9 |
| P-02 | Historique des statuts (qui, quand, pourquoi, pièce) | Absent (F-01) | ⚪ | P1 | T2 |
| P-03 | Tableau PDF : en-tête personnalisable, ordre d'inscription, date de mise à jour | En-tête et ordre ✅ ; date = date de génération, pas de `updatedAt` sur `Membre` | 🟡 | P1 | T9 |
| P-04 | Listes PDF sources : procédure documentée, pas d'OCR | À documenter dans `src/barreau/README.md` | ⚪ | P1 | T9 |
| P-05 | Dossier disciplinaire horodaté, pièces, décisions, délais | Champ `pieces` (liste de textes) ; pas de délais ni d'horodatage par étape | 🟠 | P1 | T7 |
| P-06 | Matrice rôles/droits configurable (qui saisit, valide, consulte) | Matrice de modules en base (`RolePermission`, `rbac.ts`) ✅ ; pas de permissions d'action | 🟠 | P1 | T3 |
| P-07 | Confidentialité renforcée de la discipline : accès restreint, journal de chaque consultation | Garde `discipline` et `JournalDiscipline` à chaque lecture (`discipline.ts:12-52`, `api.test.ts:476`) ✅ ; motif de radiation absent des listes (`api.test.ts:1384`) ✅ | ✅ | P1 | ne pas toucher |
| P-08 | Règles de sanctions et de sursis paramétrables | `Parametres.data` ne contient que tarifs, stage (24 mois), identité (`parametres.ts:17-35`) | ⚪ | P1 | T4 |
| P-09 | Reçus et quittances personnalisés (logo, numérotation, mentions) | Numérotation continue R-/Q- ✅, logo ✅ ; ville et dénomination en dur (X-05) | 🟡 | P1 | T5 |
| P-10 | Relances automatisables, historique des paiements, états mensuels | Relances manuelles en masse ; historique via reçus ; pas d'état mensuel | 🟡 | P1 | T5 |
| P-11 | Messagerie : statuts envoyé/reçu/lu, notifications | Notifications e-mail et in-app ✅ ; statuts par message absents | 🟠 | P1 | T6 |
| P-12 | Pièces jointes : taille, formats, aperçu | Absentes pour la messagerie ; 5 Mo pour les pièces du dossier | ⚪ | P1 | T6 |
| P-13 | Accusé de réception imprimable avec mention d'horodatage | Absent (F-34) ; mention « valeur probatoire à confirmer » à poser | ⚪ | P1 | T6 |
| P-14 | Journal d'audit filtrable et non modifiable | Voir F-39 | 🟡 | P1 | T10 |
| P-15 | Thème par barreau appliqué partout | Voir F-40 | 🟡 | P1 | T5, T12 |
| P-16 | Modules complémentaires (audio, visio, passerelle juridictions) | Étude uniquement : voir §8 | ⚪ | P3 | rapport final |

### Anomalies ❌ détaillées

| ID | Constat | Preuve | Parcours bloqués | Correction |
|---|---|---|---|---|
| X-01 | `GET /espace/annuaire` liste tous les membres (radiés, décédés, omis, suspendus) avec téléphone et e-mail ; `POST /espace/messagerie` accepte un destinataire hors tableau | `espace.ts:346-358, 684-688` | 8 | T6 (filtrer par `STATUTS_HORS_TABLEAU`, test d'absence) |
| X-02 | `PATCH /discipline/:id` enregistre `decision`, `sanction` et `statut` pour tout détenteur de `discipline`, SG compris ; la matrice ne peut pas distinguer saisir et décider | `discipline.ts:99-125`, `rbac.ts:46, 93` | 5, 6 | T3 (permissions d'action), T7 (route de décision gardée) |
| X-03 | Corps électoral par année civile, pas à la date ; vote et éligibilité utilisent l'année courante | `corpsElectoral.ts:15`, `espace.ts:756, 795` | 10 | T8 (dépend de T2 pour reconstituer la situation à une date) |
| X-04 | `valider-stage` ne met pas à jour `dateInscription` ; tri `dateInscription` refusé par `GET /membres` | `membres.ts:18, 550-553` | 2 | T2 (date d'inscription au tableau), tri autorisé |
| X-05 | Reçu et quitus : « Pointe-Noire » écrit en dur dans le titre, la ville de date et le corps du texte | `documentsRiches.ts:142, 145, 179, 186, 199` | 11 | T5 (utiliser `identite()`, non prévu explicitement dans le plan) |

## 6. Non-régression sur les lignes ✅ (CA3)

Les 7 lignes ✅ (F-04, F-09, F-16, F-18, F-24, F-29, F-30) ne doivent présenter aucun diff de comportement. Toute tâche qui touche leurs fichiers (`cabinets.ts`, `cotisations.ts`, `reunions.ts`, `assemblees.ts`, `conseil.ts`, `espace.ts` messagerie) s'appuie sur la référence de la section 1 (216 tests verts) et sur les tests nommés dans la colonne « Preuve ». F-18 n'a pas de test dédié aux stagiaires : T5 en ajoute un sans modifier le comportement.

## 7. Parcours de recette (§5 du cahier) et tâches qui les rendent verts

| Parcours | Intitulé | État actuel | Blocages (❌ ou lacunes) | Tâches |
|---|---|---|---|---|
| 1 | Import tableau + stagiaires avec erreurs | Import fonctionnel avec erreurs de ligne ; manque aperçu, doublons, modèle | F-08 (🟡) | T9 |
| 2 | Passage stagiaire → tableau | Bloqué | **X-04 ❌** (date d'inscription, tri) | T2 |
| 3 | Admission directe | Impossible | F-03 (⚪) | T4 (règles), T2 |
| 4 | Impayés → omission → réinscription | Impossible | F-07, F-20 (⚪/🟠), F-01 (historique) | T2, T5 |
| 5 | Dossier jusqu'au sursis puis radiation | Impossible | **X-02 ❌**, F-12, F-13, F-14 | T3, T4, T7 |
| 6 | Droits bâtonnier / SG | Partiel | **X-02 ❌**, F-15 | T3 |
| 7 | Tableau public : temps réel + PDF | PDF OK ; temps réel absent | F-10 (🟠) | T9 |
| 8 | Messagerie : recherche, Contacter, pièce, accusé, attestation | Bloqué | **X-01 ❌**, F-32, F-33, F-34, F-35 | T6 |
| 9 | Dépôt de pièce : rejet, notification, resoumission, validation | Rejet sans notification | F-37 (🟠) — **sans tâche prévue au plan** | T6 (à rattacher) |
| 10 | Corps électoral à une date + éligibilité | Bloqué | **X-03 ❌**, F-27 ❌, F-25 | T2, T4, T8 |
| 11 | Reçu personnalisé aux couleurs d'un barreau | Faux hors Pointe-Noire | **X-05 ❌** — **non prévu explicitement au plan** | T5 (à confirmer), T12 |
| 12 | Journal d'audit sans contenu privé | Contenu absent du journal ✅ ; filtres, immuabilité manquants | F-39 (🟡) | T10 |

Trous du plan à signaler à l'orchestrateur : Parcours 9 (notification de rejet de pièce) et Parcours 11 (reçu/quitus au nom du barreau) n'ont pas de tâche explicite dans T2 à T12.

## 8. Étude : modules complémentaires (audio, visioconférence, passerelle juridictions)

Étude documentaire seulement, rien n'est construit (hypothèse H19).

- Appels audio et visioconférence : la messagerie actuelle (WebSocket `realtime.ts`, signaux seulement) n'a pas de transport média. Deux voies : intégrer un service tiers (lien de salle généré dans le fil, aucun média ne transitant par l'application) ou héberger un serveur WebRTC (SFU) avec coût d'exploitation, enjeux de bande passante en Afrique centrale et responsabilité accrue sur le secret professionnel (art. 52 de la loi 026-92). Recommandation : lien de salle d'un prestataire en premier, avec mention explicite que le contenu des appels échappe à la plateforme.
- Passerelle avec les juridictions : suppose un interlocuteur institutionnel (greffes, parquets), un format d'échange convenu et un cadre juridique de notification électronique que les avis précédents n'ont pas trouvé. À étudier après le pilote ; ne remplace pas la lettre recommandée exigée par les art. 39 et 42.
- Continuité de service : dépend de l'hébergement (non établi, voir CONFIDENTIALITE-EFFECTIVE.md en T12).

## 9. Constats complémentaires

- La recherche du nom interdit par la consigne (grep insensible à la casse) sur le dépôt hors `node_modules`, `dist`, `.git` et `.playwright-mcp` : **0 résultat** (CA15, état initial).
- Le fichier `docs/juridique/cycle-de-vie-avocats.md`, cité par le cadrage et par l'avis juridique, est **absent de cette branche** (`docs/juridique` n'existe pas). Les tâches qui s'y réfèrent (T12, politique de confidentialité) devront le recréer ou en citer la source autrement.
- Les valeurs légales de l'avis juridique (stage 24 mois, sanctions de l'art. 36, bâtonnier inscrit depuis plus de 8 ans, etc.) corrigent H4 ; seul le défaut `stage.dureeMois: 24` existe aujourd'hui (`parametres.ts:35`).
- Le whitelist de statuts de `whereMembres` (`membres.ts:24`) et la table `STATUTS` de l'import (`membres.ts:~296`) doivent être étendus avec les nouveaux statuts en T2, sinon les filtres les ignorent en silence (risque R9).
