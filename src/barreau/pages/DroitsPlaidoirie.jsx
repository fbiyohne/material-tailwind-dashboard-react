import { useCallback, useEffect, useMemo, useState } from "react";
import { BanknotesIcon, ArrowDownTrayIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { Badge, StatCard, SortTh, Pagination, PaiementModal, useToast, EtatImprimable } from "../components";
import { useDataTable } from "../hooks/useDataTable";
import { STATUT_META } from "../data/derivations";
import { EXERCICES, EXERCICE_COURANT } from "../data/dashboard-data";
import { formatFCFA } from "../utils/format";
import { exporterExcel, exporterPdf } from "../utils/exports";
import { getDroits } from "../api/resources";

const ENTETE_ETAT = ["N°", "Avocat", "Dû", "Perçu", "Solde", "Statut"];

const ACCESSORS = {
  num: (l) => l.membre.num,
  nom: (l) => l.membre.nom.toLowerCase(),
  paye: (l) => l.paye,
  solde: (l) => l.solde,
  statut: (l) => l.statut,
};

export function DroitsPlaidoirie() {
  const toast = useToast();
  const [exercice, setExercice] = useState(EXERCICE_COURANT);
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

  const lignesEtat = useMemo(
    () => lignes.map((l) => [
      l.membre.num, `Me ${l.membre.nom}`, formatFCFA(l.du),
      l.paye ? formatFCFA(l.paye) : "—", l.solde ? formatFCFA(l.solde) : "Soldé", STATUT_META[l.statut].label,
    ]),
    [lignes]
  );
  const totauxEtat = ["", "TOTAUX", formatFCFA(totaux.du), formatFCFA(totaux.paye), formatFCFA(totaux.solde), ""];

  const exporterEtat = (fmt) => {
    if (lignes.length === 0) { toast.error("Aucune ligne à exporter pour cet exercice."); return; }
    const nom = `etat-droits-plaidoirie-${exercice}`;
    if (fmt === "xlsx") exporterExcel(nom, [ENTETE_ETAT, ...lignesEtat, totauxEtat], `Droits ${exercice}`);
    else exporterPdf(nom, "#etat-droits");
  };

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
          <button className="bpn-btn bpn-btn-ghost !py-1.5 text-[11px]" onClick={() => exporterEtat("pdf")}>
            <PrinterIcon className="h-4 w-4" /> État PDF
          </button>
          <button className="bpn-btn bpn-btn-or !py-1.5 text-[11px]" onClick={() => exporterEtat("xlsx")}>
            <ArrowDownTrayIcon className="h-4 w-4" /> Excel
          </button>
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
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-gris">Aucun avocat à afficher pour cet exercice.</td></tr>
              )}
              {rows.map((l) => {
                const meta = STATUT_META[l.statut];
                return (
                  <tr key={l.membre.id} className="border-b border-grisL hover:bg-grisL/60">
                    <td className="px-3 py-2.5 font-mono text-xs text-gris">{l.membre.num}</td>
                    <td className="px-3 py-2.5 font-medium">Me {l.membre.nom}</td>
                    <td className="px-3 py-2.5">{formatFCFA(l.du)}</td>
                    <td className={`px-3 py-2.5 ${l.paye ? "text-vert" : "text-gris"}`}>
                      {l.paye ? formatFCFA(l.paye) : "—"}
                    </td>
                    <td className={`px-3 py-2.5 font-medium ${l.solde ? "text-rouge" : "text-vert"}`}>
                      {l.solde ? formatFCFA(l.solde) : "✓ Soldé"}
                    </td>
                    <td className="px-3 py-2.5"><Badge ton={meta.ton}>{meta.label}</Badge></td>
                    <td className="px-3 py-2.5 text-right">
                      {l.solde > 0 ? (
                        <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-[10px]" onClick={() => setPaiement(l)}>
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

      <EtatImprimable id="etat-droits" titre="État des droits de plaidoirie" sousTitre={`Exercice ${exercice}`} entete={ENTETE_ETAT} lignes={lignesEtat} totaux={totauxEtat} />

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
