import PropTypes from "prop-types";
import { formatDateTime } from "../utils/format";

/**
 * Bulle de message de messagerie interne, partagée par l'espace avocat et le
 * back-office. Alignée à droite (marine) si émise par l'utilisateur courant,
 * à gauche (gris) sinon. `etiquette` nomme l'auteur quand il y a lieu.
 */
export function MessageBulle({ aDroite, etiquette, corps, date }) {
  return (
    <div className={`flex ${aDroite ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${aDroite ? "bg-navy text-white" : "bg-grisL text-encre"}`}>
        {etiquette && <div className={`mb-0.5 text-[11px] font-semibold ${aDroite ? "text-or-2" : "text-or"}`}>{etiquette}</div>}
        <div className="whitespace-pre-line leading-relaxed">{corps}</div>
        <div className={`mt-1 text-[10px] ${aDroite ? "text-white/60" : "text-gris"}`}>{formatDateTime(date)}</div>
      </div>
    </div>
  );
}

MessageBulle.propTypes = {
  aDroite: PropTypes.bool,
  etiquette: PropTypes.string,
  corps: PropTypes.string,
  date: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
};

export default MessageBulle;
