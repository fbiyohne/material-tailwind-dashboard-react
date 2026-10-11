# Hooks Git du dépôt

Garde-fou local contre un push vers la branche de production
`claude/file-context-analysis-ixq8w3` (autodéploiement Render).

## Activation (une fois par clone)

```sh
git config core.hooksPath scripts/git-hooks
```

`core.hooksPath` n'est pas versionné : un clone neuf n'est protégé qu'après
cette commande.

## Contenu

- `pre-push` : refuse tout push (mise à jour ou suppression) vers
  `refs/heads/claude/file-context-analysis-ixq8w3`.
- `pre-push.test.sh` : test du hook, `sh scripts/git-hooks/pre-push.test.sh`.

## Limites

- Protection de ce poste seulement ; contournable par `git push --no-verify`.
- Ne couvre pas les autres branches.
- Seule une protection de branche GitHub (revue obligatoire, push direct et
  push forcé interdits) empêche réellement un push : à poser par Fabrice.
