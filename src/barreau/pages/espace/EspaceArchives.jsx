import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon, ArchiveBoxIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, useToast, TableSkeleton, ErrorState, EmptyState } from "../../components";
import { formatDate } from "../../utils/format";
import { getEspaceArchives } from "../../api/resources";

/** Espace avocat — registre des documents officiels consultables (lecture seule). */
export function EspaceArchives() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("");

  const charger = () => {
    setErreur(false);
    getEspaceArchives().then(setData).catch((e) => { setErreur(true); toast.error(e.message); });
  };
  useEffect(() => { charger(); /* eslint-disable-line */ }, []);

  const lignes = useMemo(() => {
    if (!data) return [];
    const q = recherche.trim().toLowerCase();
    return data.archives.filter((a) =>
      (!categorie || a.categorie === categorie) &&
      (!q || a.titre.toLowerCase().includes(q) || (a.reference ?? "").toLowerCase().includes(q))
    );
  }, [data, recherche, categorie]);

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Les archives n'ont pas pu être chargées." onRetry={charger} /></div>;
  if (!data) return <div className="bpn-card p-6"><TableSkeleton rows={6} cols={3} /></div>;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mon espace" titre="Archives officielles" sousTitre="Documents institutionnels du Barreau et pièces vous concernant." />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un titre ou une référence…" className="bpn-input pl-9" />
        </div>
        {data.categories.length > 0 && (
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="bpn-input w-auto text-sm">
            <option value="">Toutes les catégories</option>
            {data.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      <div className="bpn-card">
        <div className="bpn-card-header">
          <span className="bpn-card-heading">Registre documentaire</span>
          <span className="font-mono text-xs text-gris">{lignes.length}</span>
        </div>
        {lignes.length === 0 ? (
          <div className="p-4"><EmptyState icon={ArchiveBoxIcon} title="Aucun document" description={recherche || categorie ? "Aucun document ne correspond à votre recherche." : "Aucun document officiel disponible pour l'instant."} /></div>
        ) : (
          <ul className="divide-y divide-grisL">
            {lignes.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge ton="gris" dot={false}>{a.categorie}</Badge>
                    <span className="text-sm text-encre">{a.titre}</span>
                  </div>
                  {a.reference && <div className="mt-0.5 font-mono text-xs text-or">{a.reference}</div>}
                </div>
                <span className="shrink-0 text-xs text-gris">{formatDate(a.date ?? a.archiveLe)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default EspaceArchives;
