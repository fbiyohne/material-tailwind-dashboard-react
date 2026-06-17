import { useCallback, useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon, ArchiveBoxIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, DataTable, useToast } from "../../components";
import { formatDate } from "../../utils/format";
import { getEspaceArchives } from "../../api/resources";

/** Espace avocat — registre des documents officiels consultables (lecture seule). */
export function EspaceArchives() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("");

  const charger = useCallback(() => {
    setChargement(true);
    setErreur(false);
    getEspaceArchives().then(setData).catch((e) => { setErreur(true); toast.error(e.message); }).finally(() => setChargement(false));
  }, [toast]);
  useEffect(() => { charger(); }, [charger]);

  const lignes = useMemo(() => {
    if (!data) return [];
    const q = recherche.trim().toLowerCase();
    return data.archives.filter((a) =>
      (!categorie || a.categorie === categorie) &&
      (!q || a.titre.toLowerCase().includes(q) || (a.reference ?? "").toLowerCase().includes(q))
    );
  }, [data, recherche, categorie]);

  const colonnes = [
    { key: "date", label: "Date", sortable: true, sortValue: (a) => a.date ?? a.archiveLe,
      cell: (a) => <span className="whitespace-nowrap text-xs text-gris">{formatDate(a.date ?? a.archiveLe)}</span> },
    { key: "categorie", label: "Catégorie", sortable: true, sortValue: (a) => a.categorie,
      cell: (a) => <Badge ton="gris" dot={false}>{a.categorie}</Badge> },
    { key: "titre", label: "Document", sortable: true, sortValue: (a) => a.titre.toLowerCase(),
      cell: (a) => <span className="text-encre">{a.titre}</span> },
    { key: "reference", label: "Référence",
      cell: (a) => <span className="font-mono text-xs text-or">{a.reference || "—"}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mon espace" titre="Archives officielles" sousTitre="Documents institutionnels du Barreau et pièces vous concernant." />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un titre ou une référence…" className="bpn-input pl-9" />
        </div>
        {data?.categories?.length > 0 && (
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="bpn-input w-auto text-sm">
            <option value="">Toutes les catégories</option>
            {data.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      <div className="bpn-card">
        <DataTable
          columns={colonnes}
          rows={lignes}
          getRowId={(a) => a.id}
          loading={chargement}
          error={erreur}
          onRetry={charger}
          pageSize={12}
          libelle="documents"
          initialSort={{ key: "date", dir: "desc" }}
          emptyIcon={ArchiveBoxIcon}
          emptyTitle="Aucun document"
          emptyDescription={recherche || categorie ? "Aucun document ne correspond à votre recherche." : "Aucun document officiel disponible pour l'instant."}
        />
      </div>
    </div>
  );
}

export default EspaceArchives;
