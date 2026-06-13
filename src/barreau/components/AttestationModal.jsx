import { useState } from "react";
import PropTypes from "prop-types";
import { PrinterIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { useBarreau } from "../store/BarreauStore";

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Génération + aperçu imprimable d'une attestation d'inscription (FR-AV-05). */
export function AttestationModal({ membre, onClose }) {
  const { prochainNumeroAttestation, genererAttestation } = useBarreau();
  const [emise, setEmise] = useState(null);

  if (!membre) return null;
  const numero = emise?.numero ?? prochainNumeroAttestation();
  const date = emise?.date ?? aujourdhui();

  const emettre = () => {
    const att = genererAttestation({ membreId: membre.id, date: aujourdhui() });
    setEmise(att);
    setTimeout(() => window.print(), 50);
  };

  return (
    <Modal
      open={!!membre}
      onClose={onClose}
      title="Attestation d'inscription"
      footer={
        <button type="button" className="bpn-btn bpn-btn-or" onClick={emettre}>
          <PrinterIcon className="h-4 w-4" />
          Générer &amp; archiver
        </button>
      }
    >
      {emise && (
        <div className="bpn-no-print mb-3 flex items-center gap-2 rounded border-l-[3px] border-vert bg-[#e6f4ee] px-3 py-2 text-sm text-vert">
          <CheckCircleIcon className="h-5 w-5 shrink-0" />
          Attestation {emise.numero} générée et archivée.
        </div>
      )}

      <div className="bpn-print-zone overflow-hidden rounded border border-grisM bg-white">
        <div className="bg-navy px-5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-or">
            Barreau de Pointe-Noire
          </div>
          <div className="text-[9px] text-white/60">
            Ordre National des Avocats du Congo · Le Bâtonnier
          </div>
        </div>
        <div className="h-[3px] bg-gradient-to-r from-or via-or-2 to-or" />

        <div className="px-8 py-7">
          <div className="mb-1 text-center font-display text-2xl text-navy">
            Attestation d'inscription
          </div>
          <div className="mb-6 text-center font-mono text-xs text-or">N° {numero}</div>

          <p className="text-[13px] leading-7 text-encre">
            Le Bâtonnier de l'Ordre des Avocats du Barreau de Pointe-Noire atteste que{" "}
            <strong>Me {membre.nom}</strong> est inscrit(e) au Tableau de l'Ordre des Avocats du
            Barreau de Pointe-Noire sous le numéro <strong>{membre.num}</strong>
            {membre.dateInscription ? (
              <>
                , depuis le{" "}
                <strong>
                  {new Date(membre.dateInscription).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
              </>
            ) : null}
            .
          </p>
          <p className="mt-3 text-[13px] leading-7 text-encre">
            La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de
            droit.
          </p>

          <div className="mt-8 flex items-end justify-between">
            <div className="text-[11px] text-gris">
              Fait à Pointe-Noire, le{" "}
              {new Date(date).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </div>
            <div className="text-right">
              <div className="mb-6 text-[10px] uppercase tracking-wide text-gris">Le Bâtonnier</div>
              <div className="border-t border-grisM pt-1 text-[11px] font-medium text-navy">
                Me BIKINDOU Audrey Séverin
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

AttestationModal.propTypes = {
  membre: PropTypes.object,
  onClose: PropTypes.func,
};

export default AttestationModal;
