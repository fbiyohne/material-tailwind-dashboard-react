import PropTypes from "prop-types";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { Sceau } from "./Sceau";
import { QRCode } from "./QRCode";
import { identite } from "../data/config";
import cachetBatonnier from "../assets/cachets/batonnier.png";

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
      <div className="pointer-events-none absolute right-6 top-1/4 opacity-[0.05]" aria-hidden="true">
        <Sceau size={360} />
      </div>

      <div className="relative z-10 flex flex-1 flex-col px-12 pb-0 pt-10">
        {/* En-tête : sceau + dénomination */}
        <div className="flex items-center gap-6">
          <Sceau size={104} />
          <div className="flex-1 text-center">
            <h1 className="font-display text-[26px] font-bold leading-tight text-navy">{identite().denomination.toUpperCase()}</h1>
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
            <p className="mt-1 text-[12px] text-gris">{identite().tresoriere}</p>
          </div>
          <img src={cachetBatonnier} alt="Cachet officiel du Bâtonnier" className="h-32 w-32 object-contain" />
          <div className="text-center">
            <p className="text-[13px] font-semibold text-encre">Le Bâtonnier</p>
            <div className="mt-9 w-52 border-t border-dotted border-gris" />
            <p className="mt-1 text-[12px] text-gris">{identite().batonnier}</p>
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

QuitusDocument.propTypes = {
  numero: PropTypes.string,
  membre: PropTypes.object,
  exercice: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  date: PropTypes.string,
};

export default QuitusDocument;
