import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import { useBarreau } from "../store/BarreauStore";

/** Édition de la fiche d'un membre (FR-AV-01 : modifier). */
export function EditMembreModal({ membre, open, onClose }) {
  const { modifierMembre } = useBarreau();
  const toast = useToast();
  const [form, setForm] = useState(membre ?? {});

  useEffect(() => { if (membre) setForm(membre); }, [membre]);

  if (!membre) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const valider = () => {
    if (!form.nom?.trim()) return;
    modifierMembre(membre.id, {
      nom: form.nom, cabinet: form.cabinet, statut: form.statut,
      tel: form.tel, email: form.email, rccm: form.rccm, dateInscription: form.dateInscription,
    });
    toast.success(`Fiche mise à jour — Me ${form.nom}`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Modifier — Me ${membre.nom}`}
      footer={<button className="bpn-btn bpn-btn-primary" onClick={valider} disabled={!form.nom?.trim()}>Enregistrer</button>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="bpn-label">Nom et prénom</span>
          <input value={form.nom ?? ""} onChange={set("nom")} className="bpn-input mt-1" /></label>
        <label className="block"><span className="bpn-label">Statut</span>
          <select value={form.statut ?? "inscrit"} onChange={set("statut")} className="bpn-input mt-1">
            <option value="inscrit">Inscrit</option>
            <option value="suspendu">Suspendu</option>
            <option value="omis">Omis</option>
            <option value="honoraire">Honoraire</option>
            <option value="radie">Radié</option>
          </select></label>
        <label className="block"><span className="bpn-label">Cabinet</span>
          <input value={form.cabinet ?? ""} onChange={set("cabinet")} className="bpn-input mt-1" /></label>
        <label className="block"><span className="bpn-label">Date d'inscription</span>
          <input type="date" value={form.dateInscription ?? ""} onChange={set("dateInscription")} className="bpn-input mt-1" /></label>
        <label className="block"><span className="bpn-label">RCCM</span>
          <input value={form.rccm ?? ""} onChange={set("rccm")} className="bpn-input mt-1" /></label>
        <label className="block"><span className="bpn-label">Téléphone</span>
          <input value={form.tel ?? ""} onChange={set("tel")} className="bpn-input mt-1" /></label>
        <label className="block"><span className="bpn-label">Email</span>
          <input type="email" value={form.email ?? ""} onChange={set("email")} className="bpn-input mt-1" /></label>
      </div>
    </Modal>
  );
}

EditMembreModal.propTypes = {
  membre: PropTypes.object,
  open: PropTypes.bool,
  onClose: PropTypes.func,
};

export default EditMembreModal;
