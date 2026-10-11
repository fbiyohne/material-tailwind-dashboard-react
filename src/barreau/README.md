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
- Décès : date obligatoire (acte de décès), bouton « danger » désactivé tant que la date est vide.
- Erreur serveur affichée sous le champ, saisie conservée ; fermeture bloquée pendant l'appel.
- `DossierDetail` propose aussi « Enregistrer une réformation » (voie, référence, date, motif ; confirmation ; `reformerDecisionDossier`, POST /discipline/:id/reformation) tant que la décision de radiation n'est pas réformée.
- Utilisée sur la fiche `AvocatDetail`. Pour un membre décédé, les actions Radier, Déclarer le décès, Attestation et Accès espace sont masquées.

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

## Tests
`npm test` à la racine (vitest) : sérialisation CSV/TXT (`utils/__tests__/exportCsv.test.js`), `normaliserMembre` et `StatutBadge` (`api/__tests__/resources.test.jsx`), modales et fiche avocat (`components/__tests__`, `pages/__tests__`).
