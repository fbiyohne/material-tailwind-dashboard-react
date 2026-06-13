import { useMemo, useState } from "react";
import { MagnifyingGlassIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import { Badge } from "../components";
import { useBarreau } from "../store/BarreauStore";

export function Archives() {
  const { archives } = useBarreau();
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("toutes");

  const categories = useMemo(
    () => ["toutes", ...Array.from(new Set(archives.map((a) => a.categorie)))],
    [archives]
  );

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return archives.filter((a) => {
      if (categorie !== "toutes" && a.categorie !== categorie) return false;
      if (!q) return true;
      return (
        a.titre.toLowerCase().includes(q) ||
        String(a.reference).toLowerCase().includes(q)
      );
    });
  }, [archives, recherche, categorie]);

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
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Catégorie</th>
                <th className="px-3 py-2.5 font-medium">Document</th>
                <th className="px-3 py-2.5 font-medium">Référence</th>
                <th className="px-3 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((a, i) => (
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
              {lignes.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-gris">Aucun document archivé pour ce filtre.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-grisM px-4 py-2.5 text-xs text-gris">
          {lignes.length} document{lignes.length > 1 ? "s" : ""} archivé{lignes.length > 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

export default Archives;
