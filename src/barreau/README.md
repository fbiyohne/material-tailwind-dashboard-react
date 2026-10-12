# Module front « barreau » (src/barreau)

Application React/Vite du Secrétariat Général du Barreau de Pointe-Noire.

## Structure
- `pages/` : écrans (Avocats, AvocatDetail, Stagiaires, Annuaire, Dashboard, TableauOrdre…).
- `components/` : composants partagés (Modal, FormField, Notice, StatutBadge, ImportMembresModal, EditMembreModal, ActeStatutModal…).
- `api/` : `client.js` (fetch + jetons), `resources.js` (appels métier : `radierMembre`, `declarerDeces`, `telechargerAvocatsPdf`, `importerMembres`, `normaliserMembre`).
- `utils/` : `exportCsv.js` (`versDelimite`, `versCsv`, `telechargerCsv`, `telechargerTxt`, `telechargerTexte`), `exports.js` (`exporterExcel`, `exporterPdf`), `format.js` (dates).
- `data/` : constantes et dérivations (`derivations.js` : libellés et tons des statuts, dont `decede` « Décédé », gris).

## ActeStatutModal
`components/ActeStatutModal.jsx`, props `mode` (`"radiation"`, `"execution"` ou `"deces"`), `membre`, `dossier` (mode `execution`), `open`, `onClose`, `onDone`.
- Exécution (T21, 2026-10-12) : radiation décidée en mode `EXPIRATION_RECOURS`, rendue exécutoire depuis `DossierDetail` (bouton « Rendre la radiation exécutoire », permission `discipline_decider`). Affiche la décision et l'organe ; date d'effet, référence de la décision (préremplie) et pièce justificative obligatoires ; envoie `radierMembre(id, { dateRadiation, dossierId, motifRadiation: "<référence> — pièce : <pièce>" })`.
- Radiation : date de la décision (défaut aujourd'hui, max aujourd'hui) et « Référence et motif de la décision » (300 caractères max, facultatif) ; rappel que la décision est prononcée par le Conseil et notifiée.
- Décès : date obligatoire (acte de décès), bouton « danger » désactivé tant que la date est vide ; pièce justificative obligatoire (T6 : acte ou certificat de décès et sa référence, aucune cause), envoyée par `declarerDeces(id, date, piece)`. `EditMembreModal` ne propose « Décédé » que pour corriger la date d'un décès déjà déclaré.
- Erreur serveur affichée sous le champ, saisie conservée ; fermeture bloquée pendant l'appel.
- `DossierDetail` propose aussi « Enregistrer une réformation » (voie, référence, date, motif ; confirmation ; `reformerDecisionDossier`, POST /discipline/:id/reformation) tant que la décision de radiation n'est pas réformée.
- Utilisée sur la fiche `AvocatDetail` en mode `deces` seulement (menu Actions) ; les modes `radiation` et `execution` ne servent plus que le module Discipline (`DossierDetail`).

