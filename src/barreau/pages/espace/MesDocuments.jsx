import { useEffect, useState } from "react";
import { ArrowDownTrayIcon, DocumentTextIcon, DocumentCheckIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, EmptyState, useToast, TableSkeleton, ErrorState } from "../../components";
import { formatFCFA, formatDate } from "../../utils/format";
import { getEspaceDocuments, telechargerEspaceRecuPdf, telechargerEspaceQuitusPdf } from "../../api/resources";

function Section({ titre, icon: Icon, vide, children, count }) {
  return (
    <div className="bpn-card">
      <div className="bpn-card-header">
        <span className="bpn-card-heading flex items-center gap-2"><Icon className="h-4 w-4 text-or" /> {titre}</span>
        <span className="font-mono text-xs text-gris">{count}</span>
      </div>
      {count === 0 ? <div className="p-4"><EmptyState title="Aucun document" description={vide} /></div> : <ul className="divide-y divide-grisL">{children}</ul>}
    </div>
  );
}

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

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mon espace" titre="Mes documents" sousTitre="Vos reçus de paiement et quitus officiels, téléchargeables en PDF." />

      <Section titre="Quitus de cotisation" icon={DocumentCheckIcon} count={docs.quitus.length} vide="Vos quitus apparaîtront ici une fois délivrés par le Secrétariat.">
        {docs.quitus.map((q) => (
          <li key={q.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="flex items-center gap-3">
              <Badge ton="bleu" dot={false}>Quitus {q.annee}</Badge>
              <span className="font-mono text-xs text-or">{q.numero}</span>
              <span className="text-xs text-gris">{formatDate(q.date)}</span>
            </span>
            <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs" onClick={() => telecharger(() => telechargerEspaceQuitusPdf(q.id, q.numero))}>
              <ArrowDownTrayIcon className="h-3.5 w-3.5" /> PDF
            </button>
          </li>
        ))}
      </Section>

      <Section titre="Reçus de paiement" icon={DocumentTextIcon} count={docs.recus.length} vide="Vos reçus apparaîtront ici après chaque paiement enregistré.">
        {docs.recus.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="flex min-w-0 items-center gap-3">
              <span className="font-mono text-xs text-or">{r.numero}</span>
              <span className="truncate text-sm text-encre">{r.objet ?? `Paiement ${r.annee}`}</span>
              <span className="shrink-0 text-xs text-gris">{formatDate(r.date)}</span>
              <span className="shrink-0 font-medium">{formatFCFA(r.montant)}</span>
            </span>
            <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs" onClick={() => telecharger(() => telechargerEspaceRecuPdf(r.id, r.numero))}>
              <ArrowDownTrayIcon className="h-3.5 w-3.5" /> PDF
            </button>
          </li>
        ))}
      </Section>
    </div>
  );
}

export default MesDocuments;
