# Feuille de route — Évolutions

Application de gestion du Secrétariat Général · Barreau de Pointe-Noire
Document de cadrage · 14 juin 2026 · à valider avant implémentation

Ce document cadre quatre chantiers : (A) refactor des composants, (B) vérification
des pièces d'inscription, (C) notifications (SMS + email), (D) paiements
(Mobile Money, cartes, banques). Aucun code n'est écrit avant validation.

---

## Principes directeurs

1. **Fournisseurs enfichables** — chaque service externe (SMS, email, paiement)
   passe par une interface (`*Provider`) ; les adaptateurs concrets sont
   interchangeables et choisis par configuration.
2. **Simulation par défaut** — sans identifiants, l'app fonctionne en mode
   simulation (comme les relances email et la signature actuelles). On câble le
   réel via variables d'environnement, sans refonte.
3. **Sécurité & conformité d'abord** — aucune donnée de carte stockée (PCI-DSS,
   périmètre SAQ-A) ; protection des données personnelles (PRD NFR-11, CEMAC /
   Congo) ; journal d'audit (RG-16) ; secrets hors du dépôt.
4. **Réutilisation du socle** — un paiement réussi alimente le flux existant
   (reçu + mise à jour cotisation, BR-03) ; les notifications réutilisent les
   modèles de documents existants.

---

## Chantier A — Refactor des composants (cohérence visuelle)

**Objectif** : éliminer la duplication des formulaires/encarts pour garantir un
rendu homogène et accélérer les chantiers suivants.

**Périmètre (nouveaux composants partagés)**
| Composant | Rôle | Remplace |
|---|---|---|
| `FormField` | libellé + requis + indice + erreur + contrôle (clair) | `Champ` (Inscription), `<label>` épars |
| `FormSection` | en-tête de section + grille | sections de l'Inscription |
| `Notice` (`ton`) | encart info/erreur/succès | bandeaux réécrits partout |
| `PageHeader` | eyebrow + titre + sous-titre + actions | en-têtes des ~10 pages |
| `Field` (généralisé) | champ clair **et** sombre via `tone` | `Field` (auth) + `FormField` |

**Migration** : modales à fort trafic d'abord — Inscription, `EditMembreModal`,
`Utilisateurs`, `PaiementModal` — puis le reste au fil de l'eau.
**Back-end** : aucun changement. **Effort** : M (3–4 j). **Risque** : faible.
**DoD** : zéro champ de formulaire « brut » dans les modales clés ; build vert ;
captures avant/après identiques fonctionnellement.

---

## Chantier B — Vérification des pièces (KYC léger, proportionné)

**Position** : pas de KYC financier/AML (porté par le PSP si paiement). On met
en place la **vérification documentaire du dossier d'inscription**, cohérente
avec le rôle institutionnel du Barreau.

**Périmètre**
- Modèle `PieceDossier` : `membreId`, `type` (CNI, PASSEPORT, DIPLOME, SERMENT,
  PHOTO, AUTRE), `fichier`, `statut` (A_VERIFIER / VERIFIEE / REJETEE),
  `verifieePar`, `verifieeAt`, `note`.
- **Checklist de pièces requises** par qualité (avocat / stagiaire).
- Upload de fichiers → décision de stockage (disque local vs stockage objet
  S3-compatible) — **à trancher**.
- UI : section sur `AvocatDetail` + à l'inscription ; statut de complétude.
- Restriction d'accès (données personnelles) + journal (RG-16) + rétention.

**Dépendances** : choix du stockage de fichiers. **Effort** : M (4–5 j).
**DoD** : dossier de pièces consultable/vérifiable, checklist de complétude,
accès cloisonné, traçabilité.

---

## Chantier C — Notifications (SMS + email)

**Objectif** : centraliser l'envoi (email déjà partiellement présent via
nodemailer) derrière un `NotificationProvider` et ajouter le SMS.

**Périmètre**
- Interface `NotificationProvider` : `sendEmail()`, `sendSms()`.
- Adaptateurs : SMTP (existant, généralisé) ; un fournisseur SMS (agnostique).
- **Modèles de messages** : relance cotisation, convocation (réunion / AG /
  discipline), quitus/attestation prêt, accusé + décision de demande d'accès,
  reçu émis.
- Mode simulation par défaut ; activation par env ; journalisation des envois.

