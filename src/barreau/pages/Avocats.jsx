import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MagnifyingGlassIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { Badge, StatutBadge, AttestationModal, SortTh, Pagination, useToast, ImportMembresModal, PageHeader, EmptyState } from "../components";
import { useAuth } from "../auth/AuthContext";
import { STATUT_META, QUALITE_LABEL } from "../data/derivations";
import { EXERCICE_COURANT } from "../data/dashboard-data";
import { listerMembres, getCotisations } from "../api/resources";

const PAGE_SIZE = 10;
const FILTRES = [
  { value: "tous", label: "Tous les statuts" },
  { value: "inscrit", label: "Inscrit" },
  { value: "suspendu", label: "Suspendu" },
  { value: "omis", label: "Omis" },
  { value: "radie", label: "Radié" },
  { value: "honoraire", label: "Honoraire" },
];

export function Avocats() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const peutImporter = user?.role === "SECRETAIRE_GENERAL" || user?.role === "ADMIN";
  const [params, setParams] = useSearchParams();
  const [attestation, setAttestation] = useState(null);
  const [importOuvert, setImportOuvert] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1, page: 1 });
  const [statutCot, setStatutCot] = useState({});
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "num", dir: "asc" });

  const filtre = params.get("statut") || "tous";
  const recherche = params.get("q") || "";
  const setParam = (k, v, vide) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (v && v !== vide) p.set(k, v);
      else p.delete(k);
      return p;
    }, { replace: true });
    setPage(1);
  };
  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  };

  // Liste paginée/triée côté serveur
  useEffect(() => {
    listerMembres({
      qualiteNot: "STAGIAIRE",
      ...(recherche ? { q: recherche } : {}),
      ...(filtre !== "tous" ? { statut: filtre.toUpperCase() } : {}),
      page, pageSize: PAGE_SIZE, sort: sort.key, order: sort.dir,
    })
      .then(setData)
      .catch((e) => toast.error(e.message));
  }, [recherche, filtre, page, sort, toast, refresh]);

  // Statut de cotisation de l'exercice courant (jointure côté client)
  useEffect(() => {
    getCotisations(EXERCICE_COURANT)
      .then((lignes) => setStatutCot(Object.fromEntries(lignes.map((l) => [l.membre.id, l.statut]))))
      .catch(() => {});
  }, [data]);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Membres" titre="Avocats inscrits" sousTitre="Tableau du Barreau — recherche multicritères, fiche individuelle et attestation d'inscription.">
        {peutImporter && (
          <button className="bpn-btn bpn-btn-ghost" onClick={() => setImportOuvert(true)}>
            <ArrowUpTrayIcon className="h-4 w-4" /> Importer (Excel/CSV)
          </button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
          <input type="text" value={recherche} onChange={(e) => setParam("q", e.target.value, "")} placeholder="Rechercher par nom, cabinet ou n°…" className="bpn-input pl-9" />
        </div>
        <select value={filtre} onChange={(e) => setParam("statut", e.target.value, "tous")} className="bpn-input sm:w-56">
          {FILTRES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      <div className="bpn-card">
        <div className="overflow-x-auto">
          <table className="bpn-table">
            <thead>
              <tr>
                <SortTh label="N°" sortKey="num" current={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortTh label="Avocat" sortKey="nom" current={sort.key} dir={sort.dir} onSort={toggleSort} />
                <SortTh label="Cabinet" sortKey="cabinet" current={sort.key} dir={sort.dir} onSort={toggleSort} />
                <th className="px-3 py-2.5 font-medium">Qualité</th>
                <SortTh label="Statut" sortKey="statut" current={sort.key} dir={sort.dir} onSort={toggleSort} />
                <th className="px-3 py-2.5 font-medium">Cotisation {EXERCICE_COURANT}</th>
                <th className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => {
                const meta = STATUT_META[statutCot[m.id] ?? "retard"];
                return (
                  <tr key={m.id} className="border-b border-grisL hover:bg-grisL/60">
                    <td className="px-3 py-2.5 font-mono text-xs text-gris">{m.num}</td>
                    <td className="px-3 py-2.5 font-medium">Me {m.nom}</td>
                    <td className="px-3 py-2.5 text-gris">{m.cabinet}</td>
                    <td className="px-3 py-2.5"><Badge ton={m.qualite === "honoraire" ? "or" : "bleu"} dot={false}>{QUALITE_LABEL[m.qualite]}</Badge></td>
                    <td className="px-3 py-2.5"><StatutBadge statut={m.statut} /></td>
                    <td className="px-3 py-2.5"><Badge ton={meta.ton}>{meta.label}</Badge></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => navigate(`/avocats/${m.id}`)} className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-[10px]">Fiche</button>
                        <button type="button" onClick={() => setAttestation(m)} className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-[10px]">Attestation</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.items.length === 0 && (
                <tr><td colSpan={7} className="p-0"><EmptyState title="Aucun avocat" description="Aucun avocat ne correspond à votre recherche." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} libelle="avocats" />
      </div>

      <AttestationModal membre={attestation} onClose={() => setAttestation(null)} />
      <ImportMembresModal open={importOuvert} onClose={() => setImportOuvert(false)} onDone={() => setRefresh((n) => n + 1)} />
    </div>
  );
}

export default Avocats;
