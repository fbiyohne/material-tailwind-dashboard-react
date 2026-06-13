import { useMemo, useState } from "react";
import { PrinterIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useBarreau } from "../store/BarreauStore";
import { montantDu, QUALITE_LABEL } from "../data/derivations";
import { EXERCICES } from "../data/dashboard-data";
import { formatFCFA } from "../utils/format";
import { montantEnLettresFCFA } from "../utils/nombreEnLettres";

const MODES = ["Espèces", "Virement", "Chèque", "Mobile Money"];
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Aperçu du reçu officiel — reproduction fidèle de la maquette annotée. */
function ApercuRecu({ numero, membre, montant, exercice, mode, date }) {
  return (
    <div className="bpn-print-zone overflow-hidden rounded border border-grisM bg-white">
      {/* En-tête institutionnel (annotation 2) */}
      <div className="bg-navy px-5 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-or">
          Barreau de Pointe-Noire
        </div>
        <div className="text-[9px] text-white/60">Trésorerie Générale · Ordre National des Avocats du Congo</div>
      </div>
      <div className="h-[3px] bg-gradient-to-r from-or via-or-2 to-or" />

      <div className="px-6 py-5">
        <div className="mb-4 border-b border-or pb-2 text-center font-display text-xl text-navy">
          Reçu N° {numero}
        </div>

        <div className="flex justify-between border-b border-dashed border-grisM py-1.5 text-sm">
          <span className="text-gris">Reçu de Me</span>
          <span className="font-semibold text-encre">{membre?.nom ?? "—"}</span>
        </div>

        {/* Montant mis en valeur (annotation 3) */}
        <div className="my-3 rounded-r border-l-[3px] border-or bg-or-L px-4 py-2.5">
          <div className="font-display text-lg font-bold text-navy">{formatFCFA(montant)}</div>
          <div className="mt-0.5 text-[11px] italic text-gris first-letter:uppercase">
            {montantEnLettresFCFA(montant)}
          </div>
        </div>

        <div className="flex justify-between border-b border-dashed border-grisM py-1.5 text-sm">
          <span className="text-gris">Pour</span>
          <span className="text-encre">Cotisation ordinale {exercice}</span>
        </div>
        <div className="flex justify-between border-b border-dashed border-grisM py-1.5 text-xs text-gris">
          <span>Mode de paiement</span>
          <span>{mode}</span>
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div className="text-[11px] text-gris">
            Pointe-Noire, le{" "}
            {new Date(date).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </div>
          {/* Signature (annotation 4) */}
          <div className="text-right">
            <div className="mb-6 text-[10px] uppercase tracking-wide text-gris">La Trésorière</div>
            <div className="border-t border-grisM pt-1 text-[11px] font-medium text-navy">
              Me ONDZE BOYA
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Recus() {
  const { membres, recus, prochainNumeroRecu, enregistrerPaiement } = useBarreau();

  const [membreId, setMembreId] = useState(membres[0]?.id);
  const [exercice, setExercice] = useState(2026);
  const membre = useMemo(() => membres.find((m) => m.id === membreId), [membres, membreId]);

  const [montant, setMontant] = useState(membre ? montantDu(membre) : 0);
  const [mode, setMode] = useState(MODES[0]);
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(aujourdhui());
  const [succes, setSucces] = useState(null);

  // Auto-remplissage du montant standard selon la qualité (FR-REC-02 / BR-07).
  const choisirMembre = (id) => {
    setMembreId(id);
    const m = membres.find((x) => x.id === id);
    if (m) setMontant(montantDu(m));
    setSucces(null);
  };

  const emettre = () => {
    if (!membre || montant <= 0) return;
    const recu = enregistrerPaiement({
      membreId,
      exercice,
      montant: Number(montant),
      mode,
      ref: reference || `${mode.slice(0, 3).toUpperCase()}-${exercice}-${prochainNumeroRecu}`,
      date,
    });
    setSucces(recu);
    setReference("");
    // Impression : seul le reçu reste visible (NFR-13).
    setTimeout(() => window.print(), 50);
  };

  return (
    <div className="space-y-5">
      <div className="bpn-no-print">
        <div className="bpn-eyebrow">Finances</div>
        <h2 className="bpn-title mt-2">Reçus de paiement</h2>
        <p className="mt-1 text-sm text-gris">
          Émission d'un reçu officiel — aperçu en temps réel, montant en lettres et mise à jour
          automatique des cotisations à l'impression.
        </p>
      </div>

      {succes && (
        <div className="bpn-no-print flex items-center gap-2 rounded border-l-[3px] border-vert bg-[#e6f4ee] px-4 py-2.5 text-sm text-vert">
          <CheckCircleIcon className="h-5 w-5 shrink-0" />
          Reçu N° {succes.numero} émis pour Me {succes.membreNom} — cotisation {succes.exercice}{" "}
          mise à jour et reçu archivé.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* Panneau formulaire sombre (annotation 5) */}
        <div className="bpn-no-print rounded-lg bg-navy-3 p-5">
          <div className="mb-4 text-[10px] uppercase tracking-[0.2em] text-white/40">Formulaire</div>

          <div className="space-y-3.5">
            <Champ label="Avocat bénéficiaire">
              <select
                value={membreId}
                onChange={(e) => choisirMembre(Number(e.target.value))}
                className="bpn-input-dark"
              >
                {/* Ordre du tableau, non alphabétique (FR-REC-01) */}
                {membres.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.num}. Me {m.nom} — {QUALITE_LABEL[m.qualite]}
                  </option>
                ))}
              </select>
            </Champ>

            <div className="grid grid-cols-2 gap-3">
              <Champ label="Exercice">
                <select
                  value={exercice}
                  onChange={(e) => setExercice(Number(e.target.value))}
                  className="bpn-input-dark"
                >
                  {EXERCICES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </Champ>
              <Champ label="N° automatique">
                <input value={prochainNumeroRecu} readOnly className="bpn-input-dark opacity-70" />
              </Champ>
            </div>

            <Champ label="Montant (FCFA)">
              <input
                type="number"
                value={montant}
                min={0}
                step={25000}
                onChange={(e) => setMontant(e.target.value)}
                className="bpn-input-dark"
              />
            </Champ>

            <div className="rounded bg-white/5 px-3 py-2 text-[11px] italic text-or-2 first-letter:uppercase">
              {montant > 0 ? montantEnLettresFCFA(montant) : "—"}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Champ label="Mode">
                <select value={mode} onChange={(e) => setMode(e.target.value)} className="bpn-input-dark">
                  {MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Champ>
              <Champ label="Date">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bpn-input-dark" />
              </Champ>
            </div>

            <Champ label="Référence (optionnel)">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Auto si vide"
                className="bpn-input-dark"
              />
            </Champ>

            <button
              type="button"
              onClick={emettre}
              disabled={!membre || montant <= 0}
              className="bpn-btn bpn-btn-or w-full justify-center !py-2.5"
            >
              <PrinterIcon className="h-4 w-4" />
              Imprimer &amp; archiver
            </button>
            <p className="text-center text-[10px] text-white/30">1 clic → impression · archivage · cotisation</p>
          </div>
        </div>

        {/* Aperçu temps réel + journal de session */}
        <div className="space-y-5">
          <ApercuRecu
            numero={succes?.numero ?? prochainNumeroRecu}
            membre={membre}
            montant={Number(montant) || 0}
            exercice={exercice}
            mode={mode}
            date={date}
          />

          <div className="bpn-no-print bpn-card">
            <div className="bpn-card-header">
              <span className="bpn-card-heading">Reçus émis (session)</span>
              <span className="font-mono text-xs text-gris">{recus.length}</span>
            </div>
            {recus.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gris">Aucun reçu émis pour le moment.</p>
            ) : (
              <ul className="divide-y divide-grisL">
                {recus.map((r) => (
                  <li key={r.numero} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-mono text-xs text-or">N° {r.numero}</span>
                    <span className="flex-1 px-3 text-encre">Me {r.membreNom}</span>
                    <span className="text-gris">{formatFCFA(r.montant)}</span>
                    <span className="ml-3 font-mono text-xs text-gris">{r.exercice}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
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

export default Recus;
