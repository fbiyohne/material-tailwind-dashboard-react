import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../components";
import { formatFCFA, ratioPct } from "../utils/format";
import { EXERCICES, prochainesEcheances, journalActivite } from "../data/dashboard-data";
import { api } from "../api/client";
import { getJournalAudit, listerReunions, listerAssemblees } from "../api/resources";

/** Échéance institutionnelle datée, format court « 14 juin ». */
const dateCourteFr = (v) => new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });

/** Affichage court d'un horodatage ISO ; laisse passer les libellés statiques. */
function formatQuand(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Sélecteur d'exercice (FR-DB-08). */
function SelecteurExercice({ valeur, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="bpn-label mr-1">Exercice</span>
      {EXERCICES.map((annee) => (
        <button key={annee} type="button" onClick={() => onChange(annee)}
          className={`rounded px-3 py-1 font-mono text-xs transition ${annee === valeur ? "bg-navy text-white" : "bg-grisL text-gris hover:bg-grisM hover:text-encre"}`}>
          {annee}
        </button>
      ))}
    </div>
  );
}

function ColonneFinance({ label, montant, total, accent }) {
  return (
    <div className="border-l-[3px] p-4" style={{ borderLeftColor: `var(--bpn-${accent})` }}>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-gris">{label}</div>
      <div className="font-display text-base font-bold" style={{ color: `var(--bpn-${accent})` }}>{formatFCFA(montant)}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded bg-grisM">
        <div className="h-full rounded transition-all duration-500" style={{ width: `${ratioPct(montant, total)}%`, backgroundColor: `var(--bpn-${accent})` }} />
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [exercice, setExercice] = useState(2026);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [journal, setJournal] = useState(null);
  const [echeances, setEcheances] = useState(null);

  useEffect(() => {
    let actif = true;
    setData(null);
    setErreur(null);
    api(`/dashboard?annee=${exercice}`)
      .then((d) => actif && setData(d))
      .catch((e) => actif && setErreur(e.message));
    return () => {
      actif = false;
    };
  }, [exercice]);

  // Journal d'audit réel (FR-DB-10 / RG-16) — repli sur l'exemple si vide.
  useEffect(() => {
    let actif = true;
    getJournalAudit(12)
      .then((j) => actif && setJournal(j))
      .catch(() => actif && setJournal([]));
    return () => {
      actif = false;
    };
  }, []);

  // Prochaines échéances réelles : réunions + assemblées à venir (FR-DB-09).
  useEffect(() => {
    let actif = true;
    const auj = new Date().toISOString().slice(0, 10);
    Promise.all([listerReunions().catch(() => []), listerAssemblees().catch(() => [])])
      .then(([reunions, assemblees]) => {
        if (!actif) return;
        const items = [
          ...reunions.map((r) => ({ date: r.date, libelle: `Réunion du Conseil${r.lieu ? ` — ${r.lieu}` : ""}` })),
          ...assemblees.map((a) => ({ date: a.date, libelle: `${a.type === "AGE" ? "Assemblée Générale Extraordinaire" : "Assemblée Générale Ordinaire"}` })),
        ]
          .filter((e) => String(e.date).slice(0, 10) >= auj)
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .slice(0, 5);
        setEcheances(items);
      });
    return () => {
      actif = false;
    };
  }, []);

  const membres = data?.membres;
  const finances = data?.finances;
  const totalDu = finances ? finances.payees + finances.impayees : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SelecteurExercice valeur={exercice} onChange={setExercice} />
      </div>

      {erreur && (
        <div className="rounded border-l-[3px] border-rouge bg-[#f4e6e6] px-4 py-2.5 text-sm text-rouge">{erreur}</div>
      )}

      {/* 4 indicateurs (données réelles de la base) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Avocats inscrits" value={membres?.inscrits ?? "…"} sub="au tableau" accent="or" valueAccent="navy" onClick={() => navigate("/avocats")} />
        <StatCard label="À jour" value={membres?.aJour ?? "…"} sub="avocats + stagiaires" accent="vert" onClick={() => navigate("/cotisations?statut=ajour")} />
        <StatCard label="En retard" value={membres?.enRetard ?? "…"} sub="relances nécessaires" accent="rouge" onClick={() => navigate("/cotisations?statut=retard")} />
        <StatCard label="Stagiaires" value={membres?.stagiaires ?? "…"} sub="en cours" accent="navy" onClick={() => navigate("/stagiaires")} />
      </div>

      {/* Situation financière */}
      <div className="bpn-card">
        <div className="bpn-card-header">
          <span className="bpn-card-heading">Situation financière {exercice}</span>
          <span className="font-mono text-xs text-gris">en FCFA</span>
        </div>
        <div className="grid grid-cols-1 divide-y divide-grisM md:grid-cols-3 md:divide-x md:divide-y-0">
          <ColonneFinance label="Cotisations payées" montant={finances?.payees ?? 0} total={totalDu} accent="vert" />
          <ColonneFinance label="Impayées" montant={finances?.impayees ?? 0} total={totalDu} accent="rouge" />
          <ColonneFinance label="Solde à recouvrer" montant={finances?.solde ?? 0} total={totalDu} accent="or" />
        </div>
      </div>

      {/* Agenda (réel) + journal d'audit (réel) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bpn-card">
          <div className="bpn-card-header"><span className="bpn-card-heading">Prochaines échéances</span></div>
          <ul className="divide-y divide-grisL">
            {(echeances && echeances.length
              ? echeances.map((e) => ({ key: `${e.date}-${e.libelle}`, date: dateCourteFr(e.date), libelle: e.libelle }))
              : prochainesEcheances.map((e) => ({ key: e.libelle, date: e.date, libelle: e.libelle }))
            ).map((e) => (
              <li key={e.key} className="flex items-center gap-3 px-4 py-3">
                <span className="w-24 shrink-0 font-mono text-[11px] text-or">{e.date}</span>
                <span className="text-sm text-encre">{e.libelle}</span>
              </li>
            ))}
            {echeances && echeances.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-gris">Aucune échéance institutionnelle à venir.</li>
            )}
          </ul>
        </div>
        <div className="bpn-card">
          <div className="bpn-card-header"><span className="bpn-card-heading">Journal d'activité</span></div>
          <ul className="divide-y divide-grisL">
            {(journal && journal.length ? journal : journalActivite).map((j, i) => (
              <li key={j.id ?? `${j.action}-${i}`} className="px-4 py-3">
                <div className="text-sm text-encre">{j.action}{j.cible ? ` ${j.cible}` : ""}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gris">
                  <span className="font-mono">{formatQuand(j.quand)}</span><span>·</span><span>{j.acteur}</span>
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
