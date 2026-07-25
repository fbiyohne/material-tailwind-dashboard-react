import { useEffect, useState } from "react";
import { SparklesIcon, DocumentTextIcon, CheckIcon, ArrowDownTrayIcon, PaperAirplaneIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, Notice, PageHeader, EmptyState, ErrorState, Skeleton, useToast } from "../components";
import { genererBrouillonArticle } from "../data/publications";
import { archiverDoc, genererArticleLettre, getCalendrierEditorial, majArticleLettre } from "../api/resources";

const STATUT_META = {
  publie: { label: "Publié", ton: "vert" },
  redige: { label: "Rédigé", ton: "bleu" },
  a_rediger: { label: "À rédiger", ton: "or" },
};

export function LettreBatonnier() {
  const toast = useToast();
  const [calendrier, setCalendrier] = useState([]);
  const [articlesLettre, setArticlesLettre] = useState({}); // mois -> { texte, simule, statut }
  const [apercu, setApercu] = useState(null); // { mois, simule, statut }
  const [brouillon, setBrouillon] = useState(""); // texte en cours d'édition
  const [chargement, setChargement] = useState(null); // mois en cours de génération
  const [chargementCal, setChargementCal] = useState(true);
  const [erreur, setErreur] = useState(false);

  const charger = () => {
    setChargementCal(true);
    setErreur(false);
    getCalendrierEditorial()
      .then((entrees) => {
        setCalendrier(entrees);
        // Hydratation des articles déjà rédigés/publiés (persistés côté serveur)
        // pour qu'ils survivent au rechargement et soient partagés entre postes.
        const articles = {};
        for (const e of entrees) {
          if (e.texte) articles[e.mois] = { texte: e.texte, simule: e.simule ?? true, statut: e.statut };
        }
        setArticlesLettre(articles);
      })
      .catch(() => setErreur(true))
      .finally(() => setChargementCal(false));
  };
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Ouvre l'éditeur sur un article (charge son texte dans le brouillon). */
  const ouvrirEditeur = (mois, article) => {
    setBrouillon(article.texte);
    setApercu({ mois, simule: article.simule, statut: article.statut ?? "redige" });
  };

  const ouvrirGeneration = async (mois, theme) => {
    const existant = articlesLettre[mois];
    if (existant) {
      ouvrirEditeur(mois, existant);
      return;
    }
    setChargement(mois);
    let resultat;
    try {
      // Génération serveur (IA Claude si configurée, sinon gabarit côté serveur).
      const r = await genererArticleLettre(mois, theme);
      resultat = { texte: r.texte, simule: r.simule, statut: "redige" };
    } catch {
      // Repli ultime côté client si l'API est injoignable.
      resultat = { texte: genererBrouillonArticle(mois, theme), simule: true, statut: "redige" };
    }
    setArticlesLettre((prev) => ({ ...prev, [mois]: resultat }));
    // Persistance du projet dès sa génération (survit au rechargement).
    try { await majArticleLettre(mois, { texte: resultat.texte, statut: "redige", simule: resultat.simule }); }
    catch (e) { toast.error(`Article généré mais non enregistré : ${e.message}`); }
    archiverDoc({ categorie: "Lettre du Bâtonnier", titre: `Projet d'article — ${mois}`, reference: mois, date: new Date().toISOString().slice(0, 10) }).catch(() => {});
    setChargement(null);
    ouvrirEditeur(mois, resultat);
  };

  /** Enregistre les modifications du Bâtonnier ; `publier` marque l'article publié. */
  const enregistrer = async (publier = false) => {
    if (!apercu) return;
    const statut = publier ? "publie" : apercu.statut ?? "redige";
    // Persistance serveur d'abord : on ne met à jour l'état local et le calendrier
    // qu'en cas de succès, pour éviter d'afficher un état non enregistré.
    try {
      await majArticleLettre(apercu.mois, { texte: brouillon, statut, simule: apercu.simule });
    } catch (e) {
      toast.error(e.message);
      return;
    }
    setArticlesLettre((prev) => ({ ...prev, [apercu.mois]: { texte: brouillon, simule: apercu.simule, statut } }));
    setCalendrier((prev) => prev.map((c) => (c.mois === apercu.mois ? { ...c, statut } : c)));
    setApercu((a) => (a ? { ...a, statut } : a));
    archiverDoc({
      categorie: "Lettre du Bâtonnier",
      titre: `${publier ? "Article publié" : "Projet d'article"} — ${apercu.mois}`,
      reference: apercu.mois,
      date: new Date().toISOString().slice(0, 10),
    }).catch(() => {});
    toast.success(publier ? `Article de ${apercu.mois} enregistré et publié.` : "Modifications enregistrées.");
    if (publier) setApercu(null);
  };

  /** Export texte (.txt) — disponible partout, sans dépendance serveur. */
  const telechargerTxt = () => {
    if (!apercu) return;
    const blob = new Blob([brouillon], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Lettre-Batonnier-${apercu.mois}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Documents" titre="Lettre du Bâtonnier" sousTitre="Calendrier éditorial mensuel — génération d'un projet d'article par assistance IA, puis édition par le Bâtonnier." />

      {chargementCal ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bpn-card space-y-3 p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : erreur ? (
        <div className="bpn-card p-6"><ErrorState onRetry={charger} /></div>
      ) : calendrier.length === 0 ? (
        <div className="bpn-card">
          <EmptyState
            icon={CalendarDaysIcon}
            title="Aucun calendrier éditorial"
            description="Le calendrier éditorial de la Lettre du Bâtonnier n'est pas encore disponible."
          />
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {calendrier.map((c) => {
          const article = articlesLettre[c.mois];
          const meta = article ? STATUT_META[article.statut] : STATUT_META[c.statut];
          return (
            <div key={c.mois} className="bpn-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-display text-base text-navy">{c.mois}</span>
                <Badge ton={meta.ton}>{meta.label}</Badge>
              </div>
              <p className="mt-2 min-h-[2.5rem] text-sm text-gris">
                <span className="text-xs uppercase tracking-wide text-or">Thème</span>
                <br />
                {c.theme}
              </p>
              <button
                className="bpn-btn bpn-btn-ghost mt-3 w-full justify-center !py-1.5 text-xs"
                onClick={() => ouvrirGeneration(c.mois, c.theme)}
                disabled={chargement === c.mois}
              >
                {chargement === c.mois ? (
                  <><SparklesIcon className="h-4 w-4 animate-pulse" /> Génération…</>
                ) : article ? (
                  <><DocumentTextIcon className="h-4 w-4" /> Ouvrir l'éditeur</>
                ) : (
                  <><SparklesIcon className="h-4 w-4" /> Générer un projet</>
                )}
              </button>
            </div>
          );
        })}
      </div>
      )}

      <Modal
        open={!!apercu}
        onClose={() => setApercu(null)}
        title={apercu ? `Lettre du Bâtonnier — ${apercu.mois}` : ""}
        footer={
          apercu ? (
            <>
              <button className="bpn-btn bpn-btn-ghost" onClick={telechargerTxt}>
                <ArrowDownTrayIcon className="h-4 w-4" /> Télécharger .txt
              </button>
              <button className="bpn-btn bpn-btn-primary" onClick={() => enregistrer(false)}>
                <CheckIcon className="h-4 w-4" /> Enregistrer
              </button>
              <button className="bpn-btn bpn-btn-or" onClick={() => enregistrer(true)}>
                <PaperAirplaneIcon className="h-4 w-4" /> Enregistrer &amp; publier
              </button>
            </>
          ) : null
        }
      >
        <Notice ton="or" icon={SparklesIcon} className="mb-3">
          {apercu?.simule
            ? "Brouillon généré à partir d'un gabarit (IA non configurée). Le Bâtonnier peut le modifier ci-dessous avant de l'enregistrer ou de le publier."
            : "Projet rédigé par l'assistance IA (Claude). Le Bâtonnier peut le modifier ci-dessous avant publication."}
        </Notice>
        <textarea
          value={brouillon}
          onChange={(e) => setBrouillon(e.target.value)}
          rows={18}
          className="bpn-input w-full resize-y font-sans text-sm leading-7"
          aria-label={`Contenu de la lettre — ${apercu?.mois ?? ""}`}
        />
        <div className="mt-1 text-right text-xs text-gris">{brouillon.length} caractères</div>
      </Modal>
    </div>
  );
}

export default LettreBatonnier;
