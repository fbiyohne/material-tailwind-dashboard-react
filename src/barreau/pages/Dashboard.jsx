import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDaysIcon, ClockIcon } from "@heroicons/react/24/outline";
import { StatCard, EmptyState, PageHeader, SelecteurExercice } from "../components";
import { formatFCFA, ratioPct } from "../utils/format";
import { EXERCICE_COURANT } from "../data/dashboard-data";
import { api } from "../api/client";
import { getJournalAudit, getAgenda } from "../api/resources";
import { useAuth } from "../auth/AuthContext";
import { aAcces, allModules } from "../routes";

/** En-tête du tableau de bord adapté au rôle (cadrage de la mission). */
const ENTETE = {
  SECRETAIRE_GENERAL: { eyebrow: "Secrétariat Général", sous: "Vue d'ensemble du Barreau — membres, finances et vie institutionnelle." },
  ADMIN: { eyebrow: "Administration", sous: "Vue d'ensemble du Barreau — membres, finances et vie institutionnelle." },
  TRESORIERE: { eyebrow: "Trésorerie", sous: "Suivi financier du Barreau — cotisations, recouvrement et échéances." },
  BATONNIER: { eyebrow: "Bâtonnat", sous: "Vie institutionnelle du Barreau — membres, instances et échéances." },
};

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

const QUALITE_LABEL = { AVOCAT: "Avocats", STAGIAIRE: "Stagiaires", HONORAIRE: "Honoraires" };
const STATUT_LABEL = { INSCRIT: "Inscrits", SUSPENDU: "Suspendus", OMIS: "Omis", RADIE: "Radiés", HONORAIRE: "Honoraires", STAGIAIRE: "Stagiaires" };

