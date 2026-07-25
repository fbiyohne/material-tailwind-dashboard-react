import { useCallback, useEffect, useMemo, useState } from "react";
import { DocumentCheckIcon, CheckCircleIcon, LockClosedIcon, ArrowDownTrayIcon, ShieldCheckIcon, TrashIcon } from "@heroicons/react/24/outline";
import { EXERCICES, EXERCICE_COURANT } from "../data/dashboard-data";
import { QuitusDocument, Notice, useToast, useConfirm, PageHeader, DataTable } from "../components";
import { useAuth } from "../auth/AuthContext";
import { formatDate } from "../utils/format";
import { telechargerCsv } from "../utils/exportCsv";
import { telechargerDocumentPdf } from "../utils/exports";
import { quitusEligibles, listerQuitus, genererQuitus, supprimerQuitus, getCotisations, getMembre, telechargerQuitusPdf } from "../api/resources";

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const pad3 = (n) => String(n).padStart(3, "0");

const COLONNES_REGISTRE = [
  { key: "numero", label: "N°", sortable: true, sortValue: (q) => q.numero,
    cell: (q) => <span className="font-mono text-xs text-or-fonce">{q.numero}</span> },
  { key: "nom", label: "Avocat", sortable: true, sortValue: (q) => q.membre?.nom,
    cell: (q) => <span className="font-medium">Me {q.membre?.nom}</span> },
  { key: "annee", label: "Exercice", sortable: true, sortValue: (q) => q.annee,
    cell: (q) => <span className="font-mono text-xs text-gris">{q.annee}</span> },
  { key: "date", label: "Date", sortable: true, sortValue: (q) => q.dateEmission,
    cell: (q) => formatDate(q.dateEmission) },
  { key: "verif", label: "Authenticité", align: "right",
    cell: (q) => (
      <a href={`/verifier/quitus/${encodeURIComponent(q.numero)}`} target="_blank" rel="noreferrer"
        title="Ouvrir la page de vérification publique"
        className="inline-flex items-center gap-1 text-xs font-medium text-navy transition hover:text-or-fonce">
        <ShieldCheckIcon className="h-4 w-4" /> Vérifier
      </a>
    ) },
];

const COLONNES_CSV = [
  { label: "N°", valeur: (q) => q.numero },
  { label: "Avocat", valeur: (q) => `Me ${q.membre?.nom}` },
  { label: "Exercice", valeur: (q) => q.annee },
  { label: "Date", valeur: (q) => formatDate(q.dateEmission) },
];

function PuceSynthese({ valeur, label, accent }) {
  return (
    <div className="flex items-center gap-2 rounded border border-grisM bg-white px-3 py-2">
      <span className="font-display text-xl font-bold" style={{ color: `var(--bpn-${accent})` }}>{valeur}</span>
      <span className="text-xs leading-tight text-gris">{label}</span>
    </div>
  );
}

