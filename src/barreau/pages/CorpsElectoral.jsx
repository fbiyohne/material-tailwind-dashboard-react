import { useEffect, useState } from "react";
import { PrinterIcon, ArrowDownTrayIcon, CheckBadgeIcon, NoSymbolIcon } from "@heroicons/react/24/outline";
import { StatCard, Badge, useToast, PageHeader, Tabs, SelecteurExercice, DataTable } from "../components";
import { exporterExcel } from "../utils/exports";
import { formatDate } from "../utils/format";
import { EXERCICE_COURANT } from "../data/dashboard-data";
import { getCorpsElectoral } from "../api/resources";

const MOTIF_LABEL = {
  cotisation: { label: "Cotisations non à jour", ton: "rouge" },
  statut: { label: "Suspension / radiation / omission", ton: "gris" },
};

export function CorpsElectoral() {
  const toast = useToast();
  const [exercice, setExercice] = useState(EXERCICE_COURANT);
  const [data, setData] = useState({ electeurs: [], exclusCotisation: [], exclusStatut: [] });

  useEffect(() => {
    getCorpsElectoral(exercice).then(setData).catch((e) => toast.error(e.message));
  }, [exercice, toast]);

  const { electeurs, exclusCotisation, exclusStatut } = data;

  const exporterXlsx = () => {
    const lignes = [
      ["N°", "Avocat électeur", "Cabinet", "Inscrit depuis"],
      ...electeurs.map((m, i) => [i + 1, `Me ${m.nom}`, m.cabinet, m.dateInscription ?? ""]),
    ];
    exporterExcel(`corps-electoral-${exercice}`, lignes, `Corps électoral ${exercice}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader className="bpn-no-print" eyebrow="Membres" titre="Corps électoral" sousTitre="Liste générée automatiquement : avocats inscrits, à jour de cotisations et non suspendus (RG-04 à RG-06).">
        <SelecteurExercice valeur={exercice} onChange={setExercice} />
      </PageHeader>

      {/* Statistiques (FR-CE) */}
      <div className="bpn-no-print grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Électeurs qualifiés" value={electeurs.length} sub="aptes à voter" accent="vert" />
        <StatCard label="Exclus — cotisations" value={exclusCotisation.length} sub="non à jour" accent="rouge" />
        <StatCard label="Exclus — statut" value={exclusStatut.length} sub="suspendu / radié / omis" accent="gris" />
      </div>

      <Tabs
        tabs={[
          {
            id: "liste",
            label: "Liste électorale",
            icon: CheckBadgeIcon,
            badge: electeurs.length || null,
            content: (
              <>
                <div className="bpn-no-print mb-4 flex justify-end gap-2">
                  <button type="button" onClick={() => window.print()} className="bpn-btn bpn-btn-ghost">
                    <PrinterIcon className="h-4 w-4" /> Imprimer
                  </button>
                  <button type="button" onClick={exporterXlsx} className="bpn-btn bpn-btn-or">
                    <ArrowDownTrayIcon className="h-4 w-4" /> Export Excel
                  </button>
                </div>

                {/* Liste électorale (imprimable) */}
                <div className="bpn-print-zone bpn-card">
                  <div className="bpn-card-header">
                    <span className="bpn-card-heading">
                      Liste du corps électoral {exercice} — Barreau de Pointe-Noire
                    </span>
                    <span className="font-mono text-xs text-gris">{electeurs.length} électeurs</span>
                  </div>
                  <DataTable
                    columns={[
                      { key: "num", label: "N°", sortable: true, sortValue: (m) => m._num, cell: (m) => <span className="font-mono text-xs text-gris">{m._num}</span> },
                      { key: "nom", label: "Avocat électeur", sortable: true, sortValue: (m) => m.nom, cell: (m) => <span className="font-medium">Me {m.nom}</span> },
                      { key: "cabinet", label: "Cabinet", sortable: true, sortValue: (m) => m.cabinet, cell: (m) => <span className="text-gris">{m.cabinet}</span> },
                      { key: "inscrit", label: "Inscrit depuis", sortable: true, sortValue: (m) => m.dateInscription ?? "", cell: (m) => <span className="text-xs text-gris">{formatDate(m.dateInscription)}</span> },
                    ]}
                    rows={electeurs.map((m, i) => ({ ...m, _num: i + 1 }))}
                    paginate={false}
                    emptyIcon={CheckBadgeIcon}
                    emptyTitle="Aucun électeur qualifié"
                    emptyDescription={`Aucun avocat ne remplit les conditions pour voter à l'exercice ${exercice} (inscrit, à jour de cotisations, non suspendu).`}
                  />
                </div>
              </>
            ),
          },
          {
            id: "exclusions",
            label: "Exclusions",
            icon: NoSymbolIcon,
            badge: exclusCotisation.length + exclusStatut.length || null,
            content: (
              <div className="bpn-card">
                <div className="bpn-card-header">
                  <span className="bpn-card-heading">Exclusions justifiées</span>
                </div>
                <ul className="divide-y divide-grisL">
                  {[...exclusCotisation.map((m) => ({ m, motif: "cotisation" })),
                    ...exclusStatut.map((m) => ({ m, motif: "statut" }))].map(({ m, motif }) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="font-medium text-encre">Me {m.nom}</span>
                      <Badge ton={MOTIF_LABEL[motif].ton}>{MOTIF_LABEL[motif].label}</Badge>
                    </li>
                  ))}
                  {exclusCotisation.length + exclusStatut.length === 0 && (
                    <li className="px-4 py-6 text-center text-sm text-gris">Aucune exclusion.</li>
                  )}
                </ul>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

export default CorpsElectoral;
