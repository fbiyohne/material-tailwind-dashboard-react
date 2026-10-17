import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Modal } from "./Modal";
import { FormField } from "./FormField";
import { Notice } from "./Notice";
import { useToast } from "./Toast";
import { enregistrerPaiement, enregistrerPaiementDroit, telechargerRecuPdf } from "../api/resources";
import { formatFCFA } from "../utils/format";

const MODES = ["Espèces", "Virement", "Chèque", "Mobile Money"];
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Enregistrement direct d'un paiement (cotisation ou droit de plaidoirie).
 * Réutilise BR-03 côté serveur (met à jour la situation et émet le reçu).
 * `ligne` : la ligne courante (montantDu, montantPaye, membre).
 * `type`  : "cotisation" (défaut) ou "droit".
 */
export function PaiementModal({ ligne, exercice, type = "cotisation", open, onClose, onDone }) {
  const toast = useToast();
  const estDroit = type === "droit";
  const libelle = estDroit ? "droit de plaidoirie" : "cotisation";
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
      const payload = { membreId: membre.id, annee: exercice, montant, mode: form.mode, ref: form.ref, date: form.date };
      const { recu } = estDroit ? await enregistrerPaiementDroit(payload) : await enregistrerPaiement(payload);
      toast.success(`Paiement enregistré — reçu N° ${recu.numero} (Me ${membre.nom})`);
      onDone?.();
      onClose();
      // Téléchargement immédiat du reçu officiel (cotisation comme droit de
      // plaidoirie) ; le paiement reste enregistré même si le PDF échoue.
      telechargerRecuPdf(recu.id, recu.numero).catch(() =>
        toast.error("Reçu enregistré, mais le PDF n'a pu être téléchargé. Réessayez depuis le registre des reçus.")
      );
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
      title={`Enregistrer un paiement — ${libelle} — Me ${membre.nom}`}
      footer={<button className="bpn-btn bpn-btn-or" onClick={valider} disabled={Number(form.montant) <= 0 || loading}>Enregistrer &amp; émettre le reçu</button>}
    >
      <Notice ton="gris" className="mb-4">
        Exercice {exercice} · dû {formatFCFA(ligne.montantDu)} · déjà payé {formatFCFA(ligne.montantPaye)} · solde{" "}
        <span className="font-medium text-rouge">{formatFCFA(solde)}</span>
      </Notice>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Montant (FCFA)" required>
          <input type="number" min={0} step={25000} value={form.montant} onChange={set("montant")} className="bpn-input" />
        </FormField>
        <FormField label="Mode de paiement">
          <select value={form.mode} onChange={set("mode")} className="bpn-input">
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </FormField>
        <FormField label="Date">
          <input type="date" value={form.date} onChange={set("date")} className="bpn-input" />
        </FormField>
        <FormField label="Référence" hint="optionnel">
          <input value={form.ref} onChange={set("ref")} className="bpn-input" placeholder="Auto si vide" />
        </FormField>
      </div>
    </Modal>
  );
}

PaiementModal.propTypes = {
  ligne: PropTypes.object,
  exercice: PropTypes.number,
  type: PropTypes.oneOf(["cotisation", "droit"]),
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onDone: PropTypes.func,
};

export default PaiementModal;
