import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MagnifyingGlassIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, useToast, PaiementModal, SortTh, Pagination } from "../components";
import { useBarreau } from "../store/BarreauStore";
import { useDataTable } from "../hooks/useDataTable";
import { EXERCICES } from "../data/dashboard-data";
import { STATUT_META, QUALITE_LABEL, ligneCotisation } from "../data/derivations";
import { formatFCFA } from "../utils/format";

const FILTRES = [
  { value: "tous", label: "Tous les statuts" },
  { value: "ajour", label: "À jour" },
  { value: "partiel", label: "Partiel" },
  { value: "retard", label: "En retard" },
  { value: "exonere", label: "Exonéré" },
];

const ACCESSORS = {
  num: (l) => l.membre.num,
  nom: (l) => l.membre.nom.toLowerCase(),
  paye: (l) => l.montantPaye,
  solde: (l) => l.solde,
  statut: (l) => l.statut,
};

/** Modale d'historique des 7 exercices d'un membre (FR-COT-04 / FR-AV-06). */
function HistoriqueModal({ membre, onClose }) {
  return (
    <Modal open={!!membre} onClose={onClose} title={membre ? `Historique — Me ${membre.nom}` : ""}>
      {membre && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-gris">
              <th className="pb-2">Exercice</th><th className="pb-2">Dû</th><th className="pb-2">Payé</th><th className="pb-2">Date</th><th className="pb-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {EXERCICES.map((annee) => {
              const l = ligneCotisation(membre, annee);
              const meta = STATUT_META[l.statut];
              return (
                <tr key={annee} className="border-t border-grisL">
                  <td className="py-2 font-mono text-xs text-gris">{annee}</td>
                  <td className="py-2">{formatFCFA(l.montantDu)}</td>
                  <td className="py-2">{l.montantPaye ? formatFCFA(l.montantPaye) : "—"}</td>
                  <td className="py-2 text-xs text-gris">{l.datePaiement ?? "—"}</td>
                  <td className="py-2"><Badge ton={meta.ton}>{meta.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

export function Cotisations() {
  const { cotisationsExercice, estValide, basculerValidation } = useBarreau();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  // Filtres persistés dans l'URL (partageables, conservés à la navigation).
  const exercice = Number(params.get("exercice")) || 2026;
  const filtre = params.get("statut") || "tous";
  const recherche = params.get("q") || "";
  const [historique, setHistorique] = useState(null);
  const [paiement, setPaiement] = useState(null);

  const setParam = (k, v, vide) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (v && v !== vide) p.set(k, v);
        else p.delete(k);
        return p;
      },
      { replace: true }
    );

  const validerSituation = (membre) => {
    const dejaValide = estValide(membre.id, exercice);
    basculerValidation(membre.id, exercice);
    toast.success(dejaValide ? `Validation retirée — Me ${membre.nom}` : `Situation validée — Me ${membre.nom} (exercice ${exercice})`);
  };

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return cotisationsExercice(exercice).filter((l) => {
      if (filtre !== "tous" && l.statut !== filtre) return false;
      if (!q) return true;
      return l.membre.nom.toLowerCase().includes(q) || l.membre.cabinet.toLowerCase().includes(q) || String(l.membre.num).includes(q);
    });
  }, [cotisationsExercice, exercice, recherche, filtre]);

  const { rows, total, page, setPage, totalPages, sortKey, sortDir, toggleSort } = useDataTable(lignes, {
    accessors: ACCESSORS, pageSize: 10, initialSort: { key: "num", dir: "asc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="bpn-eyebrow">Finances</div>
        <h2 className="bpn-title mt-2">Cotisations ordinales</h2>
        <p className="mt-1 text-sm text-gris">Suivi des cotisations 2020–2026, recherche en temps réel et historique par avocat.</p>
      </div>

      {/* Onglets d'exercice */}
      <div className="flex flex-wrap gap-1 border-b border-grisM">
        {EXERCICES.map((annee) => (
          <button key={annee} type="button" onClick={() => setParam("exercice", String(annee), "2026")}
            className={`-mb-px rounded-t px-4 py-2 font-mono text-xs transition ${annee === exercice ? "border-b-2 border-or bg-white text-navy" : "text-gris hover:text-encre"}`}>
            {annee}
          </button>
        ))}
      </div>

      {/* Recherche + filtre */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
          <input type="text" value={recherche} onChange={(e) => setParam("q", e.target.value, "")} placeholder="Rechercher par nom, cabinet ou n°…" className="bpn-input pl-9" />
        </div>
        <select value={filtre} onChange={(e) => setParam("statut", e.target.value, "tous")} className="bpn-input sm:w-56">
          {FILTRES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {/* Tableau */}
      <div className="bpn-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-[9px] uppercase tracking-[0.1em] text-white/90">
                <SortTh label="N°" sortKey="num" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Avocat" sortKey="nom" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 font-medium">Qualité</th>
                <th className="px-3 py-2.5 font-medium">Montant dû</th>
                <SortTh label="Montant payé" sortKey="paye" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Solde" sortKey="solde" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 font-medium">Date paiement</th>
                <SortTh label="Statut" sortKey="statut" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const meta = STATUT_META[l.statut];
                return (
                  <tr key={l.membre.id} className="border-b border-grisL hover:bg-grisL/60">
                    <td className="px-3 py-2.5 font-mono text-xs text-gris">{l.membre.num}</td>
                    <td className="px-3 py-2.5 font-medium">Me {l.membre.nom}</td>
                    <td className="px-3 py-2.5"><Badge ton={l.membre.qualite === "honoraire" ? "or" : "bleu"} dot={false}>{QUALITE_LABEL[l.membre.qualite]}</Badge></td>
                    <td className="px-3 py-2.5">{formatFCFA(l.montantDu)}</td>
                    <td className="px-3 py-2.5 font-medium" style={{ color: l.statut === "ajour" ? "var(--bpn-vert)" : l.statut === "partiel" ? "var(--bpn-or)" : l.statut === "retard" ? "var(--bpn-rouge)" : "var(--bpn-gris)" }}>
                      {l.montantPaye ? formatFCFA(l.montantPaye) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {l.statut === "ajour" || l.statut === "exonere" ? <span className="font-medium text-vert">✓ Soldé</span> : <span className="font-medium text-rouge">{formatFCFA(l.solde)}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gris">{l.datePaiement ?? "—"}</td>
                    <td className="px-3 py-2.5"><Badge ton={meta.ton}>{meta.label}</Badge></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {(l.statut === "retard" || l.statut === "partiel") && (
                          <button type="button" onClick={() => setPaiement(l.membre)} className="bpn-btn bpn-btn-or !px-2.5 !py-1 text-[10px]">Paiement</button>
                        )}
                        {l.statut === "ajour" && (estValide(l.membre.id, exercice) ? (
                          <button type="button" title="Situation validée — cliquer pour annuler" onClick={() => validerSituation(l.membre)} className="bpn-badge bpn-badge-vert">
                            <CheckCircleIcon className="h-3.5 w-3.5" /> Validé
                          </button>
                        ) : (
                          <button type="button" title="Valider la situation financière (Trésorière)" onClick={() => validerSituation(l.membre)} className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-[10px]">Valider</button>
                        ))}
                        <button type="button" onClick={() => setHistorique(l.membre)} className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-[10px]">Historique</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-gris">Aucun membre ne correspond à la recherche.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} libelle="membres" />
      </div>

      <HistoriqueModal membre={historique} onClose={() => setHistorique(null)} />
      <PaiementModal membre={paiement} exercice={exercice} open={!!paiement} onClose={() => setPaiement(null)} />
    </div>
  );
}

export default Cotisations;
