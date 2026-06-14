import { useState } from "react";
import PropTypes from "prop-types";
import { PrinterIcon, CheckCircleIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
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

  const generer = () => {
    onArchive?.();
    setArchive(true);
    setTimeout(() => window.print(), 50);
  };

  const nomFichier = `${title} ${reference ?? ""}`.trim().replace(/\s+/g, "-");

  // PDF serveur (Puppeteer, document scellé) si pdfPath fourni ; sinon export client.
  const telecharger = () =>
    pdfPath ? telechargerPdf(pdfPath, pdfFilename ?? `${nomFichier}.pdf`) : exporterPdf(nomFichier);

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
        <div className="bpn-no-print mb-3 flex items-center gap-2 rounded border-l-[3px] border-vert bg-vertL px-3 py-2 text-sm text-vert">
          <CheckCircleIcon className="h-5 w-5 shrink-0" /> Document généré et archivé.
        </div>
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
