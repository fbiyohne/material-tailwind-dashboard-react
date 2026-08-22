import { useEffect, useState } from "react";
import { MegaphoneIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, useToast, TableSkeleton, ErrorState, EmptyState } from "../../components";
import { formatDate } from "../../utils/format";
import { getEspacePublications } from "../../api/resources";

/** Espace avocat — communications officielles publiées du Barreau (lecture seule). */
export function EspacePublications() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [erreur, setErreur] = useState(false);

  const charger = () => {
    setErreur(false);
    getEspacePublications().then(setItems).catch((e) => { setErreur(true); toast.error(e.message); });
  };
  useEffect(() => { charger(); /* eslint-disable-line */ }, []);

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Les publications n'ont pas pu être chargées." onRetry={charger} /></div>;
  if (!items) return <div className="bpn-card p-6"><TableSkeleton rows={4} cols={2} /></div>;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mon espace" titre="Publications" sousTitre="Avis, communiqués et actualités officielles du Barreau de Pointe-Noire." />

      {items.length === 0 ? (
        <div className="bpn-card p-4"><EmptyState icon={MegaphoneIcon} title="Aucune publication" description="Les communications officielles du Barreau apparaîtront ici." /></div>
      ) : (
        items.map((p) => (
          <article key={p.id} className="bpn-card">
            <div className="bpn-card-header">
              <span className="bpn-card-heading flex items-center gap-2">
                <MegaphoneIcon className="h-4 w-4 text-or" /> {p.titre}
              </span>
              <div className="flex items-center gap-2">
                {p.type && <Badge ton="bleu" dot={false}>{p.type}</Badge>}
                <span className="text-xs text-gris">{formatDate(p.date)}</span>
              </div>
            </div>
            {p.contenu && (
              <div className="whitespace-pre-line p-4 text-sm leading-relaxed text-encre">{p.contenu}</div>
            )}
          </article>
        ))
      )}
    </div>
  );
}

export default EspacePublications;
