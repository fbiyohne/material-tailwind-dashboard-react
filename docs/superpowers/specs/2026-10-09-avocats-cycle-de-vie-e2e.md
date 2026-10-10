# Cycle de vie des avocats — scénarios de bout en bout (T14)

Exécutés le 2026-10-10 avec le MCP Playwright (Chromium) sur l'environnement de test : http://localhost:4100 (Express servant `dist/`), base `barreau_pn_test` du socle (127.0.0.1:5432), branche `feat/avocats-cycle-de-vie`. Aucune dépendance Playwright n'est ajoutée au projet.
Captures : `docs/captures/T14-<étape>-1280.png` et `-360.png`.

## Préconditions

- Socle Docker démarré, 31 migrations appliquées, `npm run build` à jour (le bundle doit contenir le correctif `cc9dbbe`).
- Comptes (mot de passe `barreau`) : `sg@barreau-pn.cg`, `admin@barreau-pn.cg`, `batonnier@barreau-pn.cg`.
- Instantané de base : script Prisma lisant `Membre` (id, num, nom, qualite, statut, cabinet, tel, email, dateInscription, dateRadiation, dateDeces, motifRadiation), exécuté avant et après.
- Les données créées portent le préfixe `E2E` : `E2E RADIE Alpha` (n° 590), `E2E DOUBLON Gamma` (n° 591, supprimé au parcours 6), `E2E DECEDE Beta` (n° 592). Alpha (id 1236) et Beta (id 1238) restent en base ; Gamma (id 1237) est supprimé.

## P1 — Inscription puis radiation motivée (SG)

1. `/avocats`, bouton « Avocat » (en-tête) : saisir nom `E2E RADIE Alpha`, cabinet, téléphone, email ; « Inscrire au tableau ».
   Attendu : redirection vers la fiche, statut Inscrit, n° PN-AAAA-NNN attribué.
2. Fiche : « Radier » ; date pré-remplie à aujourd'hui, champ « Référence et motif de la décision » : `E2E - Décision du Conseil n° 12/2026 du 01/10/2026` ; confirmer « Radier ».
   Attendu : badge « Radié », ligne « Radié le 10/10/2026 — E2E - Décision… », boutons Radier / Attestation / Accès espace absents, « Déclarer le décès » encore proposé.
   Obtenu : conforme. En base : statut RADIE, dateRadiation 2026-10-10, motif conservé.
   Captures : `p1-inscription-1280`, `p1-fiche-inscrit`, `p1-modale-radiation`, `p1-fiche-radie`.

## P2 — Décès, exclusions du tableau et du corps électoral (SG)

1. Créer `E2E DECEDE Beta` (comme P1), fiche : « Déclarer le décès », date `2026-09-15`, confirmer.
   Attendu : badge « Décédé », « Décédé le 15/09/2026 », seul « Modifier » reste (ni Attestation, ni Accès espace, ni Radier, ni Décès). Obtenu : conforme.
2. `/tableau`, section Avocats (550 membres, 55 pages) : parcourir toutes les pages.
   Attendu : Alpha (radié) et Beta (décédé) absents, le témoin Gamma (inscrit) présent (page 25). Obtenu : conforme.
3. `/corps-electoral`, onglet « Exclusions » : Alpha et Beta listés avec le motif « Suspension / radiation / omission » (raison statut) ; Gamma avec « Cotisations non à jour ». Obtenu : conforme.
   Constat mineur : le libellé de motif ne cite pas le décès.
   Captures : `p2-fiche-inscrit-avant`, `p2-modale-deces`, `p2-fiche-decede`, `p2-tableau`, `p2-corps-electoral-exclus`.

## P3 — Export de la liste (SG)

