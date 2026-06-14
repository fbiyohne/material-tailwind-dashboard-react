import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDaysIcon, ClockIcon } from "@heroicons/react/24/outline";
import { StatCard, EmptyState, PageHeader } from "../components";
import { formatFCFA, ratioPct } from "../utils/format";
import { EXERCICES, EXERCICE_COURANT } from "../data/dashboard-data";
import { api } from "../api/client";
import { getJournalAudit, getAgenda } from "../api/resources";

/** Nombre maximal de lignes rendues dans les cartes de synthèse du tableau de
 * bord (le reste est borné par un défilement interne). */
const MAX_LIGNES = 50;

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
      <div className="mb-1 text-xs uppercase tracking-wide text-gris">{label}</div>
      <div className="font-display text-2xl font-bold" style={{ color: `var(--bpn-${accent})` }}>{formatFCFA(montant)}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded bg-grisM">
        <div className="h-full rounded transition-all duration-500" style={{ width: `${ratioPct(montant, total)}%`, backgroundColor: `var(--bpn-${accent})` }} />
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [exercice, setExercice] = useState(EXERCICE_COURANT);
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

  // Prochaines échéances réelles (réunions + AG) via l'agenda — accessible à tous les rôles.
  useEffect(() => {
    let actif = true;
    getAgenda()
      .then((items) => actif && setEcheances(items))
      .catch(() => actif && setEcheances([]));
    return () => {
      actif = false;
    };
  }, []);

  const membres = data?.membres;
  const finances = data?.finances;
  const totalDu = finances ? finances.payees + finances.impayees : 0;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Secrétariat Général" titre="Tableau de bord" sousTitre="Vue d'ensemble du Barreau — membres, finances et vie institutionnelle.">
        <SelecteurExercice valeur={exercice} onChange={setExercice} />
      </PageHeader>

      {erreur && (
        <div className="rounded border-l-[3px] border-rouge bg-rougeL px-4 py-2.5 text-sm text-rouge">{erreur}</div>
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
          {echeances === null ? (
            <p className="px-4 py-6 text-center text-sm text-gris">Chargement…</p>
          ) : echeances.length === 0 ? (
            <EmptyState icon={CalendarDaysIcon} title="Aucune échéance à venir" description="Les réunions du Conseil et assemblées générales planifiées apparaîtront ici." />
          ) : (
            <>
              {/* Hauteur bornée + défilement interne : la carte ne rallonge jamais
                  la page, même avec un grand nombre d'échéances. */}
              <ul className="max-h-80 divide-y divide-grisL overflow-y-auto">
                {echeances.slice(0, MAX_LIGNES).map((e) => (
                  <li key={`${e.date}-${e.libelle}`} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-24 shrink-0 font-mono text-[11px] text-or">{dateCourteFr(e.date)}</span>
                    <span className="text-sm text-encre">{e.libelle}</span>
                  </li>
                ))}
              </ul>
              {echeances.length > MAX_LIGNES && (
                <div className="border-t border-grisL px-4 py-2 text-center text-xs text-gris">
                  {MAX_LIGNES} prochaines affichées · {echeances.length} au total
                </div>
              )}
            </>
          )}
        </div>
        <div className="bpn-card">
          <div className="bpn-card-header"><span className="bpn-card-heading">Journal d'activité</span></div>
          {journal === null ? (
            <p className="px-4 py-6 text-center text-sm text-gris">Chargement…</p>
          ) : journal.length === 0 ? (
            <EmptyState icon={ClockIcon} title="Aucune activité récente" description="Les dernières actions enregistrées dans le système s'afficheront ici." />
          ) : (
            <ul className="max-h-80 divide-y divide-grisL overflow-y-auto">
              {journal.map((j, i) => (
                <li key={j.id ?? `${j.action}-${i}`} className="px-4 py-3">
                  <div className="text-sm text-encre">{j.action}{j.cible ? ` ${j.cible}` : ""}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gris">
                    <span className="font-mono">{formatQuand(j.quand)}</span><span>·</span><span>{j.acteur}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
