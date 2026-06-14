# Déploiement d'une démo sur Render (gratuit)

Met l'application en ligne sur une **URL publique partageable**, gratuitement, en
quelques minutes. Pensé pour **montrer une démo** (au Conseil de l'Ordre, à la
Trésorière…), **pas pour la production**.

L'architecture est **mono-service** : un seul service web Render sert à la fois
l'API Express et le front React compilé (même origine, pas de CORS), avec une
base **PostgreSQL gérée**. Tout est décrit dans [`render.yaml`](../render.yaml).

---

## Limites du niveau gratuit (à connaître)

| Limite | Conséquence |
|---|---|
| Le service **s'endort** après ~15 min d'inactivité | 1er chargement lent (~30-50 s), puis rapide |
| PostgreSQL gratuit **supprimé après 90 jours** | La démo cesse de fonctionner ; à recréer |
| Le **seed se relance à chaque déploiement** | Les données sont **réinitialisées** (démo, pas de persistance réelle) |
| Pas de Chromium installé | La **génération des PDF** (reçus, attestations…) est indisponible |

➡️ Pour une vraie mise en service (données d'avocats), préférer un **VPS + Docker**.

---

## Mise en ligne (5 étapes)

1. **Pousser la branche** contenant `render.yaml` (déjà fait sur
   `claude/file-context-analysis-ixq8w3`).
2. Créer un compte sur **https://render.com** (connexion via GitHub).
3. **New ▸ Blueprint**, sélectionner ce dépôt et la branche. Render lit
   `render.yaml` et propose de créer **la base + le service web** : *Apply*.
4. Attendre la fin du build (installe les dépendances, compile le front, applique
   les migrations, charge les données de démo). Suivre les logs dans l'onglet
   *Logs*.
5. Ouvrir l'URL fournie (`https://barreau-pn.onrender.com` ou similaire).
   Vérification rapide : `…/api/health` doit répondre `{"ok":true}`.

---

## Connexion à la démo

Mot de passe : **`barreau`**

| Rôle | Email |
|------|-------|
| Secrétaire Général | `sg@barreau-pn.cg` |
| Trésorière | `tresoriere@barreau-pn.cg` |
| Bâtonnier | `batonnier@barreau-pn.cg` |
| Administrateur | `admin@barreau-pn.cg` |

La page publique **« Demander un accès »** est accessible sans connexion.
Email/SMS sont en **simulation**, les paiements en **sandbox**.

---

## Mettre à jour la démo

Pousser un nouveau commit sur la branche déployée : Render redéploie
automatiquement (et **réinitialise les données** via le seed). Pour redéployer à
la main : bouton *Manual Deploy* dans le tableau de bord du service.

---

## Dépannage

- **Build échoue sur `tsx`/`prisma`/`vite` introuvable** → vérifier que le
  `buildCommand` utilise bien `--include=dev` (ces outils sont en
  devDependencies).
- **`api/health` ne répond pas** → consulter les *Logs* ; souvent la base n'est
  pas encore prête au tout premier démarrage (Render relance).
- **Page blanche** → vérifier que `STATIC_DIR=../dist` est défini et que
  `npm run build` a bien produit `dist/` pendant le build.
- **PDF en erreur** → attendu sur le niveau gratuit (pas de Chromium).
