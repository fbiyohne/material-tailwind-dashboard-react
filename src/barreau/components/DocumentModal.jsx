import { useState } from "react";
import PropTypes from "prop-types";
import { PrinterIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

/**
 * Document officiel générique (convocation, feuille de présence, procès-verbal…)
 * — en-tête institutionnel + corps libre + bloc signature. Bouton
 * « Générer & archiver » qui archive (RG-14) puis lance l'impression (NFR-13).
 */
export function DocumentModal({
  open,
  onClose,
  title,
  org = "Conseil de l'Ordre",
  reference,
  children,
  signataire = { role: "Le Bâtonnier", nom: "Me BIKINDOU Audrey Séverin" },
  date = new Date().toISOString().slice(0, 10),
  onArchive,
}) {
  const [archive, setArchive] = useState(false);

  const generer = () => {
    onArchive?.();
    setArchive(true);
    setTimeout(() => window.print(), 50);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <button type="button" className="bpn-btn bpn-btn-or" onClick={generer}>
          <PrinterIcon className="h-4 w-4" /> Générer &amp; archiver
        </button>
      }
    >
      {archive && (
        <div className="bpn-no-print mb-3 flex items-center gap-2 rounded border-l-[3px] border-vert bg-[#e6f4ee] px-3 py-2 text-sm text-vert">
          <CheckCircleIcon className="h-5 w-5 shrink-0" /> Document généré et archivé.
        </div>
      )}

      <div className="bpn-print-zone overflow-hidden rounded border border-grisM bg-white">
        <div className="bg-navy px-5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-or">
            Barreau de Pointe-Noire
          </div>
          <div className="text-[9px] text-white/60">
            Ordre National des Avocats du Congo · {org}
          </div>
        </div>
        <div className="h-[3px] bg-gradient-to-r from-or via-or-2 to-or" />

        <div className="px-8 py-7">
          <div className="text-center font-display text-2xl text-navy">{title}</div>
          {reference && (
            <div className="mb-5 mt-1 text-center font-mono text-xs text-or">{reference}</div>
          )}
          <div className="mt-4 text-[13px] leading-7 text-encre">{children}</div>

          <div className="mt-8 flex items-end justify-between">
            <div className="text-[11px] text-gris">Fait à Pointe-Noire, le {fmtDate(date)}</div>
            <div className="text-right">
              <div className="mb-6 text-[10px] uppercase tracking-wide text-gris">
                {signataire.role}
              </div>
              <div className="border-t border-grisM pt-1 text-[11px] font-medium text-navy">
                {signataire.nom}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

DocumentModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.string,
  org: PropTypes.string,
  reference: PropTypes.string,
  children: PropTypes.node,
  signataire: PropTypes.object,
  date: PropTypes.string,
  onArchive: PropTypes.func,
};

export default DocumentModal;
