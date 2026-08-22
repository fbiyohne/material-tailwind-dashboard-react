import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PrinterIcon, TrashIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Badge, Pagination, useToast, useConfirm, PageHeader, TableSkeleton, ErrorState, ImportMembresModal } from "../components";
import { useAuth } from "../auth/AuthContext";
import { formatDate } from "../utils/format";
import { infoStage } from "../data/derivations";
import { identite } from "../data/config";
import { telechargerCsv } from "../utils/exportCsv";
import { listerMembres, supprimerMembre } from "../api/resources";

const FILTRES = [
  { value: "tous", label: "Tous" },
  { value: "encours", label: "En cours" },
  { value: "termine", label: "Terminés" },
];

// Colonnes de l'export CSV — spécifiques au stage (le champ stage est déjà dérivé
// via infoStage). Chaque ligne exportée est un objet { membre, stage }.
const COLONNES_CSV = [
  { label: "N°", valeur: ({ membre }) => membre.num },
  { label: "Stagiaire", valeur: ({ membre }) => `Me ${membre.nom}` },
  { label: "Cabinet", valeur: ({ membre }) => membre.cabinet },
  { label: "Serment", valeur: ({ stage }) => formatDate(stage?.debut) },
  { label: "Maître de stage", valeur: ({ stage }) => stage?.maitreStage ?? "" },
  { label: "Fin prévue", valeur: ({ stage }) => formatDate(stage?.fin) },
  { label: "Progression", valeur: ({ stage }) => `${stage?.progression ?? 0}%` },
  { label: "Statut", valeur: ({ stage }) => (!stage ? "Serment à renseigner" : stage.termine ? "Terminé" : "En cours") },
];

