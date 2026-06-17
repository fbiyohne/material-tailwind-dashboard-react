import { useCallback, useEffect, useMemo, useState } from "react";
import { PrinterIcon, CheckCircleIcon, ArrowDownTrayIcon, TrashIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { QUALITE_LABEL } from "../data/derivations";
import { EXERCICES, EXERCICE_COURANT } from "../data/dashboard-data";
import { formatFCFA, formatDate } from "../utils/format";
import { telechargerCsv } from "../utils/exportCsv";
import { montantEnLettresFCFA } from "../utils/nombreEnLettres";
import { RecuDocument, useToast, useConfirm, PageHeader, DataTable } from "../components";
import { listerMembres, listerRecus, enregistrerPaiement, annulerRecu, telechargerRecuPdf } from "../api/resources";

const COLONNES_CSV = [
  { label: "N°", valeur: (r) => r.numero },
  { label: "Avocat", valeur: (r) => `Me ${r.membre?.nom}` },
  { label: "Montant", valeur: (r) => r.montant },
  { label: "Exercice", valeur: (r) => r.annee },
  { label: "Date", valeur: (r) => formatDate(r.date) },
];

const MODES = ["Espèces", "Virement", "Chèque", "Mobile Money"];
const TARIF = { avocat: 150000, stagiaire: 75000, honoraire: 0 };
const aujourdhui = () => new Date().toISOString().slice(0, 10);

function Champ({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-white/55">{label}</span>
      {children}
    </label>
  );
}

export function Recus() {
  const toast = useToast();
  const confirm = useConfirm();
  const [membres, setMembres] = useState([]);
  const [recus, setRecus] = useState([]);
  const [membreId, setMembreId] = useState(null);
  const [exercice, setExercice] = useState(EXERCICE_COURANT);
  const [montant, setMontant] = useState(150000);
  const [mode, setMode] = useState(MODES[0]);
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(aujourdhui());
  const [succes, setSucces] = useState(null);
  const [chargementRecus, setChargementRecus] = useState(true);
  const [erreurRecus, setErreurRecus] = useState(false);

  const chargerRecus = useCallback(() => {
    setChargementRecus(true); setErreurRecus(false);
    return listerRecus()
      .then(setRecus)
      .catch(() => setErreurRecus(true))
      .finally(() => setChargementRecus(false));
  }, []);

  useEffect(() => {
    listerMembres().then((d) => {
      setMembres(d.items);
      if (d.items[0]) { setMembreId(d.items[0].id); setMontant(TARIF[d.items[0].qualite] ?? 150000); }
    }).catch((e) => toast.error(e.message));
    chargerRecus();
  }, [toast, chargerRecus]);

  const membre = useMemo(() => membres.find((m) => m.id === membreId), [membres, membreId]);

  const choisirMembre = (id) => {
    setMembreId(id);
    const m = membres.find((x) => x.id === id);
    if (m) setMontant(TARIF[m.qualite] ?? 150000);
    setSucces(null);
  };

  const emettre = async () => {
    if (!membre || montant <= 0) return;
    try {
      const { recu } = await enregistrerPaiement({ membreId, annee: exercice, montant: Number(montant), mode, ref: reference, date });
      setSucces(recu);
      setReference("");
      chargerRecus();
      // Reçu officiel vectoriel rendu côté serveur (A4, une page).
      await telechargerRecuPdf(recu.id, recu.numero);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const annuler = async (r) => {
    const ok = await confirm({
      title: "Annuler le reçu",
      message: `Le reçu N° ${r.numero} sera annulé : le paiement correspondant (${formatFCFA(r.montant)}) sera retiré de la situation de l'avocat. Continuer ?`,
      confirmLabel: "Annuler le reçu",
      danger: true,
    });
    if (!ok) return;
    try {
      await annulerRecu(r.id);
      toast.success(`Reçu N° ${r.numero} annulé.`);
      chargerRecus();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const numeroAffiche = succes?.numero ?? "automatique";

  return (
    <div className="space-y-5">
      <PageHeader className="bpn-no-print" eyebrow="Finances" titre="Reçus de paiement" sousTitre="Émission d'un reçu officiel — mise à jour automatique des cotisations à l'enregistrement." />

      {succes && (
        <div className="bpn-no-print flex items-center gap-2 rounded border-l-[3px] border-vert bg-vertL px-4 py-2.5 text-sm text-vert">
          <CheckCircleIcon className="h-5 w-5 shrink-0" />
          Reçu N° {succes.numero} émis pour Me {membre?.nom} — cotisation {succes.annee} mise à jour et reçu archivé.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="bpn-no-print rounded-lg bg-navy-3 p-5">
          <div className="mb-4 text-xs uppercase tracking-[0.2em] text-white/40">Formulaire</div>
          <div className="space-y-3.5">
            <Champ label="Avocat bénéficiaire">
              <select value={membreId ?? ""} onChange={(e) => choisirMembre(Number(e.target.value))} className="bpn-input-dark">
                {membres.map((m) => <option key={m.id} value={m.id}>{m.num}. Me {m.nom} — {QUALITE_LABEL[m.qualite]}</option>)}
              </select>
            </Champ>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Exercice">
                <select value={exercice} onChange={(e) => setExercice(Number(e.target.value))} className="bpn-input-dark">
                  {EXERCICES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Champ>
              <Champ label="N° automatique"><input value={numeroAffiche} readOnly className="bpn-input-dark opacity-70" /></Champ>
            </div>
            <Champ label="Montant (FCFA)">
              <input type="number" value={montant} min={0} step={25000} onChange={(e) => setMontant(e.target.value)} className="bpn-input-dark" />
            </Champ>
            <div className="rounded bg-white/5 px-3 py-2 text-[11px] italic text-or-2 first-letter:uppercase">
              {montant > 0 ? montantEnLettresFCFA(montant) : "—"}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Mode">
                <select value={mode} onChange={(e) => setMode(e.target.value)} className="bpn-input-dark">
                  {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Champ>
              <Champ label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bpn-input-dark" /></Champ>
            </div>
            <Champ label="Référence (optionnel)">
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Auto si vide" className="bpn-input-dark" />
            </Champ>
            <button type="button" onClick={emettre} disabled={!membre || montant <= 0} className="bpn-btn bpn-btn-or w-full justify-center !py-2.5">
              <PrinterIcon className="h-4 w-4" /> Émettre &amp; archiver
            </button>
            <button type="button" onClick={() => succes && telechargerRecuPdf(succes.id, succes.numero).catch((e) => toast.error(e.message))} disabled={!succes} title={succes ? "" : "Émettez d'abord le reçu"} className="bpn-btn bpn-btn-ghost w-full justify-center border-white/20 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40">
              <ArrowDownTrayIcon className="h-4 w-4" /> Télécharger PDF
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <RecuDocument numero={numeroAffiche} membre={membre} montant={Number(montant) || 0} exercice={exercice} mode={mode} date={date} />

          <div className="bpn-no-print bpn-card">
            <div className="bpn-card-header">
              <span className="bpn-card-heading">Reçus émis</span>
              <div className="flex items-center gap-3">
                <button type="button" disabled={recus.length === 0}
                  onClick={() => telechargerCsv(`Recus-${new Date().getFullYear()}`, COLONNES_CSV, recus)}
                  className="bpn-btn bpn-btn-ghost !py-1 text-xs disabled:opacity-40">
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Export CSV
                </button>
                <span className="font-mono text-xs text-gris">{recus.length}</span>
              </div>
            </div>
            <DataTable
              columns={[
                {
                  key: "numero",
                  label: "N°",
                  sortable: true,
                  sortValue: (r) => r.numero,
                  cell: (r) => <span className="font-mono text-xs text-or">{r.numero}</span>,
                },
                {
                  key: "nom",
                  label: "Avocat",
                  sortable: true,
                  sortValue: (r) => r.membre?.nom,
                  cell: (r) => <span className="font-medium">Me {r.membre?.nom}</span>,
                },
                {
                  key: "montant",
                  label: "Montant",
                  align: "right",
                  sortable: true,
                  sortValue: (r) => r.montant,
                  cell: (r) => formatFCFA(r.montant),
                },
                {
                  key: "annee",
                  label: "Exercice",
                  cell: (r) => <span className="font-mono text-xs text-gris">{r.annee}</span>,
                },
                {
                  key: "date",
                  label: "Date",
                  cell: (r) => formatDate(r.date),
                },
                {
                  key: "actions",
                  label: "",
                  align: "right",
                  cell: (r) => (
                    <div className="flex items-center justify-end gap-3">
                      <a
                        href={`/verifier/recu/${encodeURIComponent(r.numero)}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Ouvrir la page de vérification publique"
                        className="inline-flex items-center gap-1 text-xs font-medium text-navy transition hover:text-or"
                      >
                        <ShieldCheckIcon className="h-4 w-4" /> Vérifier
                      </a>
                      <button type="button" onClick={() => annuler(r)} title="Annuler le reçu" className="text-gris transition hover:text-rouge">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ),
                },
              ]}
              rows={recus}
              getRowId={(r) => r.numero}
              loading={chargementRecus}
              error={erreurRecus}
              onRetry={chargerRecus}
              emptyTitle="Aucun reçu émis"
              emptyDescription="Les reçus de paiement émis apparaîtront ici."
              libelle="reçus"
              initialSort={{ key: "numero", dir: "desc" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Recus;
