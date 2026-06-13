import { useMemo, useState } from "react";
import {
  DocumentCheckIcon,
  CheckCircleIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { useBarreau } from "../store/BarreauStore";
import { EXERCICES } from "../data/dashboard-data";

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Aperçu du quitus officiel — destiné à l'impression / archivage (FR-QUI-03). */
function ApercuQuitus({ numero, membre, exercice, date }) {
  return (
    <div className="bpn-print-zone overflow-hidden rounded border border-grisM bg-white">
      <div className="bg-navy px-5 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-or">
          Barreau de Pointe-Noire
        </div>
        <div className="text-[9px] text-white/60">
          Conseil de l'Ordre · Ordre National des Avocats du Congo
        </div>
      </div>
      <div className="h-[3px] bg-gradient-to-r from-or via-or-2 to-or" />

      <div className="px-8 py-7">
        <div className="mb-1 text-center font-display text-2xl text-navy">
          Quitus de cotisation
        </div>
        <div className="mb-6 text-center font-mono text-xs text-or">N° {numero}</div>

        <p className="text-[13px] leading-7 text-encre">
          Le Conseil de l'Ordre des Avocats du Barreau de Pointe-Noire certifie que{" "}
          <strong>Me {membre?.nom}</strong>, avocat inscrit au tableau, est{" "}
          <strong>entièrement à jour</strong> de ses cotisations ordinales au titre de
          l'exercice <strong>{exercice}</strong>.
        </p>
        <p className="mt-3 text-[13px] leading-7 text-encre">
          En foi de quoi le présent quitus lui est délivré pour servir et valoir ce que de
          droit.
        </p>

        <div className="mt-8 flex items-end justify-between">
          <div className="text-[11px] text-gris">
            Fait à Pointe-Noire, le{" "}
            {new Date(date).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </div>
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

/** Pastille de comptage pour la synthèse d'éligibilité. */
function PuceSynthese({ valeur, label, accent }) {
  return (
    <div className="flex items-center gap-2 rounded border border-grisM bg-white px-3 py-2">
      <span className="font-display text-xl font-bold" style={{ color: `var(--bpn-${accent})` }}>
        {valeur}
      </span>
      <span className="text-[11px] leading-tight text-gris">{label}</span>
    </div>
  );
}

export function Quitus() {
  const {
    membres,
    quitus,
    cotisationsExercice,
    estValide,
    eligiblesQuitus,
    prochainNumeroQuitus,
    genererQuitus,
  } = useBarreau();

  const [exercice, setExercice] = useState(2026);
  const [membreId, setMembreId] = useState(null);
  const [succes, setSucces] = useState(null);

  const eligibles = useMemo(() => eligiblesQuitus(exercice), [eligiblesQuitus, exercice]);

  // Synthèse d'éligibilité (transparence de la règle BR-01).
  const synthese = useMemo(() => {
    const lignes = cotisationsExercice(exercice);
    let aValider = 0;
    let bloques = 0;
    lignes.forEach((l) => {
      if (l.statut === "ajour") {
        if (!estValide(l.membre.id, exercice)) aValider += 1;
      } else if (l.statut !== "exonere") {
        bloques += 1;
      }
    });
    return { eligibles: eligibles.length, aValider, bloques };
  }, [cotisationsExercice, exercice, estValide, eligibles.length]);

  // Membre sélectionné effectif (toujours dans la liste des éligibles).
  const membreActif =
    eligibles.find((m) => m.id === membreId) ?? eligibles[0] ?? null;
  const numero = prochainNumeroQuitus(exercice);

  const generer = () => {
    if (!membreActif) return;
    const quit = genererQuitus({ membreId: membreActif.id, exercice, date: aujourdhui() });
    if (quit) {
      setSucces(quit);
      setTimeout(() => window.print(), 50);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bpn-no-print">
        <div className="bpn-eyebrow">Finances</div>
        <h2 className="bpn-title mt-2">Quitus de cotisation</h2>
        <p className="mt-1 text-sm text-gris">
          Délivrance d'un quitus officiel — uniquement pour les avocats à jour et validés par la
          Trésorière.
        </p>
      </div>

      {/* Bannière de la règle BR-01 (reprise de la maquette) */}
      <div className="bpn-no-print flex items-start gap-2 rounded border-l-[3px] border-vert bg-[#e6f4ee] px-4 py-2.5 text-sm text-vert">
        <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          Seuls les avocats <strong>à jour</strong> de leurs cotisations <strong>et validés par
          la Trésorière</strong> apparaissent ci-dessous. La génération est sinon bloquée
          (règle BR-01).
        </span>
      </div>

      {succes && (
        <div className="bpn-no-print flex items-center gap-2 rounded border-l-[3px] border-navy bg-[#e6edf4] px-4 py-2.5 text-sm text-navy">
          <DocumentCheckIcon className="h-5 w-5 shrink-0" />
          Quitus {succes.numero} généré et archivé pour Me {succes.membreNom} — exercice{" "}
          {succes.exercice}.
        </div>
      )}

      {/* Synthèse d'éligibilité */}
      <div className="bpn-no-print grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PuceSynthese valeur={synthese.eligibles} label="Éligibles (à jour + validés)" accent="vert" />
        <PuceSynthese valeur={synthese.aValider} label="À jour, à valider par la Trésorière" accent="or" />
        <PuceSynthese valeur={synthese.bloques} label="Non à jour — quitus bloqué" accent="rouge" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* Formulaire */}
        <div className="bpn-no-print rounded-lg bg-navy-3 p-5">
          <div className="mb-4 text-[10px] uppercase tracking-[0.2em] text-white/40">
            Générer un quitus
          </div>

          <div className="space-y-3.5">
            <label className="block">
              <span className="mb-1 block text-[9px] uppercase tracking-wide text-white/40">Exercice</span>
              <select
                value={exercice}
                onChange={(e) => {
                  setExercice(Number(e.target.value));
                  setMembreId(null);
                  setSucces(null);
                }}
                className="bpn-input-dark"
              >
                {EXERCICES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[9px] uppercase tracking-wide text-white/40">
                Avocat bénéficiaire
              </span>
              <select
                value={membreActif?.id ?? ""}
                onChange={(e) => setMembreId(Number(e.target.value))}
                disabled={eligibles.length === 0}
                className="bpn-input-dark disabled:opacity-50"
              >
                {eligibles.length === 0 ? (
                  <option>Aucun avocat éligible</option>
                ) : (
                  eligibles.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.num}. Me {m.nom} — à jour ✓
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[9px] uppercase tracking-wide text-white/40">
                N° automatique
              </span>
              <input value={numero} readOnly className="bpn-input-dark opacity-70" />
            </label>

            <button
              type="button"
              onClick={generer}
              disabled={!membreActif}
              className="bpn-btn bpn-btn-or w-full justify-center !py-2.5"
            >
              <DocumentCheckIcon className="h-4 w-4" />
              Générer &amp; archiver
            </button>
            <p className="text-center text-[10px] text-white/30">
              Génération PDF + archivage automatique
            </p>
          </div>
        </div>

        {/* Aperçu ou état bloqué */}
        <div className="space-y-5">
          {membreActif ? (
            <ApercuQuitus
              numero={succes?.numero ?? numero}
              membre={membreActif}
              exercice={exercice}
              date={aujourdhui()}
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-grisM bg-white px-6 py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f4e6e6] text-rouge">
                <LockClosedIcon className="h-6 w-6" />
              </div>
              <p className="font-display text-lg text-navy">Génération bloquée</p>
              <p className="mt-2 max-w-md text-sm text-gris">
                Aucun avocat n'est éligible pour l'exercice {exercice}. Un quitus ne peut être
                délivré que si la cotisation est entièrement réglée <strong>et</strong> validée par
                la Trésorière dans le module Cotisations (règle BR-01).
              </p>
            </div>
          )}

          {/* Registre des quitus émis */}
          <div className="bpn-no-print bpn-card">
            <div className="bpn-card-header">
              <span className="bpn-card-heading">Registre des quitus émis</span>
              <span className="font-mono text-xs text-gris">{quitus.length}</span>
            </div>
            {quitus.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gris">Aucun quitus émis.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-navy text-left text-[9px] uppercase tracking-[0.1em] text-white/90">
                    <th className="px-4 py-2 font-medium">N°</th>
                    <th className="px-4 py-2 font-medium">Avocat</th>
                    <th className="px-4 py-2 font-medium">Exercice</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {quitus.map((q) => (
                    <tr key={q.numero} className="border-b border-grisL hover:bg-grisL/60">
                      <td className="px-4 py-2 font-mono text-xs text-or">{q.numero}</td>
                      <td className="px-4 py-2 font-medium">Me {q.membreNom}</td>
                      <td className="px-4 py-2 font-mono text-xs text-gris">{q.exercice}</td>
                      <td className="px-4 py-2 text-xs text-gris">{q.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Quitus;
