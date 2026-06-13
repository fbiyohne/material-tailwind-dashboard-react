import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Badge, Modal } from "../components";
import { useBarreau } from "../store/BarreauStore";
import { STATUT_PUBLICATION_META } from "../data/publications";

function NouvellePublicationModal({ open, onClose }) {
  const { creerPublication } = useBarreau();
  const [form, setForm] = useState({ titre: "", type: "Avis", contenu: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valider = () => {
    if (!form.titre.trim()) return;
    creerPublication(form);
    onClose();
    setForm({ titre: "", type: "Avis", contenu: "" });
  };
  return (
    <Modal open={open} onClose={onClose} title="Nouvelle publication"
      footer={<button className="bpn-btn bpn-btn-primary" onClick={valider}>Soumettre pour validation</button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-2 block"><span className="bpn-label">Titre</span>
            <input value={form.titre} onChange={set("titre")} className="bpn-input mt-1" /></label>
          <label className="block"><span className="bpn-label">Type</span>
            <select value={form.type} onChange={set("type")} className="bpn-input mt-1">
              <option>Avis</option><option>Communiqué</option>
            </select></label>
        </div>
        <label className="block"><span className="bpn-label">Contenu</span>
          <textarea rows={5} value={form.contenu} onChange={set("contenu")} className="bpn-input mt-1" /></label>
      </div>
    </Modal>
  );
}

export function Publications() {
  const { publications, changerStatutPublication } = useBarreau();
  const navigate = useNavigate();
  const [creer, setCreer] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="bpn-eyebrow">Documents</div>
          <h2 className="bpn-title mt-2">Publications institutionnelles</h2>
          <p className="mt-1 text-sm text-gris">
            Avis et communiqués — validation par le Bâtonnier avant diffusion.
          </p>
        </div>
        <button className="bpn-btn bpn-btn-or" onClick={() => setCreer(true)}>
          <PlusIcon className="h-4 w-4" /> Nouvelle publication
        </button>
      </div>

      <div className="space-y-4">
        {publications.map((p) => {
          const meta = STATUT_PUBLICATION_META[p.statut];
          return (
            <div key={p.id} className="bpn-card p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge ton="gris" dot={false}>{p.type}</Badge>
                    <span className="font-display text-base text-navy">{p.titre}</span>
                    <Badge ton={meta.ton}>{meta.label}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-gris">{p.contenu}</p>
                  <div className="mt-1 font-mono text-[11px] text-gris">{p.date}</div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {p.statut === "a_valider" && (
                    <button className="bpn-btn bpn-btn-primary !py-1.5 text-[11px]"
                      onClick={() => changerStatutPublication(p.id, "valide")}>
                      Valider (Bâtonnier)
                    </button>
                  )}
                  {p.statut === "valide" && (
                    <button className="bpn-btn bpn-btn-or !py-1.5 text-[11px]"
                      onClick={() => changerStatutPublication(p.id, "publie")}>
                      Publier
                    </button>
                  )}
                  <button className="bpn-btn bpn-btn-ghost !py-1.5 text-[11px]" onClick={() => navigate(`/publications/${p.id}`)}>
                    Ouvrir
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <NouvellePublicationModal open={creer} onClose={() => setCreer(false)} />
    </div>
  );
}

export default Publications;
