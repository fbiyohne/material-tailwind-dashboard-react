import { useMemo, useState } from "react";
import { Badge, StatCard, SortTh, Pagination } from "../components";
import { useBarreau } from "../store/BarreauStore";
import { useDataTable } from "../hooks/useDataTable";
import { ligneDroit } from "../data/droits";
import { STATUT_META } from "../data/derivations";
import { EXERCICES } from "../data/dashboard-data";
import { formatFCFA } from "../utils/format";

const ACCESSORS = {
  num: (l) => l.membre.num,
  nom: (l) => l.membre.nom.toLowerCase(),
  paye: (l) => l.paye,
  solde: (l) => l.solde,
  statut: (l) => l.statut,
};

export function DroitsPlaidoirie() {
  const { membres, parametres } = useBarreau();
  const [exercice, setExercice] = useState(2026);

  const { lignes, totaux } = useMemo(() => {
    const lignes = membres
      .filter((m) => m.qualite === "avocat")
      .map((m) => ligneDroit(m, exercice));
    const totaux = lignes.reduce(
      (acc, l) => ({ du: acc.du + l.du, paye: acc.paye + l.paye, solde: acc.solde + l.solde }),
      { du: 0, paye: 0, solde: 0 }
    );
    return { lignes, totaux };
  }, [membres, exercice, parametres]);

  const { rows, total, page, setPage, totalPages, sortKey, sortDir, toggleSort } = useDataTable(lignes, {
    accessors: ACCESSORS, pageSize: 10, initialSort: { key: "num", dir: "asc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="bpn-eyebrow">Finances</div>
          <h2 className="bpn-title mt-2">Droits de plaidoirie</h2>
          <p className="mt-1 text-sm text-gris">
            Suivi des droits par avocat et par exercice — états individuels et généraux.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="bpn-label mr-1">Exercice</span>
          {EXERCICES.map((a) => (
            <button key={a} type="button" onClick={() => setExercice(a)}
              className={`rounded px-3 py-1 font-mono text-xs transition ${a === exercice ? "bg-navy text-white" : "bg-grisL text-gris hover:bg-grisM"}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Droits dus" value={formatFCFA(totaux.du)} accent="navy" />
        <StatCard label="Droits perçus" value={formatFCFA(totaux.paye)} accent="vert" />
        <StatCard label="Arriérés" value={formatFCFA(totaux.solde)} accent="rouge" />
      </div>

      <div className="bpn-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-[9px] uppercase tracking-[0.1em] text-white/90">
                <SortTh label="N°" sortKey="num" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Avocat" sortKey="nom" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 font-medium">Droit dû</th>
                <SortTh label="Perçu" sortKey="paye" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Solde" sortKey="solde" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Statut" sortKey="statut" current={sortKey} dir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const meta = STATUT_META[l.statut];
                return (
                  <tr key={l.membre.id} className="border-b border-grisL hover:bg-grisL/60">
                    <td className="px-3 py-2.5 font-mono text-xs text-gris">{l.membre.num}</td>
                    <td className="px-3 py-2.5 font-medium">Me {l.membre.nom}</td>
                    <td className="px-3 py-2.5">{formatFCFA(l.du)}</td>
                    <td className="px-3 py-2.5" style={{ color: l.paye ? "var(--bpn-vert)" : "var(--bpn-gris)" }}>
                      {l.paye ? formatFCFA(l.paye) : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-medium" style={{ color: l.solde ? "var(--bpn-rouge)" : "var(--bpn-vert)" }}>
                      {l.solde ? formatFCFA(l.solde) : "✓ Soldé"}
                    </td>
                    <td className="px-3 py-2.5"><Badge ton={meta.ton}>{meta.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} libelle="avocats" />
      </div>
    </div>
  );
}

export default DroitsPlaidoirie;
