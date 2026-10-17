# Cycle de vie des avocats — scénarios de bout en bout (T14, révision 3)

Rejoués intégralement le 2026-10-10 avec le MCP Playwright (Chromium) sur le build final de la branche `feat/avocats-cycle-de-vie` (dernier commit de code `3938c9d`) : http://localhost:4100 (Express servant `dist/`), base `barreau_pn_test` du socle (127.0.0.1:5432). Aucune dépendance Playwright n'est ajoutée au projet.
Captures : `docs/captures/T14-<étape>-1280.png` et `-360.png` (deux largeurs pour chaque étape).

## Préconditions (reproductibles)

1. Socle Docker démarré, 31 migrations appliquées (`npx prisma migrate deploy` dans `server/`), `npm run build` à la racine.
2. Serveur de test : dans `server/`, `DATABASE_URL=postgresql://barreau:barreau_dev@127.0.0.1:5432/barreau_pn_test?schema=public PORT=4100 STATIC_DIR=../dist npm start` (sans `STATIC_DIR`, le front n'est pas servi : 404).
3. Comptes (mot de passe `barreau`) : `sg@barreau-pn.cg`, `admin@barreau-pn.cg`, `batonnier@barreau-pn.cg`.
4. Préfixe des données de ce rejeu : `E2E R3`. Créer par API (SG) le doublon et le membre avec reçu :
   ```
   POST /api/auth/login {"email":"sg@barreau-pn.cg","password":"barreau"}      -> token
   POST /api/membres {"nom":"E2E R3 Gamma doublon","qualite":"AVOCAT","statut":"INSCRIT","cabinet":"SCPA E2E"}
   POST /api/membres {"nom":"E2E R3 Recu","qualite":"AVOCAT","statut":"INSCRIT","cabinet":"SCPA E2E"}   -> id R
   POST /api/cotisations/paiement {"membreId":R,"annee":2026,"montant":150000,"mode":"Espèces"}        -> crée le reçu
   ```
5. Script d'instantané `instantane.mjs`, à copier dans `server/` puis exécuter `DATABASE_URL=<base test> node instantane.mjs <sortie.json>` :
   ```js
   import { PrismaClient } from "@prisma/client";
   import { writeFileSync } from "node:fs";
   import { createHash } from "node:crypto";
   const p = new PrismaClient();
   const m = await p.membre.findMany({
     orderBy: { id: "asc" },
     select: { id: true, num: true, nom: true, qualite: true, statut: true, cabinet: true, tel: true, email: true, dateInscription: true, dateRadiation: true, dateDeces: true, motifRadiation: true },
   });
   const json = JSON.stringify(m, null, 1);
   writeFileSync(process.argv[2], json);
   console.log(m.length, "membres", createHash("sha256").update(json).digest("hex"));
   await p.$disconnect();
   ```
6. Contenu exact du fichier `p5.txt` (UTF-8, séparateur tabulation `<TAB>`, fin de ligne LF) :
   ```
   num<TAB>nom<TAB>statut<TAB>date décès
   9101<TAB>E2E R3 Delta<TAB>décédé<TAB>2026-09-15
   <TAB>E2E R3 Sans numéro<TAB>inscrit<TAB>
   9102<TAB>E2E R3 Epsilon<TAB>inscrit<TAB>
   ```
   (les n° 9101 et 9102 doivent être libres ; sinon l'import les met à jour au lieu de les créer).

Données créées lors du rejeu du 2026-10-10 (ids propres à cette base) : Alpha 1496 (n° 698), Beta 1497 (n° 699), Gamma doublon 1498 (n° 700, supprimé en P6.2), Recu 1499 (n° 701), Delta 1500 (n° 9101), Epsilon 1501 (n° 9102).

## P1 — Inscription puis radiation motivée (SG) — réussi

1. `sg@barreau-pn.cg` se connecte ; `/avocats`, bouton « Avocat » de l'en-tête : nom `E2E R3 Alpha`, cabinet `SCPA E2E`, téléphone `+242 06 000 00 01`, email `e2e.alpha@example.test` ; « Inscrire au tableau ».
   Attendu/obtenu : redirection vers `/avocats/1496`, statut Inscrit, PN-2026-698 ; boutons Modifier, Accès espace, Attestation, Radier, Déclarer le décès.
2. « Radier », date pré-remplie, champ « Référence et motif de la décision » : `E2E - Décision du Conseil n° 12/2026 du 01/10/2026`, confirmer « Radier ».
   Attendu/obtenu : badge « Radié », ligne « Radié le 10/10/2026 — E2E - Décision du Conseil n° 12/2026 du 01/10/2026 », seuls Modifier et Déclarer le décès restent. Base : RADIE, dateRadiation 2026-10-10, motif conservé.
   Captures : `p1-inscription`, `p1-fiche-inscrit`, `p1-modale-radiation`, `p1-fiche-radie`. Console : 0 erreur, 0 réponse ≥ 400.

## P2 — Décès, tableau de l'Ordre, corps électoral (SG) — réussi

1. Inscrire `E2E R3 Beta` (comme P1) puis « Déclarer le décès », date `2026-09-15`, confirmer.
   Attendu/obtenu : badge « Décédé », « Décédé le 15/09/2026 », seul « Modifier » reste (ni Attestation, ni Accès espace, ni Radier, ni Décès).
2. `/tableau`, section Avocats : parcourir les 66 pages avec « Page suivante ». Obtenu : 651 lignes ; présents : Gamma doublon (n° 650) et Recu (n° 651) ; absents : Alpha (radié) et Beta (décédé).
3. `/corps-electoral`, onglet « Exclusions » (50 pages) : Alpha et Beta listés avec le motif « Suspension / radiation / omission » (raison statut) ; Gamma avec « Cotisations non à jour ».
   Réserve (non corrigée, hors périmètre du test) : le libellé de motif de `CorpsElectoral.jsx` (l. 13) ne cite pas le décès ; la raison « statut » est exacte, l'affichage pourrait devenir « Suspension / radiation / décès / omission ».
   Captures : `p2-fiche-inscrit-avant`, `p2-modale-deces`, `p2-fiche-decede`, `p2-tableau`, `p2-corps-electoral-exclus`. Console : 0 erreur.

## P3 — Export de la liste complète (SG) — réussi

`/avocats`, menu « Exporter » : Excel, CSV, Texte, PDF (aucun filtre). Fichiers produits : `Avocats.xlsx`, `Avocats.csv`, `Avocats.txt`, `Avocats-2026-10-10.pdf`.
Obtenu : 656 avocats (697 membres en base − 41 stagiaires) ; CSV (BOM, `;`), TXT (tabulations), XLSX (feuille unique « Avocats », 658 lignes) = ligne de mention « Barreau de Pointe-Noire — Document interne confidentiel… », en-tête de 11 colonnes (N°, N° inscription, Nom, Qualité, Statut, Cabinet, Téléphone, Email, Date d'inscription, Date de radiation, Date de décès) puis 656 lignes ; PDF serveur « 656 lignes », en-tête institutionnel, « Liste des avocats — tous — arrêtée au 10/10/2026 — Document interne ». Le motif de radiation n'apparaît dans aucun fichier. (La mission écrivait « 10 en-têtes » : le décompte exact est 11, le motif étant seul exclu.)
Capture : `p3-menu-exporter`. Console : 0 erreur.

## P4 — Aller-retour export → import (SG) — CA-10 démontré

1. Instantané « avant » (script de la précondition 5) : 697 membres, SHA-256 `6d4f72f7f179472e3744979ab6027ca3c8402950d141e49de6c5b28875b2ad14`.
2. Pour chacun des trois fichiers CSV, XLSX, TXT du P3 : `/avocats`, « Importer », choisir le fichier, lire l'aperçu, « Importer 656 lignes », lire le rapport.
3. Instantané « après » : comparaison.
Obtenu : aperçu « 656 ligne(s) retenue(s), 0 ligne(s) ignorée(s) » ×3 ; rapport « 0 avocat(s) créé(s), 656 avocat(s) mis à jour » ×3 (aucune ligne d'erreur) ; journal d'audit « Import du tableau — Avocat (656 ligne(s), 0 créé(s), 656 mis à jour, 0 erreur(s)) » ×3 ; instantané après = instantané avant (`cmp` sans différence, même SHA-256), y compris l'horodatage de `dateInscription`, les statuts RADIE/DECEDE et leurs dates. Le périmètre est la liste complète (656 avocats).
Captures : `p4-complet-{csv,xlsx,txt}-{apercu,rapport}`. Console : 0 erreur, 0 réponse ≥ 400.

## P5 — Import d'un TXT à tabulations avec une ligne sans numéro (SG) — réussi, import exécuté

Fichier `p5.txt` (précondition 6). `/avocats`, « Importer », choisir le fichier.
Attendu/obtenu : aperçu « 2 ligne(s) retenue(s), 1 ligne(s) ignorée(s) (sans numéro ou sans nom) » ; « Importer 2 lignes » : « 2 avocat(s) créé(s), 0 mis à jour ». Base : Delta (n° 9101) DECEDE, dateDeces 2026-09-15 ; Epsilon (n° 9102) INSCRIT ; aucune fiche « Sans numéro ».
Captures : `p5-apercu-ignorees`, `p5-rapport`. Console : 0 erreur.

## P6 — Suppression définitive (ADMIN) — réussi

1. `admin@barreau-pn.cg`, fiche `E2E R3 Recu` (membre avec reçu, précondition 4) : « Supprimer », boîte « … Cette action est irréversible. », confirmer.
   Attendu/obtenu : refus, message « Suppression impossible : pièces comptables à conserver 10 ans (OHADA) ; utilisez radiation ou décès », fiche conservée.
2. Fiche `E2E R3 Gamma doublon` (sans pièce) : « Supprimer », boîte « irréversible », confirmer. Obtenu : retour à `/avocats` ; rechargement de la fiche : « Avocat introuvable ».
   Captures : `p6-confirmation-recu`, `p6-refus-409`, `p6-confirmation-doublon`, `p6-doublon-disparu`.

## P7 — Bâtonnier : lecture seule — réussi

`batonnier@barreau-pn.cg`, fiche `/avocats/1497` puis liste avec une ligne cochée. Obtenu : fiche = onglets Identité, Cotisations, Documents, Discipline, aucun bouton Radier / Déclarer le décès / Supprimer / Modifier ; liste = Exporter, Exporter la sélection, Fiche seulement. Console et réseau : 0 erreur, 0 réponse ≥ 400.
Captures : `p7-batonnier-fiche`, `p7-batonnier-liste`.

## Console : exception documentée au critère « aucune erreur console »

Sur l'ensemble des parcours, seules deux entrées apparaissent, toutes deux provoquées volontairement par P6 et non évitables côté client : `409 DELETE /api/membres/1499` (refus OHADA attendu ; le navigateur journalise toute réponse ≥ 400 en « Failed to load resource ») et `404 GET /api/membres/1498` (rechargement de la fiche supprimée pour prouver sa disparition). Aucune erreur applicative, aucune autre réponse ≥ 400. Cette exception est une dérogation à valider par Fabrice.

## Données laissées en base barreau_pn_test

- Parcours T14 (préfixe `E2E R3`) : ids 1496, 1497, 1499, 1500, 1501. S'y ajoutent ceux du rejeu précédent (préfixe `E2E`, ids 1236 Alpha, 1238 Beta, et les membres d'essai créés ensuite) : purge à valider par Fabrice.
- Les suites vitest du serveur (hors périmètre du test de bout en bout) ajoutent ≈ 21 membres par exécution (préfixes TEST, OVERPAY, ESPACE, DISC, STAGE, AVOC, DROIT, DEMANDE, DOUBLEPAY, TIMBRE, SUPPR-RECU, COT-SUPPR, QUI-SUPPR, « E2E scrutin-cloison », « E2E vote », « E2E reset », « E2E statut », « E2E conso », « E2E msgA/msgB »). Au 2026-10-10 : 719 membres dont 586 d'id ≤ 1235 (jeu de départ) ; id maximal 1531. Le préfixe `E2E` seul n'identifie donc pas les membres des parcours : utiliser `E2E R3` ou les ids ci-dessus. Aucun nettoyage n'a été exécuté (suppression en base à valider) ; recommandation : suites vitest autonettoyantes (`afterAll`).
