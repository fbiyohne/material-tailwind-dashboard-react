/**
 * Configuration applicative centralisée (tarifs de référence, exercice courant,
 * identité de l'institution). Les dérivations lisent cet objet « vivant » ;
 * le store le tient à jour via la page Paramètres (FR — maintenance NFR-10).
 * En V2, persistée en base et éditable selon le rôle.
 */
export const PARAMETRES_DEFAUT = {
  tarifs: {
    avocat: 150_000, // cotisation ordinale avocat (BR-07)
    stagiaire: 75_000, // cotisation ordinale stagiaire (BR-07)
    honoraire: 0, // exonéré (BR-08)
    droitsPlaidoirie: 60_000, // droit de plaidoirie annuel
  },
  exerciceCourant: 2026,
  identite: {
    denomination: "Barreau de Pointe-Noire",
    ordre: "Ordre National des Avocats du Congo",
    batonnier: "Me BIKINDOU Audrey Séverin",
    tresoriere: "Me ONDZE BOYA Armelle Laure Carine",
    secretaireGeneral: "Me KALINA-MENGA Lionel",
    adresse: "Maison de l'Avocat — Pointe-Noire, République du Congo",
  },
};

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Objet de configuration « vivant » lu par les dérivations. */
export const config = clone(PARAMETRES_DEFAUT);

/** Applique un patch partiel à la configuration vivante. */
export function appliquerConfig(patch) {
  if (patch.tarifs) config.tarifs = { ...config.tarifs, ...patch.tarifs };
  if (patch.exerciceCourant != null) config.exerciceCourant = patch.exerciceCourant;
  if (patch.identite) config.identite = { ...config.identite, ...patch.identite };
}
