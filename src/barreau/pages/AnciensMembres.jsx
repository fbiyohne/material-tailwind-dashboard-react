import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MagnifyingGlassIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { PageHeader, DataTable, Notice, useToast } from "../components";
import { useAuth } from "../auth/AuthContext";
import { QUALITE_LABEL } from "../data/derivations";
import { formatDate } from "../utils/format";
import { versDelimite, telechargerTexte } from "../utils/exportCsv";
import { exporterExcel } from "../utils/exports";
import { listerMembres, telechargerAvocatsPdf, journaliserExport } from "../api/resources";
import { MenuExport, mention } from "./Avocats";

// Motifs de sortie = valeurs serveur de STATUTS_SORTIS. La radiation n'est proposée qu'aux
// profils habilités à la discipline : le serveur refuse ce filtre aux autres (R-62).
const MOTIFS = [
  { value: "RADIE", label: "Radiation", disc: true },
  { value: "DECEDE", label: "Décès" },
  { value: "DEMISSIONNAIRE", label: "Démission" },
  { value: "RETRAITE", label: "Retraite" },
  { value: "CESSATION", label: "Cessation d'activité" },
];

// Clause CL-ANCIENS-MEMBRES de l'avis juridique M-20261011 (docs/juridique/clauses-congres.md), mot pour mot.
export const CL_ANCIENS_MEMBRES =
  "Registre des avocats sortis du tableau, en consultation seule. Le motif disciplinaire n'est visible que des personnes habilitées. Chaque consultation et chaque export sont tracés.";

// Le motif et la date viennent du serveur (motifSortie / dateSortie), déjà masqués selon R-62.
const COLONNES_EXPORT = [
  { label: "N° inscription", valeur: (m) => m.numInscription },
  { label: "Nom", valeur: (m) => m.nom },
  { label: "Qualité", valeur: (m) => QUALITE_LABEL[m.qualite] ?? m.qualite },
  { label: "Motif de sortie", valeur: (m) => m.motifSortie },
  { label: "Date de sortie", valeur: (m) => (m.dateSortie ? String(m.dateSortie).slice(0, 10) : "") },
  { label: "Cabinet", valeur: (m) => m.cabinet },
];

