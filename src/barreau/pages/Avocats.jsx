import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MagnifyingGlassIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Badge, StatutBadge, AttestationModal, useToast, useConfirm, ImportMembresModal, PageHeader, DataTable } from "../components";
import { useAuth } from "../auth/AuthContext";
import { STATUT_META, QUALITE_LABEL } from "../data/derivations";
import { EXERCICE_COURANT } from "../data/dashboard-data";
import { telechargerCsv } from "../utils/exportCsv";
import { listerMembres, getCotisations, supprimerMembre } from "../api/resources";

const FILTRES = [
  { value: "tous", label: "Tous les statuts" },
  { value: "inscrit", label: "Inscrit" },
  { value: "suspendu", label: "Suspendu" },
  { value: "omis", label: "Omis" },
  { value: "radie", label: "Radié" },
  { value: "honoraire", label: "Honoraire" },
];

// Le tableau du Barreau (≈ 139 inscrits) tient sous le plafond serveur (pageSize 200) :
// un seul appel ramène toute la liste filtrée, puis le DataTable trie/pagine/sélectionne
// côté client (sélection inter-pages + export de la sélection).
const COLONNES_CSV = [
  { label: "N°", valeur: (m) => m.num },
  { label: "Avocat", valeur: (m) => `Me ${m.nom}` },
  { label: "Cabinet", valeur: (m) => m.cabinet },
  { label: "Qualité", valeur: (m) => QUALITE_LABEL[m.qualite] },
  { label: "Statut", valeur: (m) => m.statut },
];

