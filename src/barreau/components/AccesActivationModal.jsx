import PropTypes from "prop-types";
import { ClipboardIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

/**
 * Affiche le lien d'activation de l'espace avocat après provisionnement.
 * Partagé par la fiche du membre et le module Utilisateurs. `acces` = null ferme.
 */
export function AccesActivationModal({ acces, onClose }) {
  const toast = useToast();
  const copier = (texte) => {
    navigator.clipboard?.writeText(texte).then(() => toast.success("Lien copié.")).catch(() => {});
  };
  return (
    <Modal open={!!acces} onClose={onClose} title={acces?.renvoi ? "Lien d'activation régénéré" : "Accès espace avocat créé"}>
      {acces && (
        <div className="space-y-3 text-sm">
          <p className="text-encre">
            Un lien d'activation a été {acces.renvoi ? "régénéré" : "généré"} et envoyé à{" "}
            <span className="font-medium">{acces.email}</span>. L'avocat y définira son mot de passe (lien valable 7 jours).
          </p>
          <div className="flex items-center gap-2 rounded border border-grisM bg-grisL/40 p-2">
            <input readOnly value={acces.lien} className="bpn-input !border-0 !bg-transparent font-mono text-xs" onFocus={(e) => e.target.select()} />
            <button className="bpn-btn bpn-btn-ghost bpn-btn-sm shrink-0" onClick={() => copier(acces.lien)}>
              <ClipboardIcon className="h-3.5 w-3.5" /> Copier
            </button>
          </div>
          <p className="text-xs text-gris">Vous pouvez transmettre ce lien directement à l'avocat si nécessaire.</p>
        </div>
      )}
    </Modal>
  );
}

AccesActivationModal.propTypes = {
  acces: PropTypes.shape({ email: PropTypes.string, lien: PropTypes.string, renvoi: PropTypes.bool }),
  onClose: PropTypes.func.isRequired,
};

export default AccesActivationModal;
