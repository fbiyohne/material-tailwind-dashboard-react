import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import { useBarreau } from "../store/BarreauStore";
import { montantDu, montantPaye } from "../data/derivations";
import { formatFCFA } from "../utils/format";

const MODES = ["Espèces", "Virement", "Chèque", "Mobile Money"];
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Enregistrement direct d'un paiement de cotisation depuis le tableau.
 * Réutilise BR-03 : met à jour la cotisation et émet le reçu correspondant.
 */
export function PaiementModal({ membre, exercice, open, onClose }) {
  const { enregistrerPaiement } = useBarreau();
  const toast = useToast();
  const solde = membre ? Math.max(0, montantDu(membre) - montantPaye(membre, exercice)) : 0;
  const [form, setForm] = useState({ montant: solde, mode: MODES[0], ref: "", date: aujourdhui() });

  useEffect(() => {
    if (membre) setForm({ montant: solde, mode: MODES[0], ref: "", date: aujourdhui() });
  }, [membre, solde]);

  if (!membre) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const valider = () => {
    const montant = Number(form.montant);
    if (!montant || montant <= 0) return;
    const recu = enregistrerPaiement({ membreId: membre.id, exercice, montant, mode: form.mode, ref: form.ref, date: form.date });
    toast.success(`Paiement enregistré — reçu N° ${recu.numero} (Me ${membre.nom})`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Enregistrer un paiement — Me ${membre.nom}`}
      footer={<button className="bpn-btn bpn-btn-or" onClick={valider} disabled={Number(form.montant) <= 0}>Enregistrer &amp; émettre le reçu</button>}
    >
      <div className="mb-3 rounded border border-grisM bg-grisL/40 px-3 py-2 text-xs text-gris">
        Exercice {exercice} · dû {formatFCFA(montantDu(membre))} · déjà payé {formatFCFA(montantPaye(membre, exercice))} · solde{" "}
        <span className="font-medium text-rouge">{formatFCFA(solde)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="bpn-label">Montant (FCFA)</span>
          <input type="number" min={0} step={25000} value={form.montant} onChange={set("montant")} className="bpn-input mt-1" /></label>
        <label className="block"><span className="bpn-label">Mode</span>
          <select value={form.mode} onChange={set("mode")} className="bpn-input mt-1">
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select></label>
        <label className="block"><span className="bpn-label">Date</span>
          <input type="date" value={form.date} onChange={set("date")} className="bpn-input mt-1" /></label>
        <label className="block"><span className="bpn-label">Référence (optionnel)</span>
          <input value={form.ref} onChange={set("ref")} className="bpn-input mt-1" placeholder="Auto si vide" /></label>
      </div>
    </Modal>
  );
}

PaiementModal.propTypes = {
  membre: PropTypes.object,
  exercice: PropTypes.number,
  open: PropTypes.bool,
  onClose: PropTypes.func,
};

export default PaiementModal;
