import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, PlusIcon, CheckIcon, ArrowDownTrayIcon, TrashIcon, ListBulletIcon, UserGroupIcon, ClipboardDocumentCheckIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { Badge, DocumentModal, useToast, useConfirm, PageHeader, Tabs, ErrorState, TableSkeleton } from "../components";
import { formatDate } from "../utils/format";
import { EXERCICE_COURANT } from "../data/dashboard-data";
import { getAssemblee, majAssemblee, getCorpsElectoral, archiverDoc, telechargerPvAgPdf, supprimerAssemblee } from "../api/resources";

const TYPE_LABEL = { AGO: "Assemblée Générale Ordinaire", AGE: "Assemblée Générale Extraordinaire" };

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
  const toast = useToast();
  const confirm = useConfirm();
  const [assemblee, setAssemblee] = useState(null);
  const [electeurs, setElecteurs] = useState(0);
  const [present, setPresent] = useState(0);
  const [pv, setPv] = useState("");
  const [nouvelleDecision, setNouvelleDecision] = useState("");
  const [convocation, setConvocation] = useState(false);

  const charger = () =>
    getAssemblee(Number(id))
      .then((a) => { setAssemblee(a); setPresent(a.quorumPresent ?? 0); setPv(a.pv ?? ""); })
      .catch(() => setAssemblee(false));

  useEffect(() => {
    charger();
    getCorpsElectoral(EXERCICE_COURANT).then((d) => setElecteurs(d.stats.electeurs)).catch(() => {});
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (assemblee === false) {
    return (
      <div className="space-y-4">
        <Link to="/assemblees" className="inline-flex items-center gap-1.5 text-sm text-gris hover:text-navy">
          <ArrowLeftIcon className="h-4 w-4" /> Retour aux assemblées
        </Link>
        <div className="bpn-card p-6">
          <ErrorState title="Assemblée introuvable" description="Cette assemblée n'existe pas ou a été supprimée." onRetry={charger} />
        </div>
      </div>
    );
  }
  if (!assemblee) return <div className="bpn-card p-6"><TableSkeleton rows={5} cols={2} /></div>;

  const dateCourte = String(assemblee.date).slice(0, 10);
  const requis = Math.floor(electeurs / 2) + 1;
  const atteint = present >= requis;

  const sauverQuorum = async () => {
    try {
      await majAssemblee(assemblee.id, { quorumPresent: present });
      toast.success(`Quorum enregistré : ${present}/${electeurs} (${atteint ? "atteint" : "non atteint"}).`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const ajouterDecision = async () => {
    if (!nouvelleDecision.trim()) return;
    try {
      const maj = await majAssemblee(assemblee.id, { decisions: [...(assemblee.decisions ?? []), nouvelleDecision.trim()] });
      setAssemblee(maj);
      setNouvelleDecision("");
      toast.success("Décision ajoutée.");
    } catch (e) {
      toast.error(e.message);
    }
  };
  const sauverPv = async () => {
    try {
      await majAssemblee(assemblee.id, { pv, statut: "tenue" });
      await archiverDoc({ categorie: "Procès-verbal (AG)", titre: `PV ${assemblee.type} du ${dateCourte}`, reference: dateCourte, date: dateCourte });
      toast.success("Procès-verbal enregistré et archivé.");
    } catch (e) {
      toast.error(e.message);
    }
  };
  const telechargerPv = async () => {
    try {
      await majAssemblee(assemblee.id, { pv, statut: "tenue" });
      await telechargerPvAgPdf(assemblee.id);
      toast.success("Procès-verbal enregistré, archivé et téléchargé (PDF).");
    } catch (e) {
      toast.error(e.message);
    }
  };
  const supprimer = async () => {
    const ok = await confirm({
      title: "Supprimer l'assemblée",
      message: "Cette assemblée convoquée sera définitivement supprimée. Continuer ?",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try {
      await supprimerAssemblee(assemblee.id);
      toast.success("Assemblée supprimée.");
      navigate("/assemblees");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={[{ label: "Assemblées générales", to: "/assemblees" }, { label: assemblee.titre || formatDate(assemblee.date) }]}
        titre={<span className="capitalize">{formatDate(assemblee.date)}</span>}
        sousTitre={
          <span className="flex flex-wrap items-center gap-2">
            <Badge ton={assemblee.type === "AGE" ? "rouge" : "bleu"} dot={false}>{assemblee.type}</Badge>
            <span>{TYPE_LABEL[assemblee.type]} · {assemblee.lieu}</span>
          </span>
        }
      >
        <button className="bpn-btn bpn-btn-ghost" onClick={() => setConvocation(true)}>Convocation</button>
        {assemblee.statut !== "tenue" && (
          <button className="bpn-btn bpn-btn-ghost text-rouge" onClick={supprimer}><TrashIcon className="h-4 w-4" /> Supprimer</button>
        )}
      </PageHeader>

      <Tabs
        tabs={[
          {
            id: "odj",
            label: "Ordre du jour",
            icon: ListBulletIcon,
            content: (
              <Carte titre="Ordre du jour">
                <ol className="list-inside list-decimal space-y-1 text-sm text-encre">
                  {assemblee.ordreDuJour.map((pt, i) => <li key={i}>{pt}</li>)}
                </ol>
              </Carte>
            ),
          },
          {
            id: "quorum",
            label: "Quorum",
            icon: UserGroupIcon,
            content: (
              <Carte titre="Quorum" action={<button className="bpn-btn bpn-btn-primary !px-3 !py-1 text-xs" onClick={sauverQuorum}>Enregistrer</button>}>
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
            ),
          },
          {
            id: "decisions",
            label: "Décisions",
            icon: ClipboardDocumentCheckIcon,
            badge: (assemblee.decisions ?? []).length || null,
            content: (
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
            ),
          },
          {
            id: "pv",
            label: "Procès-verbal",
            icon: DocumentTextIcon,
            content: (
              <Carte titre="Procès-verbal" action={
                <div className="flex gap-2">
                  <button className="bpn-btn bpn-btn-ghost !px-3 !py-1 text-xs" onClick={telechargerPv}><ArrowDownTrayIcon className="h-3.5 w-3.5" /> PDF</button>
                  <button className="bpn-btn bpn-btn-or !px-3 !py-1 text-xs" onClick={sauverPv}><CheckIcon className="h-3.5 w-3.5" /> Enregistrer &amp; archiver</button>
                </div>
              }>
                <textarea rows={7} value={pv} onChange={(e) => setPv(e.target.value)} className="bpn-input" placeholder="Rédiger le procès-verbal de l'assemblée…" />
              </Carte>
            ),
          },
        ]}
      />

      <DocumentModal
        open={convocation} onClose={() => setConvocation(false)} title="Convocation à l'Assemblée Générale"
        reference={`${assemblee.type} du ${formatDate(assemblee.date)}`} date={dateCourte}
        pdfPath={`/assemblees/${assemblee.id}/convocation/pdf`} pdfFilename={`Convocation-${assemblee.type}-${dateCourte}.pdf`}
        onArchive={() => archiverDoc({ categorie: "Convocation (AG)", titre: `Convocation ${assemblee.type} du ${dateCourte}`, reference: dateCourte, date: dateCourte })}
      >
        <p>Le Bâtonnier convoque les membres du corps électoral à l'<strong>{TYPE_LABEL[assemblee.type]}</strong> du{" "}
          <strong>{formatDate(assemblee.date)}</strong>, au <strong>{assemblee.lieu}</strong>.</p>
        <p className="mt-3 font-medium">Ordre du jour :</p>
        <ol className="mt-1 list-inside list-decimal">{assemblee.ordreDuJour.map((pt, i) => <li key={i}>{pt}</li>)}</ol>
      </DocumentModal>
    </div>
  );
}

export default AssembleeDetail;
