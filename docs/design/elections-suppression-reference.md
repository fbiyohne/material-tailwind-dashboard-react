# Référence de design : suppression d'un scrutin (écran Élections)

Relevé du design actuel, sans modification du code. Source unique pour l'implémentation de la suppression d'un scrutin passé (CLOS ou PUBLIE). Fichiers relevés : `src/barreau/pages/Elections.jsx`, `src/barreau/components/ConfirmDialog.jsx`, `src/barreau/components/Toast.jsx`.

## Bouton de suppression existant

- Emplacement : `src/barreau/pages/Elections.jsx:218-221`, dans le pied d'action du panneau de détail (`ScrutinDetail`), après le bouton « Télécharger le PV ».
- Condition actuelle : `s.statut === "PREPARATION"` (ligne 218).
- Classes exactes : `bpn-btn bpn-btn-ghost text-rouge hover:bg-rougeL`.
- Icône : `<TrashIcon className="h-4 w-4" />` (heroicons, importée ligne 2).
- Libellé exact : « Supprimer le scrutin ».
- Handler : `onClick={() => onSupprime(s)}`, où `onSupprime` = `supprimer` (ligne 69).

## Gestion de la suppression (handler)

- `supprimer` (lignes 69-81) : `confirm({ title: "Supprimer le scrutin ?", message, confirmLabel: "Supprimer", danger: true })`, puis `supprimerScrutin(s.id)`, puis `toast.success("Scrutin supprimé.")`, puis `setSelId(null); setDetail(null); charger()`. Erreur : `toast.error(e.message)`.
- Le message actuel (ligne 72) ne mentionne pas les résultats ni le Conseil : à compléter.

## useConfirm

- Fichier : `src/barreau/components/ConfirmDialog.jsx`, export `useConfirm()` (ligne 77).
- Signature : `confirm(options) => Promise<boolean | string>`. Options : `title`, `message`, `confirmLabel`, `danger`, `motif`.
- `motif` : `{ label?, attendu?, min?, max? }`. Avec `attendu`, le bouton reste désactivé tant que la saisie (trim) ne correspond pas exactement (ligne 23). La promesse résout alors le texte saisi.
- Exemple réel avec `motif.attendu` : `src/barreau/pages/AvocatDetail.jsx:150-155` :
  `confirm({ title: "Supprimer la fiche", message: CL_SUPPRESSION, confirmLabel: "Supprimer", danger: true, motif: { label: \`Pour confirmer, saisissez le n° d'inscription ${ref}\`, attendu: ref } })`.
- Rendu du champ : `ConfirmDialog.jsx:62-67`, `<input className="bpn-input mt-1 font-mono" autoComplete="off" spellCheck={false} />` quand `attendu` est présent.
- Usage sans motif (référence simple) : `Elections.jsx:191` pour « Retirer le candidat ? ».

## Toasts

- Hook `useToast()` (importé depuis `../components`, ligne 22 de Elections.jsx).
- Succès : `toast.success("Scrutin supprimé.")`. Erreur : `toast.error(e.message)` (le message serveur est affiché tel quel).

## Badges de statut

- Constante `STATUT` (`Elections.jsx:13-18`) :
  - PREPARATION : « En préparation », ton `gris`
  - OUVERT : « Ouvert », ton `vert`
  - CLOS : « Clôturé », ton `or`
  - PUBLIE : « Publié », ton `bleu`
- Rendu : `<Badge ton={STATUT[s.statut].ton} dot={false}>` (ligne 157).

## Droits d'affichage

- `const peutGerer = ["SECRETAIRE_GENERAL", "ADMIN"].includes(user?.role);` (ligne 25).
- Le bouton de suppression doit suivre la même règle que le serveur (`requireRole` accepte SG et ADMIN).
- Gardes existantes sur le même panneau : `peutGerer && s.statut === "PREPARATION"` (ajout de candidat, ligne 161).

## Confirmation pour un scrutin passé (cible)

- Utiliser `motif.attendu` avec `s.titre` comme valeur attendue, label « Pour confirmer, saisissez l'intitulé du scrutin ».
- Le message doit dire : suppression définitive, efface résultats et émargements, composition du Conseil et PV déjà archivés conservés.
- Garder la confirmation simple pour un scrutin en préparation.

## Points de vérification du design

- États : bouton désactivé tant que l'intitulé ne correspond pas ; pas de double envoi pendant l'appel.
- Accessibilité : le champ de saisie doit porter un libellé (`label` du motif) ; le bouton « Supprimer » reste en `danger`.
- Aucun nouveau composant, aucune nouvelle icône.