## Fiche avocat : menu Actions et onglet Parcours (T20, M-20261011)
- En-tête : deux boutons-icônes (`aria-label` et `title`) « Modifier la fiche » et « Générer une attestation d'inscription », affichés seulement s'ils sont permis et possibles, puis `MenuActions` : Contacter, Modifier, Accès espace, Attestation | actions de parcours (`actionsParcours(membre, user)` de `SituationPanel.jsx` : rappel, mise en demeure, transmission, omission, réinscription, reprise, sorties volontaires, selon les droits) | Déclarer le décès, Supprimer (rouge, séparateur rouge). Sans aucune entrée permise, pas de bouton Actions.
- Aucune radiation sur la fiche ni dans `EditMembreModal` (prop `peutRadier` supprimée ; « Radié » et « Suspendu » n'y sont affichés que comme statut courant) : la radiation se décide dans le dossier disciplinaire et se répercute sur le Parcours.
- Ancien membre (radié, décédé, démissionnaire, retraité, cessation) : fiche en lecture seule (H2). Seuls restent actifs **Contacter**, qui ouvre un e-mail direct (`mailto:`, l'espace avocat et la messagerie étant fermés ; grisé sans adresse e-mail), et **Attestation**, qui délivre l'*attestation de sortie du tableau* (`GET /api/membres/:id/attestation-sortie/pdf`, texte sans motif de sortie, R-62). Modifier, Accès espace, Déclarer le décès et Supprimer sont grisés avec leur motif en info-bulle ; exception : Modifier reste permis pour un décédé, afin de corriger la date du décès (T6). Attestation est grisée pour un omis.
- Supprimer : confirmation avec la clause CL-SUPPRESSION et saisie exacte du n° d'inscription (`useConfirm({ motif: { attendu } })`) ; le refus 409 du serveur (fiche avec historique) s'affiche tel quel.
- Onglet « Parcours » (ex-« Situation ») : phrase d'explication, frise du plus récent au plus ancien ; chaque étape donne l'organe (« Décidé par »), le motif, la référence, la pièce et l'opérateur ; une omission 35-1° n'affiche que le code d'article. Aucun bouton dans l'onglet : la saisie passe par `EvenementModal`, ouverte depuis le menu Actions.

## Export de la liste des avocats (page Avocats)
Menu « Exporter » (liste filtrée) et « Exporter la sélection » : 4 formats.

| Format | Fichier | Particularités |
|--------|---------|----------------|
| CSV | `Avocats.csv` | séparateur `;`, UTF-8 avec BOM, CRLF |
| TXT | `Avocats.txt` | tabulations, UTF-8 sans BOM |
| Excel | `Avocats.xlsx` | feuille unique « Avocats » |
| PDF | `Avocats-AAAA-MM-JJ.pdf` | serveur `GET /api/membres/export/pdf` ; repli client `exporterPdf` si le serveur échoue (toast d'information, qualité réduite) |

Les fichiers CSV, TXT et XLSX commencent par une ligne de mention (« Barreau de Pointe-Noire — Document interne confidentiel… »), puis l'en-tête, puis les données. L'import saute cette ligne.

Sécurité : chaque export est d'abord journalisé côté serveur (`journaliserExport` → `POST /api/membres/export`) ; si le journal échoue, aucun fichier n'est produit. En CSV et TXT, une valeur commençant par `=`, `@`, ou par `+`/`-` sans être un simple nombre ou téléphone, est préfixée d'une apostrophe (protection contre l'injection de formules dans Excel/LibreOffice).

### Colonnes (ordre de `COLONNES_EXPORT`, `pages/Avocats.jsx`)
Le code compte **11 colonnes** (la consigne en annonçait 10) ; le motif de radiation n'en fait pas partie.
1. N°
2. N° inscription
3. Nom (brut, sans « Me »)
4. Qualité
5. Statut (libellé français)
6. Cabinet
7. Téléphone
8. Email
9. Date d'inscription
10. Date de radiation
11. Date de décès

Dates au format `AAAA-MM-JJ`. Jamais exportés : motif de radiation, adresse, date de naissance, RCCM, CNSS, observations.

## Import (ImportMembresModal)
- Formats : `.xlsx`, `.xls`, `.csv`, `.txt` ; pour `.csv` et `.txt` le séparateur (`;`, `,` ou tabulation) est détecté automatiquement, lecture en UTF-8.
- En-têtes reconnus (casse, accents et ponctuation ignorés) :

| Champ | Synonymes |
|-------|-----------|
| num | num, no, numero, numinscription, numerodinscription, ndinscription, n |
| nom | nom, nometprenom, nomprenom, avocat, nomcomplet |
| qualite | qualite |
| statut | statut, situation |
| sexe | sexe, genre, civilite |
| cabinet | cabinet |
| tel | tel, telephone, telephoneportable, contact |
| email | email, courriel, mail, adresseemail |
| rccm | rccm |
| cnss | cnss |
| adresse | adresse, adresseprofessionnelle |
| observations | observations, observation, remarques |
| maitreStage | maitrestage, maitredestage |
| dateNaissance | datenaissance, naissance, datedenaissance |
| dateInscription | dateinscription, inscription, datedinscription |
| dateServment | dateserment, serment, prestationdeserment, datedeserment |
| dateRadiation | dateradiation, datederadiation, radiation |
| dateDeces | datedeces, datededeces, deces |
| motifRadiation | motifradiation, motifderadiation, motif |

- « N° inscription » (en-tête des exports) se normalise en `ninscription` : volontairement non reconnu, jamais pris pour `num`. « N° » est reconnu comme `num`.
- Statut « décédé » → DECEDE. Une date invalide est ignorée sans faire échouer la ligne.
- Upsert par `num` : les membres existants sont mis à jour, les autres créés ; rien n'est supprimé ; les champs absents du fichier ne sont pas écrasés.
- Aperçu avant validation : « N ligne(s) retenue(s), M ligne(s) ignorée(s) (sans numéro ou sans nom) ». Plafond : 2 000 lignes par import.
- Rapport après import : créés / mis à jour / erreurs avec numéro de ligne. Relancer après une coupure ne crée aucun doublon.

### Simulation, doublons et modèle (T10, F-08)
- Dès le fichier choisi, l'écran appelle `POST /membres/import?simulation=1` : même validation que l'import réel, **aucune écriture**. L'aperçu affiche à créer / à mettre à jour / erreurs, les colonnes obligatoires manquantes (`num`, `nom`), les colonnes non reconnues (ignorées) et les doublons possibles (numéro répété dans le fichier ; numéro de la base porté par un autre nom ; nom identique une fois normalisé — casse, accents, ordre des mots — dans le fichier ou face à la base).
- « Annuler l'aperçu » abandonne sans rien appeler d'autre ; « Confirmer l'import » lance l'import réel. Il n'y a pas de retour arrière après confirmation (point ouvert si le Barreau l'exige).
- Modèle à télécharger : `public/modeles/modele-import-membres.csv` (lignes fictives à remplacer), servi à `/modeles/modele-import-membres.csv`.

### Convertir une liste PDF source (sans OCR)
L'application ne lit pas les PDF ni les scans. Procédure, hors application :
1. Utiliser un PDF à texte sélectionnable (sinon demander la liste au secrétariat sous forme de tableur). Pas d'OCR : un scan n'est pas converti.
2. Extraire le tableau avec un outil externe (copier-coller du PDF dans Excel, `pdftotext -layout`, ou l'export tableur d'un lecteur PDF).
3. Mettre en colonnes selon le modèle CSV : au minimum `num` et `nom`, puis qualité, statut, cabinet, téléphone, e-mail, dates (AAAA-MM-JJ ou JJ/MM/AAAA).
4. Enregistrer en CSV (UTF-8, séparateur « ; ») ou XLSX, puis importer : relire l'aperçu (erreurs, doublons) avant de confirmer.

### Aller-retour
Un fichier exporté en CSV, TXT ou XLSX se ré-importe tel quel : 0 créé, N mis à jour, 0 erreur, sans modification des valeurs.

## Composants partagés de la mission audit-conformité (T3, 2026-10-10)

Tous exportés par `components/index.js`. Icônes : Heroicons 24/outline (bibliothèque unique du projet). Jetons : `tailwind.config.cjs` uniquement. Non interactifs : aucun arrêt de tabulation ajouté.

| Composant | Usage | Props |
|---|---|---|
| `BandeauExperimental` | En tête de **chaque** écran du vote électronique et du timbre autonome (CA13). Deux textes C-11, seule source du rendu : `TEXTE_EXPERIMENTAL` (vote : `Elections`, `EspaceScrutins`, variante par défaut) et `TEXTE_EXPERIMENTAL_TIMBRE` (timbre : `Timbres`, `MesTimbres`, `VerificationPublique` de type timbre, `variante="timbre"`, sans mention du scrutin, R2-10). `role="note"`, sans bouton de fermeture. | `variante` (`timbre` ou absent) |
| `MentionJuridique` | Bandeau « Loi » / « Provisoire » avec source. Préréglages (texte de l'avis juridique, une seule source) : `regles`, `sursis`, `sanction`, `radiation`, `omission`, `passageTableau` → `<MentionJuridique type="omission" />`. Mention libre : `<MentionJuridique nature="provisoire" article="Règlement intérieur — à confirmer">…</MentionJuridique>`. | `type`, `nature` (`loi`\|`provisoire`), `article`, `children` |
| `StatutBadge` | 10 statuts (`inscrit`, `suspendu`, `radie`, `omis`, `honoraire`, `stagiaire`, `decede`, `demissionnaire`, `retraite`, `cessation`). Infobulle `title` = `STATUT_AIDE[statut]`. Radié : pastille rouge pleine ; omis : or à contour pointillé (temporaire) ; sorties définitives : gris. `decrire` lit l'explication aux lecteurs d'écran (fiche membre ; pas dans les tableaux). | `statut`, `decrire` |
| `Frise` | Frise chronologique verticale (historique de situation, circuit des impayés, circuit disciplinaire). État de l'étape en texte masqué + forme du repère (coche pleine / anneau or / cercle pointillé). `<time dateTime>` ; « Non daté » si pas de date ; message `vide` si aucune étape. | `titre` (nom de la liste), `etapes` [{`id`, `libelle`, `date`, `detail`, `etat`: `fait`\|`courant`\|`a_venir`}], `avecHeure`, `vide` |
| `StatutMessage` | Envoyé / Reçu / Lu d'un message : libellé écrit + coches (1, 2, 2 marine). Détail horodaté en infobulle et pour lecteur d'écran. `inverse` sur bulle marine. `statutMessage({recuLe, luLe})` exporté. Aucune portée de preuve affichée. | `envoyeLe`, `recuLe`, `luLe`, `inverse` |

Libellés et tons des statuts : `data/derivations.js` (`STATUT_MEMBRE_META`, surchargeables en Paramètres) ; l'omission passe du gris à l'or pour se distinguer de la radiation et du décès.

### Audit impeccable (T3)

Détecteur `impeccable detect` sur les 5 fichiers : 0 constat. Score technique 18/20 :
accessibilité 3/4, performance 4/4, thème 3/4, responsive 4/4, intégrité 4/4.
Contrastes mesurés (WCAG) : or foncé/or pâle 4,56 ; blanc/or foncé 4,92 ; encre/bleu pâle 14,5 ; encre 70 %/crème ≈ 6 ; blanc/rouge 9,3 ; repère « à venir » gris/blanc 4,59 (≥ 3:1 non-texte).
Capture 360 px : `docs/captures/t3-composants-360.png` (largeur de document 352 px, aucun défilement horizontal).

Corrections appliquées pendant l'audit :
- `.bpn-badge-or` passait en texte or #C4990A sur or pâle (≈ 2,5:1, échec AA) → `text-or-fonce` (4,56:1). Touche aussi les badges « Honoraire » existants (contraste seulement).
- Textes secondaires `text-gris` (3,99 à 4,32:1 sur gris clair et crème) → `text-encre/70`.
- Repères de frise « en cours » et « à venir » relevés à ≥ 3:1 (or foncé, gris pointillé).
- `StatutMessage` : variante `inverse` pour la bulle marine (texte gris illisible sur marine).
- Omis et Honoraire partageaient le même badge or → contour pointillé sur l'omission.
- « n° 026-92 » insécable dans les mentions (coupure observée à 360 px).
- Pastille décorative du `Badge` en `aria-hidden`.

Écarts connus : pas de mode sombre (absent du projet entier, hors périmètre « pas de refonte globale ») ; l'infobulle `title` n'apparaît qu'au survol (l'information reste écrite dans le libellé et lue par les lecteurs d'écran via `decrire` / le texte masqué) ; police DM Sans reprise du projet sans nouvel embarquement.

## Paramètres → Modules (T16, M-20261011)

`components/ParametresModules.jsx`, monté dans l'onglet « Modules » de `pages/Parametres.jsx`. Un interrupteur par entrée de `routes.jsx` ; toute la ligne est cliquable (cible de 44 px). L'enregistrement écrit `parametres.modules.masques` (chemins de route) puis `appliquerConfig`, et `layout/Sidebar.jsx` retire ces chemins du menu. `/`, `/parametres`, `/journal-audit`, `/tableau` et `/discipline` (`MODULES_OBLIGATOIRES`, `data/config.js`) restent toujours affichés : « non désactivable : obligation de traçabilité ». Masquage d'affichage seulement : les droits restent régis par la matrice RBAC. Captures et mesures : `docs/captures/m20261011/parametres-modules/`.

## Paramètres : 9 onglets (T17, M-20261011)

`pages/Parametres.jsx`, dans cet ordre : 1 Barreau et identité (sous-onglets Institution, Conseil de l'Ordre, Libellés des statuts) ; 2 Règles juridiques (mention « provisoire » dans le panneau, bloc Quitus `regles.quitus.validiteMois` de 1 à 24) ; 3 Tarifs et exercices ; 4 Rôles et sécurité (`MatriceAcces`, ligne Avocat désactivée « Espace cloisonné » issue de `rolesLectureSeule` de `GET /rbac`) ; 5 Paiements (canaux proposés en ligne, puis `PanneauPaiements`) ; 6 Notifications (`PanneauNotifications` : état SMTP et SMS, journal) ; 7 Messagerie ; 8 Modules ; 9 Documents (catégories d'archives, types de publication). L'ancien sous-onglet « Paiement & stage » est dissous ; chaque section s'enregistre seule. À partir de `lg`, `Tabs vertical` place les onglets en colonne à gauche (9 libellés ne tiennent pas sur une ligne) ; en dessous, rangée horizontale défilante. Test : `__tests__/Parametres.onglets.test.jsx`. Captures : `docs/captures/m20261011/parametres-onglets/`.

## Anciens membres (T18, M-20261011)

Page `/anciens-membres` (permission `membres`, entrée de menu sous « Avocats inscrits »), en lecture seule. Elle appelle `listerMembres({ sortis: "1", q, motif, du, au })` ; le serveur renvoie `motifSortie` et `dateSortie`, déjà masqués selon R-62 (« Sortie du tableau » pour un radié sans permission discipline). Le motif « Radiation » n'est proposé dans le filtre qu'aux profils discipline. Bandeau : constante `CL_ANCIENS_MEMBRES`, texte mot pour mot de la clause (docs/juridique/clauses-congres.md). Export CSV, TXT, XLSX via `MenuExport` d'Avocats, journalisé par `journaliserExport` avant tout fichier ; PDF tracé par le serveur. Tri initial par date de sortie décroissante, fiches sans date en dernier ; colonne Cabinet masquée sous `sm`. La liste « Avocats inscrits » ne propose plus les statuts de sortie. Captures et mesures : docs/captures/m20261011/anciens-membres/.

## Vérification des documents (T10, M-20261011)

Le QR des quitus, reçus et timbres mène à la page courte `/v/{q|r|t}/{ref}.{jeton}`, rendue par le serveur (HTML sans JS, voir `server/README.md`) ; en développement, Vite la relaie au backend (proxy `/v/`). Les liens « Vérifier » de `Quitus`, `Recus`, `Timbres` et `MesTimbres` suivent le champ `verif` renvoyé par l'API, avec repli sur l'ancienne page SPA `/verifier/{type}/{numero}` (`VerificationPublique`), qui ne vaut plus que pour les documents antérieurs à `VERIF_BASCULE`. `VerificationPublique` porte la clause CL-VERIF (aucune mention « RSA » ni « signature électronique » comme qualification).

## Copier mon timbre (T12, espace avocat, point 9 M-20261011)

Depuis l'espace avocat, **Mes timbres** : bouton « Copier mon timbre » place une image PNG d'au moins 1 200 px de large dans le presse-papiers (via `navigator.clipboard.write` et `ClipboardItem`), avec un QR signé et la clause CL-TIMBRE. En cas d'indisponibilité (HTTP non sécurisé, navigateur ancien), repli sur le téléchargement avec un message explicite. Deux autres boutons : « Télécharger PNG » (même image, fichier local) et « Télécharger SVG » (vectoriel, QR niveau M, aucune dépendance ajoutée).

Fichier : `src/barreau/utils/timbreImage.js`.

## Vérification publique des documents (T10, point 10 M-20261011)

Page `/v/:t/:ref` (où `t` ∈ q|r|t pour quitus, reçu, timbre) rendue côté serveur (HTML sans JS, voir `server/README.md`), affichant l'authenticité et le statut du document. En développement, Vite la relaie au backend (proxy `/v/`). L'ancienne page SPA `/verifier/{type}/{numero}` (VerificationPublique.jsx) reste valide pour les documents antérieurs à `VERIF_BASCULE`, puis n'affiche plus qu'une erreur 404 (pas de lien de vérification sur les nouveaux documents).

## Tests
`npm test` à la racine (vitest) : sérialisation CSV/TXT (`utils/__tests__/exportCsv.test.js`), `normaliserMembre` et `StatutBadge` (`api/__tests__/resources.test.jsx`), modales et fiche avocat (`components/__tests__`, `pages/__tests__`).
