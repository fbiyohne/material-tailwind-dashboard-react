import { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { UserPlusIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import { inscrireMembre } from "../api/resources";

const vide = () => ({
  nom: "", qualite: "avocat", statut: "inscrit", cabinet: "",
  dateInscription: new Date().toISOString().slice(0, 10), dateNaissance: "",
  tel: "", email: "", adresse: "", rccm: "", cnss: "", observations: "",
});

/** Formulaire d'inscription d'un avocat (flux « Inscription avocat »). */
export function InscriptionModal({ open, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(vide());
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const valider = async () => {
    if (!form.nom.trim()) return;
    setLoading(true);
    try {
      const m = await inscrireMembre(form);
      toast.success(`Inscription enregistrée — ${m.numInscription}`);
      setForm(vide());
      onClose();
      navigate(`/avocats/${m.id}`);
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
      title="Inscription d'un avocat"
      footer={
        <button className="bpn-btn bpn-btn-or" onClick={valider} disabled={!form.nom.trim() || loading}>
          <UserPlusIcon className="h-4 w-4" /> Inscrire au tableau
        </button>
      }
    >
      <div className="mb-3 rounded border-l-[3px] border-or bg-or-L px-3 py-2 text-xs text-gris">
        Le numéro d'inscription <span className="font-mono font-medium text-navy">PN-AAAA-NNN</span> est attribué automatiquement.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="bpn-label">Nom et prénom (NOM Prénom)</span>
          <input value={form.nom} onChange={set("nom")} className="bpn-input mt-1" placeholder="KOUMBA Jean" />
        </label>
        <label className="block">
          <span className="bpn-label">Qualité</span>
          <select value={form.qualite} onChange={set("qualite")} className="bpn-input mt-1">
            <option value="avocat">Avocat</option>
            <option value="stagiaire">Stagiaire</option>
            <option value="honoraire">Honoraire</option>
          </select>
        </label>
        <label className="block">
          <span className="bpn-label">Statut</span>
          <select value={form.statut} onChange={set("statut")} className="bpn-input mt-1">
            <option value="inscrit">Inscrit</option>
            <option value="stagiaire">Stagiaire</option>
            <option value="honoraire">Honoraire</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="bpn-label">Cabinet</span>
          <input value={form.cabinet} onChange={set("cabinet")} className="bpn-input mt-1" />
        </label>
        <label className="block">
          <span className="bpn-label">Date d'inscription</span>
          <input type="date" value={form.dateInscription} onChange={set("dateInscription")} className="bpn-input mt-1" />
        </label>
        <label className="block">
          <span className="bpn-label">Date de naissance</span>
          <input type="date" value={form.dateNaissance} onChange={set("dateNaissance")} className="bpn-input mt-1" />
        </label>
        <label className="block">
          <span className="bpn-label">Téléphone</span>
          <input value={form.tel} onChange={set("tel")} className="bpn-input mt-1" placeholder="+242 06 …" />
        </label>
        <label className="block">
          <span className="bpn-label">Email</span>
          <input type="email" value={form.email} onChange={set("email")} className="bpn-input mt-1" />
        </label>
        <label className="block sm:col-span-2">
          <span className="bpn-label">Adresse</span>
          <input value={form.adresse} onChange={set("adresse")} className="bpn-input mt-1" />
        </label>
        <label className="block">
          <span className="bpn-label">RCCM (le cas échéant)</span>
          <input value={form.rccm} onChange={set("rccm")} className="bpn-input mt-1" />
        </label>
        <label className="block">
          <span className="bpn-label">CNSS (le cas échéant)</span>
          <input value={form.cnss} onChange={set("cnss")} className="bpn-input mt-1" />
        </label>
        <label className="block sm:col-span-2">
          <span className="bpn-label">Observations</span>
          <textarea rows={2} value={form.observations} onChange={set("observations")} className="bpn-input mt-1" />
        </label>
      </div>
    </Modal>
  );
}

InscriptionModal.propTypes = { open: PropTypes.bool, onClose: PropTypes.func };

export default InscriptionModal;
