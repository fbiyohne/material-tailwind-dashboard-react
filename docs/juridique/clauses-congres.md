# Clauses et mentions — version du congrès

Mission M-20261010-audit-ordre-avocats · Juriste-conseil Team Creatic, 2026-10-10.

Textes à reprendre **mot pour mot** dans l'interface, les PDF et les documents. Les crochets [ ] sont à compléter (nom du barreau depuis Paramètres, durées). Les références renvoient à la loi n° 026-92 du 20 août 1992 (« loi 026-92 ») et à la loi n° 29-2019 du 10 octobre 2019 (« loi 29-2019 »). Les valeurs citées sont celles de `regles-reference.md`.

**Condition de publication.** Une clause qui décrit une protection (C-03, C-04) ne s'affiche que si la protection est prouvée dans `docs/audit/CONFIDENTIALITE-EFFECTIVE.md` (CA16). Sinon, on retire la phrase concernée ; on n'ajoute jamais de promesse.

<!-- termes-interdits:debut -->
**Termes interdits** dans l'interface, les PDF, les clauses et le scénario de démonstration, parce qu'aucun texte congolais promulgué ne les fonde (recherche négative du 2026-10-10, hypothèse HJ-6) : « certifié », « horodatage qualifié », « signature électronique », « recommandé électronique », « chiffré de bout en bout », « vote vérifiable », « secret garanti ». L'empreinte SHA-256 se décrit comme une « empreinte technique », rien de plus.
<!-- termes-interdits:fin -->

---

### C-01 — Pied de l'accusé de réception (PDF)

Emplacement : pied de chaque accusé produit par `accuseReceptionHtml` (`server/src/lib/templates.ts`). Fondement : loi 026-92, art. 39 et 42 (lettre recommandée exigée) ; aucune loi sur la preuve électronique vérifiée.

> Accusé de lecture établi automatiquement par la plateforme du Barreau [nom] à partir de ses journaux techniques. Il atteste les dates d'envoi, de réception et de première ouverture enregistrées par le système, et l'empreinte SHA-256 des pièces transmises. Il ne vaut ni lettre recommandée ni notification au sens des articles 39 et 42 de la loi n° 026-92 du 20 août 1992. Valeur probatoire à confirmer.

Le titre du document est « Accusé de lecture de la plateforme ». Le corps du message n'y figure pas.

### C-02 — CGU de l'espace avocat : messagerie professionnelle

Emplacement : CGU de l'espace avocat (article à ajouter après la clause d'accès de `cycle-de-vie-avocats.md` §2.3) ; rappel court sous le formulaire d'envoi. Fondement : loi 026-92, art. 52.

> **Messagerie professionnelle** — La messagerie est réservée aux échanges entre avocats inscrits et avec les autorités ordinales. Chaque utilisateur est seul responsable du contenu et des pièces qu'il transmet, et du respect du secret professionnel (art. 52 de la loi n° 026-92) et des règles de confidentialité des correspondances entre confrères fixées par le règlement intérieur. Formats admis : PDF, DOCX, JPG, PNG ; 10 Mo au plus par fichier ; 5 fichiers par message. Les messages ne remplacent pas les formes de notification prévues par la loi ou les règlements (lettre recommandée, signification).

### C-03 — Politique de confidentialité : messagerie

Emplacement : `cycle-de-vie-avocats.md` §2.2.1 (reprise intégrale). Fondement : loi 026-92, art. 52 ; loi 29-2019, art. 7, 63-65.

