import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import { Badge, SortTh, Pagination, useToast } from "../components";
import { useDataTable } from "../hooks/useDataTable";
import { listerArchives } from "../api/resources";

const ACCESSORS = {
  date: (a) => a.date,
  categorie: (a) => a.categorie.toLowerCase(),
  titre: (a) => a.titre.toLowerCase(),
};

export function Archives() {
  const toast = useToast();
  const [archives, setArchives] = useState([]);
  const [categories, setCategories] = useState(["toutes"]);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("toutes");

  useEffect(() => {
    listerArchives()
      .then((d) => {
        setArchives(d.archives.map((a) => ({ ...a, date: a.date ? String(a.date).slice(0, 10) : "" })));
        setCategories(["toutes", ...d.categories]);
      })
      .catch((e) => toast.error(e.message));
  }, [toast]);

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return archives.filter((a) => {
      if (categorie !== "toutes" && a.categorie !== categorie) return false;
      if (!q) return true;
      return a.titre.toLowerCase().includes(q) || String(a.reference).toLowerCase().includes(q);
    });
  }, [archives, recherche, categorie]);

  const { rows, total, page, setPage, totalPages, sortKey, sortDir, toggleSort } = useDataTable(lignes, {
    accessors: ACCESSORS, pageSize: 12, initialSort: { key: "date", dir: "desc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="bpn-eyebrow">Documents</div>
        <h2 className="bpn-title mt-2">Archives institutionnelles</h2>
        <p className="mt-1 text-sm text-gris">
          Tout document officiel généré est archivé automatiquement (RG-14). Recherche par
          mot-clé, catégorie et date.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
          <input type="text" value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher par titre ou référence…" className="bpn-input pl-9" />
        </div>
        <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="bpn-input sm:w-64">
          {categories.map((c) => (
            <option key={c} value={c}>{c === "toutes" ? "Toutes les catégories" : c}</option>
          ))}
        </select>
      </div>

      <div className="bpn-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-[9px] uppercase tracking-[0.1em] text-white/90">
                <SortTh label="Date" sortKey="date" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Catégorie" sortKey="categorie" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Document" sortKey="titre" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 font-medium">Référence</th>
                <th className="px-3 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={`${a.reference}-${i}`} className="border-b border-grisL hover:bg-grisL/60">
                  <td className="px-3 py-2.5 text-xs text-gris">{a.date}</td>
                  <td className="px-3 py-2.5"><Badge ton="bleu" dot={false}>{a.categorie}</Badge></td>
                  <td className="px-3 py-2.5 font-medium">{a.titre}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-or">{a.reference}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-[10px]">
                      <DocumentArrowDownIcon className="h-3.5 w-3.5" /> Consulter
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-gris">Aucun document archivé pour ce filtre.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} libelle="documents" />
      </div>
    </div>
  );
}

export default Archives;
