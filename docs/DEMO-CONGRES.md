# Scénario de démonstration du congrès (20 minutes au plus)

> **Instance de démonstration. Toutes les personnes, cabinets, montants et décisions sont fictifs. Toute ressemblance avec une personne réelle est fortuite. Les règles signalées « Provisoire » ne sont pas des règles officielles de l'Ordre.**

Cette mention (clause DONNÉES DE DÉMONSTRATION, `docs/juridique/clauses-congres.md`) se lit à voix haute en ouverture et reste visible sur l'en-tête, les reçus et le PDF du tableau tant que l'identité de démonstration est active (C-13 : « Données entièrement fictives — toute ressemblance avec une personne réelle serait fortuite. Barreau de démonstration. »).

Public visé : avocats réunis en congrès à Brazzaville. Le logiciel est montré à titre de démonstration ; il n'engage aucun barreau et ne remplace aucun texte de l'Ordre.

## 1. Prérequis et installation

Poste de démonstration : instance **locale** (pas de dépendance au réseau du lieu), base `barreau_pn_test` du socle Docker partagé, port 4100. Le script refuse toute autre base (garde-fou : seul le nom exact `barreau_pn_test` est accepté).

```powershell
# 1. Socle démarré (PostgreSQL, MailHog) : vérifier avec l'outil socle_etat, sinon socle_demarrer.
# 2. Jeu de démonstration + identité de démonstration (depuis D:\DEVAPP\BARREAUPN\server).
#    TEST_DATABASE_URL est lue dans server\.env ; DATABASE_URL du .env vise la production et ne doit PAS être utilisée.
cd D:\DEVAPP\BARREAUPN\server
$env:DATABASE_URL = ((Get-Content .env | Where-Object { $_ -match '^TEST_DATABASE_URL=' }) -replace '^TEST_DATABASE_URL=', '' -replace '"', '')
npm run demo -- --identite=demonstration
# 3. Reconstruire le front et relancer l'instance sur http://localhost:4100
cd D:\DEVAPP\BARREAUPN
.\scripts\relancer-test.ps1
```

La ligne `EFFECTIFS` affichée par le script confirme le contenu : 60 avocats courants, 15 stagiaires, 10 cabinets, 4 dossiers disciplinaires (`DEMO-2026-01` à `04`), 1 omission au stade de la transmission, 1 scrutin test, 4 fils de messagerie, 12 timbres internes et 18 externes. Deux exécutions donnent les mêmes effectifs (idempotent). Aucun e-mail réel n'est émis (MailHog du socle uniquement, aucun SMS).

Contrôle d'ouverture (1 minute, avant le public) : `http://localhost:4100/api/health` répond 200 ; le bandeau de démonstration et la dénomination « Barreau de démonstration » sont visibles ; le tableau PDF s'ouvre.

## 2. Comptes

Mot de passe commun : `barreau` (base de test seulement).

| Rôle | Identifiant | Usage dans le scénario |
|------|-------------|------------------------|
| Bâtonnier | `batonnier@barreau-pn.cg` | enregistre les décisions (sanction, radiation, omission, validation du stage) |
| Secrétaire général | `sg@barreau-pn.cg` | saisit, instruit, prépare ; reçoit un refus (403) sur les décisions |
| Trésorière | `tresoriere@barreau-pn.cg` | cotisations, timbres, reçus (au besoin) |
| Administrateur | `admin@barreau-pn.cg` | journal d'audit |
| Avocat (espace avocat) | `avocat.demo@demo.invalid` | messagerie, annuaire, dépôt de pièce, attestation |

**Stagiaire** : le jeu de démonstration ne crée aucun compte de connexion de stagiaire. Les 15 stagiaires existent comme fiches (onglet *Avocats stagiaires*) et sont manipulés depuis le compte du bâtonnier ou du SG. Un compte stagiaire peut s'ajouter à la main dans *Utilisateurs* si le public doit voir l'espace du stagiaire (non prévu au minutage).

