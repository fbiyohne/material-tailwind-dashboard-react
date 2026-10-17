import { useState } from "react";
import PropTypes from "prop-types";
import { ArrowDownTrayIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { Notice } from "./Notice";
import { ApercuServeur } from "./ApercuServeur";
import { useToast } from "./Toast";
import { telechargerAttestationPdf, telechargerAttestationSortiePdf } from "../api/resources";

/** Statuts de sortie du tableau : on délivre alors l'attestation de sortie (T20, H2). */
const SORTIS = ["radie", "decede", "demissionnaire", "retraite", "cessation"];

/**
 * Génération + téléchargement de l'attestation (PDF serveur) : d'inscription (FR-AV-05),
 * ou de sortie du tableau pour un ancien membre, sans motif de sortie (R-62).
 */
export function AttestationModal({ membre, onClose }) {
  const toast = useToast();
  const [emise, setEmise] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!membre) return null;
  const sortie = SORTIS.includes(membre.statut);
  const titre = sortie ? "Attestation de sortie du tableau" : "Attestation d'inscription";

  const generer = async () => {
    setLoading(true);
    try {
      await (sortie ? telechargerAttestationSortiePdf : telechargerAttestationPdf)(membre.id, membre.num);
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
      title={titre}
      footer={
        <button type="button" className="bpn-btn bpn-btn-or" onClick={generer} disabled={loading}>
          <ArrowDownTrayIcon className="h-4 w-4" /> Générer &amp; télécharger (PDF)
        </button>
      }
    >
      {emise && (
        <Notice ton="vert" icon={CheckCircleIcon} className="bpn-no-print mb-3 text-sm">Attestation générée et archivée.</Notice>
      )}

      {/* Aperçu = le document du serveur (gabarit officiel), sans numéro ni archivage. */}
      <ApercuServeur titre={`Aperçu : ${titre}`} chemin={`/membres/${membre.id}/attestation/apercu`} corps={{}} />
    </Modal>
  );
}

AttestationModal.propTypes = { membre: PropTypes.object, onClose: PropTypes.func };

export default AttestationModal;
