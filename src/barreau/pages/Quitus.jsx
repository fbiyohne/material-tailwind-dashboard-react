import { useCallback, useEffect, useMemo, useState } from "react";
import { DocumentCheckIcon, CheckCircleIcon, LockClosedIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { EXERCICES, EXERCICE_COURANT } from "../data/dashboard-data";
import { DocumentChrome, SortTh, Pagination, useToast, PageHeader } from "../components";
import { useDataTable } from "../hooks/useDataTable";
import { quitusEligibles, listerQuitus, genererQuitus, getCotisations, telechargerQuitusPdf } from "../api/resources";

const REGISTRE_ACCESSORS = {
  numero: (q) => q.numero,
  nom: (q) => (q.membre?.nom ?? "").toLowerCase(),
  annee: (q) => q.annee,
  date: (q) => q.dateEmission,
};

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const pad3 = (n) => String(n).padStart(3, "0");

function ApercuQuitus({ numero, membre, exercice, date }) {
  return (
    <DocumentChrome org="Conseil de l'Ordre" title="Quitus de cotisation" reference={`N° ${numero}`} date={date} signataires={[{ role: "La Trésorière", nom: "Me ONDZE BOYA" }]}>
      <p className="text-[13px] leading-7 text-encre">
        Le Conseil de l'Ordre des Avocats du Barreau de Pointe-Noire certifie que{" "}
        <strong>Me {membre?.nom}</strong>, avocat inscrit au tableau, est <strong>entièrement à jour</strong> de ses
        cotisations ordinales au titre de l'exercice <strong>{exercice}</strong>.
      </p>
      <p className="mt-3 text-[13px] leading-7 text-encre">En foi de quoi le présent quitus lui est délivré pour servir et valoir ce que de droit.</p>
    </DocumentChrome>
  );
}

function PuceSynthese({ valeur, label, accent }) {
  return (
    <div className="flex items-center gap-2 rounded border border-grisM bg-white px-3 py-2">
      <span className="font-display text-xl font-bold" style={{ color: `var(--bpn-${accent})` }}>{valeur}</span>
      <span className="text-[11px] leading-tight text-gris">{label}</span>
    </div>
  );
}

export function Quitus() {
  const toast = useToast();
  const [exercice, setExercice] = useState(EXERCICE_COURANT);
  const [eligibles, setEligibles] = useState([]);
  const [registre, setRegistre] = useState([]);
  const [lignes, setLignes] = useState([]);
  const [membreId, setMembreId] = useState(null);
  const [succes, setSucces] = useState(null);

  const charger = useCallback(() => {
    quitusEligibles(exercice).then((d) => setEligibles(d.eligibles)).catch((e) => toast.error(e.message));
    listerQuitus().then(setRegistre).catch(() => {});
    getCotisations(exercice).then(setLignes).catch(() => {});
  }, [exercice, toast]);

  useEffect(() => { charger(); }, [charger]);

  const synthese = useMemo(() => {
    let aValider = 0;
    let bloques = 0;
    lignes.forEach((l) => {
      if (l.statut === "ajour") { if (!l.valideTresoriere) aValider += 1; }
      else if (l.statut !== "exonere") bloques += 1;
    });
    return { eligibles: eligibles.length, aValider, bloques };
  }, [lignes, eligibles.length]);

  const registreTable = useDataTable(registre, {
    accessors: REGISTRE_ACCESSORS, pageSize: 8, initialSort: { key: "numero", dir: "desc" },
  });

  const membreActif = eligibles.find((m) => m.id === membreId) ?? eligibles[0] ?? null;

  const numero = useMemo(() => {
    if (succes?.numero) return succes.numero;
    const suffixes = registre.filter((q) => q.annee === exercice).map((q) => parseInt(q.numero.split("-")[2] ?? "0", 10));
    return `Q-${exercice}-${pad3((suffixes.length ? Math.max(...suffixes) : 0) + 1)}`;
  }, [succes, registre, exercice]);

  const generer = async () => {
    if (!membreActif) return;
    try {
      const q = await genererQuitus(membreActif.id, exercice);
      setSucces(q);
      charger();
      setTimeout(() => window.print(), 50);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader className="bpn-no-print" eyebrow="Finances" titre="Quitus de cotisation" sousTitre="Délivrance d'un quitus officiel — uniquement pour les avocats à jour et validés par la Trésorière." />

      <div className="bpn-no-print flex items-start gap-2 rounded border-l-[3px] border-vert bg-[#e6f4ee] px-4 py-2.5 text-sm text-vert">
        <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
        <span>Seuls les avocats <strong>à jour</strong> et <strong>validés par la Trésorière</strong> apparaissent. La génération est sinon bloquée (règle BR-01).</span>
      </div>

      {succes && (
        <div className="bpn-no-print flex items-center gap-2 rounded border-l-[3px] border-navy bg-[#e6edf4] px-4 py-2.5 text-sm text-navy">
          <DocumentCheckIcon className="h-5 w-5 shrink-0" /> Quitus {succes.numero} généré et archivé (exercice {succes.annee}).
        </div>
      )}

      <div className="bpn-no-print grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PuceSynthese valeur={synthese.eligibles} label="Éligibles (à jour + validés)" accent="vert" />
        <PuceSynthese valeur={synthese.aValider} label="À jour, à valider par la Trésorière" accent="or" />
        <PuceSynthese valeur={synthese.bloques} label="Non à jour — quitus bloqué" accent="rouge" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="bpn-no-print rounded-lg bg-navy-3 p-5">
          <div className="mb-4 text-[10px] uppercase tracking-[0.2em] text-white/40">Générer un quitus</div>
          <div className="space-y-3.5">
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-white/55">Exercice</span>
              <select value={exercice} onChange={(e) => { setExercice(Number(e.target.value)); setMembreId(null); setSucces(null); }} className="bpn-input-dark">
                {EXERCICES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-white/55">Avocat bénéficiaire</span>
              <select value={membreActif?.id ?? ""} onChange={(e) => setMembreId(Number(e.target.value))} disabled={eligibles.length === 0} className="bpn-input-dark disabled:opacity-50">
                {eligibles.length === 0 ? <option>Aucun avocat éligible</option> : eligibles.map((m) => <option key={m.id} value={m.id}>{m.num}. Me {m.nom} — à jour ✓</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-white/55">N° automatique</span>
              <input value={numero} readOnly className="bpn-input-dark opacity-70" />
            </label>
            <button type="button" onClick={generer} disabled={!membreActif} className="bpn-btn bpn-btn-or w-full justify-center !py-2.5">
              <DocumentCheckIcon className="h-4 w-4" /> Générer &amp; archiver
            </button>
            <button type="button" onClick={() => succes && telechargerQuitusPdf(succes.id, succes.numero)} disabled={!succes} title={succes ? "" : "Générez d'abord le quitus"} className="bpn-btn bpn-btn-ghost w-full justify-center border-white/20 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40">
              <ArrowDownTrayIcon className="h-4 w-4" /> Télécharger PDF (serveur)
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {membreActif ? (
            <ApercuQuitus numero={numero} membre={membreActif} exercice={exercice} date={aujourdhui()} />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-grisM bg-white px-6 py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f4e6e6] text-rouge"><LockClosedIcon className="h-6 w-6" /></div>
              <p className="font-display text-lg text-navy">Génération bloquée</p>
              <p className="mt-2 max-w-md text-sm text-gris">Aucun avocat n'est éligible pour l'exercice {exercice} : un quitus n'est délivrable que si la cotisation est réglée <strong>et</strong> validée par la Trésorière (BR-01).</p>
            </div>
          )}

          <div className="bpn-no-print bpn-card">
            <div className="bpn-card-header">
              <span className="bpn-card-heading">Registre des quitus émis</span>
              <span className="font-mono text-xs text-gris">{registre.length}</span>
            </div>
            {registre.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gris">Aucun quitus émis.</p>
            ) : (
              <>
                <table className="bpn-table">
                  <thead>
                    <tr>
                      <SortTh label="N°" sortKey="numero" current={registreTable.sortKey} dir={registreTable.sortDir} onSort={registreTable.toggleSort} />
                      <SortTh label="Avocat" sortKey="nom" current={registreTable.sortKey} dir={registreTable.sortDir} onSort={registreTable.toggleSort} />
                      <SortTh label="Exercice" sortKey="annee" current={registreTable.sortKey} dir={registreTable.sortDir} onSort={registreTable.toggleSort} />
                      <SortTh label="Date" sortKey="date" current={registreTable.sortKey} dir={registreTable.sortDir} onSort={registreTable.toggleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {registreTable.rows.map((q) => (
                      <tr key={q.numero}>
                        <td className="font-mono text-xs text-or">{q.numero}</td>
                        <td className="font-medium">Me {q.membre?.nom}</td>
                        <td className="font-mono text-xs text-gris">{q.annee}</td>
                        <td className="text-xs text-gris">{String(q.dateEmission).slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={registreTable.page} totalPages={registreTable.totalPages} total={registreTable.total} onPage={registreTable.setPage} libelle="quitus" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Quitus;
