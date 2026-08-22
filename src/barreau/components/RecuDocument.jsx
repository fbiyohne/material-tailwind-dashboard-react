import PropTypes from "prop-types";
import { Sceau } from "./Sceau";
import { QRCode } from "./QRCode";
import { formatFCFA } from "../utils/format";
import { montantEnLettresFCFA } from "../utils/nombreEnLettres";
import { identite } from "../data/config";
import cachetTresoriere from "../assets/cachets/tresoriere.png";

const fmtDateFr = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

function FiletOr({ className = "w-64" }) {
  return (
    <div className={`relative mx-auto my-3 h-px bg-or ${className}`}>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] leading-none text-or">◆</span>
    </div>
  );
}

function Champ({ label, valeur, multiline = false }) {
  return (
    <div className={`flex gap-2 border-b border-dotted border-gris/50 pb-1.5 ${multiline ? "min-h-[2.6rem] items-start" : "items-baseline"}`}>
      <span className="shrink-0 font-semibold text-encre">{label} :</span>
      <span className="flex-1 text-encre">{valeur || "—"}</span>
    </div>
  );
}

/**
 * Reçu de paiement — document officiel A4. Même habillage institutionnel que le
 * quitus (bordure dorée, coin ornementé, filigrane, en-tête, encadré du montant,
 * cachet de la Trésorerie, QR de vérification et bandeau de contact).
 * Zone imprimable / exportable (.bpn-print-zone).
 */
export function RecuDocument({ numero, membre, montant, exercice, mode, objet, date }) {
  const m = Number(montant) || 0;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const hasNum = numero && numero !== "automatique";
  const verifUrl = `${origin}/verifier/recu/${encodeURIComponent(numero)}`;
  const verifHost = origin.replace(/^https?:\/\//, "");

  return (
    <div className="bpn-print-zone relative mx-auto flex w-[820px] min-h-[1160px] flex-col overflow-hidden border-2 border-or bg-white font-serif text-[13px] text-encre">
      <div className="pointer-events-none absolute inset-[7px] border border-or/60" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-bl-[100%] bg-navy-2">
        <div className="absolute inset-3 rounded-bl-[100%] border-[3px] border-or/70" />
      </div>
      <div className="pointer-events-none absolute right-6 top-1/4 opacity-[0.05]" aria-hidden="true">
        <Sceau size={360} />
      </div>

      <div className="relative z-10 flex flex-1 flex-col px-12 pb-0 pt-10">
        {/* En-tête */}
        <div className="flex items-center gap-6">
          <Sceau size={104} />
          <div className="flex-1 text-center">
            <h1 className="font-display text-[26px] font-bold leading-tight text-navy">{identite().denomination.toUpperCase()}</h1>
            <FiletOr className="w-60" />
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-encre">Trésorerie de l'Ordre des Avocats</h2>
            <p className="mt-1 text-[12px] italic text-gris">Défendre • Conseiller • Servir la Justice</p>
          </div>
        </div>

        {/* Titre */}
        <div className="mt-8 text-center">
          <h3 className="font-display text-[56px] font-bold leading-[1.08] tracking-wide text-navy">REÇU</h3>
          <FiletOr className="w-44" />
          <h4 className="text-[20px] font-medium uppercase tracking-[0.12em] text-or">Reçu de paiement</h4>
        </div>

        {/* N° + date */}
        <div className="mt-8 flex justify-between font-mono text-[14px] text-navy">
          <span>N° {numero}</span>
          <span>Pointe-Noire, le {fmtDateFr(date)}</span>
        </div>

        {/* Corps */}
        <div className="mt-9">
          <h5 className="text-center text-[16px] font-bold uppercase leading-snug text-encre">
            La Trésorière de l'Ordre des Avocats<br />au Barreau de Pointe-Noire
          </h5>
          <p className="mt-4 text-center text-[15px] italic text-encre">Reconnaît avoir reçu de Maître :</p>

          <div className="mt-6 space-y-4">
            <Champ label="Nom et Prénom(s)" valeur={`Me ${membre?.nom ?? ""}`} />
            <Champ label="Au titre de" valeur={objet || `Cotisation ordinale ${exercice}`} />
            <Champ label="Mode de paiement" valeur={mode} />
          </div>

          {/* Montant mis en valeur */}
          <div className="mx-auto mt-7 w-4/5 rounded-lg border-2 border-or/70 bg-or-L/40 px-6 py-4 text-center">
            <div className="text-[11px] uppercase tracking-wide text-gris">Montant perçu</div>
            <div className="font-display text-[34px] font-bold leading-tight text-navy">{formatFCFA(m)}</div>
            <div className="mt-0.5 text-[13px] italic text-gris first-letter:uppercase">{montantEnLettresFCFA(m)}</div>
          </div>

          <p className="mt-6 text-center text-[15px] text-encre">
            En foi de quoi, le présent reçu lui est délivré pour servir et valoir ce que de droit.
          </p>
        </div>

        {/* Signature + cachet */}
        <div className="mt-10 flex items-end justify-between">
          {hasNum ? (
            <div className="flex items-center gap-4">
              <QRCode value={verifUrl} size={78} />
              <div className="text-[11px] leading-relaxed text-gris">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-navy">Vérification</div>
                Scannez ce code, ou :<br />
                <span className="font-mono text-navy">{verifHost}/verifier/recu/{numero}</span>
              </div>
            </div>
          ) : (
            <div className="w-44" />
          )}
          <img src={cachetTresoriere} alt="Cachet officiel de la Trésorerie" className="h-32 w-32 object-contain" />
          <div className="text-center">
            <p className="text-[13px] font-semibold text-encre">La Trésorière de l'Ordre</p>
            <div className="mt-12 w-52 border-t border-dotted border-gris" />
            <p className="mt-1 text-[12px] text-gris">{identite().tresoriere}</p>
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] italic text-gris">
          Ce reçu est strictement personnel et atteste du paiement mentionné ci-dessus.
        </p>
      </div>

      {/* Bandeau de contact */}
      <div className="mt-7 grid grid-cols-3 gap-4 bg-navy-2 px-10 py-5 text-[11px] leading-relaxed text-white/90">
        <div>
          <span className="font-semibold text-or">Adresse</span><br />
          {identite().adresse}
        </div>
        <div className="text-center">
          <span className="font-semibold text-or">En ligne</span><br />
          contact@barreau-pointe-noire.cg<br />www.barreau-pointe-noire.cg
        </div>
        <div className="text-right">
          <span className="font-semibold text-or">Téléphone</span><br />
          +242 05 000 00 00<br />+242 06 000 00 00
        </div>
      </div>
    </div>
  );
}

RecuDocument.propTypes = {
  numero: PropTypes.string,
  membre: PropTypes.object,
  montant: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  exercice: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  mode: PropTypes.string,
  objet: PropTypes.string,
  date: PropTypes.string,
};

export default RecuDocument;
