import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusIcon, ArrowRightIcon, BuildingLibraryIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, EmptyState, useToast, PageHeader, FormField } from "../components";
import { listerAssemblees, creerAssemblee as apiCreerAssemblee } from "../api/resources";

const TYPE_LABEL = { AGO: "Assemblée Générale Ordinaire", AGE: "Assemblée Générale Extraordinaire" };
const fmt = (d) => new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

function NouvelleAssembleeModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ type: "AGO", date: "", lieu: "Palais de Justice — Pointe-Noire", odj: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valider = async () => {
    if (!form.date) return;
    try {
      await apiCreerAssemblee({ type: form.type, date: form.date, lieu: form.lieu, ordreDuJour: form.odj.split("\n").map((s) => s.trim()).filter(Boolean) });
      onCreated?.();
      onClose();
      setForm({ type: "AGO", date: "", lieu: "Palais de Justice — Pointe-Noire", odj: "" });
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Convoquer une assemblée générale"
      footer={<button className="bpn-btn bpn-btn-primary" onClick={valider}>Créer l'assemblée</button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Type">
            <select value={form.type} onChange={set("type")} className="bpn-input"><option value="AGO">AGO — Ordinaire</option><option value="AGE">AGE — Extraordinaire</option></select>
          </FormField>
          <FormField label="Date"><input type="date" value={form.date} onChange={set("date")} className="bpn-input" /></FormField>
        </div>
        <FormField label="Lieu"><input value={form.lieu} onChange={set("lieu")} className="bpn-input" /></FormField>
        <FormField label="Ordre du jour" hint="une ligne par point"><textarea rows={4} value={form.odj} onChange={set("odj")} className="bpn-input" /></FormField>
      </div>
    </Modal>
  );
}

export function Assemblees() {
  const navigate = useNavigate();
  const toast = useToast();
  const [assemblees, setAssemblees] = useState([]);
  const [creer, setCreer] = useState(false);

  const charger = () => listerAssemblees().then(setAssemblees).catch((e) => toast.error(e.message));
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Institutionnel" titre="Assemblées générales" sousTitre="AGO et AGE — convocation du corps électoral, suivi du quorum et décisions.">
        <button className="bpn-btn bpn-btn-or" onClick={() => setCreer(true)}><PlusIcon className="h-4 w-4" /> Nouvelle assemblée</button>
      </PageHeader>

      <div className="space-y-5">
        {assemblees.length === 0 && (
          <div className="bpn-card">
            <EmptyState
              icon={BuildingLibraryIcon}
              title="Aucune assemblée générale"
              description="Créez une AGO ou une AGE pour convoquer le corps électoral, suivre le quorum et consigner les décisions."
              action={<button className="bpn-btn bpn-btn-or" onClick={() => setCreer(true)}><PlusIcon className="h-4 w-4" /> Nouvelle assemblée</button>}
            />
          </div>
        )}
        {assemblees.map((a) => (
          <button key={a.id} onClick={() => navigate(`/assemblees/${a.id}`)} className="block w-full text-left">
            <div className="bpn-card p-5 transition hover:border-or hover:shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge ton={a.type === "AGE" ? "rouge" : "bleu"} dot={false}>{a.type}</Badge>
                    <span className="font-display text-lg capitalize text-navy">{fmt(a.date)}</span>
                  </div>
                  <div className="mt-1 text-xs text-gris">{TYPE_LABEL[a.type]} · {a.lieu}</div>
                </div>
                <ArrowRightIcon className="h-5 w-5 shrink-0 text-gris" />
              </div>
              <ul className="mt-3 list-inside list-decimal space-y-0.5 text-sm text-encre">
                {a.ordreDuJour.slice(0, 3).map((pt, i) => <li key={i}>{pt}</li>)}
              </ul>
            </div>
          </button>
        ))}
      </div>

      <NouvelleAssembleeModal open={creer} onClose={() => setCreer(false)} onCreated={charger} />
    </div>
  );
}

export default Assemblees;
