import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Badge, StatutBadge, AttestationModal, SortTh, Pagination } from "../components";
import { useBarreau } from "../store/BarreauStore";
import { useDataTable } from "../hooks/useDataTable";
import { statutCotisation, STATUT_META, QUALITE_LABEL } from "../data/derivations";

const EXERCICE_COURANT = 2026;
const FILTRES = [
  { value: "tous", label: "Tous les statuts" },
  { value: "inscrit", label: "Inscrit" },
  { value: "suspendu", label: "Suspendu" },
  { value: "omis", label: "Omis" },
  { value: "radie", label: "Radié" },
  { value: "honoraire", label: "Honoraire" },
];

const ACCESSORS = {
  num: (m) => m.num,
  nom: (m) => m.nom.toLowerCase(),
  cabinet: (m) => m.cabinet.toLowerCase(),
  statut: (m) => m.statut,
};

export function Avocats() {
  const { membres } = useBarreau();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [attestation, setAttestation] = useState(null);

  const filtre = params.get("statut") || "tous";
  const recherche = params.get("q") || "";
  const setParam = (k, v, vide) =>
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (v && v !== vide) p.set(k, v);
      else p.delete(k);
      return p;
    }, { replace: true });

  const avocats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return membres
      .filter((m) => m.qualite !== "stagiaire")
      .filter((m) => (filtre === "tous" ? true : m.statut === filtre))
      .filter((m) => (!q ? true : m.nom.toLowerCase().includes(q) || m.cabinet.toLowerCase().includes(q) || String(m.num).includes(q)));
  }, [membres, recherche, filtre]);

  const { rows, total, page, setPage, totalPages, sortKey, sortDir, toggleSort } = useDataTable(avocats, {
    accessors: ACCESSORS, pageSize: 10, initialSort: { key: "num", dir: "asc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="bpn-eyebrow">Membres</div>
        <h2 className="bpn-title mt-2">Avocats inscrits</h2>
        <p className="mt-1 text-sm text-gris">Tableau du Barreau — recherche multicritères, fiche individuelle et attestation d'inscription.</p>
      </div>

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
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-[9px] uppercase tracking-[0.1em] text-white/90">
                <SortTh label="N°" sortKey="num" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Avocat" sortKey="nom" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Cabinet" sortKey="cabinet" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 font-medium">Qualité</th>
                <SortTh label="Statut" sortKey="statut" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 font-medium">Cotisation {EXERCICE_COURANT}</th>
                <th className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const meta = STATUT_META[statutCotisation(m, EXERCICE_COURANT)];
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
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-gris">Aucun avocat ne correspond à la recherche.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} libelle="avocats" />
      </div>

      <AttestationModal membre={attestation} onClose={() => setAttestation(null)} />
    </div>
  );
}

export default Avocats;