export function Quitus() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const estAdmin = user?.role === "ADMIN";
  // La génération/archivage du quitus est réservée au SG (POST /quitus) : on ne
  // propose le bouton qu'aux rôles autorisés (la Trésorière consulte le registre).
  const peutGenerer = ["SECRETAIRE_GENERAL", "ADMIN"].includes(user?.role);
  const [generation, setGeneration] = useState(false);
  const [exercice, setExercice] = useState(EXERCICE_COURANT);
  const [eligibles, setEligibles] = useState([]);
  const [registre, setRegistre] = useState([]);
  const [lignes, setLignes] = useState([]);
  const [membreId, setMembreId] = useState(null);
  const [succes, setSucces] = useState(null);
  const [details, setDetails] = useState(null); // fiche complète de l'avocat sélectionné (n° d'inscription, adresse…)
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  const charger = useCallback(() => {
    quitusEligibles(exercice).then((d) => setEligibles(d.eligibles)).catch((e) => toast.error(e.message));
    setChargement(true); setErreur(false);
    listerQuitus()
      .then(setRegistre)
      .catch(() => setErreur(true))
      .finally(() => setChargement(false));
    getCotisations(exercice).then(setLignes).catch(() => {});
  }, [exercice, toast]);

  useEffect(() => { charger(); }, [charger]);

  const synthese = useMemo(() => {
    let partiels = 0;
    let bloques = 0;
    lignes.forEach((l) => {
      if (l.statut === "partiel") partiels += 1;
      else if (l.statut === "retard") bloques += 1;
    });
    return { eligibles: eligibles.length, partiels, bloques };
  }, [lignes, eligibles.length]);

  // Retire de la sélection les avocats déjà munis d'un quitus pour l'exercice :
  // inutile de proposer « Générer » pour un membre déjà certifié (le serveur
  // renverrait 409). Le registre à droite conserve la trace de leur quitus.
  const dejaCertifies = useMemo(
    () => new Set(registre.filter((q) => q.annee === exercice).map((q) => q.membreId)),
    [registre, exercice]
  );
  const eligiblesRestants = useMemo(
    () => eligibles.filter((m) => !dejaCertifies.has(m.id)),
    [eligibles, dejaCertifies]
  );

  const membreActif = eligiblesRestants.find((m) => m.id === membreId) ?? eligiblesRestants[0] ?? null;

  // Charge la fiche complète (n° d'inscription, date, adresse) pour renseigner le quitus.
  useEffect(() => {
    if (!membreActif?.id) { setDetails(null); return; }
    let actif = true;
    getMembre(membreActif.id).then((m) => actif && setDetails(m)).catch(() => actif && setDetails(null));
    return () => { actif = false; };
  }, [membreActif?.id]);

  const numero = useMemo(() => {
    if (succes?.numero) return succes.numero;
    const suffixes = registre.filter((q) => q.annee === exercice).map((q) => parseInt(q.numero.split("-")[2] ?? "0", 10));
    return `Q-${exercice}-${pad3((suffixes.length ? Math.max(...suffixes) : 0) + 1)}`;
  }, [succes, registre, exercice]);

  const generer = async () => {
    if (!membreActif || generation) return; // garde anti double-clic
    setGeneration(true);
    try {
      const q = await genererQuitus(membreActif.id, exercice);
      setSucces(q);
      charger();
      // PDF vectoriel rendu par le serveur (même design que l'aperçu) ; repli
      // sur la capture de l'aperçu affiché si le serveur ne peut pas le produire.
      await telechargerDocumentPdf(() => telechargerQuitusPdf(q.id, q.numero), `Quitus-${q.numero}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGeneration(false);
    }
  };

  // Suppression d'un quitus du registre — réservée au super-administrateur (ADMIN).
  const supprimer = async (q) => {
    const ok = await confirm({
      title: "Supprimer le quitus",
      message: `Le quitus ${q.numero} (Me ${q.membre?.nom}) sera définitivement retiré du registre. Cette action est irréversible.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try { await supprimerQuitus(q.id); charger(); toast.success(`Quitus ${q.numero} supprimé.`); }
    catch (e) { toast.error(e.message); }
  };

  const colonnePdf = {
    key: "pdf", label: "", align: "right",
    cell: (q) => (
      <button type="button" onClick={() => telechargerQuitusPdf(q.id, q.numero).catch((e) => toast.error(e.message))}
        title="Télécharger le quitus (PDF)" className="inline-flex items-center gap-1 text-xs font-medium text-navy transition hover:text-or-fonce">
        <ArrowDownTrayIcon className="h-4 w-4" /> PDF
      </button>
    ),
  };
  const colonnes = estAdmin
    ? [...COLONNES_REGISTRE, colonnePdf, {
        key: "actions", label: "", align: "right",
        cell: (q) => (
          <button className="bpn-btn bpn-btn-ghost !px-2 !py-1 text-xs text-rouge" onClick={() => supprimer(q)} title="Supprimer définitivement">
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        ),
      }]
    : [...COLONNES_REGISTRE, colonnePdf];

  return (
    <div className="space-y-5">
      <PageHeader className="bpn-no-print" eyebrow="Finances" titre="Quitus de cotisation" sousTitre="Délivrance d'un quitus officiel — automatique dès que la cotisation de l'avocat est soldée." />

      <Notice ton="vert" icon={CheckCircleIcon} className="bpn-no-print text-sm">
        Tout avocat dont la cotisation est <strong>intégralement réglée</strong> apparaît automatiquement : le règlement vaut validation. La génération reste bloquée tant qu'un solde est dû (règle BR-01).
      </Notice>

      {succes && (
        <Notice ton="bleu" icon={DocumentCheckIcon} className="bpn-no-print text-sm">
          Quitus {succes.numero} généré et archivé (exercice {succes.annee}).
        </Notice>
      )}

      <div className="bpn-no-print grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PuceSynthese valeur={synthese.eligibles} label="Éligibles (cotisation soldée)" accent="vert" />
        <PuceSynthese valeur={synthese.partiels} label="Paiements partiels (solde dû)" accent="or" />
        <PuceSynthese valeur={synthese.bloques} label="Non réglés — quitus bloqué" accent="rouge" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="bpn-no-print rounded-lg bg-navy-3 p-5">
          <div className="mb-4 text-xs uppercase tracking-[0.2em] text-white/40">Générer un quitus</div>
          <div className="space-y-3.5">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-white/55">Exercice</span>
              <select value={exercice} onChange={(e) => { setExercice(Number(e.target.value)); setMembreId(null); setSucces(null); }} className="bpn-input-dark">
                {EXERCICES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-white/55">Avocat bénéficiaire</span>
              <select value={membreActif?.id ?? ""} onChange={(e) => setMembreId(Number(e.target.value))} disabled={eligiblesRestants.length === 0} className="bpn-input-dark disabled:opacity-50">
                {eligiblesRestants.length === 0 ? <option>Aucun avocat à certifier</option> : eligiblesRestants.map((m) => <option key={m.id} value={m.id}>{m.num}. Me {m.nom} — à jour ✓</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-white/55">N° automatique</span>
              <input value={numero} readOnly className="bpn-input-dark opacity-70" />
            </label>
            {peutGenerer && (
              <button type="button" onClick={generer} disabled={!membreActif || generation} className="bpn-btn bpn-btn-or w-full justify-center !py-2.5">
                <DocumentCheckIcon className="h-4 w-4" /> {generation ? "Génération…" : "Générer & archiver"}
              </button>
            )}
            <button type="button" onClick={() => succes && telechargerDocumentPdf(() => telechargerQuitusPdf(succes.id, succes.numero), `Quitus-${succes.numero}`).catch((e) => toast.error(e.message))} disabled={!succes} title={succes ? "" : "Générez d'abord le quitus"} className="bpn-btn bpn-btn-ghost w-full justify-center border-white/20 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40">
              <ArrowDownTrayIcon className="h-4 w-4" /> Télécharger PDF
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {membreActif ? (
            // Gabarit fixe (820px) : défilement horizontal sur mobile plutôt que
            // de déborder toute la page.
            <div className="overflow-x-auto">
              <QuitusDocument numero={numero} membre={(details && details.id === membreActif.id) ? details : membreActif} exercice={exercice} date={aujourdhui()} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-grisM bg-white px-6 py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rougeL text-rouge"><LockClosedIcon className="h-6 w-6" /></div>
              <p className="font-display text-lg text-navy">Génération bloquée</p>
              <p className="mt-2 max-w-md text-sm text-gris">Aucun avocat n'est éligible pour l'exercice {exercice} : un quitus n'est délivrable que si la cotisation est <strong>intégralement réglée</strong> (BR-01).</p>
            </div>
          )}

          <div className="bpn-no-print bpn-card">
            <div className="bpn-card-header">
              <span className="bpn-card-heading">Registre des quitus émis</span>
              <div className="flex items-center gap-3">
                <button type="button" disabled={registre.length === 0}
                  onClick={() => telechargerCsv(`Quitus-${new Date().getFullYear()}`, COLONNES_CSV, registre)}
                  className="bpn-btn bpn-btn-ghost !py-1 text-xs disabled:opacity-40">
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Export CSV
                </button>
                <span className="font-mono text-xs text-gris">{registre.length}</span>
              </div>
            </div>
            <DataTable
              columns={colonnes}
              rows={registre}
              getRowId={(q) => q.numero}
              loading={chargement}
              error={erreur}
              onRetry={charger}
              emptyTitle="Aucun quitus émis"
              emptyDescription="Les quitus délivrés apparaîtront dans ce registre."
              libelle="quitus"
              pageSize={10}
              initialSort={{ key: "numero", dir: "desc" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Quitus;
