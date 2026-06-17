import PropTypes from "prop-types";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { Sceau } from "./Sceau";
import { QRCode } from "./QRCode";

const fmtDateFr = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

/** Filet doré orné d'un losange central (séparateur institutionnel). */
function FiletOr({ className = "w-64" }) {
  return (
    <div className={`relative mx-auto my-3 h-px bg-or ${className}`}>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] leading-none text-or">◆</span>
    </div>
  );
}

/** Champ rempli avec ligne pointillée (gabarit officiel). */
function Champ({ label, valeur, multiline = false }) {
  return (
    <div className={`flex gap-2 border-b border-dotted border-gris/50 pb-1.5 ${multiline ? "min-h-[2.6rem] items-start" : "items-baseline"}`}>
      <span className="shrink-0 font-semibold text-encre">{label} :</span>
      <span className="flex-1 text-encre">{valeur || "—"}</span>
    </div>
  );
}

/** Cachet circulaire « Le Bâtonnier » (SVG, encre marine). */
function CachetBatonnier({ size = 132 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" role="img" aria-label="Cachet du Bâtonnier" className="opacity-80">
      <defs>
        <path id="cachet-haut" d="M 30,90 A 60,60 0 0 1 150,90" />
        <path id="cachet-bas" d="M 150,92 A 60,60 0 0 1 30,92" />
      </defs>
      <circle cx="90" cy="90" r="80" fill="none" stroke="#1A3A6B" strokeWidth="3" />
      <circle cx="90" cy="90" r="66" fill="none" stroke="#1A3A6B" strokeWidth="1" />
      <text fill="#1A3A6B" fontSize="12" fontWeight="700" letterSpacing="1.5">
        <textPath href="#cachet-haut" startOffset="50%" textAnchor="middle">ORDRE DES AVOCATS</textPath>
      </text>
      <text fill="#1A3A6B" fontSize="10" fontWeight="600" letterSpacing="1">
        <textPath href="#cachet-bas" startOffset="50%" textAnchor="middle">BARREAU DE POINTE-NOIRE</textPath>
      </text>
      <g fill="#1A3A6B">
        <text x="90" y="86" textAnchor="middle" fontSize="17" fontWeight="700" letterSpacing="0.5">LE</text>
        <text x="90" y="104" textAnchor="middle" fontSize="17" fontWeight="700" letterSpacing="0.5">BÂTONNIER</text>
        <polygon points="62,72 66,68 70,72 66,76" />
        <polygon points="110,72 114,68 118,72 114,76" />
      </g>
    </svg>
  );
}

/**
 * Quitus de cotisation — document officiel A4 (certificat de non-redevance).
 * Bordure dorée, coins ornementés, filigrane, en-tête institutionnel, champs
 * renseignés avec les données réelles de l'avocat, encadré de validité,
 * signatures (Trésorier + Bâtonnier) avec cachet, et bandeau de contact.
 * C'est la zone imprimable / exportable (.bpn-print-zone).
 */
