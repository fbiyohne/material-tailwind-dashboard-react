# Référentiel des règles juridiques — paramétrage du logiciel

Mission M-20261010-audit-ordre-avocats · Barreau de Pointe-Noire (Ordre national des avocats du Congo) · Juriste-conseil Team Creatic, 2026-10-10.

**Objet.** Ce tableau est la seule référence des valeurs juridiques du logiciel. Il alimente `REGLES_DEFAUT` (`server/src/lib/regles.ts`, tâche T4), la graine de démonstration et l'écran Paramètres. Aucune autre valeur ne doit être codée en dur (CA12).

**Texte de base.** Loi n° 026-92 du 20 août 1992 portant organisation de la profession d'avocat, texte intégral relu le 2026-10-10 sur la recopie publiée par liziba.cg (https://liziba.cg/wp-content/uploads/2024/12/Loi-n°026-92-du-20-aout-1992-portant-organisation-de-la-profession-davocat.pdf). C'est une recopie non officielle : elle doit être recoupée avec le Journal officiel de 1992. Aucune loi modificative n'a été trouvée (hypothèse HJ-3).

**Statuts.**
- `légal` : la valeur est fixée par la loi, dont l'article est cité. Elle reste modifiable dans Paramètres, pour suivre une éventuelle réforme, mais elle est pré-remplie et affichée avec la mention « loi ».
- `provisoire` : aucune loi ne fixe la valeur. Elle relève du règlement intérieur de l'Ordre national ou du Barreau (loi n° 026-92, art. 8-3°, 18-1°, 47 et 54), qui n'a pas été communiqué, ou d'un choix de l'Ordre. Elle est affichée avec la mention « provisoire » et figure dans `docs/audit/POINTS-OUVERTS.md`.

**Règle d'écriture commune.** Le logiciel enregistre une décision, il ne la prononce jamais. Chaque changement de situation mentionne l'organe décideur, la date, la référence et la pièce. Aucune omission, aucune sanction et aucune radiation n'est déclenchée automatiquement.

