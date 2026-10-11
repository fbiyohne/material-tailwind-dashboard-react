# Audit de conformité — mission M-20261010-audit-ordre-avocats

Rapport final (tâche T30), arrêté le 2026-10-11 sur la branche `feat/audit-conformite-congres` (HEAD `0239c5f` plus le commit T30).
L'audit initial (T1, 2026-10-10, commit `f7abd37`) a été fait sur `76958a4` sans modifier le code. Ce rapport garde, pour chaque fonctionnalité, le constat initial et y ajoute le statut final, la décision, la priorité et la preuve.

Légende : ✅ conforme · ❌ incorrect · 🟡 basique · 🟠 partiel · ⚪ absent. « ✅ prototype » : livré comme prototype marqué « Expérimental » (BandeauExperimental, clause C-11), non utilisable en conditions réelles.
Priorités : P0 bloque un parcours de recette · P1 avant la présentation · P2 phase expérimentale · P3 évolution.
Les libellés juridiques suivent la loi n° 026-92 : le logiciel **enregistre** les décisions des organes compétents, il ne les prononce pas.

## 1. Référence et état final des tests

| Élément | Référence `76958a4` | Final (T30, 2026-10-11) |
|---|---|---|
| `npm test` (racine, vitest + jsdom) | 13 fichiers, 63 tests verts | **34 fichiers, 152 tests verts** |
| `cd server && npm test` (base `barreau_pn_test` du socle) | 2 fichiers, 153 tests verts | **26 fichiers, 317 tests verts** (24 fichiers et 313 tests avant les 2 fichiers T30) |
| Total | 216 | **469** (CA2 : au moins 216, au moins 94 côté front) |
| Tests de référence supprimés ou désactivés | — | **aucun** : `git diff 76958a4 --diff-filter=D -- '*.test.*'` est vide ; `api.test.ts` compte 143 `it` et 0 `.skip/.only/.todo` sur `76958a4` comme sur HEAD ; assertions modifiées : voir ci-dessous |

**Écart à CA2 et CA3 (déclaré, à valider par Fabrice).** Trois fichiers de test de référence (présents sur `76958a4`) ont été modifiés : `server/test/api.test.ts`, `src/barreau/pages/__tests__/AvocatDetail.test.jsx` et `src/barreau/components/__tests__/EditMembreModal.test.jsx`. Décompte réel : `git diff 76958a4 --numstat -- '*.test.*'` donne 61 fichiers, 5 618 lignes ajoutées, 54 supprimées, dont 49 dans `api.test.ts`, 4 dans `AvocatDetail.test.jsx` et 1 dans `EditMembreModal.test.jsx` (les 7 lignes de `pre-push.test.sh` sont des ajouts). Aucun fichier de test n'est supprimé ni désactivé (0 `.skip/.only/.todo` ajouté ; `api.test.ts` garde 143 `it`). Mais des assertions ont changé de valeur : ces changements sont des changements de comportement voulus par la revue, pas des isolations de fixtures, et contredisent donc la lettre de CA2 et CA3.

| Fichier:ligne (HEAD) | Ancienne assertion | Nouvelle assertion | Constat de revue |
|---|---|---|---|
| `server/test/api.test.ts:541` (R2-4, `valider-stage`) | SUSPENDU et OMIS : `200`, passage INSCRIT/AVOCAT | `409`, statut et qualité inchangés | R1-8 : la mesure n'est plus levée en silence |
| `api.test.ts:989` | `PATCH` statut SUSPENDU par le SG | même appel par l'ADMIN | R1-1 : suspension par PATCH exige `discipline_decider` (SG `403`) |
| `api.test.ts:1434` | `PATCH` RADIE par le SG : `200` | SG `403`, ADMIN `200` | R1-7 |
| `api.test.ts:1457, 1461, 1506, 1512` | `POST /radier` par le SG : `200` ; le SG recevait `403` pour tous les rôles | bâtonnier pour radier ; invariants `PATCH` vérifiés avec l'ADMIN ; le SG reçoit `403` (assertion explicite en 1512) | R1-7 : la radiation s'enregistre avec `discipline_decider` |
| `AvocatDetail.test.jsx:43` | « SG, membre inscrit : Radier et Déclarer le décès ; Radier ouvre la modale » | scindé : SG voit Déclarer le décès, pas Radier (ligne 43) ; bâtonnier avec `discipline_decider` voit Radier, pas Modifier ni décès (ligne 51) | R1-7 |
| `AvocatDetail.test.jsx:94` | titre « BATONNIER : aucun bouton… » | titre précisé « sans discipline_decider », assertions identiques | R1-7 |
| `EditMembreModal.test.jsx:30` | rendu sans prop | rendu avec `peutRadier` | R1-7 : « Radié » proposé au seul titulaire de `discipline_decider` |

Les autres lignes supprimées de `api.test.ts` (fixtures) : calcul de `num`, nettoyage des restes, liste RADIE filtrée par nom, blocs enveloppés dans `try/finally` (commits QA `192712d`, `847d147`, `fd53541`). Le nombre de `expect(` n'a pas diminué (558 initialement, davantage ensuite). Pour les lignes ✅ (CA3), aucune assertion de leurs tests propres n'a changé de valeur.

## 2. Comptage de contrôle (CA1)

| Comptage | Commande | Résultat |
|---|---|---|
| Cases `- [ ]` du §3 du cahier | `grep -c -- '- \[ \]' <cahier M-20261010>.md` | **40** |
| Lignes de fonctionnalité du rapport | `grep -c '^\| F-' docs/audit/AUDIT-CONFORMITE.md` | **40** |

Le cadrage annonçait « 52 fonctionnalités », mais le cahier ne contient que 40 cases. Les sous-points « À professionnaliser » sont suivis en P-01 à P-16, hors comptage.

## 3. Synthèse

| Statut | Initial (`76958a4`) | Final |
|---|---|---|
| ✅ conforme | 7 | **36** |
| ✅ prototype (expérimental, P2) | — | **4** (F-21, F-22, F-23 timbre ; F-28 vote) |
| ❌ incorrect | 6 | 0 |
| 🟡 basique | 4 | 0 |
| 🟠 partiel | 14 | 0 |
| ⚪ absent | 9 | 0 |
| **Total** | **40** | **40** |

Les 5 anomalies ❌ (X-01 à X-05) sont corrigées. Pour chacune, au moins un test échoue sur `76958a4` et passe sur la branche (§5, CA4).
Les réserves acceptées sont tracées en points ouverts : annulation d'import au stade de l'aperçu (PO-28), pièce jointe unique de 5 Mo (PO-26), corps du message dans l'e-mail de notification (PO-25, PO-29), `affaire` encore exposée par la vérification publique du timbre (PO-31), historique antérieur absent (PO-20), certificat de stage facultatif par défaut (PO-27).

## 4. Rapport par fonctionnalité