export function QuitusDocument({ numero, membre, exercice, date }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const verifUrl = `${origin}/verifier/quitus/${encodeURIComponent(numero)}`;
  const verifHost = origin.replace(/^https?:\/\//, "");
  return (
    <div className="bpn-print-zone relative mx-auto flex w-[820px] min-h-[1160px] flex-col overflow-hidden border-2 border-or bg-white font-serif text-[13px] text-encre">
      {/* Double bordure intérieure */}
      <div className="pointer-events-none absolute inset-[7px] border border-or/60" />

      {/* Coin marine + or (haut-droit) */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-bl-[100%] bg-navy-2">
        <div className="absolute inset-3 rounded-bl-[100%] border-[3px] border-or/70" />
      </div>

      {/* Filigrane (balance) */}
      <div className="pointer-events-none absolute right-6 top-1/4 opacity-[0.05]">
        <Sceau size={360} />
      </div>

      <div className="relative z-10 flex flex-1 flex-col px-12 pb-0 pt-10">
        {/* En-tête : sceau + dénomination */}
        <div className="flex items-center gap-6">
          <Sceau size={104} />
          <div className="flex-1 text-center">
            <h1 className="font-display text-[26px] font-bold leading-tight text-navy">BARREAU DE POINTE-NOIRE</h1>
            <FiletOr className="w-60" />
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-encre">Ordre des Avocats au Barreau de Pointe-Noire</h2>
            <p className="mt-1 text-[12px] italic text-gris">Défendre • Conseiller • Servir la Justice</p>
          </div>
        </div>

        {/* Titre du document */}
        <div className="mt-6 text-center">
          <h3 className="font-display text-[56px] font-bold leading-[1.08] tracking-wide text-navy">QUITUS</h3>
          <FiletOr className="w-44" />
          <h4 className="text-[20px] font-medium uppercase tracking-[0.12em] text-or">Certificat de non-redevance</h4>
        </div>

        {/* N° + lieu/date */}
        <div className="mt-6 flex justify-between text-[14px] font-mono text-navy">
          <span>N° {numero}</span>
          <span>Pointe-Noire, le {fmtDateFr(date)}</span>
        </div>

        {/* Corps */}
        <div className="mt-6">
          <h5 className="text-center text-[16px] font-bold uppercase leading-snug text-encre">
            Le Bâtonnier de l'Ordre des Avocats<br />au Barreau de Pointe-Noire
          </h5>
          <p className="mt-4 text-center text-[15px] italic text-encre">
            Atteste qu'après vérification des écritures de l'Ordre, Maître :
          </p>

          <div className="mt-6 space-y-4">
            <Champ label="Nom et Prénom(s)" valeur={`Me ${membre?.nom ?? ""}`} />
            <Champ label="Inscrit(e) au Barreau sous le n°" valeur={membre?.numInscription ?? (membre?.num != null ? `${membre.num}/BPN` : "")} />
            <Champ label="Date d'inscription" valeur={fmtDateFr(membre?.dateInscription)} />
            <Champ label="Adresse professionnelle" valeur={[membre?.cabinet, membre?.adresse].filter(Boolean).join(" — ")} multiline />
          </div>

          <div className="mt-5 text-center leading-7">
            <p className="text-[17px] font-bold text-encre">est à jour de toutes ses cotisations, contributions et redevances</p>
            <p className="text-[15px] text-encre">envers l'Ordre des Avocats au Barreau de Pointe-Noire, au titre de l'exercice {exercice}.</p>
          </div>

          <p className="mt-5 text-center text-[15px] text-encre">
            En foi de quoi, le présent quitus lui est délivré pour servir et valoir ce que de droit.
          </p>
        </div>

        {/* Encadré de validité */}
        <div className="mx-auto mt-6 flex w-4/5 items-center gap-4 rounded-xl border-2 border-or/70 px-5 py-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy-2 text-or">
            <CalendarDaysIcon className="h-6 w-6" />
          </div>
          <div>
            <h6 className="text-[14px] font-bold uppercase tracking-wide text-navy">Validité du présent quitus</h6>
            <p className="mt-0.5 text-[13px] text-gris">Le présent quitus est valable pour une durée de trois (03) mois à compter de sa date de délivrance.</p>
          </div>
        </div>

        {/* Signatures + cachet */}
        <div className="mt-6 flex items-end justify-between">
          <div className="text-center">
            <p className="text-[13px] font-semibold text-encre">Le Trésorier de l'Ordre</p>
            <div className="mt-9 w-52 border-t border-dotted border-gris" />
            <p className="mt-1 text-[12px] text-gris">Me ONDZE BOYA</p>
          </div>
          <CachetBatonnier />
          <div className="text-center">
            <p className="text-[13px] font-semibold text-encre">Le Bâtonnier</p>
            <div className="mt-9 w-52 border-t border-dotted border-gris" />
            <p className="mt-1 text-[12px] text-gris">Me BIKINDOU Audrey Séverin</p>
          </div>
        </div>

        {/* Vérification d'authenticité (QR) */}
        <div className="mt-5 flex items-center gap-4 border-t border-grisM pt-3">
          <QRCode value={verifUrl} size={78} />
          <div className="text-[11px] leading-relaxed text-gris">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-navy">Vérification d'authenticité</div>
            Scannez ce code, ou rendez-vous sur :<br />
            <span className="font-mono text-navy">{verifHost}/verifier/quitus/{numero}</span>
          </div>
        </div>

        {/* Mention */}
        <p className="mt-5 text-center text-[11px] italic text-gris">
          Ce document est strictement personnel et ne peut être utilisé à d'autres fins que celles pour lesquelles il est délivré.
        </p>
      </div>

      {/* Bandeau de contact (pied) */}
      <div className="grid grid-cols-3 gap-4 bg-navy-2 px-10 py-4 text-[11px] leading-relaxed text-white/90">
        <div>
          <span className="font-semibold text-or">Adresse</span><br />
          Immeuble du Barreau, Avenue Charles de Gaulle<br />Pointe-Noire — République du Congo
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

QuitusDocument.propTypes = {
  numero: PropTypes.string,
  membre: PropTypes.object,
  exercice: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  date: PropTypes.string,
};

export default QuitusDocument;
