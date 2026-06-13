import { useState } from "react";
import { SparklesIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { Badge, Modal } from "../components";
import { calendrierLettre, genererBrouillonArticle } from "../data/publications";
import { archiverDoc } from "../api/resources";

const STATUT_META = {
  publie: { label: "Publié", ton: "vert" },
  redige: { label: "Rédigé", ton: "bleu" },
  a_rediger: { label: "À rédiger", ton: "or" },
};

export function LettreBatonnier() {
  const [articlesLettre, setArticlesLettre] = useState({});
  const [apercu, setApercu] = useState(null); // { mois, texte }

  const ouvrirGeneration = (mois, theme) => {
    let texte = articlesLettre[mois];
    if (!texte) {
      texte = genererBrouillonArticle(mois, theme);
      setArticlesLettre((prev) => ({ ...prev, [mois]: texte }));
      archiverDoc({ categorie: "Lettre du Bâtonnier", titre: `Projet d'article — ${mois}`, reference: mois, date: new Date().toISOString().slice(0, 10) }).catch(() => {});
    }
    setApercu({ mois, texte });
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="bpn-eyebrow">Documents</div>
        <h2 className="bpn-title mt-2">Lettre du Bâtonnier</h2>
        <p className="mt-1 text-sm text-gris">
          Calendrier éditorial mensuel — génération d'un projet d'article par assistance IA.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {calendrierLettre.map((c) => {
          const genere = !!articlesLettre[c.mois];
          const meta = STATUT_META[genere ? "redige" : c.statut];
          return (
            <div key={c.mois} className="bpn-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-display text-base text-navy">{c.mois}</span>
                <Badge ton={meta.ton}>{meta.label}</Badge>
              </div>
              <p className="mt-2 min-h-[2.5rem] text-sm text-gris">
                <span className="text-[10px] uppercase tracking-wide text-or">Thème</span>
                <br />
                {c.theme}
              </p>
              <button
                className="bpn-btn bpn-btn-ghost mt-3 w-full justify-center !py-1.5 text-[11px]"
                onClick={() => ouvrirGeneration(c.mois, c.theme)}
              >
                {genere ? (
                  <><DocumentTextIcon className="h-4 w-4" /> Voir le projet</>
                ) : (
                  <><SparklesIcon className="h-4 w-4" /> Générer un projet</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <Modal
        open={!!apercu}
        onClose={() => setApercu(null)}
        title={apercu ? `Projet d'article — ${apercu.mois}` : ""}
      >
        <div className="mb-3 flex items-center gap-2 rounded border-l-[3px] border-or bg-or-L px-3 py-2 text-xs text-gris">
          <SparklesIcon className="h-4 w-4 shrink-0 text-or" />
          Brouillon généré automatiquement (gabarit). En V2, rédigé par l'assistance IA puis
          relu par le Bâtonnier.
        </div>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-encre">
          {apercu?.texte}
        </pre>
      </Modal>
    </div>
  );
}

export default LettreBatonnier;