**Dépendances/identifiants** : SMTP (hôte/port/user/pass, expéditeur) ; SMS
(clé API + sender ID auprès d'un agrégateur ou opérateur). **Effort** : M (3–4 j).
**DoD** : un même appel déclenche email et/ou SMS selon config ; simulation
sans identifiants ; envois tracés.

---

## Chantier D — Paiements (Mobile Money, cartes, banques)

**Objectif** : encaisser cotisations, droits de plaidoirie et reçus via Mobile
Money (MTN, Airtel), cartes (Visa/MasterCard) et banques (UBA, Ecobank), en
alimentant le flux existant (reçu + cotisation, BR-03).

**Architecture**
- Interface `PaymentProvider` : `initier(paiement)` → URL/één approbation ;
  `verifierWebhook(req)` ; `statut(ref)`.
- Modèle `Paiement` : `ref`, `canal` (MTN / AIRTEL / CARTE / VIREMENT),
  `montant`, `statut` (INITIE / EN_ATTENTE / REUSSI / ECHEC), `membreId`,
  `cotisationId?`, idempotence, horodatages.
- **Webhooks signés** + **idempotence** + réconciliation ; sur succès →
  transaction existante (création reçu `R-AAAA-NNN` + mise à jour cotisation).

**Canaux & approche**
| Canal | Approche | Remarque |
|---|---|---|
| MTN Mobile Money | API Collections (sandbox OAuth + callback) | request-to-pay, approbation sur mobile |
| Airtel Money | API Collections (sandbox OAuth + callback) | idem |
| Visa / MasterCard | **PSP : page hébergée + tokenisation** | **aucune donnée carte dans l'app** (PCI SAQ-A) |
| UBA / Ecobank | passerelle banque ou via agrégateur | selon offre marchande |

**Recommandation** : privilégier **un agrégateur** couvrant à la fois Mobile
Money + cartes (et idéalement banques) pour limiter à une intégration, plutôt que
quatre intégrations directes — **à trancher** selon les comptes marchands
disponibles et les frais.

**Dépendances/identifiants (bloquants pour le live)**
- MTN MoMo : subscription key, API user/key, environnement cible.
- Airtel Money : client_id / client_secret.
- PSP cartes (+ éventuellement MoMo) : clés API + secret de webhook.
- UBA / Ecobank : identifiants marchands + documentation API.

**Conformité** : PCI-DSS (jamais de PAN stocké), 3-D Secure côté PSP, chiffrement
des secrets, journal d'audit, rapprochement comptable pour la Trésorière.
**Effort** : L (8–12 j hors délais d'ouverture des comptes marchands).
**DoD** : un paiement sandbox aboutit, déclenche le reçu + la mise à jour de
cotisation, webhook vérifié, idempotent ; rapport pour la Trésorière.

---

## Identifiants / comptes à fournir (synthèse)

| Service | Identifiants requis | Bloquant pour |
|---|---|---|
| Email (SMTP) | hôte, port, user, mot de passe, expéditeur | C (réel) |
| SMS | clé API, sender ID | C (réel) |
| MTN MoMo | subscription key, API user/key | D (réel) |
| Airtel Money | client_id, client_secret | D (réel) |
| PSP cartes | clés API, secret webhook | D (réel) |
| UBA / Ecobank | identifiants marchands, doc API | D (réel) |
| Stockage fichiers | bucket + clés (si S3) | B (si stockage objet) |

Tant que ces identifiants ne sont pas fournis, les chantiers C et D tournent en
**simulation/sandbox** — développables et testables sans rien bloquer.

---

## Séquencement recommandé

1. **A — Refactor** (fondation, faible risque, règle l'incohérence). 
2. **C — Notifications** (gain rapide : l'email existe déjà ; ajoute le SMS).
3. **B — Vérification des pièces** (valeur institutionnelle ; nécessite le choix
   de stockage).
4. **D — Paiements** (le plus lourd ; dépend de comptes marchands et de
   conformité PCI ; on pose l'ossature + sandbox d'abord, on câble le réel
   ensuite).

## Décisions ouvertes à trancher

- Stockage des fichiers de pièces : disque local vs S3-compatible.
- Paiements : **un agrégateur** unique vs intégrations directes par opérateur.
- Périmètre des notifications SMS (quels événements, à quels rôles/avocats).
- Politique de rétention des pièces (durée, suppression).
