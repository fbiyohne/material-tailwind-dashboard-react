import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusIcon, CalendarDaysIcon, MapPinIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { Badge, Modal } from "../components";
import { useBarreau } from "../store/BarreauStore";

const fmt = (d) => new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

function NouvelleReunionModal({ open, onClose }) {
  const { creerReunion } = useBarreau();
  const [form, setForm] = useState({ date: "", heure: "15:00", lieu: "Maison de l'Avocat — Pointe-Noire", odj: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valider = () => {
    if (!form.date) return;
    creerReunion({ date: form.date, heure: form.heure, lieu: form.lieu, ordreDuJour: form.odj.split("\n").map((s) => s.trim()).filter(Boolean) });
    onClose();
    setForm({ date: "", heure: "15:00", lieu: "Maison de l'Avocat — Pointe-Noire", odj: "" });
  };
  return (
    <Modal open={open} onClose={onClose} title="Planifier une réunion du Conseil"
      footer={<button className="bpn-btn bpn-btn-primary" onClick={valider}>Créer la réunion</button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="bpn-label">Date</span><input type="date" value={form.date} onChange={set("date")} className="bpn-input mt-1" /></label>
          <label className="block"><span className="bpn-label">Heure</span><input type="time" value={form.heure} onChange={set("heure")} className="bpn-input mt-1" /></label>
        </div>
        <label className="block"><span className="bpn-label">Lieu</span><input value={form.lieu} onChange={set("lieu")} className="bpn-input mt-1" /></label>
        <label className="block"><span className="bpn-label">Ordre du jour (une ligne par point)</span><textarea rows={4} value={form.odj} onChange={set("odj")} className="bpn-input mt-1" /></label>
      </div>
    </Modal>
  );
}

export function Reunions() {
  const { reunions } = useBarreau();
  const navigate = useNavigate();
  const [creer, setCreer] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="bpn-eyebrow">Institutionnel</div>
          <h2 className="bpn-title mt-2">Réunions du Conseil de l'Ordre</h2>
          <p className="mt-1 text-sm text-gris">Planification, convocations, feuilles de présence et procès-verbaux.</p>
        </div>
        <button className="bpn-btn bpn-btn-or" onClick={() => setCreer(true)}><PlusIcon className="h-4 w-4" /> Nouvelle réunion</button>
      </div>

      <div className="space-y-4">
        {reunions.map((r) => (
          <button key={r.id} onClick={() => navigate(`/reunions/${r.id}`)} className="block w-full text-left">
            <div className="bpn-card p-5 transition hover:border-or hover:shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg capitalize text-navy">{fmt(r.date)}</span>
                    <Badge ton={r.statut === "tenue" ? "vert" : "or"}>{r.statut === "tenue" ? "Tenue" : "Planifiée"}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gris">
                    <span className="flex items-center gap-1"><CalendarDaysIcon className="h-3.5 w-3.5" /> {r.heure}</span>
                    <span className="flex items-center gap-1"><MapPinIcon className="h-3.5 w-3.5" /> {r.lieu}</span>
                  </div>
                </div>
                <ArrowRightIcon className="h-5 w-5 shrink-0 text-gris" />
              </div>
              <ul className="mt-3 list-inside list-decimal space-y-0.5 text-sm text-encre">
                {r.ordreDuJour.slice(0, 3).map((pt, i) => <li key={i}>{pt}</li>)}
                {r.ordreDuJour.length > 3 && <li className="list-none text-xs text-gris">+ {r.ordreDuJour.length - 3} autres points</li>}
              </ul>
            </div>
          </button>
        ))}
      </div>

      <NouvelleReunionModal open={creer} onClose={() => setCreer(false)} />
    </div>
  );
}

export default Reunions;
