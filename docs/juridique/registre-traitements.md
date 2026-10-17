# Registre des activités de traitement

Mission M-20261010-audit-ordre-avocats · Juriste-conseil Team Creatic, 2026-10-10. À tenir par le responsable du traitement (Barreau) et par le sous-traitant (Creatic Technologies) : loi n° 29-2019 du 10 octobre 2019, art. 67 à 69 (JO n° 45-2019 du 7 novembre 2019).

**Statut : projet à valider par le Barreau.** Rien n'a été déclaré ni déposé auprès de la Commission (son installation n'est pas vérifiée, HJ-D). Les durées « provisoire » renvoient à `docs/audit/POINTS-OUVERTS.md` et à `regles-reference.md`.

## 1. Identification

| Rubrique | Contenu |
|---|---|
| Responsable du traitement | Barreau de [nom] (Ordre des avocats du Congo), représenté par le Bâtonnier ; coordonnées : [à compléter] |
| Sous-traitant | Creatic Technologies ; contrat à signer (clause SOUS-TRAITANCE, art. 63) ; engagement écrit de confidentialité de chaque intervenant. Accès au contenu couvert par le secret professionnel (messagerie, pièces) : oui (ADMIN). Base : instruction écrite du Barreau [à signer] et engagement individuel de confidentialité de chaque titulaire d'un compte ADMIN [à signer] ; finalité limitée à l'administration, au support, à la maintenance et à la sécurité ; chaque lecture est journalisée (JournalAudit, non effaçable), sans le contenu. Détail et projets de clauses : `acces-admin-contenu.md` |
| Point de contact | [à désigner par le Barreau] |
| Hébergement | [à déterminer : Render, aaPanel ou autre ; pays à indiquer] — voir §4 |

## 2. Traitements

