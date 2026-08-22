import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { PlusIcon, TrashIcon, CheckBadgeIcon, AcademicCapIcon } from "@heroicons/react/24/outline";
import { Badge } from "./Badge";
import { Notice } from "./Notice";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";
import { useAuth } from "../auth/AuthContext";
import { formatDate } from "../utils/format";
import { infoStage } from "../data/derivations";
import { listerRapportsStage, ajouterRapportStage, supprimerRapportStage, validerStage } from "../api/resources";

const vide = { periode: "", appreciation: "", note: "" };

/**
 * Suivi du stage d'un avocat stagiaire : rapports/évaluations périodiques (SG)
 * et validation de fin de stage par le Bâtonnier (passage stagiaire → avocat).
 */
export function StagePanel({ membre, onChange }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const peutGerer = ["SECRETAIRE_GENERAL", "ADMIN"].includes(user?.role);
  const peutValider = ["BATONNIER", "ADMIN"].includes(user?.role);

  const [rapports, setRapports] = useState([]);
  const [form, setForm] = useState(vide);
  const [busy, setBusy] = useState(false);
  const stage = infoStage(membre);

  const charger = useCallback(() => {
    listerRapportsStage(membre.id).then(setRapports).catch((e) => toast.error(e.message));
  }, [membre.id, toast]);
  useEffect(() => { charger(); }, [charger]);

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const ajouter = async () => {
    if (!form.periode.trim() || !form.appreciation.trim()) return;
    setBusy(true);
    try {
      await ajouterRapportStage(membre.id, form);
      setForm(vide);
      toast.success("Rapport consigné.");
      charger();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const supprimer = async (r) => {
    const ok = await confirm({ title: "Supprimer le rapport ?", message: `Le rapport « ${r.periode} » sera supprimé.`, confirmLabel: "Supprimer", danger: true });
    if (!ok) return;
    try { await supprimerRapportStage(membre.id, r.id); toast.success("Rapport supprimé."); charger(); }
    catch (e) { toast.error(e.message); }
  };

  const valider = async () => {
    if (busy) return;
    const ok = await confirm({
      title: "Valider la fin de stage ?",
      message: `Me ${membre.nom} passera du statut d'avocat stagiaire à celui d'avocat inscrit au tableau. Action réservée au Bâtonnier.`,
      confirmLabel: "Valider la fin de stage",
    });
    if (!ok) return;
    setBusy(true);
    try { await validerStage(membre.id); toast.success("Fin de stage validée — inscription au tableau des avocats."); onChange?.(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_1fr]">
      {/* Synthèse + validation */}
      <div className="bpn-card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-encre">
          <AcademicCapIcon className="h-4 w-4 text-or-fonce" /> Stage
        </div>
        <dl className="divide-y divide-grisL text-sm">
          <div className="flex justify-between gap-3 py-2"><dt className="text-gris">Maître de stage</dt><dd className="text-right font-medium text-encre">{stage?.maitreStage ?? "—"}</dd></div>
          <div className="flex justify-between gap-3 py-2"><dt className="text-gris">Prestation de serment</dt><dd className="font-medium text-encre">{stage?.debut ? formatDate(stage.debut) : "—"}</dd></div>
          <div className="flex justify-between gap-3 py-2"><dt className="text-gris">Échéance</dt><dd className="font-medium text-encre">{stage?.fin ? formatDate(stage.fin) : "—"}</dd></div>
        </dl>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs"><span className="text-gris">Progression</span><span className="font-mono text-or-fonce">{stage?.progression ?? 0}%</span></div>
          <div className="h-2 overflow-hidden rounded bg-grisM"><div className="h-full rounded" style={{ width: `${stage?.progression ?? 0}%`, backgroundColor: stage?.termine ? "var(--bpn-vert)" : "var(--bpn-or)" }} /></div>
        </div>
        {peutValider && (
          <button className="bpn-btn bpn-btn-or mt-4 w-full justify-center" onClick={valider} disabled={busy}>
            <CheckBadgeIcon className="h-4 w-4" /> {busy ? "Validation…" : "Valider la fin de stage"}
          </button>
        )}
        {!peutValider && <Notice ton="or" className="mt-4">La validation de fin de stage est un acte du Bâtonnier.</Notice>}
      </div>

      {/* Rapports / évaluations */}
      <div className="bpn-card p-5">
        <div className="mb-3 text-sm font-semibold text-encre">Rapports & évaluations</div>

        {peutGerer && (
          <div className="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-grisL bg-grisL/30 p-3 sm:grid-cols-[10rem_1fr_9rem_auto]">
            <input value={form.periode} onChange={setF("periode")} placeholder="Période (ex. T1 2026)" className="bpn-input !py-1.5 text-sm" />
            <input value={form.appreciation} onChange={setF("appreciation")} placeholder="Appréciation / compte rendu" className="bpn-input !py-1.5 text-sm" />
            <input value={form.note} onChange={setF("note")} placeholder="Mention" className="bpn-input !py-1.5 text-sm" />
            <button className="bpn-btn bpn-btn-primary !py-1.5 text-sm" disabled={busy || !form.periode.trim() || !form.appreciation.trim()} onClick={ajouter}>
              <PlusIcon className="h-4 w-4" /> Ajouter
            </button>
          </div>
        )}

        {rapports.length === 0 ? (
          <p className="py-6 text-center text-sm text-gris">Aucun rapport de stage consigné.</p>
        ) : (
          <ul className="divide-y divide-grisL">
            {rapports.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-encre">{r.periode}</span>
                    {r.note && <Badge ton="bleu" dot={false}>{r.note}</Badge>}
                    <span className="text-xs text-gris">{formatDate(r.date)}{r.auteur ? ` · ${r.auteur}` : ""}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-encre/80">{r.appreciation}</p>
                </div>
                {peutGerer && (
                  <button type="button" onClick={() => supprimer(r)} title="Supprimer" aria-label={`Supprimer le rapport ${r.periode}`} className="shrink-0 rounded p-1.5 text-gris transition hover:bg-rougeL hover:text-rouge">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

StagePanel.propTypes = {
  membre: PropTypes.object.isRequired,
  onChange: PropTypes.func,
};

export default StagePanel;