/** Barre de proportion (identité visuelle du Barreau : piste grise, remplissage accentué). */
function Barre({ label, valeur, max, accent = "navy" }) {
  const largeur = max > 0 ? Math.round((valeur / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 shrink-0 truncate text-gris" title={label}>{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded bg-grisM">
        <span className="block h-full rounded transition-all duration-500" style={{ width: `${largeur}%`, backgroundColor: `var(--bpn-${accent})` }} />
      </span>
      <span className="w-10 shrink-0 text-right font-mono text-navy">{valeur}</span>
    </div>
  );
}

/** Carte de synthèse démographique (composition du Barreau) — visible par tous les rôles. */
function CarteRepartition({ titre, sousTitre, lignes }) {
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  return (
    <div className="bpn-card">
      <div className="bpn-card-header">
        <span className="bpn-card-heading">{titre}</span>
        {sousTitre && <span className="text-xs text-gris">{sousTitre}</span>}
      </div>
      <div className="space-y-2.5 p-4">
        {lignes.length === 0 ? <p className="text-center text-sm text-gris">—</p> : lignes.map((l) => (
          <Barre key={l.label} label={l.label} valeur={l.valeur} max={max} accent={l.accent} />
        ))}
      </div>
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
  const { user } = useAuth();
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

  // Composition du Barreau (données démographiques, servies à tous les rôles).
  const demo = data?.demographie;
  const parQualite = demo ? Object.entries(demo.parQualite).map(([k, n]) => ({ label: QUALITE_LABEL[k] ?? k, valeur: n, accent: "navy" })) : [];
  const parStatut = demo ? Object.entries(demo.parStatut).map(([k, n]) => ({ label: STATUT_LABEL[k] ?? k, valeur: n, accent: k === "INSCRIT" ? "vert" : k === "RADIE" || k === "SUSPENDU" ? "rouge" : "or" })) : [];
  const parDecennie = demo ? demo.parDecennie.map((d) => ({ label: `Années ${d.decennie}`, valeur: d.n, accent: "or" })) : [];
  const topCabinets = demo?.topCabinets ? demo.topCabinets.map((c) => ({ label: c.nom, valeur: c.effectif, accent: "vert" })) : [];
  const pariteConnue = demo ? demo.parite.H + demo.parite.F : 0;
  const pctF = pariteConnue ? Math.round((demo.parite.F * 100) / pariteConnue) : 0;
  const pctH = pariteConnue ? 100 - pctF : 0;
  const parParite = demo ? [
    { label: "Hommes", valeur: demo.parite.H, accent: "navy" },
    { label: "Femmes", valeur: demo.parite.F, accent: "or" },
    ...(demo.parite.nr ? [{ label: "Non renseigné", valeur: demo.parite.nr, accent: "gris" }] : []),
  ] : [];

  // Cadrage par rôle : en-tête adapté, navigation des cartes restreinte aux
  // modules réellement accessibles, et finances réservées aux profils finances
  // (RG-15 : le Bâtonnier ne voit pas les montants).
  const role = user?.role;
  const peut = (path) => {
    const m = allModules.find((x) => x.path === path.split("?")[0]);
    return m ? aAcces(m, role) : false;
  };
  const allerVers = (path) => (peut(path) ? () => navigate(path) : undefined);
  const voitFinances = peut("/cotisations");
  const entete = ENTETE[role] ?? ENTETE.SECRETAIRE_GENERAL;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={entete.eyebrow} titre="Tableau de bord" sousTitre={entete.sous}>
        <SelecteurExercice valeur={exercice} onChange={setExercice} />
      </PageHeader>

      {erreur && (
        <div className="rounded border-l-[3px] border-rouge bg-rougeL px-4 py-2.5 text-sm text-rouge">{erreur}</div>
      )}

      {/* 4 indicateurs (données réelles de la base) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Avocats inscrits" value={membres?.inscrits ?? "…"} sub="au tableau" accent="or" valueAccent="navy" onClick={allerVers("/avocats")} />
        <StatCard label="À jour" value={membres?.aJour ?? "…"} sub="avocats + stagiaires" accent="vert" onClick={allerVers("/cotisations?statut=ajour")} />
        <StatCard label="En retard" value={membres?.enRetard ?? "…"} sub="relances nécessaires" accent="rouge" onClick={allerVers("/cotisations?statut=retard")} className={(membres?.enRetard ?? 0) > 0 ? "!border-rouge !bg-rougeL" : ""} />
        <StatCard label="Stagiaires" value={membres?.stagiaires ?? "…"} sub="en cours" accent="navy" onClick={allerVers("/stagiaires")} />
      </div>

      {/* Situation financière — réservée aux profils finances (RG-15) ; le
          Bâtonnier ne voit pas les montants. */}
      {voitFinances && (
        <div className="bpn-card">
          <div className="bpn-card-header">
            <span className="bpn-card-heading">Situation financière {exercice}</span>
            <span className="font-mono text-xs text-gris">en FCFA</span>
          </div>
          <div className="grid grid-cols-1 divide-y divide-grisM md:grid-cols-2 md:divide-x md:divide-y-0">
            <ColonneFinance label="Cotisations payées" montant={finances?.payees ?? 0} total={totalDu} accent="vert" />
            <ColonneFinance label="Solde à recouvrer" montant={finances?.solde ?? 0} total={totalDu} accent="or" />
          </div>
        </div>
      )}

      {/* Composition du Barreau — démographie & ancienneté (tous les rôles). */}
      {demo && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CarteRepartition titre="Répartition par qualité" sousTitre={`${demo.total} membres`} lignes={parQualite} />
          <CarteRepartition titre="Situation des inscrits" lignes={parStatut} />
          <CarteRepartition titre="Parité" sousTitre={pariteConnue ? `${pctH}% H · ${pctF}% F` : "non renseigné"} lignes={parParite} />
          <CarteRepartition titre="Inscriptions par décennie" sousTitre="ancienneté au serment" lignes={parDecennie} />
          {topCabinets.length > 0 && (
            <div className="md:col-span-2">
              <CarteRepartition titre="Principaux cabinets" sousTitre="par effectif · personnes morales" lignes={topCabinets} />
            </div>
          )}
        </div>
      )}

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
                    <span className="w-24 shrink-0 font-mono text-xs text-or">{dateCourteFr(e.date)}</span>
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
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gris">
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
