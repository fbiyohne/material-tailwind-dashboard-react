import { useEffect, useMemo, useState } from "react";
import { PrinterIcon, CheckCircleIcon, ArrowDownTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { QUALITE_LABEL } from "../data/derivations";
import { EXERCICES, EXERCICE_COURANT } from "../data/dashboard-data";
import { formatFCFA } from "../utils/format";
import { montantEnLettresFCFA } from "../utils/nombreEnLettres";
import { DocumentChrome, Pagination, useToast, useConfirm } from "../components";
import { listerMembres, listerRecus, enregistrerPaiement, telechargerRecuPdf, annulerRecu } from "../api/resources";

const MODES = ["Espèces", "Virement", "Chèque", "Mobile Money"];
const PAR_PAGE = 12;
const TARIF = { avocat: 150000, stagiaire: 75000, honoraire: 0 };
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Aperçu du reçu officiel — gabarit unifié. */
function ApercuRecu({ numero, membre, montant, exercice, mode, date }) {
  return (
    <DocumentChrome org="Trésorerie Générale" title={`Reçu N° ${numero}`} date={date} signataires={[{ role: "La Trésorière", nom: "Me ONDZE BOYA" }]}>
      <div className="flex justify-between border-b border-dashed border-grisM py-1.5 text-sm">
        <span className="text-gris">Reçu de Me</span>
        <span className="font-semibold text-encre">{membre?.nom ?? "—"}</span>
      </div>
      <div className="my-3 rounded-r border-l-[3px] border-or bg-or-L px-4 py-2.5">
        <div className="font-display text-lg font-bold text-navy">{formatFCFA(montant)}</div>
        <div className="mt-0.5 text-[11px] italic text-gris first-letter:uppercase">{montantEnLettresFCFA(montant)}</div>
      </div>
      <div className="flex justify-between border-b border-dashed border-grisM py-1.5 text-sm">
        <span className="text-gris">Pour</span><span className="text-encre">Cotisation ordinale {exercice}</span>
      </div>
      <div className="flex justify-between border-b border-dashed border-grisM py-1.5 text-xs text-gris">
        <span>Mode de paiement</span><span>{mode}</span>
      </div>
    </DocumentChrome>
  );
}

function Champ({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] uppercase tracking-wide text-white/40">{label}</span>
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
  const [page, setPage] = useState(1);

  const chargerRecus = () => listerRecus().then(setRecus).catch(() => {});

  useEffect(() => {
    listerMembres().then((d) => {
      setMembres(d.items);
      if (d.items[0]) { setMembreId(d.items[0].id); setMontant(TARIF[d.items[0].qualite] ?? 150000); }
    }).catch((e) => toast.error(e.message));
    chargerRecus();
  }, [toast]);

  const membre = useMemo(() => membres.find((m) => m.id === membreId), [membres, membreId]);

  const totalPages = Math.max(1, Math.ceil(recus.length / PAR_PAGE));
  const pageSure = Math.min(page, totalPages);
  const recusPage = recus.slice((pageSure - 1) * PAR_PAGE, pageSure * PAR_PAGE);

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
      setTimeout(() => window.print(), 50);
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
      <div className="bpn-no-print">
        <div className="bpn-eyebrow">Finances</div>
        <h2 className="bpn-title mt-2">Reçus de paiement</h2>
        <p className="mt-1 text-sm text-gris">Émission d'un reçu officiel — mise à jour automatique des cotisations à l'enregistrement.</p>
      </div>

      {succes && (
        <div className="bpn-no-print flex items-center gap-2 rounded border-l-[3px] border-vert bg-[#e6f4ee] px-4 py-2.5 text-sm text-vert">
          <CheckCircleIcon className="h-5 w-5 shrink-0" />
          Reçu N° {succes.numero} émis pour Me {membre?.nom} — cotisation {succes.annee} mise à jour et reçu archivé.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="bpn-no-print rounded-lg bg-navy-3 p-5">
          <div className="mb-4 text-[10px] uppercase tracking-[0.2em] text-white/40">Formulaire</div>
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
              <PrinterIcon className="h-4 w-4" /> Imprimer &amp; archiver
            </button>
            <button type="button" onClick={() => succes && telechargerRecuPdf(succes.id, succes.numero)} disabled={!succes} title={succes ? "" : "Émettez d'abord le reçu"} className="bpn-btn bpn-btn-ghost w-full justify-center border-white/20 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40">
              <ArrowDownTrayIcon className="h-4 w-4" /> Télécharger PDF (serveur)
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <ApercuRecu numero={numeroAffiche} membre={membre} montant={Number(montant) || 0} exercice={exercice} mode={mode} date={date} />

          <div className="bpn-no-print bpn-card">
            <div className="bpn-card-header">
              <span className="bpn-card-heading">Reçus émis</span>
              <span className="font-mono text-xs text-gris">{recus.length}</span>
            </div>
            {recus.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gris">Aucun reçu émis.</p>
            ) : (
              <>
                <ul className="divide-y divide-grisL">
                  {recusPage.map((r) => (
                    <li key={r.numero} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="font-mono text-xs text-or">N° {r.numero}</span>
                      <span className="flex-1 px-3 text-encre">Me {r.membre?.nom}</span>
                      <span className="text-gris">{formatFCFA(r.montant)}</span>
                      <span className="ml-3 font-mono text-xs text-gris">{r.annee}</span>
                      <button type="button" onClick={() => annuler(r)} title="Annuler le reçu" className="ml-3 text-gris transition hover:text-rouge">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <Pagination page={pageSure} totalPages={totalPages} total={recus.length} onPage={setPage} libelle="reçus" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Recus;
