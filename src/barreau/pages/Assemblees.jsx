import { useMemo, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, DocumentModal } from "../components";
import { useBarreau } from "../store/BarreauStore";
import { eligibiliteElectorale } from "../data/derivations";

const TYPE_LABEL = { AGO: "Assemblée Générale Ordinaire", AGE: "Assemblée Générale Extraordinaire" };
const fmt = (d) => new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

function NouvelleAssembleeModal({ open, onClose }) {
  const { creerAssemblee } = useBarreau();
  const [form, setForm] = useState({ type: "AGO", date: "", lieu: "Palais de Justice — Pointe-Noire", odj: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valider = () => {
    if (!form.date) return;
    creerAssemblee({
      type: form.type, date: form.date, lieu: form.lieu,
      ordreDuJour: form.odj.split("\n").map((s) => s.trim()).filter(Boolean),
    });
    onClose();
    setForm({ type: "AGO", date: "", lieu: "Palais de Justice — Pointe-Noire", odj: "" });
  };
  return (
    <Modal open={open} onClose={onClose} title="Convoquer une assemblée générale"
      footer={<button className="bpn-btn bpn-btn-primary" onClick={valider}>Créer l'assemblée</button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="bpn-label">Type</span>
            <select value={form.type} onChange={set("type")} className="bpn-input mt-1">
              <option value="AGO">AGO — Ordinaire</option>
              <option value="AGE">AGE — Extraordinaire</option>
            </select></label>
          <label className="block"><span className="bpn-label">Date</span>
            <input type="date" value={form.date} onChange={set("date")} className="bpn-input mt-1" /></label>
        </div>
        <label className="block"><span className="bpn-label">Lieu</span>
          <input value={form.lieu} onChange={set("lieu")} className="bpn-input mt-1" /></label>
        <label className="block"><span className="bpn-label">Ordre du jour (une ligne par point)</span>
          <textarea rows={4} value={form.odj} onChange={set("odj")} className="bpn-input mt-1" /></label>
      </div>
    </Modal>
  );
}

/** Suivi du quorum — base = corps électoral, majorité simple requise. */
function Quorum({ electeurs }) {
  const requis = Math.floor(electeurs / 2) + 1;
  const [present, setPresent] = useState(0);
  const atteint = present >= requis;
  return (
    <div className="mt-3 rounded border border-grisM bg-grisL/40 p-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div><span className="text-gris">Corps électoral : </span><span className="font-medium">{electeurs}</span></div>
        <div><span className="text-gris">Quorum requis : </span><span className="font-medium">{requis}</span></div>
        <label className="flex items-center gap-2">
          <span className="text-gris">Présents :</span>
          <input type="number" min={0} max={electeurs} value={present}
            onChange={(e) => setPresent(Math.max(0, Math.min(electeurs, Number(e.target.value))))}
            className="bpn-input w-20 !py-1" />
        </label>
        <Badge ton={atteint ? "vert" : "rouge"}>{atteint ? "Quorum atteint" : "Quorum non atteint"}</Badge>
      </div>
    </div>
  );
}

export function Assemblees() {
  const { assemblees, membres, archiver } = useBarreau();
  const [creer, setCreer] = useState(false);
  const [convocation, setConvocation] = useState(null);

  const electeurs = useMemo(
    () => membres.filter((m) => m.qualite !== "stagiaire" && eligibiliteElectorale(m, 2026).eligible).length,
    [membres]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="bpn-eyebrow">Institutionnel</div>
          <h2 className="bpn-title mt-2">Assemblées générales</h2>
          <p className="mt-1 text-sm text-gris">
            AGO et AGE — convocation du corps électoral, suivi du quorum et décisions.
          </p>
        </div>
        <button className="bpn-btn bpn-btn-or" onClick={() => setCreer(true)}>
          <PlusIcon className="h-4 w-4" /> Nouvelle assemblée
        </button>
      </div>

      <div className="space-y-4">
        {assemblees.map((a) => (
          <div key={a.id} className="bpn-card p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <Badge ton={a.type === "AGE" ? "rouge" : "bleu"} dot={false}>{a.type}</Badge>
                  <span className="font-display text-lg capitalize text-navy">{fmt(a.date)}</span>
                </div>
                <div className="mt-1 text-xs text-gris">{TYPE_LABEL[a.type]} · {a.lieu}</div>
              </div>
              <button className="bpn-btn bpn-btn-ghost !py-1.5 text-[11px]" onClick={() => setConvocation(a)}>
                Convocation
              </button>
            </div>
            <ul className="mt-3 list-inside list-decimal space-y-0.5 text-sm text-encre">
              {a.ordreDuJour.map((pt, i) => <li key={i}>{pt}</li>)}
            </ul>
            <Quorum electeurs={electeurs} />
          </div>
        ))}
      </div>

      <NouvelleAssembleeModal open={creer} onClose={() => setCreer(false)} />

      <DocumentModal
        open={!!convocation}
        onClose={() => setConvocation(null)}
        title="Convocation à l'Assemblée Générale"
        reference={convocation ? `${convocation.type} du ${new Date(convocation.date).toLocaleDateString("fr-FR")}` : ""}
        date={convocation?.date}
        onArchive={() => convocation && archiver({ categorie: "Convocation (AG)", titre: `Convocation ${convocation.type} du ${convocation.date}`, reference: convocation.date, date: convocation.date })}
      >
        {convocation && (
          <>
            <p>
              Le Bâtonnier a l'honneur de convoquer l'ensemble des membres du corps électoral du
              Barreau de Pointe-Noire à l'<strong>{TYPE_LABEL[convocation.type]}</strong> qui se
              tiendra le <strong>{new Date(convocation.date).toLocaleDateString("fr-FR")}</strong>, au{" "}
              <strong>{convocation.lieu}</strong>.
            </p>
            <p className="mt-3 font-medium">Ordre du jour :</p>
            <ol className="mt-1 list-inside list-decimal">
              {convocation.ordreDuJour.map((pt, i) => <li key={i}>{pt}</li>)}
            </ol>
            <p className="mt-3 text-[12px] text-gris">
              Le quorum requis est de la majorité des {electeurs} membres du corps électoral.
            </p>
          </>
        )}
      </DocumentModal>
    </div>
  );
}

export default Assemblees;