> **Messagerie** — Le contenu des messages et des pièces n'est accessible qu'à leurs expéditeurs et destinataires. Les administrateurs de la plateforme et l'Ordre n'y ont pas accès par l'application ; le journal d'audit ne conserve que les métadonnées (auteur, destinataire, date, empreinte). Les messages sont conservés tant que le compte est actif, puis [12 mois] après sa fermeture, sauf les pièces versées à un dossier, conservées selon la durée de ce dossier. [Ne décrire le chiffrement et l'hébergement que selon CONFIDENTIALITE-EFFECTIVE.md.]

Condition : la phrase « n'y ont pas accès par l'application » n'est publiée qu'après le passage du test CA10 (absence du champ `corps` pour un jeton ADMIN).

### C-04 — Politique de confidentialité : dossier disciplinaire et pièces du dossier professionnel

Emplacement : `cycle-de-vie-avocats.md` §2.2.2 (reprise intégrale). Fondement : loi 026-92, art. 24 et 35-1° ; loi 29-2019, art. 14 et 16.

> **Dossier disciplinaire et pièces du dossier professionnel** — Les données relatives aux procédures et sanctions disciplinaires et le casier judiciaire déposé au dossier d'admission (art. 24 de la loi n° 026-92) sont traitées par les seuls organes de l'Ordre dans leurs attributions (loi n° 29-2019, art. 16). Chaque consultation est enregistrée. Aucune donnée médicale n'est enregistrée au titre d'une omission (art. 35-1°).

### C-05 — Bandeau de l'écran Paramètres, règles juridiques

Emplacement : en tête de la section « Règles juridiques » de `Parametres.jsx`, affiché tant qu'une valeur est marquée « provisoire ». Chaque valeur porte l'étiquette « loi » ou « provisoire » et sa source (colonnes Source et Statut de `regles-reference.md`).

> Les valeurs signalées ‹ loi › reprennent la loi n° 026-92 du 20 août 1992 (article indiqué). Les valeurs signalées ‹ provisoire › ne figurent pas dans la loi et doivent être confirmées par le règlement intérieur de l'Ordre et du Barreau avant tout usage officiel.

### C-06 — Infobulle du sursis

Emplacement : case « Sursis » de la saisie d'une décision disciplinaire, et réglage `sursisAutorise` dans Paramètres. Fondement : loi 026-92, art. 36, 47 et 54.

> Le sursis n'est pas prévu par la loi n° 026-92. Ne l'appliquer que si le règlement intérieur le prévoit.

Mention permanente à côté du réglage : « non prévu par la loi n° 026-92 — applicable seulement si le règlement intérieur le prévoit ».

### C-07 — Bandeau d'enregistrement d'une sanction

Emplacement : formulaire « Enregistrer la décision » du dossier disciplinaire (`DossierDetail.jsx`). Fondement : loi 026-92, art. 18, 36 à 42.

> La sanction est prononcée par le Conseil du barreau siégeant en conseil de discipline (art. 18 et 36 loi n° 026-92), après audition ou convocation sous huitaine et communication du dossier (art. 37). Enregistrez la décision motivée (art. 38) et sa date de notification (art. 39). Opposition : 5 jours (art. 40) ; appel : 10 jours francs (art. 42).

### C-08 — Radiation : ajout au bandeau existant

Emplacement : modale « Radier » (`ActeStatutModal.jsx`), à la suite du bandeau de `cycle-de-vie-avocats.md` §3 ; fiche d'un avocat radié ; décision disciplinaire de radiation. Fondement : loi 026-92, art. 40 à 43.

> Effet enregistré sous réserve des voies de recours (art. 40 à 43 loi n° 026-92) ; en cas de réformation, la fiche est rétablie et l'opération tracée.

### C-09 — Bandeau de l'omission

Emplacement : étape « Omission » du circuit des impayés (`CircuitImpayes.jsx`) et toute saisie d'omission. Fondement : loi 026-92, art. 8 et 35.

> L'omission est prononcée par le Conseil de l'Ordre national (art. 8 et 35 loi n° 026-92). Mesure administrative distincte de la radiation disciplinaire ; réinscription sur décision du Conseil, qui fixe le rang.

### C-10 — Bandeau du passage au tableau

Emplacement : action « Valider le stage » (`StagePanel.jsx`). Champs exigés : date et référence du certificat, date de la demande. Fondement : loi 026-92, art. 29 et 31.

> Inscription au tableau sur demande de l'avocat stagiaire titulaire du certificat de fin de stage délivré par le Bâtonnier de l'Ordre national (art. 29 et 31 loi n° 026-92). Saisissez la référence du certificat et la date de la demande.

### C-11 — Bandeau « Expérimental » (vote et timbre autonome)

Emplacement : `BandeauExperimental.jsx`, sur tous les écrans du vote électronique et du timbre autonome (CA13). Fondement : loi 026-92, art. 15 et 21 ; Règlement n° 04/18/CEMAC/UMAC/COBAC (encaissement réservé aux prestataires agréés, texte à vérifier).

> Expérimental — non utilisable pour un scrutin officiel ou une émission réelle. Aucun paiement réel n'est effectué.

La première phrase est le texte minimal exigé par CA13 ; la seconde s'ajoute sur les écrans qui touchent un paiement.

### C-12 — Page publique de vérification d'un timbre

Emplacement : volet timbre de `VerificationPublique`. Fondement : loi 29-2019, art. 7 (minimisation).

> Vérification de l'existence et de la validité d'un timbre émis à titre expérimental. Aucune donnée personnelle n'est affichée.

Seuls le numéro, la date et la validité sont affichés.

### C-13 — Mention de démonstration

Emplacement : écran d'accueil et page de connexion de la base de démonstration (`barreau_pn_demo`), en pied du scénario `docs/demo/SCENARIO-CONGRES.md`. Fondement : loi 29-2019, art. 6-8 ; droit au nom et à l'image d'un barreau réel.

> Données entièrement fictives — toute ressemblance avec une personne réelle serait fortuite. Barreau de démonstration.

Le profil de personnalisation montré au congrès est un « Barreau de démonstration » avec un logo générique. Un barreau réel (Brazzaville ou autre) et son logo ne s'affichent qu'avec l'accord écrit de son bâtonnier.

### C-14 — Contrat futur avec un agrégateur de paiement (après le pilote)

Emplacement : contrat entre l'Ordre et l'agrégateur ; hors logiciel, hors démo. Fondement : Règlement n° 04/18/CEMAC/UMAC/COBAC (texte à vérifier) ; loi 29-2019, art. 63.

> 1. **Agrément** — Le prestataire déclare être agréé comme établissement de crédit, de microfinance ou de paiement par l'autorité monétaire nationale après avis de la COBAC, et annexe la décision d'agrément au contrat. Toute suspension ou tout retrait d'agrément est notifié sans délai à l'Ordre.
> 2. **Fonds** — Les sommes encaissées sont créditées directement sur le compte de l'Ordre [ou du Barreau]. Aucune somme ne transite par Creatic Technologies ni par un compte tiers.
> 3. **Rapprochement** — Le prestataire met à disposition un relevé quotidien des opérations permettant le rapprochement avec les reçus émis par la plateforme.
> 4. **Données** — Le prestataire agit comme sous-traitant au sens de l'article 63 de la loi n° 29-2019 : il ne traite les données que sur instruction de l'Ordre, en assure la sécurité et la confidentialité, et notifie toute violation dans les 24 heures.

---

## Clauses complémentaires (avis juridique du 2026-10-10)

Cinq textes ajoutés après les 14 clauses C-01 à C-14. Ils portent des intitulés nommés (et non C-nn) : `verifier-referentiel.mjs` contrôle leur présence mot pour mot. Les crochets sont à compléter.

### Clause INFORMATION

Emplacement : espace avocat (page d'information) et politique de confidentialité. Fondement : loi 29-2019, droits des personnes (art. 46 et suivants).

> Le Barreau [nom], responsable du traitement, enregistre vos données d'identité, de contact, d'inscription, de cotisation et de situation au tableau pour tenir le tableau et le registre de l'Ordre (loi n° 026-92), gérer les cotisations, les élections et la messagerie professionnelle. Le tableau est public ; les autres données ne sont accessibles qu'aux organes de l'Ordre habilités. Vous pouvez demander l'accès à vos données et leur rectification auprès du secrétariat du Barreau (loi n° 29-2019 du 10 octobre 2019). Les données sont conservées tant que vous êtes membre, puis selon les durées indiquées dans la politique de confidentialité.

### Clause SOUS-TRAITANCE

Emplacement : contrat Creatic Technologies – Barreau, à signer avant toute production. Fondement : loi 29-2019, art. 63 et 74.

> Creatic Technologies traite les données pour le seul compte du Barreau et sur ses seules instructions écrites. Elle n'a pas accès au contenu des messages ni aux pièces, sauf demande écrite du Bâtonnier pour une opération de maintenance déterminée, tracée. Elle assure la sécurité et la confidentialité des données, fait signer à ses intervenants un engagement écrit de confidentialité, notifie au Barreau toute violation de données dans les 24 heures de sa connaissance, n'héberge pas les données hors de [pays] sans accord écrit du Barreau, et restitue puis efface les données en fin de contrat. Elle tient le registre des traitements effectués pour le Barreau.

### Clause DONNÉES DE DÉMONSTRATION

Emplacement : en tête du scénario et à l'écran d'accueil de l'instance de démonstration.

> Instance de démonstration. Toutes les personnes, cabinets, montants et décisions sont fictifs. Toute ressemblance avec une personne réelle est fortuite. Les règles signalées « Provisoire » ne sont pas des règles officielles de l'Ordre.

### Clause IDENTITÉ D'UN BARREAU TIERS

Emplacement : lettre d'accord à faire signer avant la bascule d'identité vers un barreau réel (PO-22).

> Le Barreau de [ville] autorise Creatic Technologies à afficher sa dénomination et son logo dans une démonstration du logiciel lors du congrès de [date], sans engagement de sa part et sans que cette présentation vaille partenariat ou adoption du logiciel.

### Clause TIMBRE ET VOTE

Emplacement : complément oral et écrit du bandeau C-11, dans le scénario.

> Prototype présenté à titre expérimental : aucun timbre émis ni aucun paiement réel ; le vote électronique n'est pas prévu par la loi n° 026-92 et ne peut servir à un scrutin officiel sans délibération de l'Ordre.
