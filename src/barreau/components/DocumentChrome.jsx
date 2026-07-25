import PropTypes from "prop-types";
import { Sceau } from "./Sceau";
import { identite } from "../data/config";

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

/**
 * Gabarit unifié des documents officiels (reçu, quitus, attestation,
 * convocation, PV…). En-tête institutionnel + filet or, corps libre, bloc
 * date + signatures + sceau officiel, et mention de pied de page. C'est la
 * zone imprimable / exportable (.bpn-print-zone).
 */
export function DocumentChrome({
  org = "Conseil de l'Ordre",
  title,
  reference,
  date = new Date().toISOString().slice(0, 10),
  signataires = [],
  children,
}) {
  return (
    <div className="bpn-print-zone overflow-hidden rounded border border-grisM bg-white">
      <div className="bg-navy px-5 py-3">
        <div className="text-2xs font-semibold uppercase tracking-[0.15em] text-or">
          {identite().denomination}
        </div>
        <div className="text-2xs text-white/60">
          {identite().ordre} · {org}
        </div>
      </div>
      <div className="h-[3px] bg-gradient-to-r from-or via-or-2 to-or" />

      <div className="px-8 py-6">
        {title && <div className="text-center font-display text-2xl text-navy">{title}</div>}
        {reference && <div className="mb-5 mt-1 text-center font-mono text-xs text-or">{reference}</div>}

        <div className={title ? "mt-2" : ""}>{children}</div>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div className="flex items-end gap-3">
            <Sceau size={80} />
            <div className="pb-1 text-xs leading-snug text-gris">
              Fait à Pointe-Noire,
              <br />
              le {fmtDate(date)}
            </div>
          </div>
          <div className="flex gap-8">
            {signataires.map((s) => (
              <div key={s.role} className="text-right">
                <div className="mb-6 text-2xs uppercase tracking-wide text-gris">{s.role}</div>
                <div className="border-t border-grisM pt-1 text-xs font-medium text-navy">{s.nom}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-grisM px-8 py-2 text-center text-2xs uppercase tracking-[0.18em] text-gris">
        Document officiel · {identite().ordre} · {identite().denomination}
      </div>
    </div>
  );
}

DocumentChrome.propTypes = {
  org: PropTypes.string,
  title: PropTypes.string,
  reference: PropTypes.string,
  date: PropTypes.string,
  signataires: PropTypes.arrayOf(PropTypes.shape({ role: PropTypes.string, nom: PropTypes.string })),
  children: PropTypes.node,
};

export default DocumentChrome;
