# Registre des activités de traitement

Mission M-20261010-audit-ordre-avocats · Juriste-conseil Team Creatic, 2026-10-10. À tenir par le responsable du traitement (Barreau) et par le sous-traitant (Creatic Technologies) : loi n° 29-2019 du 10 octobre 2019, art. 67 à 69 (JO n° 45-2019 du 7 novembre 2019).

**Statut : projet à valider par le Barreau.** Rien n'a été déclaré ni déposé auprès de la Commission (son installation n'est pas vérifiée, HJ-D). Les durées « provisoire » renvoient à `docs/audit/POINTS-OUVERTS.md` et à `regles-reference.md`.

## 1. Identification

| Rubrique | Contenu |
|---|---|
| Responsable du traitement | Barreau de [nom] (Ordre des avocats du Congo), représenté par le Bâtonnier ; coordonnées : [à compléter] |
| Sous-traitant | Creatic Technologies ; contrat à signer (clause SOUS-TRAITANCE, art. 63) ; engagement écrit de confidentialité de chaque intervenant |
| Point de contact | [à désigner par le Barreau] |
| Hébergement | [à déterminer : Render, aaPanel ou autre ; pays à indiquer] — voir §4 |

## 2. Traitements

| N° | Traitement | Finalité | Personnes | Données | Destinataires | Durée de conservation | Formalité (hypothèse) |
|---|---|---|---|---|---|---|---|
| T-1 | Tableau de l'Ordre (public) | Tenir le tableau, registre public (loi 026-92, art. 34) | Avocats inscrits | Nom, numéro et date d'inscription, cabinet, ville ; ni motif de sortie ni coordonnées privées (PO-21) | Public ; organes de l'Ordre | Tant que l'avocat est inscrit ; archive de l'Ordre ensuite, à confirmer (PO-16) | Dispense (art. 31), à confirmer par un cabinet local |
| T-2 | Gestion des membres et historique des situations | Inscription, stage, passage au tableau, omission, réinscription, démission, retraite, décès, radiation | Avocats, stagiaires, honoraires, anciens membres | Identité, contact, naissance, diplômes, serment, statut, dates et motifs des changements de situation, pièces du dossier d'admission | Secrétariat, bâtonnier, SG selon la matrice RBAC | Vie du membre, puis archive de l'Ordre, à confirmer (PO-16) | Déclaration (art. 33) |
| T-3 | Casier judiciaire du dossier d'admission | Contrôle de l'art. 24 loi 026-92 | Candidats à l'inscription | Donnée relative aux condamnations (art. 16) : préférer la date et la conformité à la conservation du document | Organes habilités ; consultation journalisée | Limitée à l'instruction du dossier, à fixer | Autorisation (art. 37) ; aucun casier en démonstration |
| T-4 | Cotisations, reçus et quitus | Facturer, encaisser, délivrer reçus et quitus, relancer les impayés | Avocats, stagiaires | Montants en FCFA, dates, exercice, mode de paiement, numéro de reçu | Trésorier, bâtonnier, secrétariat | Dix ans pour les pièces comptables (AUDCIF, cité de mémoire, à vérifier) | Déclaration (art. 33) |
| T-5 | Discipline | Enregistrer saisines, instruction, décisions et notifications du conseil de discipline | Avocats mis en cause | Données relatives aux infractions et sanctions (art. 16), motivation, dates, pièces | Bâtonnier, SG (saisine, instruction) ; lecture journalisée (R-62) | Archive de l'Ordre, à confirmer (PO-16) | Autorisation (art. 37) |
| T-6 | Messagerie professionnelle | Échanges entre avocats et avec l'administration ; attestations ; accusés de lecture | Avocats, personnel du Barreau | Expéditeur, destinataire, date, objet, corps, pièce jointe, empreinte SHA-256, dates de réception et de lecture | Expéditeur et destinataire seulement ; l'administration ne voit que ses propres fils | Vie du compte, puis 12 mois après fermeture (provisoire, R-61) | Déclaration (art. 33) |
| T-7 | Journal d'audit | Tracer les actions sensibles et la lecture des dossiers disciplinaires | Utilisateurs de la plateforme | Utilisateur, action, date, identifiant de l'objet ; jamais le corps d'un message ni le contenu d'une pièce | ADMIN et personnes désignées | À fixer (provisoire) | Déclaration (art. 33) |
| T-8 | Élections et vote | Établir le corps électoral à la date du scrutin, recevoir les candidatures, enregistrer les votes | Avocats électeurs et candidats | Statut, ancienneté, cotisation à jour, candidature, bulletin | Commission électorale, bâtonnier | Procès-verbal conservé comme archive de l'Ordre ; le vote électronique reste un prototype | Déclaration (art. 33) |
| T-9 | Timbre de plaidoirie (prototype) | Émettre et vérifier des timbres en bac à sable ; statistiques par mois et par canal ; import de données externes | Avocats | Référence, date, montant, canal, nom de l'avocat dans les données importées | Trésorier ; vérification publique limitée au numéro, à la date et à la validité (R-64) | À fixer ; aucune émission réelle | Déclaration (art. 33) avant tout usage réel |
| T-10 | Comptes et accès | Authentifier, gérer les droits | Utilisateurs | Identifiant, e-mail, mot de passe, rôle, dernière connexion | ADMIN | Vie du compte | Déclaration (art. 33) |

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
| Déclaration | T-2, T-4, T-6, T-7, T-8, T-9, T-10 | art. 33 |
| Autorisation | T-3 (casier), T-5 (discipline) | art. 37 |
| Information préalable de la Commission | Hébergement hors Congo | art. 23 |
| Contrat de sous-traitance et engagements de confidentialité | Creatic – Barreau | art. 63 |
| Registre | Le présent document, tenu par chaque partie | art. 67 à 69 |

## 8. Points à confirmer

Installation de la Commission (HJ-D) ; qualification du tableau comme registre public dispensé (HJ-C) ; lieu d'hébergement ; durées « provisoire » ; durée de conservation des pièces comptables (HJ-I).