Les clés de paramétrage sont des propositions pour `Parametres.data.regles` (décision D5 de l'architecture). Le développeur de T4 peut les renommer, mais il doit garder la valeur, la source et le statut.

## 1. Stage, accès et passage au tableau

| ID | Règle | Valeur | Clé de paramétrage proposée | Source | Statut |
|---|---|---|---|---|---|
| R-01 | Durée du stage | 24 mois | `stage.dureeMois = 24` | loi n° 026-92, art. 27 al. 2 (l'art. 65 prévoit 3 ans à titre transitoire, voir PO-01) | légal |
| R-02 | Prolongation du stage si le stagiaire n'a pas satisfait, par le bâtonnier, après audition | 2 prolongations de 12 mois au plus | `stage.prolongationsMax = 2`, `stage.prolongationMois = 12` | loi n° 026-92, art. 30 | légal |
| R-03 | Fin de stage : certificat délivré par le bâtonnier de l'Ordre national sur avis favorable du bâtonnier du barreau | « Valider le stage » exige la date et la référence du certificat | `stage.certificatObligatoire = true` | loi n° 026-92, art. 29 | légal |
| R-04 | Inscription au tableau du stagiaire certifié, sur sa demande | La date de la demande est exigée ; date d'inscription au tableau = date de la décision enregistrée | `stage.demandeObligatoire = true` | loi n° 026-92, art. 31 | légal |
| R-05 | Notification de l'inscription au tableau | Liste des destinataires et courrier PDF : Garde des Sceaux, bâtonniers, chefs de juridiction, procureurs généraux. Aucun envoi réel | `stage.destinatairesNotification` | loi n° 026-92, art. 31 | légal |
| R-06 | Dispense de stage : magistrats | 5 ans de service effectif au moins | `admissionDirecte.cas[MAGISTRAT].ancienneteMinAns = 5` | loi n° 026-92, art. 32-1° | légal |
| R-07 | Dispense de stage : professeurs, maîtres-assistants et assistants titulaires d'un diplôme de droit | 8 ans de service effectif au moins | `admissionDirecte.cas[ENSEIGNANT_DROIT].ancienneteMinAns = 8` | loi n° 026-92, art. 32-2° | légal |
| R-08 | Dispense de stage : notaires titulaires d'une maîtrise ou d'un diplôme équivalent | 5 ans de pratique professionnelle au moins | `admissionDirecte.cas[NOTAIRE].ancienneteMinAns = 5` | loi n° 026-92, art. 32-2° | légal |
| R-09 | Liste des dispenses | Liste fermée de 3 catégories. Le transfert d'un avocat déjà inscrit dans un barreau de l'Ordre national et la demande d'un Congolais ayant exercé à l'étranger ne sont pas des dispenses : ils suivent l'inscription ordinaire | `admissionDirecte.cas` (3 entrées, chacune avec son article) | loi n° 026-92, art. 32 et 66 | légal |
| R-10 | Organe qui statue sur l'inscription, l'omission, la réinscription et le rang | Conseil de l'Ordre national ; recours devant la Cour suprême contre toute décision portant grief | `organes.inscription = CONSEIL_NATIONAL` | loi n° 026-92, art. 8-2° | légal |
| R-11 | Pièce d'admission au stage | Extrait de casier judiciaire ; donnée relative aux infractions, accès réservé aux organes habilités, consultation journalisée | — (règle d'accès, pas de paramètre) | loi n° 026-92, art. 24 ; loi n° 29-2019, art. 16 | légal |

## 2. Tableau, omission et situations

| ID | Règle | Valeur | Clé de paramétrage proposée | Source | Statut |
|---|---|---|---|---|---|
| R-12 | Omission : causes légales | 5 causes codées 35-1° à 35-5° (éloignement, maladie ou activité étrangère ; subordination ; défaut d'honorabilité ; contribution non acquittée ; défaut d'exercice effectif) | `omission.causes` | loi n° 026-92, art. 35 | légal |
| R-13 | Omission : organe | Prononcée par le Conseil de l'Ordre national, d'office ou à la demande du procureur général ; le logiciel enregistre la décision (date, référence, pièce) | `organes.omission = CONSEIL_NATIONAL` | loi n° 026-92, art. 8-2° et 35 | légal |
| R-14 | Omission pour impayés | Cause 35-4° : contribution aux charges de l'Ordre non acquittée dans les délais, sans motif valable | `omission.causeImpayes = "35-4"` | loi n° 026-92, art. 35-4° | légal |
| R-15 | Omission pour maladie ou infirmité | Enregistrée par son seul code d'article, sans aucun détail médical. Le champ motif libre affiche : « N'inscrivez ici aucune donnée médicale. » | — (règle de saisie) | loi n° 026-92, art. 35-1° ; loi n° 29-2019, art. 14 | légal |
| R-16 | Circuit avant omission pour impayés | RAPPEL, puis MISE_EN_DEMEURE, puis TRANSMISSION au Conseil national, puis enregistrement de la décision d'omission ; chaque étape exige la précédente sur le même exercice | `impayes.etapes` | règlement intérieur — à confirmer | provisoire |
| R-17 | Délai entre rappel et mise en demeure | 30 jours | `impayes.delaiRappelJours = 30` | règlement intérieur — à confirmer | provisoire |
| R-18 | Délai accordé par la mise en demeure avant transmission | 15 jours | `impayes.delaiMiseEnDemeureJours = 15` | règlement intérieur — à confirmer | provisoire |
| R-19 | Effet de l'omission | Hors tableau, mesure administrative distincte de la radiation ; réversible par une décision de réinscription du Conseil national | `omission.temporaire = true` | loi n° 026-92, art. 8-2° et 35 | légal |
| R-20 | Rang à la réinscription | Le rang est fixé par la décision (champ saisi). À défaut de saisie : date d'inscription d'origine conservée | `reinscription.rangParDefaut = "ORIGINE"` | aucun texte — à confirmer (l'art. 8-2° confie le rang au Conseil national sans critère) | provisoire |
| R-21 | Congé | Alternative à l'omission accordée par le Conseil national : ni exercice, ni participation aux assemblées générales, ni usage du titre. Non géré par le logiciel (aucun statut CONGE), voir PO-05 | — | loi n° 026-92, art. 35 in fine | légal |
| R-22 | Défaut de paiement de la prime d'assurance collective | Suspension d'office par le Conseil de l'Ordre, sans audition, jusqu'au paiement ; distincte de l'omission. Non séparée de la cotisation dans le logiciel, voir PO-07 | — | loi n° 026-92, art. 61 | légal |
| R-23 | Avocats honoraires | Inscrits au tableau ; l'honorariat est conféré par le Conseil national | `organes.honorariat = CONSEIL_NATIONAL` | loi n° 026-92, art. 8-12° et 33 | légal |
| R-24 | Démission, retraite, cessation d'activité | Sorties volontaires définitives, hors tableau, enregistrées sur demande écrite de l'avocat avec pièce et date d'effet | `sorties.volontaires = [DEMISSIONNAIRE, RETRAITE, CESSATION]` | aucun texte — à confirmer (la loi ne prévoit que l'omission, la radiation et l'honorariat) | provisoire |
| R-25 | Tableau | Imprimé une fois par an et déposé aux greffes des cours d'appel ; le PDF porte sa date d'arrêté | — | loi n° 026-92, art. 34 | légal |

## 3. Discipline

| ID | Règle | Valeur | Clé de paramétrage proposée | Source | Statut |
|---|---|---|---|---|---|
| R-26 | Organe disciplinaire | Conseil du barreau siégeant comme conseil de discipline, en premier ressort ; le logiciel enregistre la décision, il ne la prend pas | `organes.discipline = CONSEIL_BARREAU` | loi n° 026-92, art. 18-10° et 36 | légal |
| R-27 | Saisine | D'office, à la demande du procureur général près la cour d'appel, à l'initiative du bâtonnier de l'Ordre national ou du bâtonnier du barreau | `discipline.origines = [OFFICE, PROCUREUR_GENERAL, BATONNIER_NATIONAL, BATONNIER]` | loi n° 026-92, art. 36 | légal |
| R-28 | Peines | Liste fermée : avertissement, réprimande, interdiction temporaire, radiation | `sanctions[].code = AVERTISSEMENT, REPRIMANDE, INTERDICTION_TEMPORAIRE, RADIATION` | loi n° 026-92, art. 36 | légal |
| R-29 | Durée de l'interdiction temporaire | 12 mois au plus (le texte dit « une année du stage », coquille probable, voir HJ-2) | `sanctions[INTERDICTION_TEMPORAIRE].dureeMaxMois = 12` | loi n° 026-92, art. 36 | légal |
| R-30 | Effets des peines sur la fiche | Avertissement et réprimande : aucun changement de statut ; interdiction temporaire ferme : SUSPENDU ; radiation : RADIE | `sanctions[].effet = AUCUN, AUCUN, SUSPENSION, RADIATION` | loi n° 026-92, art. 36 | légal |
| R-31 | Peine accessoire | Interdiction de faire partie du Conseil du barreau et/ou du Conseil de l'Ordre national, 60 mois au plus, possible avec toute peine sauf la radiation ; elle rend inéligible | `peineAccessoire.ineligibiliteMaxMois = 60` | loi n° 026-92, art. 36 | légal |
| R-32 | Droits de la défense | Avocat entendu ou appelé sous huitaine (convocation 8 jours au moins avant), entier dossier mis à sa disposition, assistance par un avocat, parole en dernier. Dates de convocation et de mise à disposition du dossier à saisir | `discipline.delaiConvocationJours = 8` | loi n° 026-92, art. 37 | légal |
| R-33 | Motivation | Champ « motivation » obligatoire pour toute sanction | `discipline.motivationObligatoire = true` | loi n° 026-92, art. 38 | légal |
| R-34 | Notification | Par le bâtonnier, par lettre recommandée, dans les 10 jours du prononcé ; interdiction et radiation adressées pour information aux procureurs généraux ; décision rendue sur saisine du procureur général notifiée à celui-ci dans les 3 jours. Date de notification obligatoire | `discipline.delaiNotificationJours = 10`, `discipline.delaiNotificationPgJours = 3` | loi n° 026-92, art. 39 | légal |
| R-35 | Opposition (décision par défaut) | 5 jours à compter de la notification à personne, par déclaration au secrétariat du barreau | `discipline.delaiOppositionJours = 5` | loi n° 026-92, art. 40 | légal |
| R-36 | Appel | Ouvert à l'avocat sanctionné et aux procureurs généraux ; 10 jours francs ; en cas de décision par défaut, le délai court à l'expiration du délai d'opposition ; l'Ordre national statue dans les 2 mois de l'appel | `discipline.delaiAppelJoursFrancs = 10`, `discipline.delaiStatuerAppelMois = 2` | loi n° 026-92, art. 41 et 42 | légal |
| R-37 | Point de départ du délai d'appel d'une décision contradictoire | Calculé à compter de la date de notification saisie (le texte dit « à compter de la notification des délais d'opposition », formule ambiguë, voir PO-09) | `discipline.departAppel = "NOTIFICATION"` | aucun texte — à confirmer (interprétation de l'art. 42) | provisoire |
| R-38 | Recours devant la Cour suprême | Pourvoi contre la décision d'appel ; recours pour excès de pouvoir contre l'interdiction et la radiation. Aucun délai calculé par le logiciel (la loi n° 026-92 n'en fixe pas) | — | loi n° 026-92, art. 42 et 43 | légal |
| R-39 | Sursis | Autorisé pour la démonstration, sur l'interdiction temporaire seulement ; une interdiction avec sursis laisse l'avocat au tableau (statut INSCRIT) ; mention visible : « non prévu par la loi n° 026-92 — applicable seulement si le règlement intérieur le prévoit » | `sursisAutorise = true`, `sanctions[INTERDICTION_TEMPORAIRE].sursisPossible = true` | règlement intérieur — à confirmer (art. 47 et 54 ; la loi n° 026-92 ne prévoit pas le sursis) | provisoire |
| R-40 | Effet de la radiation sur la fiche | À l'enregistrement de la décision, sous réserve des voies de recours ; retour possible en arrière tracé dans l'historique si la décision est réformée. Autre valeur possible : à l'expiration des délais de recours | `effetRadiation = "ENREGISTREMENT"` (autre valeur : `"EXPIRATION_RECOURS"`) | aucun texte — à confirmer | provisoire |
| R-41 | Enquêteur ou rapporteur | Désignation facultative, datée ; la loi ne connaît ni enquêteur ni rapporteur | `discipline.rapporteurActif = true` | règlement intérieur — à confirmer | provisoire |
| R-42 | Matrice bâtonnier / secrétaire général (actions d'enregistrement) | Enregistrer une décision disciplinaire : bâtonnier. Enregistrer une saisine : SG et bâtonnier. Valider le stage (enregistrer le certificat) : bâtonnier. Enregistrer une omission : SG. Admission directe : SG et bâtonnier. L'ADMIN garde l'accès (anti-verrouillage) | `RolePermission` : `discipline_decider`, `discipline_saisir`, `stage_valider`, `omission_prononcer`, `admission_directe` | règlement intérieur — à confirmer (art. 19 : délégation du bâtonnier à des membres du Conseil) | provisoire |

## 4. Élections

| ID | Règle | Valeur | Clé de paramétrage proposée | Source | Statut |
|---|---|---|---|---|---|
| R-43 | Élection du bâtonnier du barreau | Élu pour 2 ans par l'assemblée générale des avocats inscrits au tableau, au scrutin secret, majorité absolue des votants au premier tour, relative au second ; rééligible | `elections.BATONNIER.mandatAns = 2`, `elections.BATONNIER.tours = [ABSOLUE, RELATIVE]` | loi n° 026-92, art. 15 | légal |
| R-44 | Éligibilité au bâtonnat | Inscrit au tableau depuis plus de 8 ans (comparaison stricte, à la date du scrutin) | `eligibilite.BATONNIER.ancienneteMinAns = 8`, `eligibilite.BATONNIER.stricte = true` | loi n° 026-92, art. 15 | légal |
| R-45 | Composition du Conseil du barreau | Bâtonnier, membre de droit, et 1 membre élu par l'assemblée générale pour 3 avocats inscrits au tableau | `sieges.CONSEIL_BARREAU.avocatsParSiege = 3` | loi n° 026-92, art. 16 | légal |
| R-46 | Composition du Conseil de l'Ordre national | Bâtonniers en exercice, membres de droit, et 1 avocat élu par chaque barreau pour 6 avocats de ce barreau | `sieges.CONSEIL.avocatsParSiege = 6` | loi n° 026-92, art. 6 | légal |
| R-47 | Bâtonnier de l'Ordre national | Élu pour 2 ans par l'assemblée générale des avocats inscrits au tableau, parmi les bâtonniers et anciens bâtonniers | `eligibilite.BATONNIER_NATIONAL.parmi = [BATONNIER, ANCIEN_BATONNIER]` | loi n° 026-92, art. 5 | légal |
| R-48 | Corps électoral | Avocats inscrits au tableau, à la date du scrutin ; les stagiaires (liste du stage) et les omis sont exclus, ainsi que les statuts hors tableau | `electoral.qualites = [AVOCAT]`, `electoral.statutsExclus` contient OMIS, RADIE, DECEDE, DEMISSIONNAIRE, RETRAITE, CESSATION | loi n° 026-92, art. 15, 16, 27 et 35 | légal |
| R-49 | Avocats en congé | Exclus des assemblées générales | — (aucun statut CONGE, voir PO-05) | loi n° 026-92, art. 35 in fine | légal |
| R-50 | Cotisation à jour comme condition de vote | Exigée, cotisation de l'exercice qui couvre la date du scrutin | `electoral.exigerCotisationAJour = true` | aucun texte — à confirmer | provisoire |
| R-51 | Vote des avocats honoraires | Non électeurs (comportement actuel du logiciel), alors que l'art. 33 les inscrit au tableau, voir PO-10 | `electoral.honorairesElecteurs = false` | aucun texte — à confirmer | provisoire |
| R-52 | Vote des avocats sous interdiction temporaire ferme en cours | Non électeurs ; avec sursis : électeurs | `electoral.statutsExclus` contient SUSPENDU | règlement intérieur — à confirmer | provisoire |
| R-53 | Inéligibilité par peine accessoire | Inéligible au Conseil visé tant que la peine accessoire court à la date du scrutin | `eligibilite.exclurePeineAccessoire = true` | loi n° 026-92, art. 36 | légal |
| R-54 | Ancienneté pour être élu au Conseil du barreau ou au Conseil de l'Ordre national | Aucune condition d'ancienneté (la loi n'en fixe pas ; en ajouter une restreindrait l'éligibilité sans texte) | `eligibilite.CONSEIL_BARREAU.ancienneteMinAns = 0`, `eligibilite.CONSEIL.ancienneteMinAns = 0` | aucun texte — à confirmer | provisoire |
| R-55 | Assemblée générale du barreau | Quorum des deux tiers présents ou représentés ; seconde convocation valable sans quorum ; majorité simple ; voix prépondérante du bâtonnier | `ag.quorum = 2/3` | loi n° 026-92, art. 21 | légal |
| R-56 | Transmission des délibérations de l'assemblée générale du barreau | Copie au bâtonnier de l'Ordre national et au procureur général près la cour d'appel dans les 8 jours ; date de transmission à saisir | `ag.delaiTransmissionJours = 8` | loi n° 026-92, art. 23 | légal |
| R-57 | Vote électronique | Prototype seulement : la loi impose le scrutin secret en assemblée générale de membres présents ou représentés et ne prévoit pas le vote à distance. Bandeau « Expérimental » obligatoire | — | loi n° 026-92, art. 15 et 21 | légal |

## 5. Messagerie, accusés, timbres et données

| ID | Règle | Valeur | Clé de paramétrage proposée | Source | Statut |
|---|---|---|---|---|---|
| R-58 | Secret professionnel | Contenu des messages et des pièces inaccessible à l'ADMIN, au journal d'audit et aux exports ; le journal ne garde que les métadonnées (auteur, destinataire, date, empreinte) | — (règle d'accès, test CA10) | loi n° 026-92, art. 52 | légal |
| R-59 | Accusé de lecture | Ne vaut ni lettre recommandée ni notification ; pied de page obligatoire (clause C-01) | — | loi n° 026-92, art. 39 et 42 (lettre recommandée exigée) | légal |
| R-60 | Pièces jointes | PDF, DOCX, JPG, PNG ; 10 Mo au plus par fichier ; 5 fichiers par message | `messagerie.formats`, `messagerie.tailleMaxMo = 10`, `messagerie.piecesMax = 5` | aucun texte — à confirmer (choix technique repris dans les CGU, clause C-02) | provisoire |
| R-61 | Conservation des messages | Tant que le compte est actif, puis 12 mois après sa fermeture ; les pièces versées à un dossier suivent la durée du dossier | `messagerie.conservationMoisApresFermeture = 12` | aucun texte — à confirmer | provisoire |
| R-62 | Données disciplinaires | Réservées aux rôles habilités, consultation journalisée, exclues de l'annuaire, des exports, de la liste des membres et de l'espace des tiers | — (règle d'accès) | loi n° 29-2019, art. 16 et 37 | légal |
| R-63 | Timbre de plaidoirie autonome | Prototype en sandbox ; aucune base juridique trouvée (texte ou délibération du Conseil national), aucune émission réelle | `timbre.modeSandbox = true` | aucun texte — à confirmer | provisoire |
| R-64 | Page publique de vérification d'un timbre | Numéro, date et validité seulement ; aucune donnée personnelle | — | loi n° 29-2019, art. 7 | légal |

## 6. Hors tableau, pour mémoire

- **Encaissement réel** des timbres et cotisations : réservé à un prestataire de services de paiement agréé (Règlement n° 04/18/CEMAC/UMAC/COBAC du 21 décembre 2018, synthèses secondaires, texte officiel non relu, à vérifier sur https://www.beac.int). Ni l'Ordre ni Creatic ne détiennent les fonds. Démo en sandbox seulement.
- **Reçus et quittances** : numérotation continue et logo du barreau ; durée de conservation selon l'AUDCIF (article cité de mémoire, voir `cycle-de-vie-avocats.md` §5). Régime fiscal des cotisations : renvoyé à la conformité-finance.
- **Valeurs retirées du cadrage initial (H4)**, contraires à la loi n° 026-92 : la deuxième peine de l'art. 36 est la « réprimande » ; l'interdiction temporaire ne dépasse pas 12 mois ; l'ancienneté du bâtonnat est de plus de 8 ans ; la dispense de stage ne vise que les 3 catégories de l'art. 32. La graine de démonstration et `REGLES_DEFAUT` doivent reprendre ce tableau.

## 7. Contrôle

`node docs/juridique/verifier-referentiel.mjs` vérifie que chaque règle porte une valeur, une source et un statut cohérent (une règle `légal` cite un article de loi, une règle `provisoire` porte « à confirmer »), que les valeurs écartées n'apparaissent pas, que les 14 clauses sont présentes et que chaque point ouvert a sa valeur provisoire.
