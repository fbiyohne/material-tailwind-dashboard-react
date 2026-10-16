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
  /** Ville du barreau (reçus, quitus, en-têtes) : remplace toute ville écrite en dur. */
  ville: string;
  /** Coordonnées du bandeau des reçus et quitus ; vides → bloc non affiché. */
  courriel: string;
  site: string;
  /** Téléphones séparés par « / » (un par ligne sur le document). */
  telephones: string;
  /** Logo téléversé (data URI image) ; vide → sceau dessiné par défaut. */
  logo: string;
  /** Instance de démonstration : les documents portent la mention C-13. */
  modeDemonstration: boolean;
}

/** Clause C-13 (docs/juridique/clauses-congres.md), reproduite mot pour mot. */
export const MENTION_DEMONSTRATION =
  "Données entièrement fictives — toute ressemblance avec une personne réelle serait fortuite. Barreau de démonstration.";

const DEFAUT: IdentiteDocuments = {
  denomination: "Barreau de Pointe-Noire",
  ordre: "Ordre National des Avocats du Congo",
  batonnier: "Me BIKINDOU Audrey Séverin",
  tresoriere: "Me ONDZE BOYA Armelle Laure Carine",
  secretaireGeneral: "Me KALINA-MENGA Lionel",
  adresse: "245, boulevard Charles de Gaulle — Tour Mayombe, entrée Mezzanine, Pointe-Noire",
  ville: "Pointe-Noire",
  courriel: "contact@barreaudepointenoire.cg",
  site: "barreaudepointenoire.cg",
  telephones: "+242 06 857 74 74",
  logo: "",
  modeDemonstration: false,
};

/** Data URI image en base64 (seuls caractères admis : aucun guillemet ni chevron). */
const LOGO_SUR = /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]*$/i;

let courante: IdentiteDocuments = { ...DEFAUT };

/** Identité courante (lecture synchrone au rendu des documents). */
export const identite = (): IdentiteDocuments => courante;

let derniereLecture = 0;
/** Durée max. de validité du cache : une modification faite par un autre processus (script de démo, tests) est reprise au plus tard après ce délai. */
export const TTL_IDENTITE_MS = 1000;

/** Relit la base si le cache est périmé (middleware /api) : écran et PDF partagent la même identité. */
export async function rafraichirSiPerimee(): Promise<void> {
  if (Date.now() - derniereLecture >= TTL_IDENTITE_MS) await rafraichirIdentite();
}

/** Recharge l'identité depuis les Paramètres (au démarrage et après chaque PUT). */
export async function rafraichirIdentite(): Promise<void> {
  derniereLecture = Date.now();
  try {
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    const id = ((row?.data as { identite?: Partial<IdentiteDocuments> } | null)?.identite) ?? {};
    // Repli champ par champ : une valeur vide en base ne doit pas effacer le défaut.
    const ville = id.ville?.trim() || DEFAUT.ville;
    // Adresse et coordonnées par défaut appartiennent au barreau de base : un barreau
    // d'une autre ville qui ne les a pas saisies n'hérite pas de celles du barreau de base.
    const base = ville === DEFAUT.ville;
    const local = (v: string | undefined, d: string, autre = "") => v?.trim() || (base ? d : autre);
    courante = {
      denomination: id.denomination?.trim() || DEFAUT.denomination,
      ordre: id.ordre?.trim() || DEFAUT.ordre,
      batonnier: id.batonnier?.trim() || DEFAUT.batonnier,
      tresoriere: id.tresoriere?.trim() || DEFAUT.tresoriere,
      secretaireGeneral: id.secretaireGeneral?.trim() || DEFAUT.secretaireGeneral,
      adresse: local(id.adresse, DEFAUT.adresse, ville),
      ville,
      courriel: local(id.courriel, DEFAUT.courriel),
      site: local(id.site, DEFAUT.site),
      telephones: local(id.telephones, DEFAUT.telephones),
      // Base64 stricte : le logo est inséré dans <img src="…"> des PDF ; un guillemet sortirait de l'attribut (T30).
      logo: typeof id.logo === "string" && LOGO_SUR.test(id.logo) ? id.logo : "",
      modeDemonstration: id.modeDemonstration === true,
    };
  } catch {
    // Base indisponible : on conserve la dernière identité connue (ou le défaut).
  }
}
