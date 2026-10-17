import { useState } from "react";
import PropTypes from "prop-types";
import { Modal } from "./Modal";
import { FormField } from "./FormField";
import { useToast } from "./Toast";
import { contacterMembre } from "../api/resources";

/** « Contacter » : ouvre un fil de messagerie de l'administration vers l'avocat. Le contenu n'est jamais journalisé. */
export function ContacterModal({ membre, open, onClose }) {
  const toast = useToast();
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [busy, setBusy] = useState(false);
  const ferme = () => { setSujet(""); setCorps(""); onClose(); };
  const envoyer = async () => {
    setBusy(true);
    try {
      await contacterMembre({ membreId: membre.id, sujet: sujet.trim(), corps: corps.trim() });
      toast.success(`Message envoyé à Me ${membre.nom}.`);
      ferme();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal
      open={open} onClose={ferme} title={`Contacter Me ${membre.nom}`}
      footer={<>
        <button className="bpn-btn bpn-btn-ghost" onClick={ferme}>Annuler</button>
        <button className="bpn-btn bpn-btn-primary" disabled={busy || !sujet.trim() || !corps.trim()} onClick={envoyer}>Envoyer</button>
      </>}
    >
      <div className="space-y-3">
        <FormField label="Objet" htmlFor="ct-sujet" required>
          <input id="ct-sujet" className="bpn-input" maxLength={160} value={sujet} onChange={(e) => setSujet(e.target.value)} />
        </FormField>
        <FormField label="Message" htmlFor="ct-corps" required>
          <textarea id="ct-corps" rows={5} className="bpn-input" maxLength={5000} value={corps} onChange={(e) => setCorps(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

ContacterModal.propTypes = { membre: PropTypes.object.isRequired, open: PropTypes.bool, onClose: PropTypes.func.isRequired };

export default ContacterModal;