Colonnes : constat initial abrégé (preuve d'origine dans `f7abd37`), statut initial puis final, décision et réalisation, priorité, preuve finale. Les tests serveur sont dans `server/test/`, les tests front dans `src/barreau/**/__tests__/`, les captures dans `docs/captures/` (1280 et 360 px). « Parcours n » renvoie au `describe` correspondant de `server/test/parcours.test.ts` et aux captures `parcours-nn-*` de `server/scripts/recette-ui.ts`.

### Module 1 — Membres et tableau

| ID | Fonctionnalité | Constat initial | Initial | Final | Décision et réalisation | Prio | Preuve finale |
|---|---|---|---|---|---|---|---|
| F-01 | Suivi de l'entrée à la sortie, historique des changements de situation | Aucune table d'historique ; `JournalAudit` sans statut avant/après ni motif ni pièce | ⚪ | ✅ | Construit : table `EvenementSituation` ; toute écriture de statut passe par `changerSituation()` (`server/src/lib/cycleVie.ts:77`) ; `GET /membres/:id/evenements` ; onglet « Situation » avec Frise (qui, quand, pourquoi, référence, pièce, organe) | P1 | `situation-stage.test.ts` « D5 — PATCH, /radier et /deces écrivent un EvenementSituation » ; `omission.test.ts` « circuit complet … historique visible » ; `AvocatDetail.situation.test.jsx` ; captures `parcours-03-fiche-historique`, `parcours-04-reinscription-historique` |
| F-02 | Inscription sur la liste du stage puis passage au grand tableau | Passage possible, sans certificat, ni date de demande, ni durée contrôlée | 🟠 | ✅ | Complété : `POST /membres/:id/valider-stage` (`membres.ts:772`) accepte les dates de décision et de demande, la date et la référence du certificat ; la durée du stage est lue en Paramètres (409 si non atteinte) ; le certificat devient obligatoire si l'option est activée (PO-27) ; action `stage_valider` | P1 | `situation-stage.test.ts` « CA8 — durée du stage et certificat paramétrables » ; `StagePanel.test.jsx` ; Parcours 2 ; capture `parcours-02-fin-de-stage-modale` |
| F-03 | Admission directe au tableau (dérogations) | Aucune route ni champ | ⚪ | ✅ | Construit : `POST /membres/admission-directe` (`membres.ts:675`), cas et ancienneté contrôlés contre `regles.admissionDirecte` ; action `admission_directe` ; événement ADMISSION_DIRECTE | P1 | `situation-stage.test.ts` « F-03 — admission directe » (3 tests) ; `InscriptionModalBatonnier.test.jsx` ; Parcours 3 ; capture `parcours-03-admission-directe` |
| F-04 | Rattachement à un cabinet et identification de ses membres | `Cabinet`, `Membre.cabinetId`, routes cabinets | ✅ | ✅ | Ne pas toucher : `cabinets.ts` inchangé | P1 | `api.test.ts` (tests cabinets, inchangés et verts) |
| F-05 | Statuts de sortie : omission, démission, retraite, cessation, décès, radiation | DEMISSIONNAIRE, RETRAITE et CESSATION absents ; liste blanche dupliquée | 🟠 | ✅ | Complété : 3 valeurs d'enum (migration `20261010090000`), `STATUTS_SORTIS` (`business.ts:182`), événements DEMISSIONNAIRE, RETRAITE, CESSATION et REPRISE via `POST /membres/:id/evenements` ; statuts dérivés de l'enum Prisma. Les radiés restent visibles dans la liste interne, sans motif (PO-21) | P1 | `cycleVie-situation.test.ts` ; `x01-annuaire.test.ts` (DEMISSIONNAIRE absent de l'annuaire) ; `migrations.test.ts` « nouvelles valeurs d'enum … utilisables » ; `composants-audit.test.jsx` (StatutBadge, 10 statuts) |
| F-06 | Passage stage → tableau depuis la fiche, présence parmi les inscriptions récentes | `dateInscription` non modifiée, tri `dateInscription` refusé (X-04) | ❌ | ✅ | Corrigé : `dateInscription` = date de décision ; `TRI_AUTORISE` accepte `dateInscription` (`membres.ts:21`) ; colonne et tri « Inscription » dans la liste | P0 | X-04 (§5) ; `Avocats-tri.test.jsx` ; Parcours 2 ; capture `parcours-02-liste-tri-inscription` |
| F-07 | Omission ≠ radiation, mesure administrative temporaire | OMIS libre par PATCH, sans circuit ni réinscription | 🟠 | ✅ | Complété : RAPPEL → MISE_EN_DEMEURE → TRANSMISSION (même exercice, délais `regles.impayes`, 409 sinon) → OMISSION (référence obligatoire, organe « Conseil de l'Ordre national ») → REINSCRIPTION. Statut, libellé et infobulle distincts de la radiation (MentionJuridique « omission »). Circuit provisoire (PO-04) | P1 | `omission.test.ts` (11 tests, CA7 et CA8) ; `AvocatDetail.situation.test.jsx` ; Parcours 4 ; captures `parcours-04-*` |
| F-08 | Imports Excel/CSV, listes tableau et stagiaires distinctes | Pas de modèle, d'aperçu, de doublons ni d'annulation | 🟡 | ✅ | Professionnalisé : `POST /membres/import?simulation=1` (transaction annulée) renvoie créés, mis à jour, erreurs et doublons (n° et nom normalisé, fichier et base) ; colonnes obligatoires contrôlées ; modèle `public/modeles/modele-import-membres.csv` ; annulation au stade de l'aperçu (rien n'est écrit sans confirmation). Retour arrière après validation non construit (PO-28). Procédure de conversion des PDF sans OCR dans `src/barreau/README.md` | P1 | `import-simulation.test.ts` (4 tests) ; `ImportMembresModal.test.jsx` ; Parcours 1 ; captures `parcours-01-import-apercu`, `parcours-01-import-annule` |
| F-09 | Base de données partagée : persistance, synchronisation, aucune perte | PostgreSQL unique, rejeu sur collision, import idempotent | ✅ | ✅ | Ne pas toucher. Le temps réel du tableau est traité en F-10 | P1 | `api.test.ts` (anti-double-crédit, import idempotent, inchangés et verts) |
| F-10 | Tableau actualisé en temps réel, export PDF | PDF opérationnel ; ni temps réel ni date de dernière mise à jour | 🟠 | ✅ | Complété : `Membre.updatedAt` ; « Mis à jour le » = plus récent `updatedAt` des présents (`tableau.ts:27`) ; signal `tableau` sur le WebSocket existant (`realtimeTous`, `realtime.ts:58`), écouté par `TableauOrdre.jsx` | P1 | `tableau-dashboard.test.ts` « Tableau daté » ; `TableauOrdre.test.jsx` ; Parcours 7 ; captures `parcours-07-tableau-avant`, `parcours-07-tableau-apres` |

### Module 2 — Discipline et droits associés

| ID | Fonctionnalité | Constat initial | Initial | Final | Décision et réalisation | Prio | Preuve finale |
|---|---|---|---|---|---|---|---|
| F-11 | Circuit saisine → enquêteur → rapport → classement/poursuite → juridiction | Ni date de désignation, ni rapport, ni orientation, ni juridiction | 🟠 | ✅ | Complété : colonnes origine, désignation du rapporteur, date et conclusion du rapport, orientation CLASSEMENT/POURSUITE, juridiction, notification ; instruites par le SG sans effet sur la situation. Rapporteur facultatif (PO-23) | P1 | Parcours 5 « saisine → rapporteur → rapport → poursuite → juridiction → décision » ; `DossierDetail.test.jsx` ; capture `parcours-05-saisine-sg` |
| F-12 | Sanctions : avertissement, suspension, radiation, sursis | `sanction` en texte libre | ⚪ | ✅ | Construit : catalogue paramétrable (`regles.sanctions`, libellés de l'art. 36 : avertissement, réprimande, interdiction temporaire de 12 mois au plus, radiation) ; `POST /discipline/:id/decision` (`discipline.ts:178`) contrôle code, durée, sursis, peine accessoire et motivation. Le texte `sanction` est conservé et rempli | P1 | `discipline-decision.test.ts` « Catalogue des sanctions » (BLAME refusé, 13 mois refusés, catalogue modifié appliqué sans redéploiement) ; `regles.test.ts` |
| F-13 | Suspension avec sursis visible sur la fiche, sans retrait du tableau | Rien de structuré | ⚪ | ✅ | Construit : avec sursis, l'avocat reste INSCRIT, au tableau et dans le PDF ; événement SANCTION et mention C-06 sur la fiche (« non prévu par la loi n° 026-92 », PO-02) | P1 | `discipline-decision.test.ts` « interdiction avec sursis : l'avocat reste INSCRIT, au tableau, avec la mention sur sa fiche » ; Parcours 5 ; captures `parcours-05-decision-sursis`, `parcours-05-fiche-sursis` |
| F-14 | Radiation issue du disciplinaire, répercutée sur la fiche | Dossier sans effet sur la fiche | 🟠 | ✅ | Complété : décision RADIATION enregistrée → `changerSituation(RADIE)`, retrait du tableau et de l'annuaire sans autre saisie (effet paramétrable `effetRadiation`, PO-08) | P1 | `discipline-decision.test.ts` « radiation enregistrée : RADIE, retiré du tableau et de l'annuaire sans autre saisie » ; Parcours 5 ; capture `parcours-05-fiche-radiee` |
| F-15 | Droits d'accès et de validation bâtonnier / SG | SG avec toutes les permissions ; décision ouverte au SG (X-02) | ❌ | ✅ | Corrigé : catalogue `ACTIONS` dans `lib/rbac.ts` (discipline_decider, discipline_saisir, stage_valider, omission_prononcer, admission_directe), défauts R-42, SG non universel pour les actions, matrice éditable (colonnes d'actions) | P0 | X-02 (§5) ; `rbac-actions.test.ts` (7 tests) ; `MatriceAcces.test.jsx` ; Parcours 6 ; captures `parcours-06-*` |

### Module 3 — Finances et timbres numériques

| ID | Fonctionnalité | Constat initial | Initial | Final | Décision et réalisation | Prio | Preuve finale |
|---|---|---|---|---|---|---|---|
| F-16 | Cotisations, quittances, reçus, droits, timbres de plaidoirie | Cycle complet ; ville en dur (X-05) | ✅ | ✅ | Ne pas toucher au comportement. Modifications justifiées en §6 (identité X-05, statuts de sortie, helper `estRecuDroit`) | P1 | `api.test.ts` (cotisations, reçus, quitus, droits : inchangés et verts) ; `identite-documents.test.ts` |
| F-17 | Tableau de bord : effectifs tableau et stage, à jour, retardataires | Agrégats toutes qualités, sans ventilation | 🟠 | ✅ | Complété : ventilation avocats / stagiaires (effectif, à jour, retardataires), champs historiques conservés | P1 | `tableau-dashboard.test.ts` « Dashboard par qualité » |
| F-18 | Avocats et stagiaires inclus dans le suivi des impayés | Stagiaires comptés | ✅ | ✅ | Ne pas toucher. Exclusion étendue aux 3 nouveaux statuts de sortie (§6) | P1 | `api.test.ts` (inchangé) ; `tableau-dashboard.test.ts` (retardataires stagiaires) |
| F-19 | Intégration des données externes de timbres | Absente | ⚪ | ✅ | Construit : table `TimbreExterne` (référence unique), `POST /timbres/externes` idempotent (`timbres.ts:58`), import CSV/Excel lu côté front (xlsx déjà installé). Pas d'API MTN (hors périmètre) | P1 | `timbres-externes.test.ts` « importer 2 fois le même fichier laisse le même nombre de lignes » |
| F-20 | Lien cotisations → rappel / mise en demeure / transmission → omission | Relances sans trace d'étape | ⚪ | ✅ | Construit avec F-07 : étapes horodatées (permission finances), refus pour un membre à jour (409) ; `POST /cotisations/relances` inchangé | P1 | `omission.test.ts` ; Parcours 4 ; capture `parcours-04-circuit-etapes` |
| F-21 | Timbre autonome : émission numérique | Émission sandbox, sans bandeau | 🟠 | ✅ prototype | BandeauExperimental sur `Timbres.jsx` et `MesTimbres.jsx`. Aucun paiement ni aucune émission réelle (PO-13) | P2 | `Timbres.test.jsx` ; capture `parcours-T-timbres` |
| F-22 | Timbre : vérification par QR code | Vérification publique, nom de l'avocat exposé, sans bandeau | 🟠 | ✅ prototype | Bandeau ; nom de l'avocat, juridiction et montant retirés (R-64, C-12). Réserve : `affaire` reste servie par l'API, un test de référence l'exige (PO-31) ; l'écran ne l'affiche pas pour un timbre | P2 | `timbres-externes.test.ts` « Vérification publique d'un timbre » ; `Timbres.test.jsx` |
| F-23 | Timbre : statistiques produites directement | Absentes | ⚪ | ✅ prototype | `GET /timbres/stats?annee=` (`timbres.ts:72`) : volumes et montants par mois et par canal, internes et externes, en SQL paramétré ; onglet Statistiques sous le bandeau | P2 | `timbres-externes.test.ts` « les statistiques ventilent par mois et par canal » ; capture `parcours-T-timbres-statistiques` |

### Module 4 — Élections et fonctionnement institutionnel

| ID | Fonctionnalité | Constat initial | Initial | Final | Décision et réalisation | Prio | Preuve finale |
|---|---|---|---|---|---|---|---|
| F-24 | Réunions, assemblées générales, conseils | Gestion complète | ✅ | ✅ | Ne pas toucher. Modifications justifiées en §6 (dénomination paramétrée dans les convocations, statuts de sortie) | P1 | `api.test.ts` (réunions, assemblées : inchangés et verts) |
| F-25 | Scrutins : bâtonnier, conseil de l'ordre, conseil du barreau, « autre » | CONSEIL_BARREAU absent | 🟠 | ✅ | Complété : `TypeScrutin.CONSEIL_BARREAU`, `dateScrutin` | P1 | `corps-electoral-date.test.ts` « crée un scrutin du Conseil du barreau daté » ; `Elections.test.jsx` « propose le type Conseil du barreau » |
| F-26 | Corps électoral à la date du scrutin | Calcul à l'année civile (X-03) | ❌ | ✅ | Corrigé : `GET /corps-electoral?date=` / `?scrutinId=` via `electeursADate` → `situationADate` (`cycleVie.ts:152, 198`) ; `?annee=` conservé (31/12) ; vote de l'espace à la `dateScrutin`. Limite PO-20 affichée à l'écran | P0 | X-03 (§5) ; `corps-electoral-date.test.ts` (CA9) ; `cycleVie-situation.test.ts` ; Parcours 10 ; captures `parcours-10-corps-31-janvier`, `parcours-10-corps-aujourdhui` |
| F-27 | Conditions d'éligibilité paramétrables | Critères en dur | ❌ | ✅ | Corrigé : `regles.electoral` et `regles.eligibilite` (ancienneté stricte pour le bâtonnat, peine accessoire) ; candidature refusée en 409 motivé | P0 | `corps-electoral-date.test.ts` « bâtonnat : exactement 8 ans → 409 … seuil modifiable en Paramètres » ; `Elections.test.jsx` « affiche le refus motivé » |
| F-28 | Vote électronique : présentiel ou distance, authentification, secret, suivi | Mécanisme en place, sans bandeau ni contrôle de candidature | 🟠 | ✅ prototype | Bandeau sur `Elections.jsx` et `EspaceScrutins.jsx` ; contrôle des candidatures ; suivi = nombre de votants affiché. Mécanisme de vote inchangé (F-29). Jamais pour un scrutin officiel (PO-18) | P2 | `Elections.test.jsx` « Elections affiche le bandeau, sans promesse de secret garanti », « EspaceScrutins affiche le bandeau » ; capture `parcours-T-elections` |
| F-29 | À tester : confidentialité du choix, fiabilité, informations pendant le vote | Choix non relié au votant, voix masquées avant publication | ✅ | ✅ | Ne pas toucher au mécanisme. `espace.ts` touché seulement pour la date de référence du scrutin (X-03), §6 | P2 | `api.test.ts` (vote, inchangés et verts) ; `corps-electoral-date.test.ts` « le vote s'apprécie à la dateScrutin » |

### Module 5 — Messagerie et réseau privé des avocats (priorité majeure)

| ID | Fonctionnalité | Constat initial | Initial | Final | Décision et réalisation | Prio | Preuve finale |
|---|---|---|---|---|---|---|---|
| F-30 | Espace professionnel : avocats entre eux et avec les autorités ordinales | Fils confrère et administration cloisonnés ; l'e-mail de notification reproduit le corps | ✅ | ✅ | Ne pas toucher. Réserve de confidentialité consignée (PO-25, PO-29) | P1 | `api.test.ts` (messagerie, inchangés et verts) ; `messagerie-pj.test.ts` « l'ADMIN ne peut lire ni un fil entre confrères, ni sa pièce, ni son accusé (404) » |
| F-31 | Recherche d'un confrère et ouverture d'une conversation | Annuaire non filtré, destinataire hors tableau accepté (X-01) | ❌ | ✅ | Corrigé : `STATUTS_ANNUAIRE` (INSCRIT, STAGIAIRE, HONORAIRE) sur `GET /espace/annuaire` (`espace.ts:345`) ; 403 sur un destinataire hors annuaire | P0 | X-01 (§5) ; Parcours 8 ; capture `parcours-08-annuaire` |
| F-32 | Bouton « Contacter » depuis la fiche | Absent | ⚪ | ✅ | Construit : `POST /messagerie` (fil administration → membre ; 404 inconnu, 409 sorti, 403 avocat) ; bouton sur AvocatDetail (ContacterModal) et dans EspaceAnnuaire | P1 | `messagerie-pj.test.ts` (POST /messagerie) ; `attestations.test.ts` ; `Messagerie.test.jsx` ; Parcours 8 ; capture `parcours-08-nouveau-message` |
| F-33 | Envoi de correspondances, conclusions et pièces | Texte seul | 🟠 | ✅ | Complété : une pièce par message, 5 Mo, PDF/DOCX/JPG/PNG vérifiés par leurs octets (`typeReel`), stockée sous `messagerie/`, téléchargement réservé aux participants (nosniff, Content-Disposition RFC 6266). Limite : PO-26 | P1 | `messagerie-pj.test.ts` « Pièce jointe » (4 tests) ; `Messagerie.test.jsx` ; capture `parcours-08-fil-envoye` |
| F-34 | Accusés de réception horodatés et imprimables | Absents | ⚪ | ✅ | Construit : `recuAt` et `luAt` posés une seule fois ; statuts envoyé/reçu/lu (StatutMessage) ; accusé de lecture PDF (métadonnées, empreinte SHA-256, heure de Brazzaville, pied C-01 mot pour mot, sans le corps). Aucune valeur probatoire revendiquée (PO-15) | P1 | `messagerie-pj.test.ts` « Statuts reçu / lu » et accusé PDF (participant 200, tiers 403) ; capture `parcours-08-statut-lu-accuse` |
| F-35 | Demandes d'attestations, délivrance, archivage | Délivrance immédiate, ni demande ni file | 🟠 | ✅ | Complété : `POST /espace/attestations/demandes` (`espace.ts:759`), délivrance `POST /messagerie/:id/attestation` (`messagerie.ts:217`) en une transaction (numéro ATT, PDF joint, archive) | P1 | `attestations.test.ts` (5 tests, dont échec PDF sans trou de numérotation) ; Parcours 8 ; captures `parcours-08-demande-attestation`, `parcours-08-attestation-delivree` |

### Module 6 — Documents, audit et personnalisation

| ID | Fonctionnalité | Constat initial | Initial | Final | Décision et réalisation | Prio | Preuve finale |
|---|---|---|---|---|---|---|---|
| F-36 | Téléversement des pièces du dossier par l'avocat | Type déclaré par le client, non contrôlé | 🟡 | ✅ | Professionnalisé : `POST /espace/pieces` retient le type réel lu dans les octets (`typeReel`) | P1 | `messagerie-pj.test.ts` « F-36 — POST /espace/pieces vérifie le type réel » ; Parcours 9 ; capture `parcours-09-piece-deposee` |
| F-37 | Validation ou rejet avec notification et corrections demandées | Motif facultatif, aucune notification | 🟠 | ✅ | Complété : motif obligatoire (3 à 500 caractères), notification de l'avocat au rejet (motif inclus) et à la validation | P1 | `pieces-rejet.test.ts` (3 tests) ; `Pieces.test.jsx` ; Parcours 9 ; captures `parcours-09-*` |
| F-38 | Archives, annuaire, publications | Annuaire non conforme (X-01) | ❌ | ✅ | Annuaire corrigé (F-31) ; archives et publications non touchées | P0 | X-01 (§5) ; `api.test.ts` (archives, publications : inchangés et verts) |
| F-39 | Journal d'audit sans accès aux conversations privées | Pas de filtre utilisateur/action, journal modifiable, consultations non tracées | 🟡 | ✅ | Professionnalisé : filtres `userId`, `action` et dates ; envoi de message tracé « message #id », jamais le corps ; lecture d'un dossier disciplinaire et du casier tracée ; trigger `journal_audit_immuable` (UPDATE/DELETE refusés en base, TRUNCATE non couvert) ; aucune route d'écriture ; la réinitialisation ne vide plus le journal | P1 | `audit-journal.test.ts` (11 tests, dont « le texte envoyé n'apparaît dans aucune colonne de JournalAudit ») ; `migrations.test.ts` « JournalAudit : UPDATE et DELETE lèvent une exception » ; `JournalAudit.test.jsx` ; Parcours 12 ; captures `parcours-12-*` |
| F-40 | Personnalisation par barreau : logo, identité, reçus, documents | « Pointe-Noire » en dur (X-05), libellés fixes dans l'interface | 🟡 | ✅ | Professionnalisé : `identite.ville`, dénomination et logo dans tous les documents et e-mails ; route publique `GET /auth/identite` (sans signataires ni coordonnées) pour la connexion et l'espace avocat ; mention C-13 en mode démonstration. Couleurs non personnalisables (impératif de design, D14). Logo limité à une data URI image base64 (T30, §8) | P1 | X-05 (§5) ; `identite-publique.test.ts` ; `securite-logo.test.ts` ; `DocumentsIdentite.test.jsx` ; Parcours 11 ; captures `parcours-11-recu-apercu`, `parcours-11-quitus` |

## 5. Anomalies ❌ : tests rouges sur `76958a4`, verts sur la branche (CA4)

Procédure de contrôle rejouée en T30 : copie des fichiers de test dans un worktree détaché sur `76958a4`, `node_modules` du serveur reliés par jonction, même base `barreau_pn_test`, puis `npx vitest run <fichiers>`. Le worktree a été retiré ensuite. Sur la branche, les mêmes fichiers sont verts dans la suite complète (317/317).

| ID | Constat | Correction (commit) | Tests nommés | Résultat sur `76958a4` |
|---|---|---|---|---|
| X-01 | `GET /espace/annuaire` liste radiés, décédés, omis et sortis avec téléphone et e-mail ; `POST /espace/messagerie` accepte un destinataire hors tableau | `2cd740d` | `x01-annuaire.test.ts` : « un RADIE, un DECEDE, un OMIS et un DEMISSIONNAIRE sont absents ; aucune de leurs coordonnées ne fuit » ; « message vers un radié : 403 ; vers un inscrit : 201 ; vers un id inexistant : 404 » | rouge : membre radié présent dans l'annuaire ; `expected 201 to be 403` |
| X-02 | `PATCH /discipline/:id` enregistre décision, sanction et statut pour le SG | `1285303`, `200cef9` | `x02-x03-reference.test.ts` « X-02 : le SG ne peut pas enregistrer décision, sanction ni statut DECISION (403) » ; `discipline-decision.test.ts` « POST /decision : SG 403, BATONNIER 200 ; PATCH … SG 403 » | rouge : `expected 200 to be 403` (`discipline-decision.test.ts` échoue dès l'import, `lib/regles.ts` n'existant pas à la référence) |
| X-03 | Corps électoral à l'année civile, `?date=` ignoré | `5b65720` | `x02-x03-reference.test.ts` « X-03 : à une date antérieure au paiement, l'avocat n'est pas électeur ; après, il l'est » ; `corps-electoral-date.test.ts` « deux dates encadrant un paiement donnent deux listes différentes » | rouge : `expected true to be false` (même liste aux deux dates) |
| X-04 | `valider-stage` ne fixe pas `dateInscription` ; tri par date d'inscription refusé | `1da5b00`, `0ac8288` | `situation-stage.test.ts` : « dateInscription = dateDecision, événement PASSAGE_TABLEAU daté de la décision » ; « GET /membres?sort=dateInscription trie réellement par date d'inscription (200) » | rouge : `expected '2023-01-10' to be '2026-03-15'` ; ordre `[24790, 24791]` au lieu de `[24791, 24790]` |
| X-05 | Reçu et quitus : « Pointe-Noire » en dur | `97268d7`, `1832ed1` | `identite-documents.test.ts` : « reprend dénomination, ville et logo, sans « Pointe-Noire » » ; « le texte extrait du reçu et du quitus PDF porte la nouvelle identité, zéro « Pointe-Noire » » (CA11) | rouge : `expected … not to contain 'Pointe-Noire'` ; texte PDF sans « Brazzaville, le » |

Commande sur la branche : `cd server && npx vitest run test/x01-annuaire.test.ts test/x02-x03-reference.test.ts test/discipline-decision.test.ts test/corps-electoral-date.test.ts test/situation-stage.test.ts test/identite-documents.test.ts`.

### Compléments « À professionnaliser » (hors comptage des 40)

| ID | Point | Initial | Final | Preuve ou renvoi |
|---|---|---|---|---|
| P-01 | Import : modèle, colonnes, doublons, aperçu, annulation | 🟡 | ✅ (annulation à l'aperçu, PO-28) | F-08 |
| P-02 | Historique des statuts | ⚪ | ✅ | F-01 |
| P-03 | Tableau PDF : en-tête, ordre, date de mise à jour | 🟡 | ✅ | F-10 |
| P-04 | Listes PDF sources : procédure, pas d'OCR | ⚪ | ✅ | `src/barreau/README.md` (procédure de conversion) |
| P-05 | Dossier disciplinaire horodaté, pièces, décisions, délais | 🟠 | ✅ | F-11 à F-14 |
| P-06 | Matrice rôles/droits configurable | 🟠 | ✅ | F-15 |
| P-07 | Confidentialité de la discipline : accès restreint, consultation journalisée | ✅ | ✅ | `audit-journal.test.ts` (lecture et casier tracés) |
| P-08 | Règles de sanctions et de sursis paramétrables | ⚪ | ✅ | F-12, `regles.test.ts` |
| P-09 | Reçus et quittances personnalisés | 🟡 | ✅ | F-40 |
| P-10 | Relances, historique des paiements, états mensuels | 🟡 | ✅ | F-20, F-23 ; relances par lots (`cc43836`) |
| P-11 | Messagerie : statuts envoyé/reçu/lu | 🟠 | ✅ | F-34 |
| P-12 | Pièces jointes : taille, formats, aperçu | ⚪ | ✅ (1 pièce, 5 Mo, PO-26) | F-33 |
| P-13 | Accusé imprimable horodaté | ⚪ | ✅ | F-34 |
| P-14 | Journal filtrable et non modifiable | 🟡 | ✅ | F-39 |
| P-15 | Thème par barreau appliqué partout | 🟡 | ✅ (sans couleurs, D14) | F-40 |
| P-16 | Audio, visio, passerelle juridictions | ⚪ | ⚪ reporté (P3) | §9 |

## 6. Non-régression des lignes ✅ (CA3)

Les 7 lignes ✅ d'origine (F-04, F-09, F-16, F-18, F-24, F-29, F-30) gardent leur comportement : leurs tests de `api.test.ts` passent sans modification d'assertion (seules des fixtures ont été isolées, §1). Fichiers de ces lignes modifiés, avec leur justification :

| Fichier | Lignes concernées | Modification | Justification |
|---|---|---|---|
| `server/src/routes/cotisations.ts` | F-16, F-18 | « Barreau de Pointe-Noire » → `identite().denomination` dans les relances e-mail et SMS ; `STATUTS_HORS_TABLEAU` → `STATUTS_SORTIS` | X-05 ; les 3 statuts de sortie volontaire (F-05) ne doivent recevoir ni relance ni appel de cotisation |
| `server/src/routes/recus.ts` | F-16 | `estRecuDroit(objet)` remplace le test en ligne `includes("droit")` | Règle unique partagée avec le corps électoral (cotisation à la date) ; comportement identique |
| `server/src/routes/droits.ts` | F-16 | Relances envoyées par lots de 5 en parallèle | Délai de 38,7 s ramené à 12 s (`cc43836`) ; test R1-6 inchangé et vert |
| `server/src/lib/documentsRiches.ts`, `templates.ts`, `identiteDocuments.ts` | F-16 | Identité paramétrée (dénomination, ville, logo, coordonnées) | X-05, CA11 ; logo base64 strict (T30) |
| `server/src/routes/assemblees.ts`, `reunions.ts` | F-24 | Dénomination paramétrée dans les convocations ; destinataires hors `STATUTS_SORTIS` | X-05, F-05 |
| `server/src/routes/espace.ts` | F-29, F-30 | Annuaire filtré, pièces jointes, accusés, demande d'attestation, éligibilité au vote à la `dateScrutin` | X-01, F-33 à F-35, X-03 ; mécanisme du vote (émargement, décompte agrégé) inchangé |
| `server/src/routes/messagerie.ts` | F-30 | Contacter, pièce jointe, accusé, délivrance d'attestation | F-32 à F-35 ; cloisonnement `avecAdministration` conservé, fils entre confrères en 404 pour l'administration |
| `server/src/lib/business.ts` | F-09, F-16 | `STATUTS_SORTIS`, `STATUTS_ANNUAIRE`, `eligibiliteElectorale(…, regles?)` rétrocompatible, `estRecuDroit` | F-05, X-01, F-27 ; signatures existantes conservées (importées par `api.test.ts`) |

`cabinets.ts` et `conseil.ts` (F-04, F-24) sont inchangés.

## 7. Parcours de recette (§5 du cahier, CA5)

| Parcours | Intitulé | Test API (`server/test/parcours.test.ts`) | Interface (port 4100) | État final |
|---|---|---|---|---|
| 1 | Import tableau et stagiaires avec erreurs | « Parcours 1 » | `parcours-01-*` | vert |
| 2 | Passage stagiaire → tableau | « Parcours 2 » | `parcours-02-*` | vert |
| 3 | Admission directe | « Parcours 3 » | `parcours-03-*` | vert |
| 4 | Impayés → omission → réinscription | « Parcours 4 » | `parcours-04-*` | vert |
| 5 | Dossier jusqu'au sursis puis radiation | « Parcours 5 » | `parcours-05-*` | vert |
| 6 | Droits bâtonnier / SG | « Parcours 6 » | `parcours-06-*` | vert |
| 7 | Tableau : temps réel et PDF | « Parcours 7 » | `parcours-07-*` | vert |
| 8 | Messagerie : recherche, Contacter, pièce, accusé, attestation | « Parcours 8 » | `parcours-08-*` | vert |
| 9 | Pièce : rejet motivé, notification, nouveau dépôt, validation | « Parcours 9 » | `parcours-09-*` | vert |
| 10 | Corps électoral à une date et éligibilité | « Parcours 10 » | `parcours-10-*` | vert |
| 11 | Reçu personnalisé à l'identité d'un barreau | « Parcours 11 » | `parcours-11-*` | vert |
| 12 | Journal d'audit sans contenu privé | « Parcours 12 » | `parcours-12-*` | vert |

Relance :
- API : `cd server && npx vitest run test/parcours.test.ts` (12 `describe`, un par parcours, base `barreau_pn_test`).
- Interface : procédure de `docs/captures/README.md` (`npm run demo -- --identite=demonstration`, `scripts/relancer-test.ps1`, puis `npx tsx scripts/recette-ui.ts parcours`). Dernier bilan : 37 contrôles sur 37, 44 captures, aucune réponse 5xx, aucun défilement horizontal à 360 px (`docs/captures/recette-ui-parcours.json`).

Design (CA13) : `tailwind.config.cjs` et `public/css/tailwind.css` n'ont changé que dans `dd9f2dd` (`.bpn-badge-or` en `text-or-fonce`, contraste AA). Les captures avant/après des écrans Avocats, AvocatDetail, Tableau et Messagerie ne montrent que des ajouts fonctionnels (`docs/captures/README.md`). La seule retouche T30 de l'interface est textuelle : « Espace sécurisé » et « Accès sécurisé » deviennent « Espace réservé » et « Accès réservé » sur les écrans de connexion (§8). Les captures `parcours-00-connexion-*` sont antérieures à ce libellé.

## 8. Revue sécurité et juridique (T30)

Périmètre : diff `76958a4..HEAD`, soit 118 fichiers sous `server/src`, `server/prisma` et `src/`. Méthode : OWASP Top 10:2025 et ASVS 5.0, revue différentielle ciblée sur l'IDOR des pièces jointes, le secret professionnel, X-01, le RBAC et le trigger, puis relecture de l'interface et de `docs/DEMO-CONGRES.md` contre les clauses C-01 à C-14.

**Aucun constat de gravité haute ou critique.** Constats et décisions :

| # | Gravité | Constat | Chemin | Décision |
|---|---|---|---|---|
| S-01 | Moyenne (corrigé) | Le logo de l'identité était inséré tel quel dans `<img src="…">` des gabarits PDF (`templates.ts:14`, `documentsRiches.ts:24`). La validation de `PUT /parametres` ne contrôlait que le préfixe `data:image/`, si bien qu'un guillemet sortait de l'attribut (injection HTML rendue par Chromium côté serveur). Le logo est en outre servi publiquement depuis T29 (`GET /auth/identite`) | Compte avec la permission `parametres` → `Parametres.data.identite.logo` → `rafraichirIdentite()` → gabarits PDF | **Corrigé** à la source unique : `identiteDocuments.ts` ne retient qu'une data URI image en base64 stricte, sinon le sceau dessiné. Test `securite-logo.test.ts`, rouge sur `76958a4` et sur `0239c5f`, vert après correctif |
| S-02 | Basse (corrigé) | Les écrans de connexion affichaient « Espace sécurisé » et « Accès sécurisé » : une promesse de sécurité non démontrée (CA12) | `Login.jsx`, `MotDePasseOublie.jsx`, `ReinitialiserMotDePasse.jsx` | **Corrigé** : « Espace réservé » et « Accès réservé ». Contrôle par grep, aucune occurrence de « sécuris » dans `src/barreau` hors tests |
| S-03 | Basse (accepté) | Repli des actions RBAC par catégorie : un rôle dont l'ADMIN décoche toutes les actions retrouve ses actions par défaut. Seul le bâtonnier est concerné (cinq actions par défaut) | `lib/rbac.ts` `effectives()` ; test `rbac-actions.test.ts` « repli par catégorie » | Choix d'architecture D2, qui protège les bases existantes. Visible dans la matrice après rechargement, réservé à l'ADMIN, et un retrait partiel est respecté. À traiter par une ligne sentinelle si l'Ordre veut un bâtonnier sans aucune action |
| S-04 | Basse (accepté, PO-31) | `GET /verifier/timbre/:code` (public) renvoie encore le champ `affaire`, qui peut contenir un nom de partie, alors que R-64 limite la réponse au numéro, à la date et à la validité. L'écran ne l'affiche pas | `verification.ts:81` ; exigé par un test de référence (`api.test.ts`, vérification de timbre) | Non modifié (CA2 interdit de modifier ce test). Exposition limitée au détenteur du code (QR). À retirer après accord de Fabrice |
| S-05 | Basse (accepté) | `POST /discipline/:id/decision` : deux enregistrements simultanés du même dossier passeraient le contrôle `sanctionCode` avant écriture ; l'effet sur la fiche est appliqué hors de la transaction de mise à jour du dossier | `discipline.ts:178` | Réservé au titulaire de `discipline_decider`, sans gain pour un attaquant ; la machine à états refuse les transitions incohérentes. Amélioration : `updateMany where sanctionCode IS NULL` en verrou |
| S-06 | Info | La réinitialisation des données (`POST /parametres/reinitialiser-donnees`, ADMIN) supprime les messages mais laisse les fichiers joints sur le disque | `parametres.ts:141` | Pas une vulnérabilité ; purge disque à prévoir avec la politique de conservation (PO-16) |

Contrôles sans constat :
- **IDOR des pièces jointes** : côté espace, `monMessage()` exige la participation au fil (403, sinon). Côté administration, `messageAdministration()` répond 404 pour un fil entre confrères, ADMIN compris. Aucune route ne sert `pieceFichier`. Le type est lu dans les octets ; le fichier est servi avec nosniff, en `inline` seulement pour PDF, JPG et PNG, avec un nom assaini. La limite JSON de 8 Mo est inchangée. Tests : `messagerie-pj.test.ts` (tiers 403, ADMIN 404).
- **Secret professionnel** : `JournalAudit` ne reçoit que « message #id » (`res.locals.auditDetail`) ; aucun corps de requête n'est journalisé. `JournalNotification` ne garde que l'objet générique de l'e-mail. Aucune autre route ne lit `Message` (grep). Réserve existante : le corps du message figure dans l'e-mail de notification (F-30 ✅, PO-25, PO-29).
- **X-01** : filtre `STATUTS_ANNUAIRE` sur l'annuaire et contrôle du destinataire par identifiant ; le jeton AVOCAT est confiné à `/espace` et `/auth` par le middleware global.
- **RBAC** : toutes les nouvelles routes portent `requirePermission` (actions) ou `requireRole`. `POST /membres/:id/evenements` contrôle l'action selon le type d'étape et vérifie que la pièce appartient au membre. `PUT /rbac` refuse les clés inconnues (400) et les rôles non éditables.
- **Trigger d'immuabilité** : `BEFORE UPDATE OR DELETE` sur `JournalAudit`, créé sans DROP. Aucune clé étrangère vers `JournalAudit`, donc la suppression d'un utilisateur n'est pas bloquée. TRUNCATE n'est pas couvert, et le rapport ne l'annonce pas comme couvert.
- **Injection** : les statistiques de timbres passent par `Prisma.sql` paramétré ; les champs libres des gabarits PDF sont échappés ; l'interception anti-SSRF du rendu PDF est conservée.
- **CA12** : le pied C-01 de l'accusé est conforme mot pour mot (`templates.ts:489`, dénomination paramétrée à la place de « [nom] »). Le bandeau Expérimental est présent sur Timbres (onglet Statistiques compris), MesTimbres, VerificationPublique, Elections et EspaceScrutins. `DEMO-CONGRES.md` emploie les libellés de l'art. 36 et « décision enregistrée », et liste les formules interdites. Aucune promesse de chiffrement, d'hébergement ou de valeur probatoire. L'identité Brazzaville est refusée par le script de démonstration sans accord écrit.

## 9. Étude : modules complémentaires (audio, visioconférence, passerelle juridictions)

Étude documentaire seulement, rien n'est construit (P-16, P3).

- Appels audio et visioconférence : la messagerie actuelle (WebSocket `realtime.ts`, signaux seulement) n'a pas de transport média. Deux voies s'offrent. La première intègre un service tiers : un lien de salle est généré dans le fil, et aucun média ne transite par l'application. La seconde héberge un serveur WebRTC (SFU), avec un coût d'exploitation, des enjeux de bande passante en Afrique centrale et une responsabilité accrue sur le secret professionnel (art. 52 de la loi 026-92). Recommandation : commencer par le lien de salle d'un prestataire, en indiquant clairement que le contenu des appels échappe à la plateforme.
- Passerelle avec les juridictions : elle suppose un interlocuteur institutionnel (greffes, parquets), un format d'échange convenu et un cadre juridique de notification électronique, que les recherches n'ont pas trouvé. À étudier après le pilote. Elle ne remplace pas la lettre recommandée exigée par les art. 39 et 42.
- Continuité de service : elle dépend de l'hébergement de production, non établi (`docs/juridique/registre-traitements.md`, transfert hors du Congo : loi n° 29-2019, art. 23).

## 10. Constats complémentaires

- **CA16** : `git diff 76958a4 --name-only --diff-filter=AM` puis grep insensible à la casse du nom de produit écarté par la consigne : **0 fichier**. Aucun écran ni identifiant n'a été renommé.
- **CA17** : `git status -sb` → `feat/audit-conformite-congres...origin/feat/audit-conformite-congres [ahead N]`, N = `git rev-list --count origin/feat/audit-conformite-congres..HEAD` ; 13 au moment de la rédaction, ce commit compris. **CA17 n'est pas rempli au sens littéral** (le critère exige ni ahead ni behind) : la branche distante existe et a été poussée hors consigne, et l'écart ne se résorbe que par une action interdite (push des commits locaux d'avance, ou push forcé). T30 n'a rien poussé ; `git branch --unset-upstream` masquerait l'écart et n'est pas utilisé. Écart à valider par Fabrice (§11, point 2). En revanche, le journal des références distantes montre deux pushs faits depuis ce dépôt le 2026-10-11, contraires à la consigne « ne rien pousser » : `origin/feat/audit-conformite-congres` à `847d147` (09:14), puis surtout **`origin/claude/file-context-analysis-ixq8w3` (branche de production, autodéploiement Render) à `2203bd5` (14:17)**. Voir §11.
- **F-15, radiation hors dossier (R1-7, corrigé)** : `POST /membres/:id/radier` exige désormais l'action `discipline_decider` (`requirePermission`, bâtonnier par défaut, ADMIN) au lieu de `requireRole("SECRETAIRE_GENERAL")`. Le SG reçoit 403 et la fiche reste inchangée, aucun `EvenementSituation` n'est écrit. Le bouton « Radier » de la fiche ne s'affiche qu'avec cette permission (`AvocatDetail.jsx`). Tests : `radier-permission.test.ts` (SG 403, bâtonnier 200, ADMIN 200 ; rouge avant, vert après) ; `api.test.ts` « O3 » (SG 403 sur `/radier`) et les tests de radiation passés au jeton bâtonnier ; `AvocatDetail.test.jsx` (SG sans Radier, bâtonnier avec Radier). Seconde voie fermée (reprise QA) : `PATCH /membres/:id` (« Modifier ») refuse au SG, en 403, tout passage en RADIE et toute levée de radiation (RADIE vers un autre statut que DECEDE) ; le SG corrige encore la date ou la référence d'un radié sans changer son statut, et déclare un décès. L'option « Radié » du formulaire « Modifier » n'est proposée qu'avec `discipline_decider` (`EditMembreModal.jsx`, prop `peutRadier`). Aucune autre voie : l'import refuse tout changement vers ou depuis un statut de sortie, `POST /membres` refuse la création en RADIE, `/evenements` n'accepte aucun type RADIATION, et le seul autre appel de `changerSituation` vers RADIE est la décision disciplinaire (`discipline_decider`). Tests : `radier-permission.test.ts` « PATCH et import ne contournent pas discipline_decider » (SG PATCH RADIE 403 sans événement, SG levée de radiation 403, correction de référence 200, ADMIN 200, import « radié » en erreur ; rouges avant, verts après) ; `api.test.ts` « correction d'une saisie » et « R2-4 » (SG 403, invariants rejoués avec l'ADMIN) ; `EditMembreModal.r15.test.jsx` (option « Radié » selon la permission). PO-34 clos.
- **F-15, routes génériques du SG (R1-1, corrigé)** : `PATCH /membres/:id` (« Modifier ») et l'import ne contournent plus la séparation bâtonnier / SG. Sans l'action concernée, PATCH répond : 409 pour tout passage vers ou depuis OMIS (circuit `POST /membres/:id/evenements`, `omission_prononcer`) ; 403 puis 409 pour un stagiaire passé au tableau, en qualité (AVOCAT, HONORAIRE) comme en statut (INSCRIT, HONORAIRE) (`stage_valider`, puis « Valider la fin de stage ») ; 403 pour imposer une suspension ou une radiation, ou lever une radiation (`discipline_decider` : la sanction s'enregistre par la décision du dossier disciplinaire) ; 403 pour lever une suspension tant qu'une interdiction ferme court (`sanctionFin` future), la REPRISE répondant 409 dans ce cas. L'import refuse tout changement de statut d'un membre existant vers ou depuis OMIS, SUSPENDU ou un statut de sortie, ainsi que toute ligne dont la paire effective (colonne absente = valeur existante) serait qualité stagiaire avec statut inscrit ou honoraire, création comprise, et tout changement de qualité d'un stagiaire existant (R1-5, reprise QA 2 : `r1-5-contournement.test.ts`, bloc « aucun stagiaire au tableau », rouge avant, vert après). « Modifier » ne propose « Suspendu » et « Radié » qu'avec `discipline_decider` (`EditMembreModal`). Preuves : `separation-roles.test.ts`, `r1-5-contournement.test.ts`, `radier-permission.test.ts`, `omission.test.ts` (R1-8), `EditMembreModal.r15.test.jsx`. Reste ouvert (non bloquant) : `POST /membres` crée encore un membre directement en SUSPENDU (reprise de données).
- **F-01/F-15, transitions de statut concurrentes (R1-11, corrigé)** : `changerSituation` (`server/src/lib/cycleVie.ts`) verrouille la fiche (`SELECT … FOR UPDATE`) avant de la lire : deux transitions d'un même membre s'enchaînent (statutAvant du second = statutApres du premier). L'accès à l'espace avocat est écrit dans la même transaction (`reconcilierAcces`) : statut changé, l'accès suit (coupé ou rétabli) ; statut inchangé, un accès resté ouvert sur un statut bloquant est coupé, mais un compte n'est jamais réactivé (un compte désactivé à la main par l'administrateur le reste après un avertissement, une réprimande ou un sursis : régression relevée par la QA sur `b7604f2`, corrigée). Les gardes évaluées hors verrou sont revérifiées sous verrou par `statutAttendu` (409 « situation modifiée par ailleurs ») : `PATCH /membres/:id` avec changement de statut, `/radier` (« déjà radié »), `/deces`, `/evenements` (omission, réinscription, reprise, sorties) et `valider-stage`. `PATCH` sans changement de statut et la mise à jour d'un membre existant par l'import relisent la fiche sous verrou et répondent 409 (ligne d'import en erreur) si le statut a changé, au lieu de rétablir un radié en INSCRIT. Preuves : `server/test/cycle-vie-concurrence.test.ts` (9 cas au total ; 6 cas d'origine : historique chaîné, compte désactivé conservé après SANCTION, coupure d'un accès ouvert sur un radié, PATCH sans et avec changement de statut et `/radier` pendant une radiation tenue sous verrou, course rendue déterministe par `pg_blocking_pids` ; les 4 derniers rouges avant, verts après). Provisionnement et activation de l'accès (reprise QA) : `provisionnerAccesEspace` (`server/src/lib/acces.ts`) contrôle le statut et écrit le compte et son lien sous le même verrou de fiche ; une radiation concurrente attend ce verrou, puis trouve le compte et invalide le lien (chemins `POST /membres/:id/acces` et approbation d'une demande d'accès). `POST /auth/activer` relit la fiche sous verrou et répond 409 si le statut est bloquant (radié, omis, suspendu, sorti, décédé), même avec un lien encore présent. `POST /discipline/:id/decision` passe `statutAttendu` à la suspension et à la radiation et refuse (409) une interdiction ferme sur un radié ou un décédé : une décision ne lève plus une radiation hors circuit. Preuves complémentaires dans le même fichier (3 cas, rouges avant, verts après) : radiation pendant un provisionnement tenu par `LOCK TABLE "User"` (lien invalidé, activation refusée, compte inactif), activation refusée à un radié muni d'un lien, interdiction ferme sur un radié (409, fiche RADIE, aucun événement, dossier libre). Non couvert : les étapes de recouvrement (rappel, mise en demeure, transmission) écrivent leur événement sans verrou, sans effet sur le statut ni sur l'accès. Traçabilité : `b7604f2`, étiqueté R1-11, contient aussi des fichiers R1-1 (voir `8e238b6`) ; il n'a pas été réécrit, la branche étant partagée.
- Le fichier `docs/juridique/cycle-de-vie-avocats.md` existe désormais (`a414fbb`).
- Le jeu de démonstration (`npm run demo`) refuse toute base autre que `barreau_pn_test` et toute identité de barreau réel. Il est idempotent (`demo-idempotence.test.ts`) et ne touche pas les membres de test existants.

## 11. À valider par Fabrice

1. **Branche de production poussée** : `origin/claude/file-context-analysis-ixq8w3` pointe sur `2203bd5` (travail de la mission jusqu'à T28), poussé le 2026-10-11 à 14:17 depuis ce poste. Si l'autodéploiement Render s'est déclenché, les migrations `20261010090000` et `20261010090100` (dont le trigger d'immuabilité du journal) ont pu s'appliquer à la base de production. Il faut vérifier sur Render et décider : conserver le déploiement, ou revenir en arrière. Un retour en arrière est un push forcé : action destructive, non faite. Garde-fou local ajouté (R1-2) : hook `scripts/git-hooks/pre-push`, activé sur ce poste par `git config core.hooksPath scripts/git-hooks`, qui refuse tout push vers `claude/file-context-analysis-ixq8w3` (test : `sh scripts/git-hooks/pre-push.test.sh` ; vérifié par `git push --dry-run`, refusé). Ce hook ne protège que ce poste : la protection de branche GitHub (revue obligatoire, push direct interdit) reste à poser par Fabrice.
2. Push de `feat/audit-conformite-congres` (les commits locaux d'avance, 13 à ce jour, commit de cette retouche compris) et fusion vers la production : non faits. Décision attendue : pousser les commits locaux d'avance (CA17 rempli) ou les garder en local en acceptant l'écart sur CA17.
3. Activation du trigger `journal_audit_immuable` en production, et procédure DBA de désactivation pour les purges de conservation.
4. Retrait du champ `affaire` de la vérification publique du timbre (S-04, PO-31) : il faut lever l'assertion du test de référence `api.test.ts`.
5. Accord écrit d'un barreau tiers avant tout affichage de son identité (PO-22) ; contrat de sous-traitance ; formalités auprès de la Commission de protection des données (loi n° 29-2019, art. 33 et 37) ; lieu d'hébergement de la production (art. 23).
6. Remise de `docs/audit/POINTS-OUVERTS.md` (PO-01 à PO-34, PO-34 clos) à Me Kalina MENGA.
7. Nettoyage des ~130 membres de test de `barreau_pn_test` (suppression de données, hors mission).
