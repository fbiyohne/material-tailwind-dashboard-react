# Captures de recette (T29)

Instance : http://localhost:4100, base `barreau_pn_test` du socle. Jamais `barreau_pn`. Aucun envoi réel (MailHog du socle).

## Relancer la recette

Depuis `D:\DEVAPP\BARREAUPN`, PowerShell ou Git Bash :

1. **Jeu de démonstration** (seule la base `barreau_pn_test` est acceptée) :
   `cd server`, `DATABASE_URL` = `TEST_DATABASE_URL` de `server/.env`, puis `npm run demo -- --identite=demonstration --mots-de-passe-defaut`
   (la recette se connecte avec le mot de passe commun de la base de test ; sans cette option, `--identite=demonstration` pose des mots de passe aléatoires, réservés au congrès).
2. **Instance** : `.\scripts\relancer-test.ps1` (build du front, `prisma generate`, `migrate deploy`, démarrage sur 4100).
   Le script tourne sous PowerShell 5.1 lancé par un outil : `$ErrorActionPreference = "Continue"` et contrôle de `$LASTEXITCODE`
   après chaque commande (le stderr de `prisma generate` n'arrête plus le script) ; il refuse un `TEST_DATABASE_URL` qui ne vise pas `barreau_pn_test`.
   Le relancer **avant chaque exécution du point 3** : la connexion est limitée à 10 essais par 15 minutes et le limiteur vit en mémoire.
3. **Volet interface des 12 parcours** (Chromium piloté par `puppeteer-core`, déjà dépendance du serveur) :
   ```bash
   cd server
   DATABASE_URL="<TEST_DATABASE_URL>" npx tsx scripts/recette-ui.ts parcours   # 12 parcours + timbre et vote
   DATABASE_URL="<TEST_DATABASE_URL>" npx tsx scripts/recette-ui.ts apres      # 4 écrans de référence (CA13)
   ```
   Chaque capture est prise à 1280 × 900 puis à 360 × 780 (`<nom>-1280.png`, `<nom>-360.png`). À 360 px, la largeur défilable
   de la page est relevée ; au-delà de 360 px, la capture est en échec. Le résultat détaillé (contrôles, largeurs, PDF reçus,
   réponses 4xx et 5xx, erreurs de console) est écrit dans `recette-ui-parcours.json` et `recette-ui-apres.json`. Code de sortie 0 si tout passe.
   **Remise en état automatique** en fin d'exécution, même en cas d'échec : les écritures faites en direct sur les membres DEMO
   (événements, dossiers, fils, pièces, fiches) sont défaites et les membres « RECETTE … » supprimés. Restent, sans effet sur les
   effectifs du jeu : les lignes de `JournalAudit` (immuable), les archives (attestation, fin de stage) et les notifications.
   Le mode `apres` s'exécute sous l'identité de base, comme les captures `avant-*` : `npm run demo -- --identite=pointe-noire`,
   relance de l'instance, `apres`, puis retour à `--identite=demonstration --mots-de-passe-defaut` et nouvelle relance.
4. **Volet API** : `cd server && npx vitest run test/parcours.test.ts`. Il remet l'identité « Barreau de Pointe-Noire » :
   refaire le point 1 avant une démonstration.

## Résultat du 11 octobre 2026 (HEAD de la branche, base `barreau_pn_test`)

`recette-ui.ts parcours` : **37 contrôles sur 37**, 44 captures × 2 largeurs, **aucune page plus large que 360 px**, aucune réponse 5xx.
Les seules réponses 4xx sont attendues : 403 du SG sur `valider-stage` et sur la décision disciplinaire (parcours 6), 403 de
`GET /parametres` pour l'avocat (jeton confiné), 403 de `GET /membres/2` pour la trésorière (module Membres non attribué).
Après exécution, les effectifs DEMO sont ceux du jeu (`EFFECTIFS` identique), aucun membre « RECETTE » ne reste.

| Parcours (cahier §5) | Rejoué dans l'interface (compte) | Contrôles | Captures |
|----------------------|----------------------------------|-----------|----------|
| 0 Ouverture | connexion, accueil (SG) | identité de démonstration sur l'écran de connexion ; mention C-13 | `parcours-00-*` |
| 1 Import avec erreurs et doublons | aperçu simulé, annulation (SG) | 1 à créer, 2 mises à jour, 1 erreur, 1 doublon ; rien d'écrit après annulation | `parcours-01-*` |
| 2 Stagiaire vers le tableau | fin de stage de BALORIN Aline (bâtonnier), tri par inscription | INSCRIT, date d'inscription = date de décision | `parcours-02-*` |
| 3 Admission directe | « RECETTE Claire » (bâtonnier) | INSCRIT + événement ADMISSION_DIRECTE dans l'historique | `parcours-03-*` |
| 4 Impayés vers omission | rappel, mise en demeure, transmission (SG) ; omission puis réinscription de BALONDE Aline (bâtonnier) | étapes horodatées ; OMIS ; infobulle « mesure administrative temporaire » ; retour INSCRIT avec historique | `parcours-04-*` |
| 5 Discipline, sursis, radiation | saisine de deux dossiers (SG) ; interdiction temporaire 6 mois avec sursis sur SOLANDRE Bruno, radiation de BALIVOR Mireille (bâtonnier, avec confirmation) | sursis : reste INSCRIT, mention C-06 sur la fiche ; radiation : RADIE sans saisie manuelle | `parcours-05-*` |
| 6 Droits SG / bâtonnier | fiche stagiaire, dossier, matrice (SG) | pas de bouton de fin de stage ni de formulaire de décision ; 403 sur les deux routes | `parcours-06-*` |
| 7 Tableau temps réel et PDF | tableau ouvert dans un second onglet SG pendant la radiation | effectif 5457 → 5456 sans rechargement ; « Mis à jour le » ; PDF 200 `application/pdf` | `parcours-07-*` |
| 8 Messagerie | annuaire, Contacter, pièce PDF, demande d'attestation (avocat) ; lecture et délivrance (SG) ; statut « Lu » et accusé (avocat) | radiée absente de l'annuaire ; identité de démonstration et C-13 dans l'espace avocat ; empreinte posée ; ATT numérotée ; accusé PDF 200 | `parcours-08-*` |
| 9 Pièce rejetée puis validée | dépôt (avocat), rejet motivé (SG), motif visible (avocat), nouveau dépôt vérifié (SG) | REJETEE avec motif, puis VERIFIEE | `parcours-09-*` |
| 10 Corps électoral à deux dates | 31/01/2026 puis 11/10/2026 (bâtonnier) | 1 électeur puis 1 211 : listes différentes | `parcours-10-*` |
| 11 Reçu personnalisé | aperçu du reçu, PDF, quitus (trésorière) | « Barreau de démonstration », « Ville de démonstration », aucune occurrence de « Pointe-Noire » ; PDF 200 | `parcours-11-*` |
| 12 Journal d'audit | filtres action et utilisateur, recherche du texte envoyé (administrateur) | « message #id » tracé ; texte du message absent de l'écran et de `JournalAudit` | `parcours-12-*` |
| T Timbre et vote | timbres, statistiques (trésorière), élections (bâtonnier) | bandeau « Expérimental » sur les deux modules | `parcours-T-*` |

## Comparaison avant / après (CA13)

Conditions identiques : compte SG, identité de base « Barreau de Pointe-Noire », 1280 × 900 et 360 × 780. Captures `avant-*` (T1) et `apres-*`.
Aucun ajout dans `tailwind.config.cjs` ni dans `public/css/tailwind.css` depuis dd9f2dd ; aucune police, couleur ni bibliothèque ajoutée.

| Écran | Écarts relevés | Nature |
|-------|----------------|--------|
| Avocats | liste « Tri : numéro / date d'inscription » à droite des filtres ; colonne « Inscription » dans le tableau | ajouts fonctionnels (T19, X-04) |
| AvocatDetail | bouton « Contacter » en tête des actions ; onglet « Situation » | ajouts fonctionnels (T20, T13) |
| Tableau | « Mis à jour le 11 octobre 2026 » dans le sous-titre ; à 1280 px, les boutons « Télécharger le PDF » et « Publier » passent sous le sous-titre, devenu plus long | ajout fonctionnel (T17, F-10) ; même composant `PageHeader`, retour à la ligne natif |
| Messagerie | pastille du nombre de fils non lus sur « Conversations » | ajout fonctionnel (T13, statuts) |

Écarts de données, sans lien avec le design : effectifs et pastilles (base de test enrichie par les suites de tests et le jeu DEMO),
premières lignes de listes (membres DEMO et de test), fils dont le membre de test a été purgé affichés « Avocat ».
Écart d'outil : les captures « avant » (MCP Playwright) réservent la place d'une barre de défilement verticale ; celles d'après
(Chromium sans barre) disposent de quelques pixels de plus en largeur.

## Défauts trouvés et corrigés pendant la recette (avec test)

| Défaut | Correctif | Test |
|--------|-----------|------|
| Parcours 3 : le bâtonnier (action `admission_directe`) n'avait pas le bouton « Avocat » | commit c4f910a | `InscriptionModalBatonnier.test.jsx` |
| Parcours 4 : omission d'un impayé 2025 enregistrée en 2026 refusée (409) | commit 5ff8d63 | `SituationExercice.test.jsx` |
| Parcours 5 : « Avocat mis en cause » ne proposait que les 200 premiers membres (plafond serveur) : un avocat au-delà ne pouvait pas être poursuivi | recherche côté serveur dans le modal d'ouverture de dossier | `DisciplineRechercheAvocat.test.jsx` |
| Parcours 0 et 8 : écran de connexion et espace avocat toujours à « Barreau de Pointe-Noire », sans mention C-13 (l'avocat ne lit pas `/parametres`) | `GET /api/auth/identite` public (dénomination, ordre, ville, logo, mode démonstration) chargé avant la connexion ; bandeau C-13 partagé (`BandeauDemonstration`) dans l'espace avocat | `server/test/identite-publique.test.ts`, `identitePublique.test.jsx` |
| Parcours 11 : aperçus du reçu, du quitus, de l'attestation et des états imprimables avec « Pointe-Noire » et les coordonnées du barreau de base écrits en dur | identité et coordonnées paramétrées (`identite()`, `coordonnees()`) | `DocumentsIdentite.test.jsx` |
| Parcours 11 (R2-11) : `/recus` et `/quitus` défilaient horizontalement à 1280 px (scrollWidth 1456), l'aperçu fixe de 820 px élargissant la colonne `1fr` | commit 86f9e6a : `lg:grid-cols-[320px_minmax(0,1fr)]` ; l'aperçu défile dans son conteneur `overflow-x-auto` | mesuré le 11/10/2026 sur http://localhost:4100 (dist/ reconstruit, compte SG, Chrome sans tête) : à 1280 px, scrollWidth = clientWidth = 1280 sur les deux pages, colonnes `320px 612px`, aperçu 612 visibles / 820 défilables ; à 360 px, scrollWidth = clientWidth = 360, colonne `328px`, aperçu 328 / 820 ; aucun élément ne déborde hors du conteneur d'aperçu |
| R2-13 : balayage de 54 rechargements (27 routes, 1280 et 360 px) en SG, puis toute l'API en 429 pendant 13 min (Retry-After 783 s), écrans sur « Chargement… » sans message | cause mesurée : un seul utilisateur consomme environ 10 requêtes comptées par rechargement (37 sur `/avocats`), soit environ 580 pour 54 rechargements, loin des 3000 autorisés ; le blocage venait de l'expiration du jeton d'accès (15 min) en cours de balayage : le jeton expiré était compté sur le budget anonyme de l'IP (600, déjà dépassé) et recevait 429 au lieu de 401, donc le client ne rafraîchissait jamais sa session. Correctif : `server/src/app.ts`, l'expiration est ignorée pour identifier l'utilisateur du limiteur (signature vérifiée) ; `client.js` rafraîchit la session sur `/auth/me` ; `BandeauLimite` affiche « Trop de requêtes, réessayez dans N s. » sous l'en-tête de tous les écrans | `server/test/limiteur-par-utilisateur.test.ts` (rouge avant : `[401,401,429,429,429]`), `clientRefreshMe.test.js`, `BandeauLimite.test.jsx`. Rejoué le 11/10/2026 par `server/scripts/balayage-limiteur.cjs` (2 passes de 54 rechargements, jeton remplacé par un jeton expiré au 60e, puis 429 simulé sur `/reunions`, `/assemblees`, `/publications`, `/lettre-batonnier`, `/profil`) : avant (0ca5d7f), 48 rechargements en 429 (Retry-After 789 s) et 48 « Chargement… » muets, 20 écrans muets sur 20 sous blocage ; après, 0 rechargement en 429, 0 chargement muet, 1 122 requêtes comptées sur 3000 pour 108 rechargements, le délai affiché sur 20 écrans sur 20, aucun défilement horizontal. Reprise QA (11/10/2026) : sur 8fd74d1, si le budget anonyme de l'IP est déjà saturé (salle derrière un NAT), `POST /auth/refresh` (anonyme) recevait 429 et le client vidait la session (écran de connexion, puis login en 429 pendant environ 13 min). Correctif : `/auth/refresh` sort du limiteur global et reçoit son propre limiteur (300 / 15 min / IP, `routes/auth.ts`) ; `client.js` distingue succès, refus (401) et limite (429) du rafraîchissement : sur 429, ni `clearSession` ni `onUnauthorized`, le délai est signalé au bandeau et une erreur 429 est levée (`api`, `telechargerPdf`, `ouvrirFichierAuth`). Tests rouges avant, verts après : `clientRefresh429.test.js` (3 cas), `limiteur-par-utilisateur.test.ts` « budget anonyme saturé : refresh 200 ». Rejeu dans la condition du constat (600 requêtes anonymes préalables depuis la même IP, `ACCESS_TTL=60s`, expiration réelle, `SATURER=600 node scripts/balayage-limiteur.cjs`) : avant (fd412be, instance isolée), 34 rechargements sur 54 en 429 dès l'expiration du jeton (Retry-After 840 s), aucun rafraîchissement ; après, 0 rechargement en 429, 2 rafraîchissements en 200, 0 chargement muet, 0 écran de connexion, 0 session perdue, 564 requêtes comptées sur 3000. Scénario QA (`node scripts/qa-nat-limiteur.cjs`, 1280 et 360 px) : refresh 200, écran `/reunions` chargé, refresh token conservé, aucun défilement horizontal. Le critère « écran de connexion » du balayage détecte désormais le formulaire (identifiant + mot de passe), plus le mot « mot de passe » (faux positif de `/profil`). Relevés : `r2-13-balayage-avant.json` (fd412be), `r2-13-balayage-apres.json`, `r2-13-qa-nat-apres.json` ; captures `r2-13-nat-*.png`, `r2-13-qa-nat-apres-*.png` et `r2-13-*.png` |
| Relance : `scripts/relancer-test.ps1` s'arrêtait sur le stderr de `prisma generate` | `$ErrorActionPreference = "Continue"` et contrôle de `$LASTEXITCODE` | exécuté sous PowerShell 5.1 (outil) à chaque relance de la recette, sans arrêt |

## Points relevés, non corrigés

- Listes déroulantes alimentées par la première page de `/membres` (200 membres au plus) : recherche de la barre supérieure, Annuaire, Reçus
  (« Avocat bénéficiaire »), Timbres, Paramètres. Sans effet pour un barreau de moins de 200 membres ; dans `barreau_pn_test` (plus de 6 000
  membres de test), les membres DEMO n'y figurent pas et l'aperçu du reçu montre un membre de test. À traiter par une recherche serveur, comme pour la discipline.
- Textes encore écrits « Pointe-Noire » hors documents : écran d'attente au chargement et titre de l'onglet (`index.html`), lieux par défaut
  des réunions et assemblées, sous-titre des publications de l'espace avocat, convocation disciplinaire, mention d'export de la liste des avocats,
  page publique de vérification.
- Page publique de vérification : la phrase « Signature électronique RSA-2048 / SHA-256 » est une affirmation de sécurité à faire relire (CA12).
- Journal d'audit : l'envoi d'un message depuis l'espace avocat est libellé « Création — Espace avocat (message #id) » au lieu de « Envoi d'un message ».
- Import : une qualité inconnue est ramenée à « avocat » sans erreur (seul un statut inconnu est signalé).
- Comptes de la base de test (SG, bâtonnier, trésorière) et membres de base portent des noms qui semblent réels (relevé juridique : données de démonstration 100 % fictives).
