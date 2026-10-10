# Module front « barreau » (src/barreau)

Application React/Vite du Secrétariat Général du Barreau de Pointe-Noire.

## Structure
- `pages/` : écrans (Avocats, AvocatDetail, Stagiaires, Annuaire, Dashboard, TableauOrdre…).
- `components/` : composants partagés (Modal, FormField, Notice, StatutBadge, ImportMembresModal, EditMembreModal, ActeStatutModal…).
- `api/` : `client.js` (fetch + jetons), `resources.js` (appels métier : `radierMembre`, `declarerDeces`, `telechargerAvocatsPdf`, `importerMembres`, `normaliserMembre`).
- `utils/` : `exportCsv.js` (`versDelimite`, `versCsv`, `telechargerCsv`, `telechargerTxt`, `telechargerTexte`), `exports.js` (`exporterExcel`, `exporterPdf`), `format.js` (dates).
- `data/` : constantes et dérivations (`derivations.js` : libellés et tons des statuts, dont `decede` « Décédé », gris).

## ActeStatutModal
`components/ActeStatutModal.jsx`, props `mode` (`"radiation"` ou `"deces"`), `membre`, `open`, `onClose`, `onDone`.
- Radiation : date de la décision (défaut aujourd'hui, max aujourd'hui) et « Référence et motif de la décision » (300 caractères max, facultatif) ; rappel que la décision est prononcée par le Conseil et notifiée.
- Décès : date obligatoire (acte de décès), bouton « danger » désactivé tant que la date est vide.
- Erreur serveur affichée sous le champ, saisie conservée ; fermeture bloquée pendant l'appel.
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

### Aller-retour
Un fichier exporté en CSV, TXT ou XLSX se ré-importe tel quel : 0 créé, N mis à jour, 0 erreur, sans modification des valeurs.

## Composants partagés de la mission audit-conformité (T3, 2026-10-10)

Tous exportés par `components/index.js`. Icônes : Heroicons 24/outline (bibliothèque unique du projet). Jetons : `tailwind.config.cjs` uniquement. Non interactifs : aucun arrêt de tabulation ajouté.

| Composant | Usage | Props |
|---|---|---|
| `BandeauExperimental` | En tête de **chaque** écran du vote électronique et du timbre autonome (CA13). Texte exact de l'avis, exporté en `TEXTE_EXPERIMENTAL`. `role="note"`, sans bouton de fermeture. | aucune |
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

## Tests
`npm test` à la racine (vitest) : sérialisation CSV/TXT (`utils/__tests__/exportCsv.test.js`), `normaliserMembre` et `StatutBadge` (`api/__tests__/resources.test.jsx`), modales et fiche avocat (`components/__tests__`, `pages/__tests__`).
