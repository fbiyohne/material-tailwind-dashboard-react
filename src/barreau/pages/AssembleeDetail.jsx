import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, PlusIcon, CheckIcon } from "@heroicons/react/24/outline";
import { Badge, DocumentModal, useToast } from "../components";
import { useBarreau } from "../store/BarreauStore";
import { eligibiliteElectorale } from "../data/derivations";

const TYPE_LABEL = { AGO: "Assemblée Générale Ordinaire", AGE: "Assemblée Générale Extraordinaire" };
const fmt = (d) => new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

function Carte({ titre, action, children }) {
  return (
    <div className="bpn-card">
      <div className="bpn-card-header"><span className="bpn-card-heading">{titre}</span>{action}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function AssembleeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { assemblees, membres, mettreAJourAssemblee, archiver } = useBarreau();
  const toast = useToast();
  const assemblee = assemblees.find((a) => a.id === Number(id));

  const electeurs = useMemo(
    () => membres.filter((m) => m.qualite !== "stagiaire" && eligibiliteElectorale(m, 2026).eligible).length,
    [membres]
  );

  const [present, setPresent] = useState(assemblee?.quorumPresent ?? 0);
  const [pv, setPv] = useState(assemblee?.pv ?? "");
  const [nouvelleDecision, setNouvelleDecision] = useState("");
  const [convocation, setConvocation] = useState(false);

  if (!assemblee) {
    return (
      <div className="py-20 text-center">
        <p className="text-gris">Assemblée introuvable.</p>
        <button className="bpn-btn bpn-btn-ghost mt-4" onClick={() => navigate("/assemblees")}>Retour</button>
      </div>
    );
  }

  const requis = Math.floor(electeurs / 2) + 1;
  const atteint = present >= requis;

  const sauverQuorum = () => {
    mettreAJourAssemblee(assemblee.id, { quorumPresent: present });
    toast.success(`Quorum enregistré : ${present}/${electeurs} (${atteint ? "atteint" : "non atteint"}).`);
  };
  const ajouterDecision = () => {
    if (!nouvelleDecision.trim()) return;
    mettreAJourAssemblee(assemblee.id, { decisions: [...(assemblee.decisions ?? []), nouvelleDecision.trim()] });
    setNouvelleDecision("");
    toast.success("Décision ajoutée.");
  };
  const sauverPv = () => {
    mettreAJourAssemblee(assemblee.id, { pv, statut: "tenue" });
    archiver({ categorie: "Procès-verbal (AG)", titre: `PV ${assemblee.type} du ${assemblee.date}`, reference: assemblee.date, date: assemblee.date });
    toast.success("Procès-verbal enregistré et archivé.");
  };

  return (
    <div className="space-y-5">
      <Link to="/assemblees" className="inline-flex items-center gap-1.5 text-sm text-gris hover:text-navy">
        <ArrowLeftIcon className="h-4 w-4" /> Retour aux assemblées
      </Link>

      <div className="bpn-card flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge ton={assemblee.type === "AGE" ? "rouge" : "bleu"} dot={false}>{assemblee.type}</Badge>
            <h2 className="font-display text-2xl capitalize text-navy">{fmt(assemblee.date)}</h2>
          </div>
          <div className="mt-1 text-xs text-gris">{TYPE_LABEL[assemblee.type]} · {assemblee.lieu}</div>
        </div>
        <button className="bpn-btn bpn-btn-ghost" onClick={() => setConvocation(true)}>Convocation</button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Carte titre="Ordre du jour">
          <ol className="list-inside list-decimal space-y-1 text-sm text-encre">
            {assemblee.ordreDuJour.map((pt, i) => <li key={i}>{pt}</li>)}
          </ol>
        </Carte>

        <Carte titre="Quorum" action={<button className="bpn-btn bpn-btn-primary !px-3 !py-1 text-[11px]" onClick={sauverQuorum}>Enregistrer</button>}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div><span className="text-gris">Corps électoral : </span><span className="font-medium">{electeurs}</span></div>
              <div><span className="text-gris">Quorum requis : </span><span className="font-medium">{requis}</span></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-gris">Présents :</span>
              <input type="number" min={0} max={electeurs} value={present} onChange={(e) => setPresent(Math.max(0, Math.min(electeurs, Number(e.target.value))))} className="bpn-input w-24 !py-1" />
              <Badge ton={atteint ? "vert" : "rouge"}>{atteint ? "Quorum atteint" : "Quorum non atteint"}</Badge>
            </label>
          </div>
        </Carte>
      </div>

      <Carte titre="Décisions">
        <div className="mb-3 flex gap-2">
          <input value={nouvelleDecision} onChange={(e) => setNouvelleDecision(e.target.value)} className="bpn-input flex-1" placeholder="Ajouter une décision adoptée…" onKeyDown={(e) => e.key === "Enter" && ajouterDecision()} />
          <button className="bpn-btn bpn-btn-or" onClick={ajouterDecision}><PlusIcon className="h-4 w-4" /> Ajouter</button>
        </div>
        {(assemblee.decisions ?? []).length === 0 ? (
          <p className="py-3 text-center text-sm text-gris">Aucune décision enregistrée.</p>
        ) : (
          <ul className="list-inside list-decimal space-y-1 text-sm text-encre">
            {assemblee.decisions.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        )}
      </Carte>

      <Carte titre="Procès-verbal" action={<button className="bpn-btn bpn-btn-or !px-3 !py-1 text-[11px]" onClick={sauverPv}><CheckIcon className="h-3.5 w-3.5" /> Enregistrer &amp; archiver</button>}>
        <textarea rows={7} value={pv} onChange={(e) => setPv(e.target.value)} className="bpn-input" placeholder="Rédiger le procès-verbal de l'assemblée…" />
      </Carte>

      <DocumentModal
        open={convocation} onClose={() => setConvocation(false)} title="Convocation à l'Assemblée Générale"
        reference={`${assemblee.type} du ${new Date(assemblee.date).toLocaleDateString("fr-FR")}`} date={assemblee.date}
        onArchive={() => archiver({ categorie: "Convocation (AG)", titre: `Convocation ${assemblee.type} du ${assemblee.date}`, reference: assemblee.date, date: assemblee.date })}
      >
        <p>Le Bâtonnier convoque les membres du corps électoral à l'<strong>{TYPE_LABEL[assemblee.type]}</strong> du{" "}
          <strong>{new Date(assemblee.date).toLocaleDateString("fr-FR")}</strong>, au <strong>{assemblee.lieu}</strong>.</p>
        <p className="mt-3 font-medium">Ordre du jour :</p>
        <ol className="mt-1 list-inside list-decimal">{assemblee.ordreDuJour.map((pt, i) => <li key={i}>{pt}</li>)}</ol>
      </DocumentModal>
    </div>
  );
}

export default AssembleeDetail;
