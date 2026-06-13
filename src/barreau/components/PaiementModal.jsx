import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import { enregistrerPaiement } from "../api/resources";
import { formatFCFA } from "../utils/format";

const MODES = ["Espèces", "Virement", "Chèque", "Mobile Money"];
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Enregistrement direct d'un paiement de cotisation. Réutilise BR-03 côté
 * serveur (met à jour la cotisation et émet le reçu).
 * `ligne` : la ligne de cotisation courante (montantDu, montantPaye, membre).
 */
export function PaiementModal({ ligne, exercice, open, onClose, onDone }) {
  const toast = useToast();
  const solde = ligne ? Math.max(0, ligne.montantDu - ligne.montantPaye) : 0;
  const [form, setForm] = useState({ montant: solde, mode: MODES[0], ref: "", date: aujourdhui() });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ligne) setForm({ montant: solde, mode: MODES[0], ref: "", date: aujourdhui() });
  }, [ligne, solde]);

  if (!ligne) return null;
  const membre = ligne.membre;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const valider = async () => {
    const montant = Number(form.montant);
    if (!montant || montant <= 0) return;
    setLoading(true);
    try {
      const { recu } = await enregistrerPaiement({ membreId: membre.id, annee: exercice, montant, mode: form.mode, ref: form.ref, date: form.date });
      toast.success(`Paiement enregistré — reçu N° ${recu.numero} (Me ${membre.nom})`);
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Enregistrer un paiement — Me ${membre.nom}`}
      footer={<button className="bpn-btn bpn-btn-or" onClick={valider} disabled={Number(form.montant) <= 0 || loading}>Enregistrer &amp; émettre le reçu</button>}
    >
      <div className="mb-3 rounded border border-grisM bg-grisL/40 px-3 py-2 text-xs text-gris">
        Exercice {exercice} · dû {formatFCFA(ligne.montantDu)} · déjà payé {formatFCFA(ligne.montantPaye)} · solde{" "}
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
  ligne: PropTypes.object,
  exercice: PropTypes.number,
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onDone: PropTypes.func,
};

export default PaiementModal;
