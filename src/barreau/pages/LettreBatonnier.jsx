import { useEffect, useState } from "react";
import { SparklesIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, PageHeader } from "../components";
import { genererBrouillonArticle } from "../data/publications";
import { archiverDoc, genererArticleLettre, getCalendrierEditorial } from "../api/resources";

const STATUT_META = {
  publie: { label: "Publié", ton: "vert" },
  redige: { label: "Rédigé", ton: "bleu" },
  a_rediger: { label: "À rédiger", ton: "or" },
};

export function LettreBatonnier() {
  const [calendrier, setCalendrier] = useState([]);
  const [articlesLettre, setArticlesLettre] = useState({});
  const [apercu, setApercu] = useState(null); // { mois, texte, simule }
  const [chargement, setChargement] = useState(null); // mois en cours de génération

  useEffect(() => {
    getCalendrierEditorial().then(setCalendrier).catch(() => setCalendrier([]));
  }, []);

  const ouvrirGeneration = async (mois, theme) => {
    const existant = articlesLettre[mois];
    if (existant) {
      setApercu({ mois, ...existant });
      return;
    }
    setChargement(mois);
    let resultat;
    try {
      // Génération serveur (IA Claude si configurée, sinon gabarit côté serveur).
      const r = await genererArticleLettre(mois, theme);
      resultat = { texte: r.texte, simule: r.simule };
    } catch {
      // Repli ultime côté client si l'API est injoignable.
      resultat = { texte: genererBrouillonArticle(mois, theme), simule: true };
    }
    setArticlesLettre((prev) => ({ ...prev, [mois]: resultat }));
    archiverDoc({ categorie: "Lettre du Bâtonnier", titre: `Projet d'article — ${mois}`, reference: mois, date: new Date().toISOString().slice(0, 10) }).catch(() => {});
    setChargement(null);
    setApercu({ mois, ...resultat });
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Documents" titre="Lettre du Bâtonnier" sousTitre="Calendrier éditorial mensuel — génération d'un projet d'article par assistance IA." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {calendrier.map((c) => {
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
                disabled={chargement === c.mois}
              >
                {chargement === c.mois ? (
                  <><SparklesIcon className="h-4 w-4 animate-pulse" /> Génération…</>
                ) : genere ? (
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
          {apercu?.simule
            ? "Brouillon généré à partir d'un gabarit (IA non configurée). À relire par le Bâtonnier."
            : "Projet rédigé par l'assistance IA (Claude). À relire et valider par le Bâtonnier."}
        </div>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-encre">
          {apercu?.texte}
        </pre>
      </Modal>
    </div>
  );
}

export default LettreBatonnier;
