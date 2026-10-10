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

## Tests
`npm test` à la racine (vitest) : sérialisation CSV/TXT (`utils/__tests__/exportCsv.test.js`), `normaliserMembre` et `StatutBadge` (`api/__tests__/resources.test.jsx`), modales et fiche avocat (`components/__tests__`, `pages/__tests__`).
