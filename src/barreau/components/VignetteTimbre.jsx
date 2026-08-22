import PropTypes from "prop-types";
import { Sceau } from "./Sceau";
import { QRCode } from "./QRCode";
import { identite } from "../data/config";
import { formatFCFA, formatDate } from "../utils/format";

/**
 * Timbre / vignette électronique de droit de plaidoirie — reproduit le modèle
 * officiel (cadre perforé, emblème, n°, affaire, ID unique, montant, QR de
 * vérification). Rendu à largeur fixe pour un export PNG net (à coller dans un acte).
 */
export function VignetteTimbre({ timbre, idAttr = "vignette-timbre" }) {
  const { ordre, denomination } = identite();
  const nom = timbre.membre?.nom ?? timbre.membreNom ?? "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const verifUrl = `${origin}/verifier/timbre/${encodeURIComponent(timbre.code)}`;

  return (
    <div id={idAttr} className="w-[360px] rounded-[3px] border-2 border-dashed border-navy bg-[#FBF9F0] p-1.5">
      <div className="flex flex-col items-center border-2 border-navy px-5 py-5 text-center text-navy">
        <Sceau size={64} />
        <h1 className="mt-2 font-display text-xl font-bold leading-tight">{ordre}</h1>

        <div className="my-3 font-display text-3xl font-bold">N° {timbre.numero}</div>

        <dl className="w-full space-y-1 text-left text-[13px]">
          <div><dt className="inline font-bold">Affaire :</dt> <dd className="inline">{timbre.affaire}</dd></div>
          {timbre.reference && <div><dt className="inline font-bold">Réf :</dt> <dd className="inline">{timbre.reference}</dd></div>}
          {timbre.juridiction && <div><dt className="inline font-bold">Juridiction :</dt> <dd className="inline">{timbre.juridiction}</dd></div>}
        </dl>

        <div className="mt-3 font-bold uppercase">{denomination}</div>
        {timbre.cabinet && <div className="mt-1 font-bold uppercase">Cabinet : {timbre.cabinet}</div>}

        <div className="mt-3 w-full bg-navy px-3 py-2 text-left font-bold text-white">ID : {timbre.code}</div>

        <div className="mt-3 text-[15px]">DP : {formatFCFA(timbre.montant)}</div>

        <div className="mt-3 rounded border border-navy/30 bg-white p-2">
          <QRCode value={verifUrl} size={120} />
        </div>

        {timbre.statut === "ANNULE" && (
          <div className="mt-3 rounded border border-rouge px-3 py-1 text-xs font-bold uppercase text-rouge">Annulé</div>
        )}

        <div className="mt-4 text-[10px] text-gris">Vignette générée le {formatDate(timbre.createdAt)}</div>
      </div>
    </div>
  );
}

VignetteTimbre.propTypes = {
  timbre: PropTypes.object.isRequired,
  idAttr: PropTypes.string,
};

export default VignetteTimbre;