export function Avocats() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const peutImporter = user?.role === "SECRETAIRE_GENERAL" || user?.role === "ADMIN";
  const estAdmin = user?.role === "ADMIN";
  const [params, setParams] = useSearchParams();
  const [attestation, setAttestation] = useState(null);
  const [importOuvert, setImportOuvert] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [membres, setMembres] = useState([]);
  const [statutCot, setStatutCot] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  const filtre = params.get("statut") || "tous";
  const recherche = params.get("q") || "";
  const setParam = (k, v, vide) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (v && v !== vide) p.set(k, v);
      else p.delete(k);
      return p;
    }, { replace: true });
  };

  // Liste filtrée côté serveur (recherche + statut), rendue intégralement côté client.
  const charger = useCallback(() => {
    setChargement(true);
    setErreur(false);
    listerMembres({
      qualiteNot: "STAGIAIRE",
      ...(recherche ? { q: recherche } : {}),
      ...(filtre !== "tous" ? { statut: filtre.toUpperCase() } : {}),
      pageSize: 200,
    })
      .then((d) => setMembres(d.items ?? []))
      .catch(() => setErreur(true))
      .finally(() => setChargement(false));
  }, [recherche, filtre]);
  useEffect(() => { charger(); }, [charger, refresh]);

  // Statut de cotisation de l'exercice courant (jointure côté client).
  // Indépendant des filtres/recherche : on le charge une fois (et à chaque
  // rafraîchissement explicite), pas à chaque rechargement de la liste.
  useEffect(() => {
    getCotisations(EXERCICE_COURANT)
      .then((lignes) => setStatutCot(Object.fromEntries(lignes.map((l) => [l.membre.id, l.statut]))))
      .catch(() => toast.error("Statuts de cotisation indisponibles."));
  }, [toast, refresh]);

  // Suppression définitive d'un membre (cascade) — réservée au super-administrateur (ADMIN).
  const supprimer = async (m) => {
    const ok = await confirm({
      title: "Supprimer l'avocat",
      message: `Me ${m.nom} sera définitivement supprimé, ainsi que tout son historique financier (cotisations, droits, reçus, quitus, paiements). Cette action est irréversible.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try { await supprimerMembre(m.id); toast.success(`Me ${m.nom} supprimé.`); setRefresh((n) => n + 1); }
    catch (e) { toast.error(e.message); }
  };

  const colonnes = [
    { key: "num", label: "N°", sortable: true, sortValue: (m) => m.num,
      cell: (m) => <span className="font-mono text-xs text-gris">{m.num}</span> },
    { key: "nom", label: "Avocat", sortable: true, sortValue: (m) => m.nom,
      cell: (m) => <span className="font-medium">Me {m.nom}</span> },
    { key: "cabinet", label: "Cabinet", sortable: true, sortValue: (m) => m.cabinet,
      cell: (m) => <span className="text-gris">{m.cabinet || "—"}</span> },
    { key: "qualite", label: "Qualité",
      cell: (m) => <Badge ton={m.qualite === "honoraire" ? "or" : "bleu"} dot={false}>{QUALITE_LABEL[m.qualite]}</Badge> },
    { key: "statut", label: "Statut", sortable: true, sortValue: (m) => m.statut,
      cell: (m) => <StatutBadge statut={m.statut} /> },
    { key: "cotis", label: `Cotisation ${EXERCICE_COURANT}`,
      cell: (m) => {
        const st = statutCot[m.id];
        // Pas de statut connu (chargement ou échec de la jointure) → neutre,
        // surtout pas « En retard » par défaut (faux positif sur honoraires/inconnus).
        if (!st) return <span className="text-xs text-gris">—</span>;
        const meta = STATUT_META[st] ?? { ton: "gris", label: st };
        return <Badge ton={meta.ton}>{meta.label}</Badge>;
      } },
    { key: "actions", label: "Actions", align: "right",
      cell: (m) => (
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" onClick={() => navigate(`/avocats/${m.id}`)} className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs">Fiche</button>
          {peutImporter && (
            <button type="button" onClick={() => setAttestation(m)} className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs">Attestation</button>
          )}
          {estAdmin && (
            <button type="button" onClick={() => supprimer(m)} className="bpn-btn bpn-btn-ghost !px-2 !py-1 text-xs text-rouge" title="Supprimer définitivement">
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Membres" titre="Avocats inscrits" sousTitre="Tableau du Barreau — recherche multicritères, fiche individuelle et attestation d'inscription.">
        <button className="bpn-btn bpn-btn-ghost" disabled={membres.length === 0}
          onClick={() => telechargerCsv("Avocats", COLONNES_CSV, membres)}>
          <ArrowDownTrayIcon className="h-4 w-4" /> Export CSV
        </button>
        {peutImporter && (
          <button className="bpn-btn bpn-btn-ghost" onClick={() => setImportOuvert(true)}>
            <ArrowUpTrayIcon className="h-4 w-4" /> Importer (Excel/CSV)
          </button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
          <input type="text" value={recherche} onChange={(e) => setParam("q", e.target.value, "")} placeholder="Rechercher par nom, cabinet ou n°…" className="bpn-input pl-9" />
        </div>
        <select value={filtre} onChange={(e) => setParam("statut", e.target.value, "tous")} className="bpn-input sm:w-56">
          {FILTRES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      <div className="bpn-card">
        <DataTable
          columns={colonnes}
          rows={membres}
          getRowId={(m) => m.id}
          loading={chargement}
          error={erreur}
          onRetry={charger}
          emptyTitle="Aucun avocat"
          emptyDescription="Aucun avocat ne correspond à votre recherche."
          selectable
          libelle="avocats"
          initialSort={{ key: "num", dir: "asc" }}
          renderBulkActions={(ids) => (
            <button type="button" className="bpn-btn bpn-btn-ghost !py-1 text-xs"
              onClick={() => telechargerCsv("Avocats-selection", COLONNES_CSV, membres.filter((m) => ids.includes(m.id)))}>
              <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Exporter la sélection (CSV)
            </button>
          )}
        />
      </div>

      <AttestationModal membre={attestation} onClose={() => setAttestation(null)} />
      <ImportMembresModal open={importOuvert} onClose={() => setImportOuvert(false)} onDone={() => setRefresh((n) => n + 1)} />
    </div>
  );
}

export default Avocats;
