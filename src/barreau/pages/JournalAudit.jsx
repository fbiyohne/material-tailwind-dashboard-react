import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, ShieldExclamationIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, useToast, TableSkeleton, ErrorState, EmptyState } from "../components";
import { formatDateTime } from "../utils/format";
import { listerAudit } from "../api/resources";

const PAGE_SIZE = 10;

const initiales = (nom = "") =>
  nom.replace(/^me\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join("").toUpperCase() || "?";
const estSysteme = (a) => !a || /^syst/i.test(a);

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
  const [nonce, setNonce] = useState(0);

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
  }, [q, from, to, page, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetPage = (setter) => (e) => { setter(e.target.value); setPage(1); };
  const reinitialiser = () => { setQ(""); setFrom(""); setTo(""); setPage(1); };

  const totalPages = useMemo(() => (data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1), [data]);
  const items = data?.items ?? [];
  const filtreActif = !!(q || from || to);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Système" titre="Journal d'audit" sousTitre="Traçabilité des actions sensibles (RG-16) : qui a fait quoi, et quand.">
        {data && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-grisM bg-white px-3 py-1 text-xs text-gris">
            <ShieldCheckIcon className="h-4 w-4 text-or-fonce" />
            <span className="font-mono font-semibold text-encre">{data.total}</span> action{data.total > 1 ? "s" : ""}{filtreActif ? " (filtrées)" : " enregistrées"}
          </span>
        )}
      </PageHeader>

      {/* Barre de filtres */}
      <div className="bpn-card p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
            <input type="text" value={q} onChange={resetPage(setQ)} placeholder="Rechercher une action, un acteur, une cible, une IP…" className="bpn-input pl-9" />
          </div>
          <label className="flex items-center gap-2 text-xs text-gris">Du <input type="date" lang="fr-FR" value={from} onChange={resetPage(setFrom)} className="bpn-input !w-auto !py-1.5" /></label>
          <label className="flex items-center gap-2 text-xs text-gris">Au <input type="date" lang="fr-FR" value={to} onChange={resetPage(setTo)} className="bpn-input !w-auto !py-1.5" /></label>
          {filtreActif && (
            <button type="button" onClick={reinitialiser} className="bpn-btn bpn-btn-ghost bpn-btn-sm shrink-0">Réinitialiser</button>
          )}
        </div>
      </div>

      <div className="bpn-card overflow-hidden">
        {chargement ? (
          <div className="p-4"><TableSkeleton rows={8} cols={6} /></div>
        ) : erreur ? (
          <div className="p-6"><ErrorState title="Indisponible" description="Le journal d'audit n'a pas pu être chargé." onRetry={() => setNonce((n) => n + 1)} /></div>
        ) : items.length === 0 ? (
          <div className="p-6"><EmptyState icon={ShieldExclamationIcon} title="Aucune entrée" description={filtreActif ? "Aucune action ne correspond à ce filtre." : "Aucune action enregistrée."} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="bpn-table">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="w-px whitespace-nowrap">Date & heure</th>
                  <th>Acteur</th>
                  <th>Action</th>
                  <th>Cible</th>
                  <th>Adresse IP</th>
                  <th className="text-right">Résultat</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => {
                  const echec = e.statut >= 400;
                  const sys = estSysteme(e.acteur);
                  return (
                    <tr key={e.id} className={echec ? "bg-rougeL/30" : undefined}>
                      <td className="whitespace-nowrap font-mono text-xs text-gris">{formatDateTime(e.quand)}</td>
                      <td>
                        <span className="flex items-center gap-2">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-2xs font-bold ${sys ? "bg-grisM text-gris" : "bg-navy/10 text-navy"}`}>
                            {sys ? "SYS" : initiales(e.acteur)}
                          </span>
                          <span className="font-medium text-encre">{e.acteur}</span>
                        </span>
                      </td>
                      <td className="text-encre/90">{e.action}</td>
                      <td>{e.cible ? <span className="rounded bg-grisL px-1.5 py-0.5 font-mono text-xs text-or-fonce">{e.cible}</span> : <span className="text-gris">—</span>}</td>
                      <td>{e.ip ? <span className="font-mono text-xs text-gris">{e.ip}</span> : <span className="text-gris">—</span>}</td>
                      <td className="text-right" title={`Code HTTP ${e.statut}`}>
                        <Badge ton={echec ? "rouge" : "vert"} dot={false}>{echec ? "Échec" : "Réussi"}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-xs text-gris">
          <span>Page {page} / {totalPages}</span>
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
