import { useState } from "react";
import PropTypes from "prop-types";
import { ArrowDownTrayIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { DocumentChrome } from "./DocumentChrome";
import { useToast } from "./Toast";
import { telechargerAttestationPdf } from "../api/resources";

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Génération + téléchargement de l'attestation d'inscription (PDF serveur, FR-AV-05). */
export function AttestationModal({ membre, onClose }) {
  const toast = useToast();
  const [emise, setEmise] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!membre) return null;

  const generer = async () => {
    setLoading(true);
    try {
      await telechargerAttestationPdf(membre.id, membre.num);
      setEmise(true);
      toast.success(`Attestation générée, archivée et téléchargée — Me ${membre.nom}.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!membre}
      onClose={onClose}
      title="Attestation d'inscription"
      footer={
        <button type="button" className="bpn-btn bpn-btn-or" onClick={generer} disabled={loading}>
          <ArrowDownTrayIcon className="h-4 w-4" /> Générer &amp; télécharger (PDF)
        </button>
      }
    >
      {emise && (
        <div className="bpn-no-print mb-3 flex items-center gap-2 rounded border-l-[3px] border-vert bg-vertL px-3 py-2 text-sm text-vert">
          <CheckCircleIcon className="h-5 w-5 shrink-0" /> Attestation générée et archivée.
        </div>
      )}

      <DocumentChrome
        org="Le Bâtonnier"
        title="Attestation d'inscription"
        reference="N° attribué à la génération"
        date={aujourdhui()}
        signataires={[{ role: "Le Bâtonnier", nom: "Me BIKINDOU Audrey Séverin" }]}
      >
        <p className="text-[13px] leading-7 text-encre">
          Le Bâtonnier de l'Ordre des Avocats du Barreau de Pointe-Noire atteste que{" "}
          <strong>Me {membre.nom}</strong> est inscrit(e) au Tableau de l'Ordre des Avocats du
          Barreau de Pointe-Noire sous le numéro <strong>{membre.num}</strong>
          {membre.dateInscription ? (
            <>
              , depuis le{" "}
              <strong>{new Date(membre.dateInscription).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</strong>
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