export function AnciensMembres() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const voitDiscipline = user?.role === "ADMIN" || !!user?.permissions?.includes("discipline");
  const [params, setParams] = useSearchParams();
  const [membres, setMembres] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  const recherche = params.get("q") || "";
  const motif = params.get("motif") || "";
  const du = params.get("du") || "";
  const au = params.get("au") || "";
  const setParam = (k, v) =>
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (v) p.set(k, v); else p.delete(k);
      return p;
    }, { replace: true });

  const filtres = { sortis: "1", ...(recherche ? { q: recherche } : {}), ...(motif ? { motif } : {}), ...(du ? { du } : {}), ...(au ? { au } : {}) };

  const charger = useCallback(() => {
    setChargement(true);
    setErreur(false);
    const p = { sortis: "1", ...(recherche ? { q: recherche } : {}), ...(motif ? { motif } : {}), ...(du ? { du } : {}), ...(au ? { au } : {}), pageSize: 200 };
    (async () => {
      const d = await listerMembres(p);
      const items = [...(d.items ?? [])];
      for (let page = 2; page <= (d.totalPages ?? 1); page++) items.push(...((await listerMembres({ ...p, page })).items ?? []));
      setMembres(items);
    })()
      .catch(() => setErreur(true))
      .finally(() => setChargement(false));
  }, [recherche, motif, du, au]);
  useEffect(() => { charger(); }, [charger]);

  // Journal serveur écrit AVANT de produire le fichier : pas de trace, pas d'export.
  const exporter = async (format) => {
    const libelle = ["anciens membres", motif && `motif ${motif}`, du && `du ${du}`, au && `au ${au}`, recherche && `recherche « ${recherche} »`].filter(Boolean).join(", ");
    try {
      if (format === "pdf") { await telechargerAvocatsPdf(filtres); return; } // tracé par le serveur
      await journaliserExport({ format, filtre: libelle.slice(0, 200), lignes: membres.length });
      if (format === "csv") telechargerTexte("Anciens-membres.csv", `﻿${mention()}\r\n${versDelimite(COLONNES_EXPORT, membres, ";")}`, "text/csv;charset=utf-8;");
      else if (format === "txt") telechargerTexte("Anciens-membres.txt", `${mention()}\r\n${versDelimite(COLONNES_EXPORT, membres, "\t")}`, "text/plain;charset=utf-8;");
      else await exporterExcel("Anciens-membres", [[mention()], COLONNES_EXPORT.map((c) => c.label), ...membres.map((m) => COLONNES_EXPORT.map((c) => c.valeur(m) ?? ""))], "Anciens membres");
    } catch (e) {
      toast.error(`Export impossible : ${e.message}.`);
    }
  };

  const colonnes = [
    { key: "numInscription", label: "N° inscription", sortable: true, sortValue: (m) => m.numInscription,
      cell: (m) => <span className="font-mono text-xs text-gris">{m.numInscription || "—"}</span> },
    { key: "nom", label: "Avocat", sortable: true, sortValue: (m) => m.nom,
      cell: (m) => <span className="font-medium">Me {m.nom}</span> },
    { key: "cabinet", label: "Cabinet", className: "hidden sm:table-cell", sortable: true, sortValue: (m) => m.cabinet,
      cell: (m) => <span className="text-gris">{m.cabinet || "—"}</span> },
    { key: "motif", label: "Motif de sortie", sortable: true, sortValue: (m) => m.motifSortie,
      cell: (m) => <span>{m.motifSortie}</span> },
    { key: "dateSortie", label: "Date de sortie", sortable: true, sortValue: (m) => m.dateSortie ?? "", // sans date : en dernier en tri décroissant
      cell: (m) => <span className="text-gris">{m.dateSortie ? formatDate(String(m.dateSortie).slice(0, 10)) : "—"}</span> },
    { key: "actions", label: "Actions", align: "right",
      cell: (m) => <button type="button" onClick={() => navigate(`/avocats/${m.id}`)} className="bpn-btn bpn-btn-ghost bpn-btn-sm">Fiche</button> },
  ];

  const peutExporter = !chargement && !erreur && membres.length > 0;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Membres" titre="Anciens membres" sousTitre="Registre des avocats sortis du tableau de l'Ordre.">
        {peutExporter
          ? <MenuExport libelle="Exporter" onExport={exporter} />
          : <button type="button" className="bpn-btn bpn-btn-ghost" disabled>Exporter</button>}
      </PageHeader>

      <Notice ton="or" icon={InformationCircleIcon}>{CL_ANCIENS_MEMBRES}</Notice>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-0 flex-1 sm:min-w-[14rem]">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" aria-hidden="true" />
          <input type="text" value={recherche} onChange={(e) => setParam("q", e.target.value)} placeholder="Rechercher par nom ou cabinet…" aria-label="Rechercher un ancien membre" className="bpn-input pl-9" />
        </div>
        <select value={motif} onChange={(e) => setParam("motif", e.target.value)} aria-label="Filtrer par motif de sortie" className="bpn-input sm:w-56">
          <option value="">Tous les motifs</option>
          {MOTIFS.filter((x) => !x.disc || voitDiscipline).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
        <label className="flex flex-col gap-1 text-xs text-gris sm:w-40">Sorti à partir du
          <input type="date" value={du} max={au || undefined} onChange={(e) => setParam("du", e.target.value)} className="bpn-input h-10" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gris sm:w-40">Jusqu'au
          <input type="date" value={au} min={du || undefined} onChange={(e) => setParam("au", e.target.value)} className="bpn-input h-10" />
        </label>
      </div>

      <div className="bpn-card">
        <DataTable
          columns={colonnes}
          rows={membres}
          getRowId={(m) => m.id}
          loading={chargement}
          error={erreur}
          onRetry={charger}
          emptyTitle="Aucun ancien membre"
          emptyDescription="Aucun avocat sorti du tableau ne correspond à ces critères."
          libelle="anciens membres"
          initialSort={{ key: "dateSortie", dir: "desc" }}
        />
      </div>
    </div>
  );
}

export default AnciensMembres;
