# Accès de l'ADMIN au contenu (messagerie, pièces)

Mission M-20261016-admin-droit-a-tout · Juriste-conseil Team Creatic, 2026-10-16. Projet à valider par le Barreau ; rien n'est signé ni déclaré.

## 1. Décision et avis

- Décision de Fabrice (16/10/2026) : l'ADMIN a droit à tout, contenu de la messagerie et des pièces compris.
- Avis : **faisable sous conditions**. Le blocage n'est pas légal en soi : il dépend de l'autorisation du responsable du traitement (le Barreau). Sans écrit du Barreau, l'accès au contenu est une décision du prestataire seul, sans base (loi 29-2019, art. 63 : le sous-traitant n'agit que sur instruction du responsable). Avis d'expérience pour l'application à ce cas.
- Instance de test et données fictives : aucun obstacle.
- **Production : aucune donnée réelle d'avocat ne passe par la messagerie ou les pièces avant signature de C1 et C3.** Tant que ces écrits manquent, le compte ADMIN qui accède au contenu est confié à une personne désignée par le Barreau ; Creatic ne l'utilise que sur demande tracée.

## 2. Conditions

| N° | Condition |
|---|---|
| C1 | Décision prise par le responsable du traitement, par écrit (délibération ou lettre du Bâtonnier, ou avenant au contrat de sous-traitance). |
| C2 | Finalité limitée et écrite : administration, support, maintenance, sécurité. Jamais d'exploitation du contenu. |
| C3 | Engagement individuel de confidentialité de chaque titulaire d'un compte ADMIN, visant le secret professionnel de l'avocat. |
| C4 | Chaque lecture ADMIN (liste, fil, pièce jointe, fichier de pièce) écrit une ligne dans JournalAudit (acteur, action, ressource, #id, horodatage), sans le contenu. Le journal reste non modifiable et non supprimable, y compris par l'ADMIN (aucune route de purge ; la réinitialisation des données conserve le journal). |
| C5 | Le Bâtonnier, ou la personne qu'il désigne, peut consulter le journal des accès de l'ADMIN (contrôle par une personne qui n'est pas contrôlée). |
| C6 | Information des personnes concernées : la politique de confidentialité mentionne l'accès de l'administrateur, sa finalité et la traçabilité. |
| C7 | Compte ADMIN nominatif, mot de passe fort, double authentification dès que possible. Pas de compte partagé ni générique. |

Garde-fous conservés dans le code, sans retirer de droit à l'ADMIN : journal non effaçable ; alerte de privilège (notifie sans bloquer lors d'une reprise, promotion ou création de compte habilité) ; refus 409 de réémettre un lien d'activation pour un compte déjà activé (tous opérateurs).

## 3. Textes

| Texte | Statut |
|---|---|
| Loi n° 026-92 du 20 août 1992, organisation de la profession d'avocat, art. 52 (secret professionnel) | Vérifié : recopie liziba.cg relue le 2026-10-10 (`regles-reference.md`) ; recopie non officielle, à recouper avec le JO 1992. Non relue dans cette mission. Ne fonde pas l'autorisation : elle ne l'autorise pas. |
| Loi n° 29-2019 du 10 octobre 2019, art. 63 (sous-traitant : instruction, contrat écrit, sécurité, confidentialité) | Vérifié par le registre (mission M-20261010) ; non relu en ligne ici. |
| Loi n° 29-2019, art. 67 à 69 (registre), art. 33 (déclaration préalable) | Vérifié par le registre ; non relu en ligne ici. |
| Loi n° 29-2019, articles sur l'information des personnes et la sécurité | **À vérifier** (numéros non relus) : JO de la République du Congo (sgg.cg) ou cabinet local. |
| Code pénal, art. 378 (violation du secret par dépositaire par état ou profession) | **À vérifier** : avis d'expérience, numérotation héritée du Code pénal de 1810. JO, Cour suprême, cabinet local. |
| Loi n° 26-2020 du 5 juin 2020 (cybersécurité) et loi n° 27-2020 du 5 juin 2020 (cybercriminalité) | **À vérifier** : références à confirmer, JO 2020 ou ANSSI Congo. |
| Directive CEMAC n° 07/08-UEAC-133-CM-18 du 19 décembre 2008 (droits des utilisateurs de communications électroniques) | **À vérifier** sur cemac.int ; subsidiaire, la loi 29-2019 étant le texte national applicable. |

## 4. Risques

- Violation du secret professionnel (élevé) : sans instruction écrite, responsabilité de Creatic, résiliation possible, plainte d'un avocat. Parade : C1 et C3 avant toute donnée réelle.
- Accès du sous-traitant hors instruction (élevé) : sanction possible de la Commission. Parade : instruction écrite, registre aligné, déclaration art. 33 citant l'administrateur technique comme destinataire.
- Usurpation d'identité par reprise de compte (moyen) : actes contestables. Parade : alerte, 409, journal.
- Perte de valeur probante du journal (moyen) : si une route de purge existait. Parade : n'en créer aucune ; toute capacité de purge relève d'une décision du Barreau, consignée.
- Refus du Barreau (faible) : repli par configuration, un compte ADMIN technique sans contenu et un compte ADMIN métier détenu par le Barreau.

## 5. Projets de clauses (à faire relire par un cabinet local)

### 5.1 Avenant au contrat de sous-traitance Barreau – Creatic

> **Article [n] – Accès de l'administrateur au contenu.** Le Barreau, responsable du traitement, autorise les titulaires d'un compte Administrateur à accéder au contenu de la messagerie interne et aux fichiers des pièces, aux seules fins d'administration, de support, de maintenance et de sécurité de l'application. Tout autre usage est interdit. Chaque accès est enregistré dans un journal horodaté, non modifiable, consultable à tout moment par le Bâtonnier ou par la personne qu'il désigne. Creatic Technologies s'interdit de copier, de conserver hors de l'application ou de communiquer à quiconque tout contenu ainsi consulté. [Référence et date de signature : à renseigner.]

### 5.2 Engagement individuel de confidentialité (par titulaire d'un compte ADMIN)

> Je reconnais que les contenus auxquels mon compte Administrateur donne accès peuvent être couverts par le secret professionnel de l'avocat (loi n° 026-92 du 20 août 1992, art. 52). Je m'engage à ne les consulter que pour les besoins techniques de l'application, à n'en révéler aucun élément et à ne pas en faire de copie. Cet engagement survit à la fin de ma mission. Je sais que chacun de mes accès est journalisé.
> Nom : [ ] · Fonction : [ ] · Date : [ ] · Signature : [ ]

### 5.3 Politique de confidentialité, rubrique « Destinataires »

> L'administrateur de l'application, désigné par le Barreau, peut accéder au contenu des messages et des pièces pour assurer le fonctionnement, le support et la sécurité du service. Ces accès sont limités à cette finalité, enregistrés dans un journal et contrôlables par le Bâtonnier.

Mention affichée sur les écrans Messagerie et Pièces : « Les accès de l'administrateur à ce contenu sont journalisés. »

## 6. Démarches (aucune faite)

Faire signer l'avenant et les engagements ; mettre à jour la déclaration à la Commission (art. 33) pour T-6 et T-10 ; renseigner dans le registre les références de l'avenant ; vérifier les textes marqués « à vérifier ».
