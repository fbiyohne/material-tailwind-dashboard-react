import { useCallback, useEffect, useState } from "react";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { Badge, StatCard, SortTh, Pagination, PaiementModal, useToast } from "../components";
import { useDataTable } from "../hooks/useDataTable";
import { STATUT_META } from "../data/derivations";
import { EXERCICES } from "../data/dashboard-data";
import { formatFCFA } from "../utils/format";
import { getDroits } from "../api/resources";

const ACCESSORS = {
  num: (l) => l.membre.num,
  nom: (l) => l.membre.nom.toLowerCase(),
  paye: (l) => l.paye,
  solde: (l) => l.solde,
  statut: (l) => l.statut,
};

export function DroitsPlaidoirie() {
  const toast = useToast();
  const [exercice, setExercice] = useState(2026);
  const [lignes, setLignes] = useState([]);
  const [totaux, setTotaux] = useState({ du: 0, paye: 0, solde: 0 });
  const [paiement, setPaiement] = useState(null);

  const charger = useCallback(() => {
    getDroits(exercice)
      .then((d) => { setLignes(d.lignes); setTotaux(d.totaux); })
      .catch((e) => toast.error(e.message));
  }, [exercice, toast]);
  useEffect(() => { charger(); }, [charger]);

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
          <table className="bpn-table">
            <thead>
              <tr>
                <SortTh label="N°" sortKey="num" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Avocat" sortKey="nom" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 font-medium">Droit dû</th>
                <SortTh label="Perçu" sortKey="paye" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Solde" sortKey="solde" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Statut" sortKey="statut" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 text-right font-medium">Action</th>
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
                    <td className="px-3 py-2.5 text-right">
                      {l.solde > 0 ? (
                        <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-[11px]" onClick={() => setPaiement(l)}>
                          <BanknotesIcon className="h-3.5 w-3.5" /> Encaisser
                        </button>
                      ) : (
                        <span className="text-[11px] text-vert">✓ Soldé</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} libelle="avocats" />
      </div>

      <PaiementModal
        ligne={paiement}
        exercice={exercice}
        type="droit"
        open={!!paiement}
        onClose={() => setPaiement(null)}
        onDone={charger}
      />
    </div>
  );
}

export default DroitsPlaidoirie;
