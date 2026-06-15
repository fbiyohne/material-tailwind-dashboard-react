import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PrinterIcon } from "@heroicons/react/24/outline";
import { Badge, useToast, PageHeader } from "../components";
import { formatDate } from "../utils/format";
import { infoStage } from "../data/derivations";
import { listerMembres } from "../api/resources";

const FILTRES = [
  { value: "tous", label: "Tous" },
  { value: "encours", label: "En cours" },
  { value: "termine", label: "Terminés" },
];

function CarteStagiaire({ membre, stage, onFiche }) {
  return (
    <div className="bpn-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-base text-navy">Me {membre.nom}</div>
          <div className="text-xs text-gris">{membre.cabinet}</div>
        </div>
        <Badge ton={stage.termine ? "vert" : "bleu"}>
          {stage.termine ? "Stage terminé" : "En cours"}
        </Badge>
      </div>

      <div className="mt-3 space-y-1 text-xs text-gris">
        <div className="flex justify-between">
          <span>Serment</span>
          <span className="text-encre">{formatDate(stage.debut)}</span>
        </div>
        <div className="flex justify-between">
          <span>Maître de stage</span>
          <span className="text-encre">{stage.maitreStage}</span>
        </div>
        <div className="flex justify-between">
          <span>Fin prévue</span>
          <span className="text-encre">{formatDate(stage.fin)}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-gris">Progression</span>
          <span className="font-mono text-or">{stage.progression}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-grisM">
          <div
            className="h-full rounded transition-all"
            style={{
              width: `${stage.progression}%`,
              backgroundColor: stage.termine ? "var(--bpn-vert)" : "var(--bpn-or)",
            }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onFiche(membre)}
        className="bpn-btn bpn-btn-ghost mt-3 w-full justify-center !py-1.5 text-xs"
      >
        Voir la fiche
      </button>
    </div>
  );
}

export function Stagiaires() {
  const navigate = useNavigate();
  const toast = useToast();
  const [membres, setMembres] = useState([]);
  const [filtre, setFiltre] = useState("tous");

  useEffect(() => {
    listerMembres({ qualite: "STAGIAIRE" })
      .then((d) => setMembres(d.items))
      .catch((e) => toast.error(e.message));
  }, [toast]);

  const stagiaires = useMemo(
    () =>
      membres
        .map((m) => ({ membre: m, stage: infoStage(m) }))
        .filter(({ stage }) => stage)
        .filter(({ stage }) =>
          filtre === "tous" ? true : filtre === "termine" ? stage.termine : !stage.termine
        ),
    [membres, filtre]
  );

  return (
    <div className="space-y-5">
      <PageHeader className="bpn-no-print" eyebrow="Membres" titre="Avocats stagiaires" sousTitre="Liste de stage — suivi de la progression et du maître de stage.">
        {FILTRES.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFiltre(f.value)}
            className={`rounded px-3 py-1 text-xs transition ${
              filtre === f.value ? "bg-navy text-white" : "bg-grisL text-gris hover:bg-grisM"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => window.print()}
          className="bpn-btn bpn-btn-ghost !py-1.5 text-xs"
        >
          <PrinterIcon className="h-4 w-4" />
          Liste
        </button>
      </PageHeader>

      <div className="bpn-no-print grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stagiaires.map(({ membre, stage }) => (
          <CarteStagiaire key={membre.id} membre={membre} stage={stage} onFiche={(m) => navigate(`/avocats/${m.id}`)} />
        ))}
        {stagiaires.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-gris">
            Aucun stagiaire pour ce filtre.
          </p>
        )}
      </div>

      {/* Liste imprimable (FR-ST — génération de la liste des stagiaires) */}
      <div className="bpn-print-zone hidden print:block">
        <div className="mb-2 text-center font-display text-xl text-navy">
          Liste des avocats stagiaires — Barreau de Pointe-Noire
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy text-left text-xs uppercase text-navy">
              <th className="py-1">N°</th>
              <th className="py-1">Stagiaire</th>
              <th className="py-1">Cabinet</th>
              <th className="py-1">Serment</th>
              <th className="py-1">Maître de stage</th>
              <th className="py-1">Statut</th>
            </tr>
          </thead>
          <tbody>
            {stagiaires.map(({ membre, stage }) => (
              <tr key={membre.id} className="border-b border-grisL">
                <td className="py-1 font-mono text-xs">{membre.num}</td>
                <td className="py-1">Me {membre.nom}</td>
                <td className="py-1">{membre.cabinet}</td>
                <td className="py-1">{formatDate(stage.debut)}</td>
                <td className="py-1">{stage.maitreStage}</td>
                <td className="py-1">{stage.termine ? "Terminé" : "En cours"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

export default Stagiaires;
