# Cycle de vie des avocats — dossier juridique

Mission M-20261009-avocats-cycle-de-vie · Barreau de Pointe-Noire (Ordre national des avocats du Congo) · Avis du juriste-conseil Team Creatic, 2026-10-10.

Textes de référence : loi n° 026-92 du 20 août 1992 portant organisation de la profession d'avocat (« loi 026-92 ») ; loi n° 29-2019 du 10 octobre 2019 portant protection des données à caractère personnel (« loi 29-2019 ») ; Acte uniforme OHADA relatif au droit comptable et à l'information financière du 26 janvier 2017 (« AUDCIF »). L'état de vérification de chaque texte est donné en section 5. Ce document n'est pas l'avis d'un cabinet inscrit au barreau congolais : les points marqués « à valider » le sont.

---

## 1. Fiche du registre des activités de traitement

Fondement : loi 29-2019, art. 67 à 69 (tenue d'un registre des traitements par le responsable). Fiche à reporter dans le registre du Barreau et à joindre au dossier de déclaration (art. 33, art. 43-46) dès l'installation de la Commission (voir section 4).

| Rubrique | Contenu |
|---|---|
| Responsable du traitement | Barreau de Pointe-Noire, représenté par le Bâtonnier — [adresse], [email] (loi 29-2019, art. 67) |
| Dénomination du traitement | Gestion du tableau de l'Ordre et du cycle de vie des avocats (inscription, modification, omission, suspension, radiation, décès, suppression des fiches erronées, import et export de la liste) |
| Finalités | (a) tenue du tableau de l'Ordre et de la liste du stage, impression annuelle et dépôt aux greffes (loi 026-92, art. 33-35) ; (b) exécution des décisions du Conseil : omission, suspension, radiation (loi 026-92, art. 8, 36-43) ; (c) mise à jour de fait du tableau en cas de décès ; (d) gestion des cotisations et du corps électoral ; (e) ouverture et fermeture des accès à l'espace avocat ; (f) statistiques internes de l'Ordre (loi 29-2019, art. 6-7) |
| Base légale | Mission légale de l'Ordre (loi 026-92, art. 8, 33-39) ; licéité, finalité et exactitude (loi 29-2019, art. 6-8) ; données relatives aux sanctions : traitement par un auxiliaire de justice dans ses attributions (loi 29-2019, art. 16) |
| Personnes concernées | Avocats inscrits, stagiaires, avocats honoraires, omis, suspendus, radiés, décédés ; utilisateurs internes (SG, trésorerie, accueil, consultation, administrateur) |
| Catégories de données | Identité et état civil (nom, prénoms, date de naissance, date de décès) ; données professionnelles (n° d'inscription, qualité, statut, cabinet, date de prestation de serment, dates d'inscription/radiation) ; coordonnées professionnelles ; données financières (cotisations, reçus, quitus, paiements) ; données de connexion (compte espace, jetons, journal d'audit avec adresse IP) ; **données relatives aux sanctions et mesures disciplinaires** : référence et motif de la décision de radiation — catégorie relevant des art. 16 et 37 de la loi 29-2019, accès restreint (voir « Mesures ») |
| Destinataires | Secrétariat et organes de l'Ordre (Conseil, Bâtonnier, Secrétaire Général, Trésorerie) ; greffes des cours d'appel (tableau annuel, loi 026-92, art. 34) ; procureurs généraux (décisions disciplinaires, loi 026-92, art. 39) ; public, pour l'annuaire limité à nom, qualité, statut, cabinet, téléphone et email professionnels ; l'avocat lui-même pour sa fiche. Le motif de radiation n'a aucun destinataire hors des organes de l'Ordre |
| Durées de conservation | Tableau historique (identité, statut, dates d'inscription, de radiation, de décès) : sans limitation, finalité historique et statistique (loi 29-2019, art. 7 et 65) ; pièces financières (reçus, quitus, paiements, cotisations) : 10 ans (AUDCIF, art. 24 — à vérifier) ; journaux d'audit : 5 ans (hypothèse, à inscrire dans la politique) ; comptes d'accès : désactivés dès suspension, omission, radiation ou décès, supprimés avec la fiche ; motif de radiation : durée du tableau historique, accès restreint |
| Transferts hors du Congo | Hébergement applicatif et base de données chez Render (région à confirmer, UE recommandée) = transfert transfrontalier (loi 29-2019, art. 23-25). Conditions : contrat de sous-traitance (art. 63 al. 3), chiffrement en transit, sauvegardes (art. 64), déclaration à la Commission dès son installation |
| Sous-traitants | Hébergeur (Render) ; prestataire d'envoi d'email (SMTP) pour les relances ; Creatic Technologies (développement et maintenance, accès aux données de test uniquement — hypothèse) |
| Mesures de sécurité (art. 63-64) | Authentification par compte nominatif et rôle (RBAC) ; motif de radiation servi uniquement sur la fiche (GET /api/membres/:id) aux rôles SG/Bâtonnier/Admin, exclu de l'annuaire, de l'espace avocat et des quatre formats d'export ; export réservé à la permission « membres » (jamais au rôle AVOCAT) ; journalisation (JournalAudit) de chaque radiation, décès, import, export, suppression avec auteur, horodatage et IP ; suppression définitive refusée (HTTP 409) tant qu'existent des pièces comptables ; révocation des jetons et désactivation du compte espace à la radiation et au décès ; TLS, sauvegardes de la base ; procédure de notification de violation sous 72 h (art. 74) |
| Formalités | Annuaire public : dispense de l'art. 31 (registre légal d'information du public) — hypothèse ; fichier interne : déclaration (art. 33) ; motif disciplinaire : autorisation (art. 37) ; régime transitoire (art. 99-100). Aucune formalité possible tant que la Commission n'est pas installée |

---

## 2. Clauses prêtes à coller

Les crochets [ ] sont à compléter par le secrétariat de l'Ordre. Les clauses de la messagerie, des accusés, de la discipline, des bandeaux du congrès et de la démonstration sont dans `clauses-congres.md` ; les valeurs juridiques (légales ou provisoires) dans `regles-reference.md`.

### 2.1 Mentions légales (site et pied des PDF)

> **Éditeur et responsable du traitement** : Barreau de Pointe-Noire (Ordre national des avocats du Congo), [adresse], [téléphone], [email de contact]. Directeur de la publication : le Bâtonnier en exercice.
> **Hébergeur** : [Render Services, Inc. — adresse], serveurs situés en [région].
> **Traitements de données** : mis en œuvre au titre de la loi n° 026-92 du 20 août 1992 portant organisation de la profession d'avocat et de la loi n° 29-2019 du 10 octobre 2019 portant protection des données à caractère personnel. Les formalités prévues aux articles 33 et 37 de la loi n° 29-2019 seront accomplies auprès de la Commission de protection des données dès son installation.
> **Réalisation** : Creatic Technologies, [adresse].

### 2.2 Politique de confidentialité

> **1. Finalités** (loi 29-2019, art. 6) — Le Barreau de Pointe-Noire traite vos données pour la tenue du tableau de l'Ordre et de la liste du stage, la gestion des inscriptions, omissions, suspensions, radiations et décès, des cotisations, du corps électoral et des élections, des procédures disciplinaires et des accès à l'espace avocat. Ces traitements sont fondés sur la mission légale de l'Ordre (loi n° 026-92, art. 8 et 33 à 43).
>
> **2. Données traitées** (loi 29-2019, art. 8, 14, 16) — Identité, coordonnées, données professionnelles, données financières liées aux cotisations, données de connexion. Les données relatives aux décisions disciplinaires sont traitées par les seuls organes de l'Ordre dans leurs attributions légales (art. 16).
>
> **3. Destinataires** — Secrétariat et organes de l'Ordre ; greffes des cours d'appel (tableau annuel, loi n° 026-92, art. 34) ; procureurs généraux (décisions disciplinaires, loi n° 026-92, art. 39) ; public pour l'annuaire limité aux nom, qualité, statut, cabinet, téléphone professionnel et email professionnel. Les motifs de décisions disciplinaires ne sont jamais diffusés hors des organes de l'Ordre.
>
> **4. Durées** (loi 29-2019, art. 7 et 65) — Données du tableau : conservées sans limitation à des fins historiques et statistiques ; données financières : 10 ans (Acte uniforme OHADA relatif au droit comptable) ; journaux d'audit : 5 ans ; comptes d'accès : désactivés dès suspension, omission, radiation ou décès.
>
> **5. Vos droits** (loi 29-2019, art. 50 à 59) — Vous disposez d'un droit d'accès, de rectification, d'opposition pour motif légitime et de portabilité, à exercer auprès de [email] ou par courrier au secrétariat de l'Ordre. Toute demande reçoit une réponse dans le délai légal.
>
> **6. Décès** (loi 29-2019, art. 60-61) — Les droits de la personne s'éteignent à son décès. Ses ayants droit peuvent, sur présentation de l'acte de décès et d'un justificatif de qualité, demander la prise en compte du décès et les mises à jour en découlant (retrait du tableau, du corps électoral et des cotisations, fermeture du compte espace).
>
> **7. Transfert et hébergement** (loi 29-2019, art. 23 à 25, 63 al. 3) — Les données sont hébergées chez [hébergeur] en [pays/région]. Ce transfert est encadré par un contrat imposant à l'hébergeur les obligations de sécurité et de confidentialité de l'article 63 ; il sera déclaré à la Commission de protection des données dès son installation.
>
> **8. Sécurité** (loi 29-2019, art. 63-64, 74) — Accès par compte nominatif, journalisation des opérations sensibles, chiffrement des échanges, sauvegardes. Toute violation de données vous concernant vous sera notifiée ainsi qu'à la Commission dans les 72 heures.

### 2.2.1 Politique de confidentialité — Messagerie

Ajout du 2026-10-10 (mission M-20261010-audit-ordre-avocats, clause C-03 de `clauses-congres.md`). Fondement : loi 026-92, art. 52 ; loi 29-2019, art. 7, 63-65. Condition de publication : la première phrase suppose le test CA10 au vert ; le chiffrement et l'hébergement ne sont décrits que selon `docs/audit/CONFIDENTIALITE-EFFECTIVE.md`.

> **9. Messagerie** — Le contenu des messages et des pièces n'est accessible qu'à leurs expéditeurs et destinataires. Les administrateurs de la plateforme et l'Ordre n'y ont pas accès par l'application ; le journal d'audit ne conserve que les métadonnées (auteur, destinataire, date, empreinte). Les messages sont conservés tant que le compte est actif, puis [12 mois] après sa fermeture, sauf les pièces versées à un dossier, conservées selon la durée de ce dossier. [Ne décrire le chiffrement et l'hébergement que selon CONFIDENTIALITE-EFFECTIVE.md.]

### 2.2.2 Politique de confidentialité — Dossier disciplinaire et pièces du dossier professionnel

Ajout du 2026-10-10 (clause C-04 de `clauses-congres.md`). Fondement : loi 026-92, art. 24 et 35-1° ; loi 29-2019, art. 14 et 16. Complète le point 2 ci-dessus.

> **10. Dossier disciplinaire et pièces du dossier professionnel** — Les données relatives aux procédures et sanctions disciplinaires et le casier judiciaire déposé au dossier d'admission (art. 24 de la loi n° 026-92) sont traitées par les seuls organes de l'Ordre dans leurs attributions (loi n° 29-2019, art. 16). Chaque consultation est enregistrée. Aucune donnée médicale n'est enregistrée au titre d'une omission (art. 35-1°).

### 2.3 CGU de l'espace avocat — clause d'accès et de suspension

> **Accès** — L'accès à l'espace avocat est réservé aux avocats inscrits au tableau de l'Ordre ou sur la liste du stage. Il est strictement personnel.
>
> **Suspension de plein droit** — L'accès est suspendu de plein droit, sans formalité, en cas d'omission, d'interdiction temporaire, de radiation ou de décès, à compter de l'enregistrement de la décision ou de l'acte par le secrétariat de l'Ordre, sans préjudice des voies de recours prévues aux articles 40 à 43 de la loi n° 026-92 du 20 août 1992. Les sessions ouvertes sont fermées et aucun document (attestation, quitus) ne peut plus être délivré en ligne. L'accès est rétabli par le secrétariat sur décision de réinscription ou de réformation de la décision.
>
> **Données** — Les données de l'espace sont traitées conformément à la politique de confidentialité (loi n° 29-2019, art. 43 à 46).

### 2.4 Charte des utilisateurs internes (SG, trésorerie, accueil, consultation, administrateur)

Fondement : loi 29-2019, art. 63 (confidentialité ; personnes agissant sous l'autorité du responsable), art. 64 (sécurité). Charte à signer avant remise des identifiants ; copie au registre.

> Je soussigné(e) [nom], [fonction] au Barreau de Pointe-Noire, utilisateur du système de gestion du tableau, m'engage, conformément à l'article 63 de la loi n° 29-2019 du 10 octobre 2019 :
> 1. à n'utiliser les données des membres que pour l'exercice de mes attributions, avec mon compte personnel, sans partager mes identifiants ;
> 2. à ne pas diffuser hors des organes de l'Ordre les fichiers exportés (Excel, CSV, TXT, PDF), à les stocker sur un support protégé et à les supprimer de mon poste dès la fin de l'usage ;
> 3. à ne consulter ni divulguer les données relatives aux décisions disciplinaires en dehors de mes attributions (art. 16) ;
> 4. à signaler au Secrétaire Général, sous 24 heures, tout incident, perte, accès non autorisé ou fichier égaré (art. 74) ;
> 5. à restituer tout fichier et à cesser tout accès à la fin de mes fonctions.
> Je suis informé(e) que chaque opération sensible est journalisée et que la violation de ces engagements expose l'Ordre et son auteur aux sanctions des articles 92 à 98 de la loi n° 29-2019.
> Fait à Pointe-Noire, le [date]. Signature :

### 2.5 Contrat de sous-traitance avec l'hébergeur (DPA) — exigences minimales

Fondement : loi 29-2019, art. 63 al. 3 (le sous-traitant présente des garanties suffisantes, fixées par contrat), art. 64, art. 74 al. 2. À vérifier dans les conditions de Render (Data Processing Addendum standard) ; tout point absent fait l'objet d'un avenant ou motive un changement d'hébergeur.

| Exigence | Article | Contenu attendu |
|---|---|---|
| Objet, durée, nature des données | art. 63 al. 3 | Hébergement de l'application et de la base PostgreSQL du Barreau ; données listées en section 1 |
| Instructions documentées | art. 63 | L'hébergeur n'agit que sur instruction écrite du Barreau ; aucun usage propre ni cession |
| Confidentialité du personnel | art. 63 | Engagement de confidentialité des personnes habilitées |
| Mesures de sécurité | art. 64 | Chiffrement en transit et au repos, sauvegardes quotidiennes, journalisation, contrôle d'accès physique et logique |
| Notification de violation | art. 74 al. 2 | Notification au Barreau sans délai, au plus tard 24 h après découverte, pour permettre la notification à la Commission sous 72 h |
| Localisation des serveurs | art. 23-25 | Région déclarée (UE recommandée) ; tout changement de région notifié au préalable |
| Sous-traitance ultérieure | art. 63 | Liste des sous-traitants ultérieurs, information préalable, mêmes obligations |
| Fin de contrat | art. 65 | Restitution d'une copie exploitable de la base, puis suppression certifiée |
| Audit | art. 63 | Mise à disposition des certifications (SOC 2, ISO 27001) et réponse aux demandes de la Commission |

---

## 3. Bandeaux et messages applicatifs

Textes de référence, à reprendre mot pour mot (espaces insécables incluses) ; source : spécification UI `docs/superpowers/specs/2026-10-09-avocats-cycle-de-vie-ui.md`, § 6. Implémentation au 2026-10-10 : `src/barreau/components/ActeStatutModal.jsx` (modales, identiques), `server/src/routes/membres.ts` (409, identique), `server/src/middleware/audit.ts` (libellés d’audit, identiques) ; la mention des exports et le titre PDF sont spécifiés (spec § 4.2 et § 6) et seront portés par `server/src/lib/templates.ts` et `src/barreau/pages/Avocats.jsx` à la tâche export : y recopier les cellules ci-dessous telles quelles. Contrôle : `grep -cF "<texte>" <fichier>` doit renvoyer au moins 1 pour chaque ligne (les insécables comptent).

| Emplacement | Fondement | Texte |
|---|---|---|
| Modale « Radier » — bandeau | loi 026-92, art. 36 (peines disciplinaires), art. 39 (notification) | La radiation est prononcée par le Conseil siégeant en matière disciplinaire (art. 36 loi n° 026-92). Enregistrez ici la date et la référence de la décision notifiée (art. 39). |
| Modale « Radier » — conséquences | loi 026-92, art. 34-35 ; loi 29-2019, art. 65 | L'avocat sera retiré du tableau de l'Ordre, du corps électoral et des cotisations ; son accès à l'espace avocat sera désactivé. |
| Modale « Déclarer le décès » — bandeau | Code de la famille (acte de décès, à vérifier) ; loi 29-2019, art. 61 | Enregistrement sur présentation de l'acte de décès. Le compte espace sera désactivé et l'avocat retiré du tableau, du corps électoral et des cotisations. |
| Modale « Déclarer le décès » — indice du champ date | Code de la famille (acte de décès, à vérifier) | date portée sur l'acte de décès |
| Exports CSV/TXT (ligne 1), XLSX (A1), PDF (en-tête et pied) | loi 29-2019, art. 63-64 | Barreau de Pointe-Noire — Document interne confidentiel — Liste arrêtée au JJ/MM/AAAA — Diffusion interdite hors des organes de l'Ordre. |
| PDF — titre | loi 29-2019, art. 63 | Liste des avocats — {filtre} — arrêtée au JJ/MM/AAAA — Document interne |
| PDF — pied de page abrégé | loi 29-2019, art. 63 | Document interne confidentiel — Barreau de Pointe-Noire |
| DELETE /api/membres/:id — refus 409 | AUDCIF, art. 24 (à vérifier) | Suppression impossible : pièces comptables à conserver 10 ans (OHADA) ; utilisez radiation ou décès |
| Journal d'audit — libellés | loi 29-2019, art. 63-64 | Radiation d'un avocat — Avocat · Déclaration de décès — Avocat · Import du tableau — Avocat · Export de la liste des avocats — Avocat |

Règles d'écriture : le logiciel enregistre une décision, il ne la prononce jamais (loi 026-92, art. 36-43) ; le champ « motif » de la radiation est libellé « Référence et motif de la décision » ; la date de décès est celle portée sur l'acte de décès.

---

## 4. Démarches à valider par Fabrice (aucune n'a été engagée)

| # | Démarche | Pourquoi | Auprès de qui |
|---|---|---|---|
| V-01 | Obtenir le règlement intérieur de l'Ordre national des avocats du Congo et du Barreau de Pointe-Noire | Aligner les libellés de statuts, la procédure d'omission et la constatation du décès sur le texte interne (non trouvé en ligne) | Secrétariat du Barreau de Pointe-Noire |
| V-02 | Signer le contrat de sous-traitance (DPA) avec l'hébergeur Render selon la section 2.5 | loi 29-2019, art. 63 al. 3 | Render (dashboard → Legal / DPA) ; à défaut, avenant |
| V-03 | Confirmer la région d'hébergement et choisir une région UE (Frankfurt) si ce n'est pas déjà le cas ; documenter le choix | loi 29-2019, art. 23-25 : transfert vers un pays assurant un niveau de protection suffisant | Render (paramètres du service et de la base) |
| V-04 | Préparer le dossier de déclaration (fichier interne, art. 33) et d'autorisation (motif disciplinaire, art. 37) à partir de la fiche de la section 1 ; le déposer dès l'installation de la Commission nationale de protection des données | loi 29-2019, art. 33, 37, 43-46, 99-100 | Commission (non installée au 2026-10-10 ; projet de loi du 3 juillet 2024) ; en attendant, ministère en charge de l'économie numérique |
| V-05 | Désigner un délégué à la protection des données si le Barreau est qualifié d'organisme chargé d'une mission de service public | loi 29-2019, art. 83-91 (hypothèse H-J02) | Conseil de l'Ordre |
| V-06 | Faire signer la charte 2.4 par chaque utilisateur interne | loi 29-2019, art. 63 | Secrétaire Général |
| V-07 | Publier les mentions légales 2.1, la politique 2.2 et les CGU 2.3 sur le site et dans l'espace avocat, après complément des crochets | loi 29-2019, art. 43-46 (information des personnes) | Bâtonnier / Secrétaire Général |
| V-08 | Vérifier au Journal officiel (https://www.sgg.cg/JO/) les textes marqués « à vérifier » en section 5 | Sécuriser les références citées | Journal officiel ; cabinet local au besoin |
| V-09 | Arbitrer le garde-fou DELETE 409 (pièces comptables) : conservé par la mission ; si le Barreau préfère une anonymisation, nouvelle mission | AUDCIF, art. 24 | Fabrice / Conformité-finance |
| V-10 | Vérifier qu'aucune suppression en cascade de reçus/quitus/paiements n'a eu lieu en production avant ce garde-fou | AUDCIF, art. 24 | Conformité-finance (journal d'audit de production) |

---

## 5. Textes cités et état de vérification

| Texte | Articles mobilisés | Vérifié | Source / où vérifier |
|---|---|---|---|
| Loi n° 026-92 du 20 août 1992 portant organisation de la profession d'avocat | 5-6, 8, 15-16, 18-23, 24-32, 33-35, 36-43, 47, 52, 54, 61, 65-66 (détail dans `regles-reference.md`) | oui (texte intégral lu le 2026-10-09, relu le 2026-10-10 ; recopie non officielle à recouper avec le JO de 1992) | https://liziba.cg/wp-content/uploads/2024/12/Loi-n°026-92-du-20-aout-1992-portant-organisation-de-la-profession-davocat.pdf |
| Loi n° 29-2019 du 10 octobre 2019 portant protection des données à caractère personnel | 6-8, 14-16, 23-25, 31, 33-37, 43-46, 50-61, 63-69, 74, 83-91, 92-100 | oui (JO n° 45-2019 du 7 novembre 2019 lu le 2026-10-09) | https://www.sgg.cg/JO/2019/congo-jo-2019-45.pdf |
| AUDCIF (OHADA, 26 janvier 2017) | art. 24 — conservation 10 ans des livres et pièces | **à vérifier** : règle des 10 ans certaine, numéro d'article cité de mémoire | https://www.ohada.com (texte officiel de l'acte uniforme) |
| Loi congolaise relative aux transactions électroniques (2019, numéro probable 24-2019) | écrit et signature électroniques — non requis par la mission | **à vérifier** (numéro et contenu) | https://www.sgg.cg/JO/2019/ |
| Loi n° 073-84 du 17 octobre 1984 portant Code de la famille | actes de l'état civil (acte de décès) | **à vérifier** (non consulté) | Journal officiel ; cabinet local |
| Loi n° 26-2020 du 5 juin 2020 relative à la cybersécurité | obligations générales de sécurité | **à vérifier** (articles non lus) | https://liziba.cg/wp-content/uploads/2024/09/Loi-n°26-2020-du-5-juin-2020-relative-a-la-cybersecurite.pdf |
| Règlement intérieur de l'Ordre / du Barreau de Pointe-Noire | tenue du tableau, omission, décès | **à vérifier** (non trouvé en ligne) | Secrétariat du Barreau de Pointe-Noire (V-01) |
| Projet de loi créant la Commission nationale de protection des données (Conseil des ministres du 3 juillet 2024) | autorité de contrôle | **à vérifier** (installation non constatée) | https://www.osiris.sn ; ministère de l'économie numérique |

Hypothèses de ce dossier : H-J01 pays concerné = Congo-Brazzaville seul ; H-J02 le Barreau est une personne morale de droit privé chargée d'une mission de service public (délai transitoire de 2 ans, art. 100) ; H-J03 l'annuaire public relève de la dispense de l'art. 31 ; H-J04 Commission non installée ; durée des journaux d'audit fixée à 5 ans par choix de l'Ordre (aucun texte n'impose une durée) ; région Render inconnue à ce jour.
