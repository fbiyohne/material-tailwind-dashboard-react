import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, useToast, TableSkeleton, ErrorState, EmptyState } from "../components";
import { formatDateTime } from "../utils/format";
import { listerAudit } from "../api/resources";

const PAGE_SIZE = 25;

/**
 * Journal d'audit (RG-16) — consultation des actions sensibles, filtrable par
 * mot-clé (action / chemin / cible / acteur) et plage de dates, paginée côté
 * serveur. Réservé au SG / Bâtonnier / Admin.
 */
export function JournalAudit() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null); // { items, total, page, pageSize }
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  // Recherche/filtre avec léger debounce ; tout changement de filtre revient en page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setChargement(true);
      setErreur(false);
      listerAudit({ q, from, to, page, pageSize: PAGE_SIZE })
        .then(setData)
        .catch((e) => { setErreur(true); toast.error(e.message); })
        .finally(() => setChargement(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, from, to, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetPage = (setter) => (e) => { setter(e.target.value); setPage(1); };

  const totalPages = useMemo(() => (data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1), [data]);
  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Système" titre="Journal d'audit" sousTitre="Traçabilité des actions sensibles (RG-16) : qui a fait quoi, et quand. Recherche par mot-clé et plage de dates." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
          <input type="text" value={q} onChange={resetPage(setQ)} placeholder="Action, acteur, chemin, cible…" className="bpn-input pl-9" />
        </div>
        <label className="flex items-center gap-2 text-xs text-gris">
          Du <input type="date" lang="fr-FR" value={from} onChange={resetPage(setFrom)} className="bpn-input !w-auto !py-1.5" />
        </label>
        <label className="flex items-center gap-2 text-xs text-gris">
          Au <input type="date" lang="fr-FR" value={to} onChange={resetPage(setTo)} className="bpn-input !w-auto !py-1.5" />
        </label>
      </div>

      <div className="bpn-card overflow-hidden">
        {chargement ? (
          <div className="p-4"><TableSkeleton rows={8} cols={4} /></div>
        ) : erreur ? (
          <div className="p-6"><ErrorState title="Indisponible" description="Le journal d'audit n'a pas pu être chargé." onRetry={() => setPage((p) => p)} /></div>
        ) : items.length === 0 ? (
          <div className="p-6"><EmptyState icon={ShieldExclamationIcon} title="Aucune entrée" description={q || from || to ? "Aucune action ne correspond à ce filtre." : "Aucune action enregistrée."} /></div>
        ) : (
          <table className="bpn-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Acteur</th>
                <th>Action</th>
                <th>Cible</th>
                <th className="text-right">Statut</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-xs text-gris">{formatDateTime(e.quand)}</td>
                  <td className="font-medium text-encre">{e.acteur}</td>
                  <td className="text-encre/90">{e.action}</td>
                  <td className="font-mono text-xs text-or">{e.cible ?? "—"}</td>
                  <td className="text-right" title={`Code HTTP ${e.statut}`}>
                    <Badge ton={e.statut < 400 ? "vert" : "rouge"} dot={false}>{e.statut < 400 ? "Réussi" : "Échec"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-xs text-gris">
          <span>{data.total} action{data.total > 1 ? "s" : ""} · page {page} / {totalPages}</span>
          <div className="flex gap-1.5">
            <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 disabled:opacity-40" disabled={page <= 1 || chargement} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeftIcon className="h-4 w-4" /> Précédent
            </button>
            <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 disabled:opacity-40" disabled={page >= totalPages || chargement} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Suivant <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default JournalAudit;
