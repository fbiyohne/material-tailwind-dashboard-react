import { useState } from "react";
import PropTypes from "prop-types";
import { ArrowDownTrayIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { Notice } from "./Notice";
import { DocumentChrome } from "./DocumentChrome";
import { useToast } from "./Toast";
import { identite } from "../data/config";
import { telechargerAttestationPdf, telechargerAttestationSortiePdf } from "../api/resources";

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const jourLong = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
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
  // Date de sortie : celle du registre (motif jamais affiché) ; à défaut, dates d'acte de la fiche.
  const dateSortie = membre.dateSortie ?? membre.dateRadiation ?? membre.dateDeces;

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

      <DocumentChrome
        org="Le Bâtonnier"
        title={titre}
        reference="N° attribué à la génération"
        date={aujourdhui()}
        signataires={[{ role: "Le Bâtonnier", nom: identite().batonnier }]}
      >
        {sortie ? (
          <p className="text-xs leading-7 text-encre">
            Le Bâtonnier de l'Ordre des Avocats du {identite().denomination} atteste que <strong>Me {membre.nom}</strong> a été
            inscrit(e) au Tableau de l'Ordre sous le numéro <strong>{membre.num}</strong>
            {membre.dateInscription ? <>, à compter du <strong>{jourLong(membre.dateInscription)}</strong></> : null}, et ne figure plus au Tableau
            {dateSortie ? <> depuis le <strong>{jourLong(dateSortie)}</strong></> : null}.
          </p>
        ) : (
        <p className="text-xs leading-7 text-encre">
          Le Bâtonnier de l'Ordre des Avocats du {identite().denomination} atteste que{" "}
          <strong>Me {membre.nom}</strong> est inscrit(e) au Tableau de l'Ordre des Avocats du
          {" "}{identite().denomination} sous le numéro <strong>{membre.num}</strong>
          {membre.dateInscription ? (
            <>
              , depuis le{" "}
              <strong>{new Date(membre.dateInscription).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</strong>
            </>
          ) : null}
          .
        </p>
        )}
        <p className="mt-3 text-xs leading-7 text-encre">
          La présente attestation est délivrée {sortie ? "" : "à l'intéressé(e) "}pour servir et valoir ce que de droit.
        </p>
      </DocumentChrome>
    </Modal>
  );
}

AttestationModal.propTypes = { membre: PropTypes.object, onClose: PropTypes.func };

export default AttestationModal;