`/avocats`, menu « Exporter » : Excel, CSV, Texte, PDF, pour la liste complète puis pour la recherche `E2E`.
Attendu : 4 téléchargements ; CSV/TXT/XLSX = ligne de mention de confidentialité + 11 en-têtes (N°, N° inscription, Nom, Qualité, Statut, Cabinet, Téléphone, Email, Date d'inscription, Date de radiation, Date de décès) + une ligne par avocat affiché ; XLSX à une feuille « Avocats » ; PDF A4 « Liste des avocats — … — Document interne ».
Obtenu : conforme pour les formats et les en-têtes (11 colonnes, le « 10 » de la mission est un décompte erroné, motif exclu). Le motif de radiation n'apparaît dans aucun fichier.
Correctif (révision 2) : la page Avocats enchaîne désormais les pages serveur de 200 jusqu'à `totalPages` ; la liste complète est exportée. Base de test au 2026-10-10 : 612 avocats (hors stagiaires) ; CSV, TXT, XLSX = 612 lignes de données, PDF serveur « 612 lignes », 11 en-têtes dans les trois formats texte/tableur.
Captures : `p3-menu-exporter`.

## P4 — Aller-retour export → import (SG) — CA-10

Périmètre : la liste COMPLÈTE (612 avocats, 651 membres en base dont 39 stagiaires non touchés).
1. Instantané « avant » (script Prisma : id, num, nom, qualite, statut, cabinet, tel, email, dateInscription au milliseconde, dateRadiation, dateDeces, motifRadiation, 651 membres, JSON).
2. `/avocats`, « Exporter » : Excel, CSV, Texte, PDF (liste complète, aucun filtre).
3. Pour chacun des trois fichiers CSV, XLSX, TXT : « Importer », choisir le fichier, lire l'aperçu, « Importer 612 lignes », lire le rapport.
4. Instantané « après », comparaison.
Attendu : aperçu « 612 ligne(s) retenue(s), 0 ligne(s) ignorée(s) » ; rapport 0 créé / 612 mis à jour / aucune erreur ; instantanés identiques.
Obtenu :

- Aperçu 612 / 0 ignorée pour CSV, XLSX et TXT ; rapport « 0 avocat(s) créé(s), 612 avocat(s) mis à jour » ; journal d'audit « Import du tableau — Avocat (612 ligne(s), 0 créé(s), 612 mis à jour, 0 erreur(s)) » ×3.
- Instantané avant/après : fichiers JSON strictement identiques (`cmp` sans différence, SHA-256 identique), y compris l'horodatage de `dateInscription`.
- Défauts trouvés lors des essais précédents et corrigés : (a) mention de confidentialité prise pour l'en-tête (`cc9dbbe`) ; (b) l'import ramenait `dateInscription` à 00:00 (l'export n'écrit que le jour) : le serveur conserve désormais l'horodatage quand le jour est inchangé (test « aller-retour » dans `api.test.ts`) ; (c) la liste ne portait que 200 lignes : pages enchaînées côté client.
Captures : `p4-complet-{csv,xlsx,txt}-{apercu,rapport}-{1280,360}`.

## P5 — Import d'un TXT à tabulations avec une ligne sans numéro (SG)

Fichier `num<TAB>nom<TAB>statut<TAB>date décès` : ligne 9101 « E2E TXT Delta » décédé 2026-09-15, une ligne sans numéro, ligne 9102 « E2E TXT Epsilon » inscrit. Ouvrir « Importer », choisir le fichier.
Attendu : aperçu « 2 ligne(s) retenue(s), 1 ligne(s) ignorée(s) ». Obtenu : conforme (statut « décédé » reconnu dans l'aperçu). Import volontairement non lancé pour ne pas créer de données ; le chemin d'import « décédé » est couvert par les tests serveur.
Captures : `p5-apercu-ignorees`.

## P6 — Suppression définitive (ADMIN)

1. Fiche d'un membre ayant des reçus (n° 21, issu des tests serveur) : « Supprimer », boîte « irréversible », confirmer.
   Attendu : refus, message « Suppression impossible : pièces comptables à conserver 10 ans (OHADA) ; utilisez radiation ou décès », fiche conservée. Obtenu : conforme (HTTP 409 consigné en console).
2. Fiche de `E2E DOUBLON Gamma` (sans pièce) : « Supprimer », boîte « irréversible », confirmer.
   Attendu : suppression, fiche introuvable (404), absent de la liste. Obtenu : conforme ; base : id 1237 absent.
   Captures : `p6-confirmation-recu`, `p6-refus-409`, `p6-confirmation-doublon`, `p6-doublon-disparu`.

## P7 — Bâtonnier : lecture seule

Connecté `batonnier@barreau-pn.cg`, fiche d'un inscrit (n° 1) puis liste avec une ligne cochée.
Attendu : aucun bouton Radier, Déclarer le décès, Supprimer (ni Modifier). Obtenu : seuls les onglets Identité, Cotisations, Documents, Discipline ; la liste n'offre que « Fiche ».
Correctif (révision 2) : la page Avocats n'appelle plus `/api/cotisations` sans la permission « finances » ; console et réseau du Bâtonnier sur `/avocats` et `/avocats/1` (360 et 1280 px) : 0 erreur, 0 réponse ≥ 400.
Captures : `p7-batonnier-fiche`, `p7-batonnier-liste`.

## Console

Aucune erreur applicative. Seules réponses ≥ 400 : 409 (P6.1) et 404 (P6.2), attendues et provoquées par le scénario. P1 (inscription, 360 px ajouté), P3, P4 et P7 : 0 erreur console, 0 réponse ≥ 400.

## Données laissées en base barreau_pn_test

Les suites vitest du serveur laissent des membres (préfixes TEST, OVERPAY, ESPACE, DISC, STAGE, AVOC, DROIT, DEMANDE, DOUBLEPAY, TIMBRE, SUPPR-RECU, COT-SUPPR, QUI-SUPPR, « E2E scrutin-cloison », « E2E vote », « E2E reset », « E2E statut », « E2E conso », « E2E msgA/msgB », ≈ 21 membres par exécution) : le préfixe « E2E » n'identifie donc pas les seuls parcours. Membres des parcours T14 : ids 1236 (`E2E RADIE Alpha`, radié) et 1238 (`E2E DECEDE Beta`, décédé). Nettoyage non exécuté (à valider par Fabrice).