| N° | Traitement | Finalité | Personnes | Données | Destinataires | Durée de conservation | Formalité (hypothèse) |
|---|---|---|---|---|---|---|---|
| T-1 | Tableau de l'Ordre (public) | Tenir le tableau, registre public (loi 026-92, art. 34) | Avocats inscrits | Nom, numéro et date d'inscription, cabinet, ville ; ni motif de sortie ni coordonnées privées (PO-21) | Public ; organes de l'Ordre | Tant que l'avocat est inscrit ; archive de l'Ordre ensuite, à confirmer (PO-16) | Dispense (art. 31), à confirmer par un cabinet local |
| T-2 | Gestion des membres et historique des situations | Inscription, stage, passage au tableau, omission, réinscription, démission, retraite, décès, radiation | Avocats, stagiaires, honoraires, anciens membres | Identité, contact, naissance, diplômes, serment, statut, dates et motifs des changements de situation, pièces du dossier d'admission | Selon la matrice ci-dessous (lignes membres, pieces) : lecture complète SG et ADMIN ; lecture partielle Bâtonnier, SA, Consultation, Trésorière et Accueil (annuaire, fiche selon la ligne) ; création SG, ADMIN, SA et Accueil (partielle) ; modification SG et ADMIN, SA (partielle) ; validation Bâtonnier et ADMIN, partielle pour SG (admission directe), SA et Trésorière (déclaration d'événement filtrée) ; suppression ADMIN ; fichier d'une pièce : SG, Bâtonnier et ADMIN (ADMIN : accès au contenu sur instruction écrite du responsable du traitement [référence de l'avenant, à renseigner], pour l'administration, le support et la sécurité ; chaque lecture est journalisée dans JournalAudit, sans le contenu) ; chaque avocat pour son seul dossier (ligne espace) | Vie du membre, puis archive de l'Ordre, à confirmer (PO-16) | Déclaration (art. 33) |
| T-3 | Casier judiciaire du dossier d'admission | Contrôle de l'art. 24 loi 026-92 | Candidats à l'inscription | Donnée relative aux condamnations (art. 16) : préférer la date et la conformité à la conservation du document | Selon la matrice ci-dessous (lignes pieces, discipline) : SG et Bâtonnier pour le fichier ; ADMIN : accès au contenu sur instruction écrite du responsable du traitement [référence de l'avenant, à renseigner], pour l'administration, le support et la sécurité ; chaque lecture est journalisée dans JournalAudit, sans le contenu ; Trésorière, Accueil et Consultation : 403 ; consultation journalisée | Limitée à l'instruction du dossier, à fixer | Autorisation (art. 37) ; aucun casier en démonstration |
| T-4 | Cotisations, reçus et quitus | Facturer, encaisser, délivrer reçus et quitus, relancer les impayés | Avocats, stagiaires | Montants en FCFA, dates, exercice, mode de paiement, numéro de reçu | Selon la matrice ci-dessous (lignes cotisations, recus, quitus, paiements) : SG, Trésorière, ADMIN ; chaque avocat pour ses seules pièces (ligne espace) ; Bâtonnier, SA, Consultation, Accueil : aucun accès ; vérification publique du quitus et du reçu limitée (T-11) | Dix ans pour les pièces comptables (AUDCIF, cité de mémoire, à vérifier) | Déclaration (art. 33) |
| T-5 | Discipline | Enregistrer saisines, instruction, décisions et notifications du conseil de discipline | Avocats mis en cause | Données relatives aux infractions et sanctions (art. 16), motivation, dates, pièces | Selon la matrice ci-dessous (ligne discipline) : Bâtonnier (décision), SG (saisine, instruction), ADMIN, SA en lecture (F6, à valider) ; l'avocat concerné pour les décisions qui lui sont notifiées (ligne espace) ; Trésorière, Accueil, Consultation : 403 ; toute lecture journalisée (R-62) | Archive de l'Ordre, à confirmer (PO-16) | Autorisation (art. 37) |
| T-6 | Messagerie professionnelle et avis de service | Échanges entre avocats et avec l'administration ; attestations ; accusés de lecture ; avis e-mail et SMS neutres | Avocats, personnel du Barreau | Expéditeur, destinataire, date, objet, corps, pièce jointe, empreinte SHA-256, dates de réception et de lecture ; journal des avis (canal, destinataire, sujet neutre, événement, statut), sans corps | Selon la matrice ci-dessous (lignes messagerie, notifications) : expéditeur et destinataire seulement (SG, Bâtonnier, Trésorière, SA et avocats, chacun pour ses fils) ; ADMIN : accès au contenu sur instruction écrite du responsable [référence de l'avenant, à renseigner], pour l'administration, le support et la sécurité, chaque lecture journalisée dans JournalAudit sans le contenu ; journal des avis : SG, ADMIN | Vie du compte, puis 12 mois après fermeture (provisoire, R-61) | Déclaration (art. 33) |
| T-7 | Journal d'audit | Tracer les actions sensibles, la lecture des dossiers disciplinaires (liste, dossier, PDF, casier), la lecture par l'ADMIN du contenu de la messagerie et des pièces (sans le contenu) et les écritures refusées en 403 (« Accès refusé », M-20261016) | Utilisateurs de la plateforme | Utilisateur, action, date, chemin, statut, IP, identifiant de l’objet ; jamais le corps d'un message ni le contenu d'une pièce | Titulaires de la permission « audit » : par défaut SG, ADMIN, Bâtonnier, SA, Consultation (docs/audits/m20261016/rbac-matrice.md) | 5 ans (provisoire, refus 403 compris ; HJ-M8) | Déclaration (art. 33). L'ADMIN (sous-traitant technique) crée, promeut, modifie, réinitialise et supprime tout compte, accorde « messagerie » et ouvre l'accès espace (décision du 16/10/2026, sur instruction écrite du responsable à formaliser) ; chaque action sur un compte habilité est alertée au titulaire et au SG ; aucun lien d'activation n'est régénéré sur un compte déjà activé (409, tous opérateurs). Hors application : l'accès technique à la base ou au serveur relève du contrat de sous-traitance (art. 63). |
| T-8 | Élections et vote | Établir le corps électoral à la date du scrutin, recevoir les candidatures, enregistrer les votes | Avocats électeurs et candidats | Statut, ancienneté, cotisation à jour, candidature, bulletin | Selon la matrice ci-dessous (lignes corps-electoral, scrutins) : SG, ADMIN, SA (gestion), Bâtonnier (lecture, validation partielle), Consultation (corps électoral en lecture) ; chaque électeur pour son vote et son éligibilité (ligne espace). La commission électorale n'a pas de rôle propre dans l'application | Procès-verbal conservé comme archive de l'Ordre ; le vote électronique reste un prototype | Déclaration (art. 33) |
| T-9 | Timbre de plaidoirie (prototype) | Émettre et vérifier des timbres en bac à sable ; statistiques par mois et par canal ; import de données externes | Avocats | Référence, date, montant, canal, nom de l'avocat dans les données importées | Selon la matrice ci-dessous (lignes droits, timbres) : SG, Trésorière, ADMIN ; vérification publique limitée au numéro, à la date et à la validité (R-64, ligne verifier) | À fixer ; aucune émission réelle | Déclaration (art. 33) avant tout usage réel |
| T-10 | Comptes et accès | Authentifier, gérer les droits | Utilisateurs | Identifiant, e-mail, mot de passe, rôle, dernière connexion ; alertes in-app par utilisateur | Selon la matrice ci-dessous (lignes users, rbac, demandes-acces, auth, mes-notifications, installation) : SG et ADMIN (comptes, droits, demandes d'accès ; suppression : ADMIN). L'ADMIN gère aussi les comptes qui accèdent au contenu (messagerie, pièces) : ADMIN : accès au contenu sur instruction écrite du responsable du traitement [référence de l'avenant, à renseigner], pour l'administration, le support et la sécurité ; chaque lecture est journalisée dans JournalAudit, sans le contenu ; chaque utilisateur pour son propre compte et ses alertes | Vie du compte | Déclaration (art. 33) |
| T-11 | Page publique de vérification (QR des quitus, reçus et timbres) | Permettre à un tiers de contrôler qu'un document a été émis par l'Ordre et d'en connaître le statut | Titulaires de quitus, de reçus et de timbres | Quitus : numéro, date de délivrance, date de fin, statut, nom et numéro d'inscription (déjà publics au tableau, art. 34). Reçu : numéro, date, exercice couvert, sans montant, adresse ni téléphone. Timbre : numéro, date, statut, sans nom (R-64). Avocat sorti : libellé neutre « titulaire non inscrit au tableau à ce jour » (PO-21) | Public, sans compte | Aucune donnée propre à la page ; ni cookie ni traceur tiers | Dispense probable (art. 31), à confirmer. Limitation de débit par adresse IP ; jeton signé pour les nouveaux documents ; anciennes URL sans jeton valables pour les documents antérieurs à la bascule seulement |
| T-12 | Vie institutionnelle de l'Ordre | Tenir les organes (conseil), les réunions du conseil et les assemblées générales (convocations, présences, PV), les cabinets, les publications et les archives ; identité des responsables dans les documents | Membres du conseil, avocats convoqués ou présents, titulaires et membres de cabinets, responsables de l'Ordre, membres nommés dans les archives | Nom, fonction, mandat et motif de sortie ; présences, quorum, décisions et PV ; nom, forme et coordonnées professionnelles du cabinet, titulaire et membres rattachés ; nom du membre d'une archive ; noms du Bâtonnier, de la Trésorière et du SG (Paramètres) | Selon la matrice ci-dessous (lignes conseil, reunions, assemblees, cabinets, publications, archives, parametres, installation) | Archive de l'Ordre, à confirmer (PO-16) | À confirmer : déclaration (art. 33) probable ; cabinets et noms des responsables en partie publics (tableau, art. 34) |

### Destinataires par rôle (matrice attendue, docs/audits/m20261016/rbac-matrice.md §3)

Le serveur reste maître ; le détail route par route est dans l'annexe (§9) de ce rapport. Les colonnes de rôles ci-dessous sont recopiées sans retouche des lignes correspondantes de la matrice condensée §3 (relecture ligne à ligne faite le 2026-10-16 contre rbac-matrice.md §3. Contrôle mécanique dans les deux sens, borné à la section 3 avant « ## 4. » : les 34 lignes de §3 sont présentes mot pour mot en tête de 34 lignes de ce tableau, 0 absente, aucune ligne en plus). Légende de §2 : **L** lecture, **C** création, **M** modification, **S** suppression ou annulation, **V** validation ; majuscule = sur toutes les routes du module, minuscule = sur une partie seulement, « — » = aucun accès (403).

| Module | SG | BAT | TRES | ADM | SA | CONS | ACC | AV | STAG | Traitement | Précisions (annexe §9 et §5) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| health | public | public | public | public | public | public | public | public | public | aucun traitement de données personnelles | Sonde de disponibilité, sans donnée |
| installation | public | public | public | public | public | public | public | public | public | T-10, T-12 | Fenêtre d'installation seulement (`wizardActif`) : création du premier compte ADMIN (nom, e-mail, mot de passe haché) et de l'identité institutionnelle (noms du Bâtonnier, de la Trésorière et du SG) ; refusée (409) une fois l'application installée |
| auth | LM | LM | LM | LM | LM | LM | LM | LM | LM | T-10 | Chacun pour son propre compte : connexion, activation, réinitialisation, changement de mot de passe, `GET /api/auth/me`. Les routes publiques (connexion, demande d'accès, activation) ne renvoient aucune donnée d'un tiers |
| membres | LCMsv | lV | lv | LCMSV | lCmv | l | lc | — | — | T-2 | Lecture : annuaire `GET /api/membres` ouvert à tous les rôles internes ; Trésorière limitée à l'annuaire (export, fiche, événements refusés) et à la déclaration d'événement filtrée dans le gestionnaire ; Bâtonnier : fiche, pièces, événements, validations (radiation, stage, admission directe). Création : SG, ADMIN, SA ; Accueil limité au dépôt de pièces. Modification : SG, ADMIN, SA. Validation partielle du SG : admission directe. Suppression d'un membre : ADMIN seul ; SG : suppression d'un rapport de stage. Écarts restrictifs non élargis : fiche et rapports refusés à SA, CONS, ACC (E8), écritures refusées au SA (E9, E10), dépôt refusé à l'Accueil (E11) |
| users | LCM | — | — | LCMS | — | — | — | — | — | T-10 | Suppression : ADMIN. Création, promotion ou reprise d'un compte SG : SG et ADMIN seulement. L'ADMIN crée, promeut, reprend et réinitialise aussi les comptes ayant accès au contenu ; l'alerte de privilège notifie sans bloquer et JournalAudit garde la trace |
| demandes-acces | LV | — | — | LV | — | — | — | — | — | T-10 | — |
| pieces | LSV | L | — | LSV | — | — | — | — | — | T-2, T-3 | Fichier d'une pièce (`GET /api/pieces/:id/fichier`) : SG, Bâtonnier et ADMIN ; ADMIN : sur instruction écrite du Barreau [à signer], pour l'administration, le support et la sécurité, lecture journalisée dans JournalAudit sans le contenu. ADMIN : aussi métadonnées, vérification, rejet, suppression. Trésorière, SA, Consultation, Accueil : 403 |
| notifications | L | — | — | L | — | — | — | — | — | T-6 | Journal des avis de service e-mail et SMS (`journalNotification` : canal, destinataire, sujet neutre, événement, statut, simulation ; jamais le corps d'un message), permission `parametres`. Les événements RELANCE et RECU se rattachent aussi à T-4 |
| mes-notifications | LM | LM | LM | LM | LM | LM | LM | — | — | T-10 | Chaque utilisateur interne, pour ses seules alertes (`req.user.id`) |
| rbac | LM | — | — | LM | — | — | — | — | — | T-10 | Toute modification est journalisée |
| paiements | LCV | — | LCV | LCV | — | — | — | — | — | T-4 | Mode test |
| cotisations | LC | — | LCV | LCSV | — | — | — | — | — | T-4 | Suppression : ADMIN |
| recus | LS | — | LS | LS | — | — | — | — | — | T-4 | — |
| quitus | LC | — | LC | LCS | — | — | — | — | — | T-4 | Émission refusée aujourd'hui à la Trésorière par le code (E12, à valider) |
| droits | LC | — | LC | LCS | — | — | — | — | — | T-9 | — |
| timbres | LC | — | LC | LCS | — | — | — | — | — | T-9 | Prototype |
| discipline | LCM | LCMV | — | LCMSV | L | — | — | — | — | T-3, T-5 | Instruction (PATCH) : titulaires de `discipline_saisir` (SG, BAT, ADMIN). Décision et réformation : BAT, ADMIN. Suppression : ADMIN. SA en lecture (F6, à valider). Trésorière, Accueil, Consultation : 403, casier compris. Toute lecture (liste, journal, dossier, PDF, casier) est journalisée |
| reunions | LCMS | L | — | LCMS | LCM | — | — | — | — | T-12 | Réunions du conseil : ordre du jour, présences, PV, convocations et feuille de présence en PDF. Suppression : SG, ADMIN |
| assemblees | LCMS | L | — | LCMS | LCM | — | — | — | — | T-12 | Assemblées générales : ordre du jour, quorum, décisions, PV. Suppression : SG, ADMIN |
| publications | LCMSV | LcV | — | LCMSV | LCM | L | L | — | — | T-12 | Lettre du Bâtonnier et publications : validation du statut par SG, BAT, ADMIN ; génération de la Lettre par SG, BAT, ADMIN, SA (refusée aujourd'hui au SA par le code, E9). Suppression : SG, ADMIN |
| archives | LCS | LC | — | LCS | LC | L | L | — | — | T-12 | Archives de l'Ordre (titre, référence, date, nom du membre concerné). Création : SG, BAT, ADMIN, SA (E5, E6). Suppression : SG, ADMIN |
| parametres | LM | Lm | L | LMS | L | L | L | — | — | T-12 | `GET /api/parametres` : vue filtrée pour tout rôle interne ; secrets jamais renvoyés. Modification : SG, BAT, ADMIN (règles de décision pour le Bâtonnier). Test des canaux : permission `parametres` (E7). Réinitialisation des données : ADMIN seul. Données personnelles : noms des responsables dans l'identité institutionnelle |
| corps-electoral | L | L | — | L | L | L | — | — | — | T-8 | — |
| dashboard | L | L | l | L | L | L | l | — | — | T-7 | Extrait du journal (`GET /api/dashboard/journal`) réservé aux titulaires de `audit` : refusé à la Trésorière et à l'Accueil |
| audit | L | L | — | L | L | L | — | — | — | T-7 | Titulaires de la permission `audit` |
| tableau | LV | L | — | LV | LV | L | L | — | — | T-1 | Registre public |
| scrutins | LCMSV | Lv | — | LCMSV | LCMV | — | — | — | — | T-8 | Publication des résultats refusée au Bâtonnier par le code (E13, à valider) |
| signatures | L | L | L | L | L | L | L | — | — | aucun traitement de données personnelles | Clé publique du Barreau et vérification d'une charge signée fournie par l'appelant ; rien n'est enregistré (signatures.ts:11-24) |
| conseil | LCMS | L | — | LCMS | LCM | — | — | — | — | T-12 | Composition du conseil : nom, fonction, rôle, mandat, motif de sortie, avocat rattaché. Suppression : SG, ADMIN |
| cabinets | LCMS | L | — | LCMS | LCM | L | L | — | — | T-12 | Cabinets : nom, forme, coordonnées professionnelles, titulaire et membres rattachés. Suppression, détachement d'un membre et purge : SG, ADMIN |
| calendrier-editorial | LM | LM | — | LM | LM | L | L | — | — | aucun traitement de données personnelles | Thèmes et textes de la Lettre par mois ; modification : SG, BAT, ADMIN, SA (E5). Le texte ne doit pas désigner une personne hors fonction publique de l'Ordre |
| espace | — | — | — | —\* | — | — | — | LCMSV | LCMSV | T-2, T-4, T-5, T-6 | Chaque avocat ou stagiaire, pour ses seules données (`membreId` du jeton) ; objet d'un autre membre : 403 ou 404. \* ADMIN : exception structurelle, pas un refus de droit. L'espace est un libre-service lié au `membreId` du jeton, que l'ADMIN n'a pas ; il gère ces accès côté administration (utilisateurs, ouverture d'accès, approbation des demandes) |
| messagerie | LC | LC | LC | LC | LC | — | — | — | — | T-6 | Contenu (liste avec aperçu, fil, pièce jointe, envoi, réponse, attestation) : SG, BAT, TRES, SA, chacun pour ses propres fils. ADMIN : accès au contenu sur instruction écrite du Barreau [référence de l'avenant, à renseigner], pour l'administration, le support et la sécurité ; chaque lecture (liste, fil, pièce jointe) est journalisée dans JournalAudit, sans le contenu. Consultation, Accueil : 403 |
| verifier | public | public | public | public | public | public | public | public | public | T-11 | Page publique `/v/...` : numéro, date, validité et statut seulement (R-64), sans compte |

La santé n'est jamais enregistrée : l'omission pour maladie (art. 35-1°) se limite au code d'article (loi 29-2019, art. 17).

## 3. Mesures de sécurité (art. 64)

Seules les mesures vérifiées figurent comme démontrées ; les autres sont des objectifs.

| Mesure | Démontré | Preuve ou état |
|---|---|---|
| Contrôle d'accès par rôles et permissions, bâtonnier distinct du SG pour les décisions | Oui | Tests serveur (`server/test`) et parcours 5 ; à rejouer avant livraison |
| Journalisation des actions et de la lecture des dossiers disciplinaires | À confirmer par le test CA10 de la mission | `docs/audit/AUDIT-CONFORMITE.md` |
| Journal sans contenu des messages | À confirmer par le test CA10 | idem |
| Journal non modifiable en base | À confirmer par le test de migration ; TRUNCATE non couvert | idem |
| Mots de passe protégés dans la base | À vérifier dans le code d'authentification avant affirmation | Contrôle par la sécurité |
| Protection des échanges (TLS) | Non démontré : dépend de l'hébergement de production | Ne pas affirmer avant vérification |
| Protection des données stockées, sauvegardes | Non démontré | À définir avec le Barreau et l'hébergeur |
| Démonstration isolée de la production | Oui (garde-fou sur le nom de la base du script) | Script de démonstration |

Le logiciel et le scénario n'affirment ni protection de bout en bout, ni valeur probatoire, ni horodatage de tiers (clauses C-01 et C-11).

## 3 bis. Sous-traitants techniques (art. 63)

Prestataires qui reçoivent des données pour le compte du Barreau. Contrat de sous-traitance à signer avec chacun (clause CL-CONTRAT-PRESTATAIRE, `clauses-congres.md`). Aucun n'est encore retenu : les pays sont à renseigner à la signature.

| Prestataire | Finalité | Données transmises | Pays d'hébergement | État |
|---|---|---|---|---|
| Fournisseur SMTP (e-mail) | Avis de service neutres (« nouveau message sur votre espace ») | Adresse e-mail du destinataire, objet neutre ; jamais le corps d'un message ni une pièce (loi 026-92, art. 52 ; R-58) | [à renseigner] | Mode test ; contrat à signer |
| Fournisseur SMS | Avis de service neutres, sans prospection | Numéro de téléphone, texte neutre ; aucun contenu de message ni information disciplinaire | [à renseigner] | Mode test ; contrat à signer ; identifiant d'expéditeur à enregistrer chez les opérateurs (non vérifié) |
| Prestataire de paiement agréé CEMAC (Mobile Money, agrégateur) | Encaisser cotisations et timbres ; fonds versés directement au compte de l'Ordre | Référence, montant, numéro de téléphone du payeur | [à renseigner] | Mode test verrouillé ; agrément à vérifier (PO-39) ; Creatic ne détient jamais de fonds |

Si un prestataire héberge hors du Congo, appliquer le §4 (art. 23).

## 4. Transfert hors du Congo (art. 23) — à signaler

Si l'hébergement de production est hors du Congo (Render, serveur aaPanel à l'étranger ou autre), le transfert n'est permis que vers un pays offrant une protection suffisante, et la Commission doit en être informée au préalable. Le lieu d'hébergement reste à décider par le Barreau avec Creatic, hors mission. Les données de démonstration sont fictives et non concernées.

## 5. Violation de données (art. 74)

Le sous-traitant prévient le responsable dans les 24 heures (contrat). Le responsable notifie la Commission dans les meilleurs délais, si possible sous 72 heures.

## 6. Droits des personnes

Accès, rectification et opposition : demande au secrétariat du Barreau (clause INFORMATION).

## 7. Formalités à préparer (aucune démarche faite)

| Formalité | Objet | Fondement |
|---|---|---|
| Dispense | Tableau public (T-1) | loi 29-2019, art. 31 |
| Déclaration | T-2, T-4, T-6, T-7, T-8, T-9, T-10 ; T-12 à confirmer. Pour T-6 et T-10, citer l'administrateur technique parmi les destinataires du contenu | art. 33 |
| Autorisation | T-3 (casier), T-5 (discipline) | art. 37 |
| Information préalable de la Commission | Hébergement hors Congo | art. 23 |
| Contrat de sous-traitance et engagements de confidentialité | Creatic – Barreau | art. 63 |
| Registre | Le présent document, tenu par chaque partie | art. 67 à 69 |

## 8. Points à confirmer

Installation de la Commission (HJ-D) ; hébergement et agrément des prestataires du §3 bis (PO-39) ; qualification du tableau comme registre public dispensé (HJ-C) ; lieu d'hébergement ; durées « provisoire » ; durée de conservation des pièces comptables (HJ-I).
