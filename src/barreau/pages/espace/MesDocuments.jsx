import { useEffect, useState } from "react";
import { ArrowDownTrayIcon, DocumentTextIcon, DocumentCheckIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, EmptyState, Tabs, useToast, TableSkeleton, ErrorState } from "../../components";
import { formatFCFA, formatDate } from "../../utils/format";
import { getEspaceDocuments, telechargerEspaceRecuPdf, telechargerEspaceQuitusPdf } from "../../api/resources";

/** Espace avocat — reçus et quitus personnels, téléchargeables en PDF officiel. */
export function MesDocuments() {
  const toast = useToast();
  const [docs, setDocs] = useState(null);
  const [erreur, setErreur] = useState(false);

  const charger = () => {
    setErreur(false);
    getEspaceDocuments().then(setDocs).catch((e) => { setErreur(true); toast.error(e.message); });
  };
  useEffect(() => { charger(); /* eslint-disable-line */ }, []);

  const telecharger = async (fn) => { try { await fn(); } catch (e) { toast.error(e.message || "Téléchargement impossible."); } };

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Vos documents n'ont pas pu être chargés." onRetry={charger} /></div>;
  if (!docs) return <div className="bpn-card p-6"><TableSkeleton rows={4} cols={3} /></div>;

  const quitus = (
    <div className="bpn-card">
      {docs.quitus.length === 0 ? (
        <div className="p-4"><EmptyState icon={DocumentCheckIcon} title="Aucun quitus" description="Vos quitus apparaîtront ici une fois délivrés par le Secrétariat." /></div>
      ) : (
        <ul className="divide-y divide-grisL">
          {docs.quitus.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-3">
                <Badge ton="bleu" dot={false}>Quitus {q.annee}</Badge>
                <span className="font-mono text-xs text-or">{q.numero}</span>
                <span className="text-xs text-gris">{formatDate(q.date)}</span>
              </span>
              <button className="bpn-btn bpn-btn-ghost bpn-btn-sm" onClick={() => telecharger(() => telechargerEspaceQuitusPdf(q.id, q.numero))}>
                <ArrowDownTrayIcon className="h-3.5 w-3.5" /> PDF
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const recus = (
    <div className="bpn-card">
      {docs.recus.length === 0 ? (
        <div className="p-4"><EmptyState icon={DocumentTextIcon} title="Aucun reçu" description="Vos reçus apparaîtront ici après chaque paiement enregistré." /></div>
      ) : (
        <ul className="divide-y divide-grisL">
          {docs.recus.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="font-mono text-xs text-or">{r.numero}</span>
                <span className="truncate text-sm text-encre">{r.objet ?? `Paiement ${r.annee}`}</span>
                <span className="shrink-0 text-xs text-gris">{formatDate(r.date)}</span>
                <span className="shrink-0 font-medium">{formatFCFA(r.montant)}</span>
              </span>
              <button className="bpn-btn bpn-btn-ghost bpn-btn-sm" onClick={() => telecharger(() => telechargerEspaceRecuPdf(r.id, r.numero))}>
                <ArrowDownTrayIcon className="h-3.5 w-3.5" /> PDF
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mon espace" titre="Mes documents" sousTitre="Vos reçus de paiement et quitus officiels, téléchargeables en PDF." />
      <Tabs
        tabs={[
          { id: "quitus", label: `Quitus de cotisation (${docs.quitus.length})`, icon: DocumentCheckIcon, content: quitus },
          { id: "recus", label: `Reçus de paiement (${docs.recus.length})`, icon: DocumentTextIcon, content: recus },
        ]}
      />
    </div>
  );
}

export default MesDocuments;
