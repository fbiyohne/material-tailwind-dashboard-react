import PropTypes from "prop-types";
import { Sceau } from "./Sceau";
import { QRCode } from "./QRCode";
import { identite } from "../data/config";
import { formatFCFA, formatDate } from "../utils/format";

/** Bandeau guilloché (deux ondes entrelacées) — signe « document de sécurité ». */
function Guilloche({ id, flip = false }) {
  return (
    <svg width="100%" height="12" viewBox="0 0 240 12" preserveAspectRatio="none" aria-hidden="true"
      style={flip ? { transform: "scaleY(-1)" } : undefined} className="block">
      <defs>
        <pattern id={`g1-${id}`} width="20" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 6 Q5 0 10 6 T20 6" fill="none" stroke="#C4990A" strokeWidth="0.7" opacity="0.75" />
        </pattern>
        <pattern id={`g2-${id}`} width="20" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 6 Q5 12 10 6 T20 6" fill="none" stroke="#1A3A6B" strokeWidth="0.6" opacity="0.4" />
        </pattern>
      </defs>
      <rect width="240" height="12" fill={`url(#g1-${id})`} />
      <rect width="240" height="12" fill={`url(#g2-${id})`} />
    </svg>
  );
}

/**
 * Timbre / vignette électronique de droit de plaidoirie — document officiel de
 * sécurité (cadre guilloché, filigrane, identifiant scellé, QR de vérification).
 * Largeur fixe, sans mask/filter → capture PNG (téléchargement / presse-papier) fidèle.
 */
export function VignetteTimbre({ timbre, idAttr = "vignette-timbre" }) {
  const { ordre, denomination } = identite();
  const nom = timbre.membre?.nom ?? timbre.membreNom ?? "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const code = timbre.code || "—";
  const verifUrl = `${origin}/verifier/timbre/${encodeURIComponent(code)}`;
  const verifHost = origin.replace(/^https?:\/\//, "");
  const annule = timbre.statut === "ANNULE";
  const uid = String(timbre.numero ?? "x").replace(/\W/g, "");

  const Champ = ({ label, valeur }) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#E4DcC4] py-[5px] last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A6D08]">{label}</span>
      <span className="min-w-0 truncate text-right text-[12.5px] font-medium text-[#1A2A3A]">{valeur || "—"}</span>
    </div>
  );

  return (
    <div id={idAttr} className="w-[360px] select-none bg-[#0E2144] p-[3px] shadow-[0_10px_30px_-12px_rgba(14,33,68,0.5)]">
      {/* Cadre or intérieur */}
      <div className="border border-[#C4990A]/70 bg-[#FBF9F0] p-[3px]">
        <div className="relative overflow-hidden border border-[#1A3A6B]/25 bg-[#FBF9F0]">
          {/* Filigrane emblème */}
          <div className="pointer-events-none absolute inset-x-0 top-[120px] flex justify-center opacity-[0.05]">
            <Sceau size={230} />
          </div>

          <Guilloche id={`t-${uid}`} />

          <div className="relative px-6 pb-5 pt-4 text-center text-[#1A3A6B]">
            {/* En-tête */}
            <div className="text-[9px] font-semibold uppercase tracking-[0.34em] text-[#8A6D08]">Timbre de plaidoirie</div>
            <div className="mt-3 flex justify-center"><Sceau size={58} /></div>
            <h1 className="mt-2 font-display text-[17px] font-bold leading-[1.15]">{ordre}</h1>

            {/* Numéro */}
            <div className="mt-3 flex items-baseline justify-center gap-1.5">
              <span className="font-display text-[15px] font-semibold text-[#8A6D08]">N°</span>
              <span className="font-display text-[34px] font-bold leading-none tracking-tight">{timbre.numero}</span>
            </div>

            {/* Filet or losange */}
            <div className="relative mx-auto my-3 h-px w-40 bg-[#C4990A]">
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] leading-none text-[#C4990A]">◆</span>
            </div>

            {/* Champs */}
            <div className="mx-auto max-w-[280px] text-left">
              <Champ label="Affaire" valeur={timbre.affaire} />
              {timbre.reference && <Champ label="Référence" valeur={timbre.reference} />}
              {timbre.juridiction && <Champ label="Juridiction" valeur={timbre.juridiction} />}
            </div>

            <div className="mt-3 font-display text-[13px] font-bold uppercase tracking-wide">{denomination}</div>
            {timbre.cabinet && <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#4A5568]">Cabinet : {timbre.cabinet}</div>}
            {nom && <div className="mt-0.5 text-[11px] text-[#4A5568]">Me {nom}</div>}

            {/* Identifiant scellé */}
            <div className="mt-3 flex items-center overflow-hidden rounded-[3px] border border-[#0E2144] bg-[#0E2144] text-left">
              <span className="shrink-0 bg-[#C4990A] px-2 py-2 text-[8px] font-bold uppercase leading-tight tracking-wider text-[#0E2144]">Identifiant</span>
              <span className="truncate px-2.5 font-mono text-[12.5px] font-semibold tracking-[0.14em] text-white">{code}</span>
            </div>

            {/* Droit de plaidoirie */}
            <div className="mx-auto mt-3 w-full rounded-[3px] border border-[#C4990A] bg-[#FDF6E3] px-4 py-2">
              <div className="text-[8.5px] font-semibold uppercase tracking-[0.18em] text-[#8A6D08]">Droit de plaidoirie</div>
              <div className="font-display text-[20px] font-bold text-[#1A3A6B]">{formatFCFA(timbre.montant)}</div>
            </div>

            {/* QR + vérification */}
            <div className="mt-3 flex items-center gap-3 rounded-[3px] border border-[#1A3A6B]/20 bg-white p-2.5 text-left">
              <div className="shrink-0 rounded-[2px] border border-[#1A3A6B]/15 bg-white p-1"><QRCode value={verifUrl} size={78} /></div>
              <div className="min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#1A3A6B]">Vérifier l'authenticité</div>
                <div className="mt-0.5 text-[10px] leading-snug text-[#4A5568]">Scannez le code ou rendez-vous sur :</div>
                <div className="mt-0.5 break-all font-mono text-[9.5px] text-[#8A6D08]">{verifHost}/verifier/timbre/{code}</div>
              </div>
            </div>

            {annule && (
              <div className="mt-3 rounded-[3px] border border-rouge bg-rougeL px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rouge">
                Timbre annulé
              </div>
            )}
          </div>

          <Guilloche id={`b-${uid}`} flip />

          {/* Pied */}
          <div className="border-t border-[#1A3A6B]/15 bg-[#F3EEDE] px-6 py-1.5 text-center font-mono text-[8.5px] tracking-wide text-[#8A6D08]">
            Timbre N° {timbre.numero} · émis le {formatDate(timbre.createdAt)} · {denomination}
          </div>
        </div>
      </div>
    </div>
  );
}

VignetteTimbre.propTypes = {
  timbre: PropTypes.object.isRequired,
  idAttr: PropTypes.string,
};

export default VignetteTimbre;
