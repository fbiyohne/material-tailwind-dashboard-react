import { useEffect, useState } from "react";
import { ArrowDownTrayIcon, BuildingLibraryIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, useToast, TableSkeleton, ErrorState, EmptyState } from "../../components";
import { formatDate } from "../../utils/format";
import { getEspaceAssemblees, telechargerEspaceConvocationAgPdf, telechargerEspacePvAgPdf } from "../../api/resources";

const TYPE_LABEL = { AGO: "Assemblée générale ordinaire", AGE: "Assemblée générale extraordinaire" };
const STATUT_TON = { convoquee: "or", tenue: "vert", reportee: "rouge", annulee: "gris" };
const STATUT_LABEL = { convoquee: "Convoquée", tenue: "Tenue", reportee: "Reportée", annulee: "Annulée" };

/** Espace avocat — assemblées générales (lecture seule, concernent tous les membres). */
export function EspaceAssemblees() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [erreur, setErreur] = useState(false);

  const charger = () => {
    setErreur(false);
    getEspaceAssemblees().then(setItems).catch((e) => { setErreur(true); toast.error(e.message); });
  };
  useEffect(() => { charger(); /* eslint-disable-line */ }, []);

  const tele = async (fn) => { try { await fn(); } catch (e) { toast.error(e.message || "Téléchargement impossible."); } };

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Les assemblées n'ont pas pu être chargées." onRetry={charger} /></div>;
  if (!items) return <div className="bpn-card p-6"><TableSkeleton rows={4} cols={3} /></div>;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mon espace" titre="Assemblées générales" sousTitre="Convocations, ordres du jour et procès-verbaux des assemblées du Barreau." />

      {items.length === 0 ? (
        <div className="bpn-card p-4"><EmptyState icon={BuildingLibraryIcon} title="Aucune assemblée" description="Les convocations aux assemblées générales apparaîtront ici." /></div>
      ) : (
        items.map((a) => (
          <div key={a.id} className="bpn-card">
            <div className="bpn-card-header">
              <span className="bpn-card-heading flex items-center gap-2">
                <BuildingLibraryIcon className="h-4 w-4 text-or" /> {TYPE_LABEL[a.type] ?? a.type}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gris">{formatDate(a.date)}</span>
                <Badge ton={STATUT_TON[a.statut] ?? "gris"} dot={false}>{STATUT_LABEL[a.statut] ?? a.statut}</Badge>
              </div>
            </div>
            <div className="space-y-3 p-4">
              {a.lieu && <div className="text-sm text-gris">Lieu : <span className="text-encre">{a.lieu}</span></div>}
              {a.ordreDuJour?.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gris">Ordre du jour</div>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-encre">{(a.ordreDuJour ?? []).map((p, i) => <li key={i}>{p}</li>)}</ol>
                </div>
              )}
              {a.decisions?.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gris">Décisions</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-encre">{a.decisions.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs" onClick={() => tele(() => telechargerEspaceConvocationAgPdf(a.id))}>
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Convocation
                </button>
                {a.pv && (
                  <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs" onClick={() => tele(() => telechargerEspacePvAgPdf(a.id))}>
                    <DocumentTextIcon className="h-3.5 w-3.5" /> Procès-verbal
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default EspaceAssemblees;
