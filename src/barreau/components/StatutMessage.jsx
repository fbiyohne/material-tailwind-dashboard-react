import PropTypes from "prop-types";
import { CheckIcon } from "@heroicons/react/24/outline";
import { formatDateTime } from "../utils/format";

/** Statut le plus avancé d'un message : « lu » > « recu » > « envoye ». */
export function statutMessage({ recuLe, luLe }) {
  if (luLe) return "lu";
  if (recuLe) return "recu";
  return "envoye";
}

// `inverse` : sur une bulle marine (messages de l'utilisateur), contrastes AA conservés.
const META = {
  envoye: { label: "Envoyé", coches: 1, couleur: "text-encre/70", inverse: "text-white/80" },
  recu: { label: "Reçu", coches: 2, couleur: "text-encre/70", inverse: "text-white/80" },
  lu: { label: "Lu", coches: 2, couleur: "text-navy", inverse: "text-or-2" },
};

/**
 * Statut d'un message envoyé (envoyé / reçu / lu). Le libellé est toujours écrit :
 * les coches (une, deux, deux marine) ne font que le doubler. Le détail horodaté
 * est en infobulle et lu par les lecteurs d'écran. Simple constat technique des
 * dates enregistrées par la plateforme — aucune portée de preuve n'est affichée.
 */
export function StatutMessage({ envoyeLe, recuLe, luLe, inverse = false, className = "" }) {
  const statut = statutMessage({ recuLe, luLe });
  const m = META[statut];
  const detail = [
    `Envoyé le ${formatDateTime(envoyeLe)}`,
    recuLe && `reçu le ${formatDateTime(recuLe)}`,
    luLe && `lu le ${formatDateTime(luLe)}`,
  ].filter(Boolean).join(" · ");
  return (
    <span title={detail} className={`inline-flex items-center gap-1 text-2xs font-medium ${inverse ? m.inverse : m.couleur} ${className}`}>
      <span aria-hidden="true" className="inline-flex">
        <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
        {m.coches === 2 && <CheckIcon className="-ml-2 h-3.5 w-3.5" strokeWidth={2.5} />}
      </span>
      <span aria-hidden="true">{m.label}</span>
      <span className="sr-only">{detail}</span>
    </span>
  );
}

StatutMessage.propTypes = {
  envoyeLe: PropTypes.string.isRequired,
  recuLe: PropTypes.string,
  luLe: PropTypes.string,
  inverse: PropTypes.bool,
  className: PropTypes.string,
};

export default StatutMessage;
