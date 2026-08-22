import { useCallback, useEffect, useState } from "react";
import { PrinterIcon, ArrowDownTrayIcon, CheckBadgeIcon, NoSymbolIcon } from "@heroicons/react/24/outline";
import { StatCard, Badge, PageHeader, Tabs, SelecteurExercice, DataTable } from "../components";
import { exporterExcel } from "../utils/exports";
import { formatDate } from "../utils/format";
import { telechargerCsv } from "../utils/exportCsv";
import { EXERCICE_COURANT } from "../data/dashboard-data";
import { identite } from "../data/config";
import { getCorpsElectoral } from "../api/resources";

const MOTIF_LABEL = {
  cotisation: { label: "Cotisations non à jour", ton: "rouge" },
  statut: { label: "Suspension / radiation / omission", ton: "gris" },
  autre: { label: "Honoraire / autre motif", ton: "or" },
};

const COLONNES_ELECTEURS = [
  { key: "num", label: "N°", sortable: true, sortValue: (m) => m._num, cell: (m) => <span className="font-mono text-xs text-gris">{m._num}</span> },
  { key: "nom", label: "Avocat électeur", sortable: true, sortValue: (m) => m.nom, cell: (m) => <span className="font-medium">Me {m.nom}</span> },
  { key: "cabinet", label: "Cabinet", sortable: true, sortValue: (m) => m.cabinet, cell: (m) => <span className="text-gris">{m.cabinet}</span> },
  { key: "inscrit", label: "Inscrit depuis", sortable: true, sortValue: (m) => m.dateInscription ?? "", cell: (m) => <span className="text-xs text-gris">{formatDate(m.dateInscription)}</span> },
];

const COLONNES_EXCLUSIONS = [
  { key: "nom", label: "Avocat", sortable: true, sortValue: (m) => m.nom, cell: (m) => <span className="font-medium text-encre">Me {m.nom}</span> },
  { key: "cabinet", label: "Cabinet", sortable: true, sortValue: (m) => m.cabinet, cell: (m) => <span className="text-gris">{m.cabinet || "—"}</span> },
  { key: "motif", label: "Motif d'exclusion", align: "right", cell: (m) => <Badge ton={MOTIF_LABEL[m.motif].ton}>{MOTIF_LABEL[m.motif].label}</Badge> },
];

const COLONNES_CSV = [
  { label: "N°", valeur: (m) => m._num },
  { label: "Avocat électeur", valeur: (m) => `Me ${m.nom}` },
  { label: "Cabinet", valeur: (m) => m.cabinet },
  { label: "Inscrit depuis", valeur: (m) => formatDate(m.dateInscription) },
];

export function CorpsElectoral() {
  const [exercice, setExercice] = useState(EXERCICE_COURANT);
  const [data, setData] = useState({ electeurs: [], exclusCotisation: [], exclusStatut: [], exclusAutre: [] });
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  const charger = useCallback(() => {
    setChargement(true);
    setErreur(false);
    getCorpsElectoral(exercice)
      .then(setData)
      .catch(() => setErreur(true))
      .finally(() => setChargement(false));
  }, [exercice]);
  useEffect(() => { charger(); }, [charger]);

  const { electeurs, exclusCotisation, exclusStatut, exclusAutre = [] } = data;
  const electeursNum = electeurs.map((m, i) => ({ ...m, _num: i + 1 }));
  const exclusions = [
    ...exclusCotisation.map((m) => ({ ...m, _key: `c-${m.id}`, motif: "cotisation" })),
    ...exclusStatut.map((m) => ({ ...m, _key: `s-${m.id}`, motif: "statut" })),
    ...exclusAutre.map((m) => ({ ...m, _key: `a-${m.id}`, motif: "autre" })),
  ];

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
      <div className="bpn-no-print grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Électeurs qualifiés" value={electeurs.length} sub="aptes à voter" accent="vert" />
        <StatCard label="Exclus — cotisations" value={exclusCotisation.length} sub="non à jour" accent="rouge" />
        <StatCard label="Exclus — statut" value={exclusStatut.length} sub="suspendu / radié / omis" accent="gris" />
        <StatCard label="Exclus — honoraires / autre" value={exclusAutre.length} sub="non électeurs" accent="or" />
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
                  <button type="button" disabled={electeurs.length === 0}
                    onClick={() => telechargerCsv(`corps-electoral-${exercice}`, COLONNES_CSV, electeursNum)}
                    className="bpn-btn bpn-btn-ghost disabled:opacity-40">
                    <ArrowDownTrayIcon className="h-4 w-4" /> Export CSV
                  </button>
                  <button type="button" onClick={exporterXlsx} className="bpn-btn bpn-btn-ghost">
                    <ArrowDownTrayIcon className="h-4 w-4" /> Export Excel
                  </button>
                </div>

                {/* Liste électorale (imprimable) */}
                <div className="bpn-print-zone bpn-card">
                  <div className="bpn-card-header">
                    <span className="bpn-card-heading">
                      Liste du corps électoral {exercice} — {identite().denomination}
                    </span>
                    <span className="font-mono text-xs text-gris">{electeurs.length} électeurs</span>
                  </div>
                  {/* À l'écran : liste paginée (10 par page). */}
                  <div className="print:hidden">
                    <DataTable
                      columns={COLONNES_ELECTEURS}
                      rows={electeursNum}
                      loading={chargement}
                      error={erreur}
                      onRetry={charger}
                      pageSize={10}
                      libelle="électeurs"
                      emptyIcon={CheckBadgeIcon}
                      emptyTitle="Aucun électeur qualifié"
                      emptyDescription={`Aucun avocat ne remplit les conditions pour voter à l'exercice ${exercice} (inscrit, à jour de cotisations, non suspendu).`}
                    />
                  </div>
                  {/* À l'impression : liste intégrale (la pagination ne doit pas tronquer le document officiel). */}
                  {electeursNum.length > 0 && (
                    <div className="hidden print:block">
                      <DataTable
                        columns={COLONNES_ELECTEURS}
                        rows={electeursNum}
                        paginate={false}
                      />
                    </div>
                  )}
                </div>
              </>
            ),
          },
          {
            id: "exclusions",
            label: "Exclusions",
            icon: NoSymbolIcon,
            badge: exclusions.length || null,
            content: (
              <div className="bpn-card">
                <div className="bpn-card-header">
                  <span className="bpn-card-heading">Exclusions justifiées</span>
                  <span className="font-mono text-xs text-gris">{exclusions.length}</span>
                </div>
                <DataTable
                  columns={COLONNES_EXCLUSIONS}
                  rows={exclusions}
                  getRowId={(m) => m._key}
                  loading={chargement}
                  error={erreur}
                  onRetry={charger}
                  pageSize={10}
                  libelle="exclusions"
                  emptyIcon={NoSymbolIcon}
                  emptyTitle="Aucune exclusion"
                  emptyDescription="Tous les avocats inscrits remplissent les conditions pour voter."
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

export default CorpsElectoral;
