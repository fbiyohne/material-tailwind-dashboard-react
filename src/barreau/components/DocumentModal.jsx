import { useState } from "react";
import PropTypes from "prop-types";
import { PrinterIcon, CheckCircleIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { Notice } from "./Notice";
import { DocumentChrome } from "./DocumentChrome";
import { exporterPdf } from "../utils/exports";
import { telechargerPdf } from "../api/client";

/**
 * Document officiel générique (convocation, feuille de présence, procès-verbal…)
 * bâti sur le gabarit unifié DocumentChrome. « Générer & archiver » archive
 * (RG-14) puis imprime (NFR-13) ; « Télécharger PDF » exporte le document.
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
  pdfPath,
  pdfFilename,
}) {
  const [archive, setArchive] = useState(false);

  const nomFichier = `${title} ${reference ?? ""}`.trim().replace(/\s+/g, "-");

  // PDF serveur (Puppeteer, document scellé) si pdfPath fourni ; sinon export client.
  const telecharger = () =>
    pdfPath ? telechargerPdf(pdfPath, pdfFilename ?? `${nomFichier}.pdf`) : exporterPdf(nomFichier);

  // « Générer & archiver » : archive (RG-14) puis produit le document officiel.
  // On télécharge le PDF scellé du serveur quand il existe — fiable, contrairement
  // à window.print() depuis une modale (zone d'impression tronquée par l'overlay) ;
  // repli sur l'impression navigateur uniquement faute de PDF serveur.
  const generer = async () => {
    try {
      await onArchive?.();
      setArchive(true);
      if (pdfPath) await telechargerPdf(pdfPath, pdfFilename ?? `${nomFichier}.pdf`);
      else setTimeout(() => window.print(), 50);
    } catch {
      /* l'échec d'archivage/téléchargement reste silencieux ici (pas de toast dans ce composant) */
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="bpn-btn bpn-btn-ghost" onClick={telecharger}>
            <ArrowDownTrayIcon className="h-4 w-4" /> PDF
          </button>
          <button type="button" className="bpn-btn bpn-btn-or" onClick={generer}>
            <PrinterIcon className="h-4 w-4" /> Générer &amp; archiver
          </button>
        </>
      }
    >
      {archive && (
        <Notice ton="vert" icon={CheckCircleIcon} className="bpn-no-print mb-3 text-sm">Document généré et archivé.</Notice>
      )}

      <DocumentChrome org={org} title={title} reference={reference} date={date} signataires={[signataire]}>
        {children}
      </DocumentChrome>
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
  pdfPath: PropTypes.string,
  pdfFilename: PropTypes.string,
};

export default DocumentModal;
