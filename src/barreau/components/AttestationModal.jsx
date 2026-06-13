import { useState } from "react";
import PropTypes from "prop-types";
import { PrinterIcon, CheckCircleIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { DocumentChrome } from "./DocumentChrome";
import { useBarreau } from "../store/BarreauStore";
import { exporterPdf } from "../utils/exports";

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
        <>
          <button type="button" className="bpn-btn bpn-btn-ghost" onClick={() => exporterPdf(`Attestation-${numero}`)}>
            <ArrowDownTrayIcon className="h-4 w-4" /> PDF
          </button>
          <button type="button" className="bpn-btn bpn-btn-or" onClick={emettre}>
            <PrinterIcon className="h-4 w-4" /> Générer &amp; archiver
          </button>
        </>
      }
    >
      {emise && (
        <div className="bpn-no-print mb-3 flex items-center gap-2 rounded border-l-[3px] border-vert bg-[#e6f4ee] px-3 py-2 text-sm text-vert">
          <CheckCircleIcon className="h-5 w-5 shrink-0" /> Attestation {emise.numero} générée et archivée.
        </div>
      )}

      <DocumentChrome
        org="Le Bâtonnier"
        title="Attestation d'inscription"
        reference={`N° ${numero}`}
        date={date}
        signataires={[{ role: "Le Bâtonnier", nom: "Me BIKINDOU Audrey Séverin" }]}
      >
        <p className="text-[13px] leading-7 text-encre">
          Le Bâtonnier de l'Ordre des Avocats du Barreau de Pointe-Noire atteste que{" "}
          <strong>Me {membre.nom}</strong> est inscrit(e) au Tableau de l'Ordre des Avocats du
          Barreau de Pointe-Noire sous le numéro <strong>{membre.num}</strong>
          {membre.dateInscription ? (
            <>
              , depuis le{" "}
              <strong>
                {new Date(membre.dateInscription).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
              </strong>
            </>
          ) : null}
          .
        </p>
        <p className="mt-3 text-[13px] leading-7 text-encre">
          La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.
        </p>
      </DocumentChrome>
    </Modal>
  );
}

AttestationModal.propTypes = { membre: PropTypes.object, onClose: PropTypes.func };

export default AttestationModal;