function CarteStagiaire({ membre, stage, onFiche, onSupprimer }) {
  // Un stagiaire sans date de serment n'a pas de stage dérivé (stage === null) :
  // on l'affiche quand même, avec une mention « Serment à renseigner », plutôt
  // que de le faire disparaître de la liste.
  const sansServment = !stage;
  const progression = stage?.progression ?? 0;
  return (
    <div className="bpn-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-base text-navy">Me {membre.nom}</div>
          <div className="text-xs text-gris">{membre.cabinet}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge ton={sansServment ? "or" : stage.termine ? "vert" : "bleu"}>
            {sansServment ? "Serment à renseigner" : stage.termine ? "Stage terminé" : "En cours"}
          </Badge>
          {onSupprimer && (
            <button type="button" onClick={() => onSupprimer(membre)} className="bpn-btn bpn-btn-ghost !px-1.5 !py-1 text-xs text-rouge" title="Supprimer définitivement">
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs text-gris">
        <div className="flex justify-between">
          <span>Serment</span>
          <span className="text-encre">{formatDate(stage?.debut)}</span>
        </div>
        <div className="flex justify-between">
          <span>Maître de stage</span>
          <span className="text-encre">{stage?.maitreStage ?? "—"}</span>
        </div>
        <div className="flex justify-between">
          <span>Fin prévue</span>
          <span className="text-encre">{formatDate(stage?.fin)}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-gris">Progression</span>
          <span className="font-mono text-or-fonce">{progression}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-grisM">
          <div
            className="h-full rounded transition-all"
            style={{
              width: `${progression}%`,
              backgroundColor: stage?.termine ? "var(--bpn-vert)" : "var(--bpn-or)",
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
  const confirm = useConfirm();
  const { user } = useAuth();
  const estAdmin = user?.role === "ADMIN";
  const peutImporter = user?.role === "SECRETAIRE_GENERAL" || user?.role === "ADMIN";
  const [membres, setMembres] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [filtre, setFiltre] = useState("tous");
  const [importOuvert, setImportOuvert] = useState(false);

  const charger = useCallback(() => {
    setChargement(true);
    setErreur(false);
    listerMembres({ qualite: "STAGIAIRE" })
      .then((d) => setMembres(d.items))
      .catch(() => setErreur(true))
      .finally(() => setChargement(false));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  // Suppression définitive d'un stagiaire (cascade) — super-administrateur (ADMIN).
  const supprimer = async (m) => {
    const ok = await confirm({
      title: "Supprimer le stagiaire",
      message: `Me ${m.nom} sera définitivement supprimé, ainsi que tout son historique rattaché. Cette action est irréversible.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try { await supprimerMembre(m.id); toast.success(`Me ${m.nom} supprimé.`); charger(); }
    catch (e) { toast.error(e.message); }
  };

  const stagiaires = useMemo(
    () =>
      membres
        // On conserve TOUS les stagiaires, y compris ceux sans date de serment
        // (stage === null) : un serment non renseigné compte comme « en cours ».
        .map((m) => ({ membre: m, stage: infoStage(m) }))
        .filter(({ stage }) =>
          filtre === "tous" ? true : filtre === "termine" ? stage?.termine : !stage?.termine
        )
        .filter(({ membre: m }) => {
          const q = recherche.trim().toLowerCase();
          return !q || m.nom.toLowerCase().includes(q) || (m.cabinet ?? "").toLowerCase().includes(q);
        }),
    [membres, filtre, recherche]
  );

  // Pagination de la grille (l'impression, elle, liste tous les stagiaires).
  const PAR_PAGE = 10;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [filtre, recherche]);
  const totalPages = Math.max(1, Math.ceil(stagiaires.length / PAR_PAGE));
  const pageCourante = Math.min(page, totalPages);
  const visibles = stagiaires.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE);

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
        <button
          type="button"
          className="bpn-btn bpn-btn-ghost !py-1.5 text-xs"
          disabled={stagiaires.length === 0}
          onClick={() => telechargerCsv("Stagiaires", COLONNES_CSV, stagiaires)}
        >
          <ArrowDownTrayIcon className="h-4 w-4" /> Export CSV
        </button>
        {peutImporter && (
          <button
            type="button"
            className="bpn-btn bpn-btn-ghost !py-1.5 text-xs"
            onClick={() => setImportOuvert(true)}
          >
            <ArrowUpTrayIcon className="h-4 w-4" /> Importer (Excel/CSV)
          </button>
        )}
      </PageHeader>

      <div className="bpn-no-print relative max-w-md">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
        <input type="text" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher par nom ou cabinet…" aria-label="Rechercher un stagiaire" className="bpn-input pl-9" />
      </div>

      {chargement ? (
        <div className="bpn-no-print"><TableSkeleton rows={6} cols={3} /></div>
      ) : erreur ? (
        <div className="bpn-no-print bpn-card p-6">
          <ErrorState title="Indisponible" description="La liste des stagiaires n'a pas pu être chargée." onRetry={charger} />
        </div>
      ) : (
        <div className="bpn-no-print grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map(({ membre, stage }) => (
            <CarteStagiaire key={membre.id} membre={membre} stage={stage} onFiche={(m) => navigate(`/avocats/${m.id}`)} onSupprimer={estAdmin ? supprimer : undefined} />
          ))}
          {stagiaires.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-gris">
              Aucun stagiaire pour ce filtre.
            </p>
          )}
        </div>
      )}

      {!chargement && !erreur && totalPages > 1 && (
        <div className="bpn-no-print bpn-card">
          <Pagination page={pageCourante} totalPages={totalPages} total={stagiaires.length} onPage={setPage} libelle="stagiaires" />
        </div>
      )}

      {/* Liste imprimable (FR-ST — génération de la liste des stagiaires) */}
      <div className="bpn-print-zone hidden print:block">
        <div className="mb-2 text-center font-display text-xl text-navy">
          Liste des avocats stagiaires — {identite().denomination}
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
                <td className="py-1">{formatDate(stage?.debut)}</td>
                <td className="py-1">{stage?.maitreStage ?? "—"}</td>
                <td className="py-1">{!stage ? "Serment à renseigner" : stage.termine ? "Terminé" : "En cours"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ImportMembresModal
        open={importOuvert}
        onClose={() => setImportOuvert(false)}
        onDone={charger}
        qualiteDefaut="STAGIAIRE"
        title="Importer des avocats stagiaires"
        description={
          <>
            Sélectionnez un fichier <strong>.xlsx</strong> ou <strong>.csv</strong>. Les stagiaires sont mis à jour
            par numéro d'inscription (les nouveaux sont créés). Sans colonne « qualité », les lignes sont importées
            comme <strong>stagiaires</strong>. Colonnes reconnues : num, nom, qualité, statut, cabinet, téléphone,
            email, adresse, observations, maître de stage, date de serment, dates.
          </>
        }
      />
    </div>
  );
}

export default Stagiaires;
