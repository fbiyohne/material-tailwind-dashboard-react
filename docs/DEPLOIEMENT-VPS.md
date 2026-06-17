# Déploiement sur un VPS (production)

Installation **sans coder**, en deux temps : provisionnement par script, puis
assistant web de configuration.

## 1. Provisionnement (une commande)

Sur un VPS **Ubuntu/Debian** frais, en `root` (ou sudo), dans le dépôt cloné :

```bash
git clone <URL-du-depot> barreau && cd barreau
bash install.sh
```

Le script : installe Docker si absent, demande le **domaine** (pour le HTTPS
automatique), génère les secrets (`.env`), construit et lance les conteneurs
(**app + PostgreSQL + Chromium + Caddy**). La base démarre **vide**.

> Pré-requis HTTPS : le domaine doit pointer (DNS A/AAAA) vers l'IP du VPS ;
> Caddy obtient alors un certificat Let's Encrypt automatiquement.

## 2. Assistant web (premier lancement)

Ouvrez l'URL affichée par le script. L'**assistant d'installation** apparaît
(il n'existe que sur le VPS, grâce à `INSTALL_WIZARD=1`) et vous guide :

1. Compte **administrateur** (email + mot de passe ≥ 8 caractères)
2. **Identité** de l'Ordre (dénomination, Bâtonnier, Trésorière, SG, adresse)
3. **Tarifs & exercice**
4. **Email (Gmail, optionnel)** : `smtp.gmail.com` port `587`, utilisateur =
   votre adresse Gmail, mot de passe = **mot de passe d'application** Google
   (activez la 2FA puis créez-en un) ; bouton « Tester ».
5. Récapitulatif → **Installer**.

À la fin, connectez-vous avec le compte administrateur. La base est **vide** :
importez vos avocats via **Avocats → Importer** (.xlsx/.csv), puis créez les
comptes Secrétaire Général / Bâtonnier / Trésorière dans **Utilisateurs**.

## Données & sauvegardes

Les données PostgreSQL persistent dans le volume Docker `db-data`. Sauvegarde
recommandée :
```bash
docker compose exec db pg_dump -U barreau barreau_pn > sauvegarde-$(date +%F).sql
```

## Mise à jour

```bash
git pull && docker compose up -d --build
```
Les migrations s'appliquent au démarrage. L'assistant ne réapparaît pas (un
admin existe déjà).
