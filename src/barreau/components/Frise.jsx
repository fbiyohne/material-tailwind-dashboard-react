import PropTypes from "prop-types";
import { CheckIcon } from "@heroicons/react/24/outline";
import { formatDate, formatDateTime } from "../utils/format";

// L'état de l'étape est porté par le texte (lecteur d'écran) ET par la forme du
// repère (coche pleine, anneau or, cercle vide) — jamais par la seule couleur.
const ETATS = {
  fait: {
    sr: "Étape franchie :",
    repere: "border-navy bg-navy text-white",
    titre: "text-encre",
  },
  courant: {
    sr: "Étape en cours :",
    repere: "border-or-fonce bg-or-L ring-4 ring-or/20",
    titre: "text-encre",
  },
  a_venir: {
    sr: "Étape à venir :",
    repere: "border-gris border-dashed bg-white",
    titre: "text-encre/70",
  },
};

/**
 * Frise chronologique verticale et datée. Sert l'historique de situation d'un
 * membre, le circuit des impayés (rappel → mise en demeure → transmission →
 * omission) et le circuit disciplinaire (saisine → … → décision).
 * Toujours verticale : lisible à 360 px sans défilement horizontal.
 * `etapes` : [{ id?, libelle, date?, detail?, etat? = "fait" }] dans l'ordre affiché.
 */
export function Frise({ titre, etapes, avecHeure = false, vide = "Aucune étape enregistrée.", className = "" }) {
  if (!etapes?.length) return <p className={`text-sm text-encre/70 ${className}`}>{vide}</p>;
  const formater = avecHeure ? formatDateTime : formatDate;
  return (
    <ol aria-label={titre} className={`relative ${className}`}>
      {etapes.map((e, i) => {
        const etat = ETATS[e.etat] ?? ETATS.fait;
        const dernier = i === etapes.length - 1;
        return (
          <li key={e.id ?? i} className="relative grid grid-cols-[1.5rem_1fr] gap-x-3 pb-5 last:pb-0">
            {!dernier && <span aria-hidden="true" className="absolute bottom-0 left-[0.6875rem] top-6 w-px bg-grisM" />}
            <span
              aria-hidden="true"
              className={`relative z-[1] mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 ${etat.repere}`}
            >
              {(e.etat ?? "fait") === "fait" && <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />}
              {e.etat === "courant" && <span className="h-2 w-2 rounded-full bg-or-fonce" />}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-medium ${etat.titre}`}>
                <span className="sr-only">{etat.sr} </span>
                {e.libelle}
              </p>
              <p className="text-xs tabular-nums text-encre/70">
                {e.date ? <time dateTime={e.date}>{formater(e.date)}</time> : "Non daté"}
              </p>
              {e.detail && <p className="mt-1 break-words text-xs text-encre">{e.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

Frise.propTypes = {
  titre: PropTypes.string.isRequired,
  etapes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      libelle: PropTypes.node.isRequired,
      date: PropTypes.string,
      detail: PropTypes.node,
      etat: PropTypes.oneOf(["fait", "courant", "a_venir"]),
    }),
  ),
  avecHeure: PropTypes.bool,
  vide: PropTypes.string,
  className: PropTypes.string,
};

export default Frise;
