import { prisma } from "../prisma.js";

/**
 * Source unique de l'identité institutionnelle utilisée par TOUS les documents
 * (PDF officiels et aperçus). Les valeurs proviennent des Paramètres (section
 * `identite`, éditée par le Secrétariat), avec repli sur les valeurs par défaut.
 *
 * L'identité est mise en cache en mémoire et rafraîchie explicitement : au
 * démarrage du serveur puis à chaque enregistrement des Paramètres. La lecture
 * (`identite()`) est synchrone — les templates l'appellent au moment du rendu —
 * et l'objet est remplacé d'un bloc (affectation atomique), sans lecture partielle.
 */
export interface IdentiteDocuments {
  denomination: string;
  ordre: string;
  batonnier: string;
  tresoriere: string;
  secretaireGeneral: string;
  adresse: string;
  /** Logo téléversé (data URI image) ; vide → sceau dessiné par défaut. */
  logo: string;
}

const DEFAUT: IdentiteDocuments = {
  denomination: "Barreau de Pointe-Noire",
  ordre: "Ordre National des Avocats du Congo",
  batonnier: "Me BIKINDOU Audrey Séverin",
  tresoriere: "Me ONDZE BOYA Armelle Laure Carine",
  secretaireGeneral: "Me KALINA-MENGA Lionel",
  adresse: "Maison de l'Avocat — Pointe-Noire, République du Congo",
  logo: "",
};

let courante: IdentiteDocuments = { ...DEFAUT };

/** Identité courante (lecture synchrone au rendu des documents). */
export const identite = (): IdentiteDocuments => courante;

/** Recharge l'identité depuis les Paramètres (au démarrage et après chaque PUT). */
export async function rafraichirIdentite(): Promise<void> {
  try {
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    const id = ((row?.data as { identite?: Partial<IdentiteDocuments> } | null)?.identite) ?? {};
    // Repli champ par champ : une valeur vide en base ne doit pas effacer le défaut.
    courante = {
      denomination: id.denomination?.trim() || DEFAUT.denomination,
      ordre: id.ordre?.trim() || DEFAUT.ordre,
      batonnier: id.batonnier?.trim() || DEFAUT.batonnier,
      tresoriere: id.tresoriere?.trim() || DEFAUT.tresoriere,
      secretaireGeneral: id.secretaireGeneral?.trim() || DEFAUT.secretaireGeneral,
      adresse: id.adresse?.trim() || DEFAUT.adresse,
      logo: typeof id.logo === "string" ? id.logo : "",
    };
  } catch {
    // Base indisponible : on conserve la dernière identité connue (ou le défaut).
  }
}
