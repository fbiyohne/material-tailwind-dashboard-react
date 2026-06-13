import { useState } from "react";
import { StatCard } from "../components";
import { formatFCFA, ratioPct } from "../utils/format";
import {
  EXERCICES,
  dashboardParExercice,
  prochainesEcheances,
  journalActivite,
} from "../data/dashboard-data";

/** Sélecteur d'exercice (FR-DB-08) — pastilles d'années 2020 → 2026. */
function SelecteurExercice({ valeur, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="bpn-label mr-1">Exercice</span>
      {EXERCICES.map((annee) => (
        <button
          key={annee}
          type="button"
          onClick={() => onChange(annee)}
          className={`rounded px-3 py-1 font-mono text-xs transition ${
            annee === valeur
              ? "bg-navy text-white"
              : "bg-grisL text-gris hover:bg-grisM hover:text-encre"
          }`}
        >
          {annee}
        </button>
      ))}
    </div>
  );
}

/** Une colonne de la situation financière (payées / impayées / solde). */
function ColonneFinance({ label, montant, total, accent, className = "" }) {
  return (
    <div
      className={`border-l-[3px] p-4 ${className}`}
      style={{ borderLeftColor: `var(--bpn-${accent})` }}
    >
      <div className="mb-1 text-[10px] uppercase tracking-wide text-gris">{label}</div>
      <div
        className="font-display text-base font-bold"
        style={{ color: `var(--bpn-${accent})` }}
      >
        {formatFCFA(montant)}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded bg-grisM">
        <div
          className="h-full rounded transition-all duration-500"
          style={{
            width: `${ratioPct(montant, total)}%`,
            backgroundColor: `var(--bpn-${accent})`,
          }}
        />
      </div>
    </div>
  );
}

export function Dashboard() {
  const [exercice, setExercice] = useState(2025);
  const { membres, finances } = dashboardParExercice[exercice];
  const totalDu = finances.payees + finances.impayees;
  const solde = finances.impayees; // solde à recouvrer = cotisations impayées

  return (
    <div className="space-y-6">
      {/* Sélecteur d'exercice (FR-DB-08) */}
      <div className="flex justify-end">
        <SelecteurExercice valeur={exercice} onChange={setExercice} />
      </div>

      {/* 4 indicateurs membres */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Avocats inscrits"
          value={membres.inscrits}
          sub="au tableau"
          accent="or"
          valueAccent="navy"
        />
        <StatCard
          label="À jour"
          value={membres.aJour}
          sub="avocats + stagiaires"
          accent="vert"
        />
        <StatCard
          label="En retard"
          value={membres.enRetard}
          sub="relances nécessaires"
          accent="rouge"
        />
        <StatCard
          label="Stagiaires"
          value={membres.stagiaires}
          sub="en cours"
          accent="navy"
        />
      </div>

      {/* Situation financière */}
      <div className="bpn-card">
        <div className="bpn-card-header">
          <span className="bpn-card-heading">Situation financière {exercice}</span>
          <span className="font-mono text-xs text-gris">en FCFA</span>
        </div>
        <div className="grid grid-cols-1 divide-y divide-grisM md:grid-cols-3 md:divide-x md:divide-y-0">
          <ColonneFinance
            label="Cotisations payées"
            montant={finances.payees}
            total={totalDu}
            accent="vert"
          />
          <ColonneFinance
            label="Impayées"
            montant={finances.impayees}
            total={totalDu}
            accent="rouge"
          />
          <ColonneFinance
            label="Solde à recouvrer"
            montant={solde}
            total={totalDu}
            accent="or"
          />
        </div>
      </div>

      {/* Agenda + journal d'activité */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bpn-card">
          <div className="bpn-card-header">
            <span className="bpn-card-heading">Prochaines échéances</span>
          </div>
          <ul className="divide-y divide-grisL">
            {prochainesEcheances.map((e) => (
              <li key={e.libelle} className="flex items-center gap-3 px-4 py-3">
                <span className="w-24 shrink-0 font-mono text-[11px] text-or">
                  {e.date}
                </span>
                <span className="text-sm text-encre">{e.libelle}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bpn-card">
          <div className="bpn-card-header">
            <span className="bpn-card-heading">Journal d'activité</span>
          </div>
          <ul className="divide-y divide-grisL">
            {journalActivite.map((j) => (
              <li key={j.action} className="px-4 py-3">
                <div className="text-sm text-encre">{j.action}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gris">
                  <span className="font-mono">{j.quand}</span>
                  <span>·</span>
                  <span>{j.acteur}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
