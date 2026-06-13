import { useMemo, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Badge, Modal } from "../components";
import { useBarreau } from "../store/BarreauStore";
import { EXERCICES } from "../data/dashboard-data";
import {
  STATUT_META,
  QUALITE_LABEL,
  ligneCotisation,
} from "../data/derivations";
import { formatFCFA } from "../utils/format";

const FILTRES = [
  { value: "tous", label: "Tous les statuts" },
  { value: "ajour", label: "À jour" },
  { value: "partiel", label: "Partiel" },
  { value: "retard", label: "En retard" },
  { value: "exonere", label: "Exonéré" },
];

/** Modale d'historique des 7 exercices d'un membre (FR-COT-04 / FR-AV-06). */
function HistoriqueModal({ membre, onClose }) {
  return (
    <Modal open={!!membre} onClose={onClose} title={membre ? `Historique — Me ${membre.nom}` : ""}>
      {membre && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-gris">
              <th className="pb-2">Exercice</th>
              <th className="pb-2">Dû</th>
              <th className="pb-2">Payé</th>
              <th className="pb-2">Date</th>
              <th className="pb-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {EXERCICES.map((annee) => {
              const l = ligneCotisation(membre, annee);
              const meta = STATUT_META[l.statut];
              return (
                <tr key={annee} className="border-t border-grisL">
                  <td className="py-2 font-mono text-xs text-gris">{annee}</td>
                  <td className="py-2">{formatFCFA(l.montantDu)}</td>
                  <td className="py-2">{l.montantPaye ? formatFCFA(l.montantPaye) : "—"}</td>
                  <td className="py-2 text-xs text-gris">{l.datePaiement ?? "—"}</td>
                  <td className="py-2">
                    <Badge ton={meta.ton}>{meta.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

export function Cotisations() {
  const { cotisationsExercice } = useBarreau();
  const [exercice, setExercice] = useState(2026);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [historique, setHistorique] = useState(null);

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return cotisationsExercice(exercice).filter((l) => {
      if (filtre !== "tous" && l.statut !== filtre) return false;
      if (!q) return true;
      return (
        l.membre.nom.toLowerCase().includes(q) ||
        l.membre.cabinet.toLowerCase().includes(q) ||
        String(l.membre.num).includes(q)
      );
    });
  }, [cotisationsExercice, exercice, recherche, filtre]);

  return (
    <div className="space-y-5">
      <div>
        <div className="bpn-eyebrow">Finances</div>
        <h2 className="bpn-title mt-2">Cotisations ordinales</h2>
        <p className="mt-1 text-sm text-gris">
          Suivi des cotisations 2020–2026, recherche en temps réel et historique par avocat.
        </p>
      </div>

      {/* Onglets d'exercice */}
      <div className="flex flex-wrap gap-1 border-b border-grisM">
        {EXERCICES.map((annee) => (
          <button
            key={annee}
            type="button"
            onClick={() => setExercice(annee)}
            className={`-mb-px rounded-t px-4 py-2 font-mono text-xs transition ${
              annee === exercice
                ? "border-b-2 border-or bg-white text-navy"
                : "text-gris hover:text-encre"
            }`}
          >
            {annee}
          </button>
        ))}
      </div>

      {/* Recherche + filtre */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher par nom, cabinet ou n°…"
            className="bpn-input pl-9"
          />
        </div>
        <select
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          className="bpn-input sm:w-56"
        >
          {FILTRES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Tableau */}
      <div className="bpn-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-[9px] uppercase tracking-[0.1em] text-white/90">
                <th className="px-3 py-2.5 font-medium">N°</th>
                <th className="px-3 py-2.5 font-medium">Avocat</th>
                <th className="px-3 py-2.5 font-medium">Qualité</th>
                <th className="px-3 py-2.5 font-medium">Montant dû</th>
                <th className="px-3 py-2.5 font-medium">Montant payé</th>
                <th className="px-3 py-2.5 font-medium">Solde</th>
                <th className="px-3 py-2.5 font-medium">Date paiement</th>
                <th className="px-3 py-2.5 font-medium">Statut</th>
                <th className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const meta = STATUT_META[l.statut];
                return (
                  <tr key={l.membre.id} className="border-b border-grisL hover:bg-grisL/60">
                    <td className="px-3 py-2.5 font-mono text-xs text-gris">{l.membre.num}</td>
                    <td className="px-3 py-2.5 font-medium">Me {l.membre.nom}</td>
                    <td className="px-3 py-2.5">
                      <Badge ton={l.membre.qualite === "honoraire" ? "or" : "bleu"} dot={false}>
                        {QUALITE_LABEL[l.membre.qualite]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">{formatFCFA(l.montantDu)}</td>
                    <td
                      className="px-3 py-2.5 font-medium"
                      style={{
                        color:
                          l.statut === "ajour"
                            ? "var(--bpn-vert)"
                            : l.statut === "partiel"
                            ? "var(--bpn-or)"
                            : l.statut === "retard"
                            ? "var(--bpn-rouge)"
                            : "var(--bpn-gris)",
                      }}
                    >
                      {l.montantPaye ? formatFCFA(l.montantPaye) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {l.statut === "ajour" || l.statut === "exonere" ? (
                        <span className="font-medium text-vert">✓ Soldé</span>
                      ) : (
                        <span className="font-medium text-rouge">{formatFCFA(l.solde)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gris">{l.datePaiement ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge ton={meta.ton}>{meta.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setHistorique(l.membre)}
                        className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-[10px]"
                      >
                        Historique
                      </button>
                    </td>
                  </tr>
                );
              })}
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm text-gris">
                    Aucun membre ne correspond à la recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-grisM px-4 py-2.5 text-xs text-gris">
          {lignes.length} membre{lignes.length > 1 ? "s" : ""} affiché
          {lignes.length > 1 ? "s" : ""} · exercice {exercice}
        </div>
      </div>

      <HistoriqueModal membre={historique} onClose={() => setHistorique(null)} />
    </div>
  );
}

export default Cotisations;
