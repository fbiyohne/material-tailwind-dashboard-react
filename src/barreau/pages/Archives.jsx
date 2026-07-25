import { useCallback, useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon, DocumentArrowDownIcon, ArrowDownTrayIcon, ArchiveBoxIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, useToast, useConfirm, PageHeader, DataTable } from "../components";
import { formatDate } from "../utils/format";
import { telechargerCsv } from "../utils/exportCsv";
import { categoriesArchives } from "../data/config";
import { useAuth } from "../auth/AuthContext";
import { listerArchives, supprimerArchive } from "../api/resources";

const COLONNES_CSV = [
  { label: "Date", valeur: (a) => formatDate(a.date) },
  { label: "Catégorie", valeur: (a) => a.categorie },
  { label: "Document", valeur: (a) => a.titre },
  { label: "Référence", valeur: (a) => a.reference },
];

export function Archives() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  // Suppression d'archive réservée au SG (DELETE /archives = requireRole("SECRETAIRE_GENERAL")) :
  // on masque le bouton pour le Bâtonnier plutôt que de le laisser buter sur un 403.
  const peutSupprimer = ["SECRETAIRE_GENERAL", "ADMIN"].includes(user?.role);
  const [archives, setArchives] = useState([]);
  const [categories, setCategories] = useState(["toutes"]);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("toutes");
  const [apercu, setApercu] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  const charger = useCallback(() => {
    setChargement(true);
    setErreur(false);
    listerArchives()
      .then((d) => {
        setArchives(d.archives.map((a) => ({ ...a, date: a.date ? String(a.date).slice(0, 10) : "" })));
        // Fusionne les catégories de référence (Paramètres) et celles réellement
        // présentes dans les archives, pour un filtre complet et stable.
        const fusion = Array.from(new Set([...categoriesArchives(), ...d.categories]));
        setCategories(["toutes", ...fusion]);
      })
      .catch(() => setErreur(true))
      .finally(() => setChargement(false));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const supprimer = async (a) => {
    const ok = await confirm({
      title: "Supprimer l'archive",
      message: `« ${a.titre} » (réf. ${a.reference}) sera retirée du registre documentaire. L'action est tracée dans le journal d'audit. Continuer ?`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try { await supprimerArchive(a.id); toast.success("Archive supprimée."); charger(); }
    catch (e) { toast.error(e.message); }
  };

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return archives.filter((a) => {
      if (categorie !== "toutes" && a.categorie !== categorie) return false;
      if (!q) return true;
      return a.titre.toLowerCase().includes(q) || String(a.reference).toLowerCase().includes(q);
    });
  }, [archives, recherche, categorie]);

  const colonnes = [
    { key: "date", label: "Date", sortable: true, sortValue: (a) => a.date,
      cell: (a) => <span className="text-xs text-gris">{formatDate(a.date)}</span> },
    { key: "categorie", label: "Catégorie", sortable: true, sortValue: (a) => a.categorie.toLowerCase(),
      cell: (a) => <Badge ton="bleu" dot={false}>{a.categorie}</Badge> },
    { key: "titre", label: "Document", sortable: true, sortValue: (a) => a.titre.toLowerCase(),
      cell: (a) => <span className="font-medium">{a.titre}</span> },
    { key: "reference", label: "Référence", cell: (a) => <span className="font-mono text-xs text-or">{a.reference}</span> },
    { key: "actions", label: "Action", align: "right",
      cell: (a) => (
        <div className="flex items-center justify-end gap-1.5">
          <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs" onClick={() => setApercu(a)}>
            <DocumentArrowDownIcon className="h-3.5 w-3.5" /> Consulter
          </button>
          {peutSupprimer && (
            <button
              type="button"
              onClick={() => supprimer(a)}
              title="Supprimer l'archive"
              aria-label={`Supprimer l'archive « ${a.titre} »`}
              className="rounded p-1.5 text-gris transition hover:bg-rougeL hover:text-rouge"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Documents" titre="Archives institutionnelles" sousTitre="Tout document officiel généré est archivé automatiquement (RG-14). Recherche par mot-clé, catégorie et date.">
        <button className="bpn-btn bpn-btn-ghost" disabled={lignes.length === 0}
          onClick={() => telechargerCsv("Archives", COLONNES_CSV, lignes)}>
          <ArrowDownTrayIcon className="h-4 w-4" /> Export CSV
        </button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
          <input type="text" value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher par titre ou référence…" aria-label="Rechercher un document" className="bpn-input pl-9" />
        </div>
        <select value={categorie} onChange={(e) => setCategorie(e.target.value)} aria-label="Filtrer par catégorie" className="bpn-input sm:w-64">
          {categories.map((c) => (
            <option key={c} value={c}>{c === "toutes" ? "Toutes les catégories" : c}</option>
          ))}
        </select>
      </div>

      <div className="bpn-card">
        <DataTable
          columns={colonnes}
          rows={lignes}
          getRowId={(a) => `${a.reference}-${a.titre}`}
          loading={chargement}
          error={erreur}
          onRetry={charger}
          pageSize={12}
          libelle="documents"
          initialSort={{ key: "date", dir: "desc" }}
          emptyIcon={ArchiveBoxIcon}
          emptyTitle="Aucun document"
          emptyDescription={recherche || categorie !== "toutes" ? "Aucun document archivé ne correspond à ce filtre." : "Aucun document archivé pour le moment."}
        />
      </div>

      <Modal open={!!apercu} onClose={() => setApercu(null)} title={apercu?.titre ?? "Document archivé"}>
        {apercu && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge ton="bleu" dot={false}>{apercu.categorie}</Badge>
              <span className="font-mono text-xs text-or">{apercu.reference}</span>
            </div>
            <dl className="divide-y divide-grisL text-sm">
              <div className="flex justify-between gap-4 py-2"><dt className="text-gris">Date d'archivage</dt><dd className="font-medium text-encre">{formatDate(apercu.date)}</dd></div>
              <div className="flex justify-between gap-4 py-2"><dt className="text-gris">Catégorie</dt><dd className="font-medium text-encre">{apercu.categorie}</dd></div>
              <div className="flex justify-between gap-4 py-2"><dt className="text-gris">Référence</dt><dd className="font-mono text-encre">{apercu.reference}</dd></div>
              {apercu.membreNom && <div className="flex justify-between gap-4 py-2"><dt className="text-gris">Concerné</dt><dd className="font-medium text-encre">Me {apercu.membreNom}</dd></div>}
            </dl>
            <p className="rounded border-l-[3px] border-or bg-or-L px-3 py-2 text-xs text-gris">
              Cette entrée trace un document officiel généré par l'application. Le PDF se régénère
              depuis le module d'origine (reçu, quitus, attestation, convocation…).
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Archives;
