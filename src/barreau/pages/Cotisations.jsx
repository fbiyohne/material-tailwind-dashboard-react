import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MagnifyingGlassIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, useToast, PaiementModal, SortTh, Pagination } from "../components";
import { useDataTable } from "../hooks/useDataTable";
import { EXERCICES } from "../data/dashboard-data";
import { STATUT_META, QUALITE_LABEL } from "../data/derivations";
import { formatFCFA } from "../utils/format";
import { getCotisations, getMembre, validerCotisation, lancerRelances } from "../api/resources";
import { EnvelopeIcon } from "@heroicons/react/24/outline";

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

const statutLigne = (du, paye) => (du === 0 ? "exonere" : paye <= 0 ? "retard" : paye >= du ? "ajour" : "partiel");

/** Modale d'historique des 7 exercices d'un membre (FR-COT-04). */
function HistoriqueModal({ membreId, onClose }) {
  const [membre, setMembre] = useState(null);
  useEffect(() => {
    if (membreId) getMembre(membreId).then(setMembre).catch(() => {});
    else setMembre(null);
  }, [membreId]);

  const parAnnee = useMemo(() => Object.fromEntries((membre?.cotisations ?? []).map((c) => [c.annee, c])), [membre]);

  return (
    <Modal open={!!membreId} onClose={onClose} title={membre ? `Historique — Me ${membre.nom}` : "Historique"}>
      {membre && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-gris">
              <th className="pb-2">Exercice</th><th className="pb-2">Dû</th><th className="pb-2">Payé</th><th className="pb-2">Date</th><th className="pb-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {EXERCICES.map((annee) => {
              const c = parAnnee[annee];
              const du = c?.montantDu ?? (membre.qualite === "honoraire" ? 0 : membre.qualite === "stagiaire" ? 75000 : 150000);
              const paye = c?.montantPaye ?? 0;
              const meta = STATUT_META[statutLigne(du, paye)];
              return (
                <tr key={annee} className="border-t border-grisL">
                  <td className="py-2 font-mono text-xs text-gris">{annee}</td>
                  <td className="py-2">{formatFCFA(du)}</td>
                  <td className="py-2">{paye ? formatFCFA(paye) : "—"}</td>
                  <td className="py-2 text-xs text-gris">{c?.datePaiement ? String(c.datePaiement).slice(0, 10) : "—"}</td>
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
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const exercice = Number(params.get("exercice")) || 2026;
  const filtre = params.get("statut") || "tous";
  const recherche = params.get("q") || "";

  const [lignes, setLignes] = useState([]);
  const [historique, setHistorique] = useState(null);
  const [paiement, setPaiement] = useState(null);

  const charger = useCallback(() => {
    getCotisations(exercice).then(setLignes).catch((e) => toast.error(e.message));
  }, [exercice, toast]);

  useEffect(() => { charger(); }, [charger]);

  const setParam = (k, v, vide) =>
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (v && v !== vide) p.set(k, v);
      else p.delete(k);
      return p;
    }, { replace: true });

  const validerSituation = async (l) => {
    try {
      await validerCotisation(l.membre.id, exercice, !l.valideTresoriere);
      toast.success(l.valideTresoriere ? `Validation retirée — Me ${l.membre.nom}` : `Situation validée — Me ${l.membre.nom}`);
      charger();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return lignes.filter((l) => {
      if (filtre !== "tous" && l.statut !== filtre) return false;
      if (!q) return true;
      return l.membre.nom.toLowerCase().includes(q) || (l.membre.cabinet ?? "").toLowerCase().includes(q) || String(l.membre.num).includes(q);
    });
  }, [lignes, recherche, filtre]);

  const { rows, total, page, setPage, totalPages, sortKey, sortDir, toggleSort } = useDataTable(filtrees, {
    accessors: ACCESSORS, pageSize: 10, initialSort: { key: "num", dir: "asc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="bpn-eyebrow">Finances</div>
          <h2 className="bpn-title mt-2">Cotisations ordinales</h2>
          <p className="mt-1 text-sm text-gris">Suivi des cotisations 2020–2026, recherche en temps réel et historique par avocat.</p>
        </div>
        <button
          className="bpn-btn bpn-btn-ghost"
          onClick={async () => {
            try {
              const r = await lancerRelances(exercice);
              toast.success(`${r.envoyes} relance${r.envoyes > 1 ? "s" : ""} envoyée${r.envoyes > 1 ? "s" : ""}${r.simulation ? " (simulation)" : ""}.`);
            } catch (e) { toast.error(e.message); }
          }}
        >
          <EnvelopeIcon className="h-4 w-4" /> Relancer les retardataires
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-grisM">
        {EXERCICES.map((annee) => (
          <button key={annee} type="button" onClick={() => setParam("exercice", String(annee), "2026")}
            className={`-mb-px rounded-t px-4 py-2 font-mono text-xs transition ${annee === exercice ? "border-b-2 border-or bg-white text-navy" : "text-gris hover:text-encre"}`}>
            {annee}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
          <input type="text" value={recherche} onChange={(e) => setParam("q", e.target.value, "")} placeholder="Rechercher par nom, cabinet ou n°…" className="bpn-input pl-9" />
        </div>
        <select value={filtre} onChange={(e) => setParam("statut", e.target.value, "tous")} className="bpn-input sm:w-56">
          {FILTRES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      <div className="bpn-card">
        <div className="overflow-x-auto">
          <table className="bpn-table">
            <thead>
              <tr>
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
                          <button type="button" onClick={() => setPaiement(l)} className="bpn-btn bpn-btn-or !px-2.5 !py-1 text-[10px]">Paiement</button>
                        )}
                        {l.statut === "ajour" && (l.valideTresoriere ? (
                          <button type="button" title="Validé — cliquer pour annuler" onClick={() => validerSituation(l)} className="bpn-badge bpn-badge-vert">
                            <CheckCircleIcon className="h-3.5 w-3.5" /> Validé
                          </button>
                        ) : (
                          <button type="button" title="Valider la situation (Trésorière)" onClick={() => validerSituation(l)} className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-[10px]">Valider</button>
                        ))}
                        <button type="button" onClick={() => setHistorique(l.membre.id)} className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-[10px]">Historique</button>
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

      <HistoriqueModal membreId={historique} onClose={() => setHistorique(null)} />
      <PaiementModal ligne={paiement} exercice={exercice} open={!!paiement} onClose={() => setPaiement(null)} onDone={charger} />
    </div>
  );
}

export default Cotisations;