Membres fictifs repérés (recherche par nom) : stagiaires `BALORIN Aline` (k=60) et `KEMORIN Hervé` (k=61) ; avocat en circuit d'omission `PILETTE Yannick` ; dossiers déjà décidés `SOLETTE Gaël` (classement), `FALETTE Damien` (interdiction avec sursis), `NURETTE Prisca` (radiation) ; compte avocat = `BALANDRE Aline`. Les actions montrées en direct se font sur des avocats courants non cités ci-dessus (par exemple `SOLANDRE Bruno`, `BALIVOR Mireille`) pour ne pas altérer les cas préparés.

## 3. Enchaînement minuté (total : 19,5 min)

| # | Parcours (cahier §5) | Min | Compte | Écran | Ce qu'on montre |
|---|----------------------|-----|--------|-------|-----------------|
| 0 | Ouverture | 1,0 | — | Connexion | Mention de démonstration, identité « Barreau de démonstration » |
| 1 | Import tableau et stagiaires, avec erreurs | 1,0 | SG | *Avocats* > Importer | Modèle téléchargeable, aperçu, erreurs et doublons signalés, annulation avant confirmation |
| 2 | Stagiaire vers le tableau | 1,0 | Bâtonnier | Fiche de `BALORIN Aline` > Valider le stage | Date d'inscription fixée, changement de liste, tri « inscriptions récentes » |
| 3 | Admission directe | 1,0 | Bâtonnier | *Avocats* > Admission directe | Cas dérogatoire paramétré, événement dans l'historique |
| 4 | Impayés vers omission | 2,0 | SG puis Bâtonnier | Fiche de `PILETTE Yannick` > Situation | Rappel, mise en demeure, transmission horodatés (délais paramétrables) ; omission enregistrée avec sa référence ; distincte de la radiation (statut, libellé, infobulle) ; réversible par réinscription |
| 5 | Dossier disciplinaire jusqu'au sursis, puis à la radiation | 2,5 | SG puis Bâtonnier | *Discipline* > nouveau dossier | Saisine par le SG ; décision enregistrée par le bâtonnier : interdiction temporaire avec sursis (l'avocat reste au tableau et dans le PDF, mention sur sa fiche) ; radiation enregistrée (fiche en RADIE, retirée du tableau et de l'annuaire) |
| 6 | Droits : bâtonnier et secrétaire général | 1,0 | SG | Dossier > Enregistrer la décision | Le SG est refusé (403) sur la décision et sur la validation du stage ; matrice des actions dans *Paramètres* |
| 7 | Tableau public temps réel et PDF | 1,0 | Bâtonnier | *Tableau de l'Ordre* | Un changement de statut met le tableau à jour sans rechargement ; PDF daté de la dernière mise à jour |
| 8 | Messagerie | 3,0 | Avocat puis Bâtonnier | *Espace > Annuaire / Messagerie* | Recherche d'un confrère, « Contacter », envoi d'une pièce, statuts envoyé / reçu / lu, accusé de lecture imprimable (PDF horodaté), demande d'attestation, délivrance et archivage |
| 9 | Dépôt d'une pièce | 1,0 | Avocat puis Bâtonnier | *Vérification des pièces* | Rejet avec corrections demandées, notification, nouvelle soumission, validation |
| 10 | Corps électoral à une date et éligibilité | 1,5 | Bâtonnier | *Corps électoral* | Deux dates, deux listes différentes ; critères d'éligibilité paramétrables, bandeau « Provisoire » |
| 11 | Reçu personnalisé | 1,0 | Trésorière | *Reçus de paiement* | Reçu et quitus au nom, à la ville et au logo du barreau de démonstration |
| 12 | Journal d'audit | 1,0 | Administrateur | *Journal d'audit* | Opération tracée, filtres par utilisateur, action et date ; aucun contenu de message privé |
| T | Timbre et vote (prototypes) | 1,0 | Trésorière | *Timbres*, *Élections* | Texte oral du § 6 ; bandeau « Expérimental » visible |
| C | Clôture et questions | 0,5 | — | — | Points ouverts à valider avec le Barreau |
| | **Total** | **19,5** | | | |

Le total est de 19,5 minutes : marge de 30 secondes. Si le temps presse, sacrifier dans cet ordre : parcours 1 (montrer le modèle seulement), 3, 9 ; chacun libère 0,5 à 1 minute.

Règles de conduite : une seule action par parcours est faite en direct, les autres sont montrées dans l'historique de la fiche ; on ne ressaisit rien devant le public (formulaires préremplis par les cas préparés) ; chaque décision est dite « enregistrée ».

## 4. Formulations de la loi n° 026-92 à employer

Le logiciel **enregistre** les décisions des organes de l'Ordre ; il ne les prononce pas. À dire et à écrire :

- Peines de l'article 36, dans cet ordre : **avertissement, réprimande, interdiction temporaire, radiation**. L'interdiction temporaire dure 12 mois au plus (valeur de la loi, paramétrable).
- « **Décision enregistrée** par le bâtonnier » : la sanction relève du Conseil du barreau siégeant en conseil de discipline (art. 18 et 36) ; l'omission et la réinscription, du Conseil de l'Ordre national (art. 8 et 35) ; le certificat de fin de stage, du Bâtonnier de l'Ordre national (art. 29).
- Sursis : « non prévu par la loi n° 026-92 — applicable seulement si le règlement intérieur le prévoit » (C-06). Il ne porte que sur l'interdiction temporaire. Le présenter comme **réglage provisoire de démonstration**.
- Omission : mesure administrative distincte de la radiation disciplinaire ; le circuit rappel, mise en demeure, transmission est **provisoire** et ses délais (30 jours puis 15 jours) sont paramétrables. Aucun automatisme : la décision est saisie à la main avec sa référence.
- Corps électoral : avocats inscrits au tableau à la date du scrutin ; stagiaires, omis et statuts hors tableau exclus. Cotisation à jour, honoraires et suspendus : règles **provisoires**. Bâtonnat : plus de 8 ans d'inscription (comparaison stricte, art. 15) ; aucune ancienneté pour les Conseils.
- Tableau public : ne montre que les inscrits, sans motif de sortie.
- Accusé de lecture : pied C-01 mot pour mot, « Valeur probatoire à confirmer » ; il ne vaut ni lettre recommandée ni notification (art. 39 et 42).

## 5. Bascule d'identité et remise à zéro

**Identité de démonstration (par défaut au congrès)**, depuis `D:\DEVAPP\BARREAUPN\server` avec `DATABASE_URL` pointant sur `barreau_pn_test` (voir § 1) :

```powershell
npm run demo -- --identite=demonstration   # Barreau de démonstration, logo générique, mode démonstration actif
npm run demo -- --identite=pointe-noire    # retour à l'identité de base (à faire avant npm test)
```

Le serveur déjà lancé garde l'identité en cache : relancer `.\scripts\relancer-test.ps1` (ou enregistrer *Paramètres*) après chaque bascule. Le logo se remplace en écrasant `server\assets\demo\logo-demonstration.png`.

**Brazzaville ou tout autre barreau réel : interdit sans accord écrit de ce barreau.** Le script refuse l'identité `brazzaville` (code de sortie 1) : aucune commande ne l'active. Après réception de la lettre d'accord signée (clause IDENTITÉ D'UN BARREAU TIERS de `docs/juridique/clauses-congres.md`, point ouvert PO-22), la dénomination, la ville et le logo se saisissent à la main dans *Paramètres*, section Identité. Les couleurs ne changent jamais (le design de l'application est fixe). Sans lettre, ne montrer ni le nom, ni le logo, ni les couleurs d'un barreau réel.

**Remise à zéro entre deux répétitions.** `npm run demo` est idempotent mais ne défait pas les actions faites en direct (statuts, dossiers, messages). Procédure retenue : prendre un instantané juste après l'installation, le restaurer avant chaque passage.

```powershell
# Instantané (après npm run demo, avant la première répétition)
docker exec creatic-postgres pg_dump -U barreau -Fc barreau_pn_test -f /tmp/demo-congres.dump
# Remise à zéro (arrêter l'instance 4100 avant, puis relancer .\scripts\relancer-test.ps1)
docker exec creatic-postgres pg_restore -U barreau -d barreau_pn_test --clean --if-exists /tmp/demo-congres.dump
```

La restauration remplace le contenu de `barreau_pn_test` : à ne faire que sur cette base, jamais sur `barreau_pn`. Ces commandes sont à répéter une fois avant le congrès (elles n'ont pas été rejouées lors de la rédaction).

## 6. Texte oral : timbre et vote (prototypes)

À dire tel quel, en présentant les écrans *Timbres* et *Élections* (bandeau C-11 visible : « Expérimental — non utilisable pour un scrutin officiel ou une émission réelle. Aucun paiement réel n'est effectué. ») :

> « Ces deux modules sont des prototypes présentés à titre expérimental : aucun timbre n'est émis et aucun paiement n'est effectué. Le vote électronique n'est pas prévu par la loi n° 026-92 et ne peut servir à un scrutin officiel sans délibération de l'Ordre. Nous les montrons pour recueillir vos avis, pas pour les proposer en l'état. »

Timbre : montrer l'émission en bac à sable, la vérification publique par QR (numéro, date et validité seulement, aucune donnée personnelle, C-12) et les statistiques par mois et par canal, avec l'import des données externes. Vote : montrer l'ouverture d'un scrutin test fictif et le dépouillement ; ne rien dire du secret du vote ni de la valeur du résultat.

## 7. Plan de secours en réseau faible

1. **Tout est local** : l'instance, la base et les polices tournent sur le poste ; aucun appel externe n'est nécessaire. Ne pas se connecter au Wi-Fi du lieu.
2. **PDF pré-générés** la veille, sur le poste et sur une clé USB : tableau de l'Ordre, reçu et quitus au nom du barreau de démonstration, accusé de lecture, attestation. Les produire depuis les écrans correspondants (téléchargement) et les nommer `secours-tableau.pdf`, `secours-recu.pdf`, `secours-accuse.pdf`, `secours-attestation.pdf`.
3. **Captures de repli** des 12 parcours (à réaliser lors de la recette des écrans et à ranger dans `docs/captures`, nommées `parcours-NN-*.png`), projetables si l'instance tombe.
4. Si le rendu d'un PDF dépasse 30 secondes, l'ouvrir depuis les fichiers de secours et poursuivre. Si l'instance ne répond plus : `.\scripts\relancer-test.ps1`, puis reprendre au parcours suivant.
5. Parcours à tester à 360 px de large la veille (projection sur téléphone possible).

## 8. Formules interdites

Ne jamais dire, écrire ni laisser afficher :

- le nom de la peine absente de l'article 36 qui commence par « bl » et se termine par « âme » (écrire **réprimande**) ;
- le terme « suspension » pour désigner la peine (écrire **interdiction temporaire**) ; « suspendu » reste un statut de fiche ;
- la formule où le bâtonnier « prononce » une sanction, une radiation ou une omission (écrire **décision enregistrée par le bâtonnier**, en nommant l'organe décideur) ;
- toute affirmation de protection cryptographique : « chif-fré », « chiffrement de bout en bout » ;
- toute affirmation de label ou de garantie : « cer-tifié », « sécurisé à 100 % », « inviolable » ;
- toute garantie sur le vote : « secret du vote ga-ranti » (écrire que le vote est un **prototype**) ;
- toute valeur probatoire acquise : « preuve légale », « valant lettre recommandée », « signature électronique qualifiée » ;
- toute promesse d'hébergement : « hébergement souverain », « données hébergées au Congo » ;
- l'idée que les règles provisoires (sursis, circuit d'omission, corps électoral élargi) sont celles de l'Ordre ;
- le nom, le logo ou les couleurs d'un barreau réel sans accord écrit ;
- l'idée qu'un timbre ou un paiement réel est émis, ou qu'un opérateur de paiement est intégré.

(Les termes cités avec un trait d'union dans cette liste sont coupés exprès, pour que la relecture automatique du document ne les confonde pas avec un emploi.)

## 9. Relecture et suites

- Relecture de ce scénario par la sécurité et par le juriste avant le congrès : à consigner dans le rapport de mission.
- Points ouverts à valider avec Me Kalina MENGA : `docs/audit/POINTS-OUVERTS.md`.
- Rejeu technique des 12 parcours : `cd server && npx vitest run test/parcours.test.ts`.
- Après la démonstration : `npm run demo -- --identite=pointe-noire` puis `npm test` (certains tests de PDF attendent l'identité de base).
