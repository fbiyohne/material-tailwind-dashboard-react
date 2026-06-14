import { useEffect, useState } from "react";
import { PrinterIcon, ArrowDownTrayIcon, CheckBadgeIcon, NoSymbolIcon } from "@heroicons/react/24/outline";
import { StatCard, Badge, EmptyState, useToast, PageHeader, Tabs } from "../components";
import { exporterExcel } from "../utils/exports";
import { EXERCICES, EXERCICE_COURANT } from "../data/dashboard-data";
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
        <span className="bpn-label mr-1">Exercice</span>
        {EXERCICES.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setExercice(a)}
            className={`rounded px-3 py-1 font-mono text-xs transition ${
              a === exercice ? "bg-navy text-white" : "bg-grisL text-gris hover:bg-grisM"
            }`}
          >
            {a}
          </button>
        ))}
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
                  {electeurs.length === 0 ? (
                    <EmptyState
                      icon={CheckBadgeIcon}
                      title="Aucun électeur qualifié"
                      description={`Aucun avocat ne remplit les conditions pour voter à l'exercice ${exercice} (inscrit, à jour de cotisations, non suspendu).`}
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="bpn-table">
                        <thead>
                          <tr>
                            <th className="px-3 py-2.5 font-medium">N°</th>
                            <th className="px-3 py-2.5 font-medium">Avocat électeur</th>
                            <th className="px-3 py-2.5 font-medium">Cabinet</th>
                            <th className="px-3 py-2.5 font-medium">Inscrit depuis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {electeurs.map((m, i) => (
                            <tr key={m.id} className="border-b border-grisL hover:bg-grisL/60">
                              <td className="px-3 py-2.5 font-mono text-xs text-gris">{i + 1}</td>
                              <td className="px-3 py-2.5 font-medium">Me {m.nom}</td>
                              <td className="px-3 py-2.5 text-gris">{m.cabinet}</td>
                              <td className="px-3 py-2.5 text-xs text-gris">{m.dateInscription ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
