import { useEffect, useRef, useState } from "react";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { DataTable, useToast } from "../components";
import { formatFCFA } from "../utils/format";
import { statsTimbres, importerTimbresExternes } from "../api/resources";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const iso = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").trim());

/** Lit un .csv / .xlsx (colonnes reference, date, montant, canal, avocat) en lignes d'import. */
async function lireFichier(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const brut = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  return brut.map((r) => {
    const o = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), v]));
    return { reference: String(o.reference ?? "").trim(), date: iso(o.date), montant: Number(o.montant), canal: String(o.canal ?? "").trim(), avocatNom: String(o.avocat ?? "").trim() || undefined };
  });
}

/** Onglet Statistiques du timbre autonome : volumes par mois et par canal + import mensuel externe. */
export function StatsTimbres() {
  const toast = useToast();
  const champ = useRef(null);
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [lignes, setLignes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  const charger = () => {
    setChargement(true); setErreur(false);
    statsTimbres(annee).then((d) => setLignes(d.lignes.map((l, i) => ({ ...l, id: i })))).catch(() => setErreur(true)).finally(() => setChargement(false));
  };
  useEffect(charger, [annee]); // eslint-disable-line react-hooks/exhaustive-deps

  const importer = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const r = await importerTimbresExternes(await lireFichier(file));
      toast.success(`${r.importes} timbre(s) importé(s), ${r.doublons} déjà connu(s) ignoré(s).`);
      charger();
    } catch (err) { toast.error(`Import impossible : ${err.message}`); }
  };

  return (
    <div className="bpn-card">
      <div className="bpn-card-header">
        <span className="bpn-card-heading">Timbres par mois et par canal</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gris">
            Année
            <input type="number" min={2000} max={2100} value={annee} onChange={(e) => setAnnee(Number(e.target.value) || annee)} className="bpn-input w-24" />
          </label>
          <input ref={champ} type="file" accept=".csv,.xlsx,.xls" onChange={importer} className="hidden" aria-label="Fichier des timbres externes" />
          <button type="button" onClick={() => champ.current?.click()} className="bpn-btn bpn-btn-ghost">
            <ArrowUpTrayIcon className="h-4 w-4" /> Importer les timbres externes
          </button>
        </div>
      </div>
      <p className="px-5 pb-2 text-xs text-gris">Fichier CSV ou Excel : colonnes <span className="font-mono">reference, date (AAAA-MM-JJ), montant, canal, avocat</span>. Réimporter le même fichier n'ajoute aucune ligne.</p>
      <DataTable
        columns={[
          { key: "mois", label: "Mois", sortable: true, sortValue: (l) => l.mois, cell: (l) => <span className="capitalize">{MOIS[l.mois - 1]}</span> },
          { key: "canal", label: "Canal", cell: (l) => l.canal },
          { key: "source", label: "Origine", cell: (l) => (l.source === "externe" ? "Externe" : "Interne") },
          { key: "nombre", label: "Timbres", align: "right", cell: (l) => l.nombre },
          { key: "montant", label: "Montant", align: "right", cell: (l) => formatFCFA(l.montant) },
        ]}
        rows={lignes}
        loading={chargement}
        error={erreur}
        onRetry={charger}
        emptyTitle="Aucune donnée"
        emptyDescription="Aucun timbre sur cette année."
        libelle="lignes"
        initialSort={{ key: "mois", dir: "asc" }}
      />
    </div>
  );
}

export default StatsTimbres;
