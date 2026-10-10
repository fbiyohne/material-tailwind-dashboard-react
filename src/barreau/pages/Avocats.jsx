import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MagnifyingGlassIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, ChevronDownIcon, DocumentIcon, DocumentTextIcon, TableCellsIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Badge, StatutBadge, AttestationModal, useToast, useConfirm, ImportMembresModal, PageHeader, DataTable } from "../components";
import { useAuth } from "../auth/AuthContext";
import { STATUT_META, STATUT_MEMBRE_META_CLES, QUALITE_LABEL } from "../data/derivations";
import { EXERCICE_COURANT } from "../data/dashboard-data";
import { versDelimite, telechargerTexte } from "../utils/exportCsv";
import { exporterExcel, exporterPdf } from "../utils/exports";
import { listerMembres, getCotisations, supprimerMembre, telechargerAvocatsPdf, journaliserExport } from "../api/resources";

const FILTRES = [
  { value: "tous", label: "Tous les statuts" },
  { value: "inscrit", label: "Inscrit" },
  { value: "suspendu", label: "Suspendu" },
  { value: "omis", label: "Omis" },
  { value: "radie", label: "Radié" },
  { value: "decede", label: "Décédé" },
  { value: "honoraire", label: "Honoraire" },
];

// La liste filtrée est chargée intégralement (pages serveur de 200 enchaînées), puis le
// DataTable trie/pagine/sélectionne côté client (sélection inter-pages + export complet).

// Colonnes des exports (identiques en CSV, TXT, XLSX et PDF). Projection « annuaire » :
// ni motif de radiation, ni adresse, naissance, RCCM, CNSS (loi 29-2019, art. 16 et 63).
// Nom brut (sans « Me ») et statut au libellé par défaut non surchargeable : ré-importable tel quel.
export const COLONNES_EXPORT = [
  { label: "N°", valeur: (m) => m.num },
  { label: "N° inscription", valeur: (m) => m.numInscription },
  { label: "Nom", valeur: (m) => m.nom },
  { label: "Qualité", valeur: (m) => QUALITE_LABEL[m.qualite] ?? m.qualite },
  { label: "Statut", valeur: (m) => STATUT_MEMBRE_META_CLES[m.statut]?.label ?? m.statut },
  { label: "Cabinet", valeur: (m) => m.cabinet },
  { label: "Téléphone", valeur: (m) => m.tel },
  { label: "Email", valeur: (m) => m.email },
  { label: "Date d'inscription", valeur: (m) => m.dateInscription },
  { label: "Date de radiation", valeur: (m) => m.dateRadiation },
  { label: "Date de décès", valeur: (m) => m.dateDeces },
];

const FORMATS = [
  { id: "xlsx", label: "Excel", ext: ".xlsx", Icon: TableCellsIcon },
  { id: "csv", label: "CSV", ext: ".csv", Icon: DocumentTextIcon },
  { id: "txt", label: "Texte", ext: ".txt", Icon: DocumentTextIcon },
  { id: "pdf", label: "PDF", ext: ".pdf", Icon: DocumentIcon },
];

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const jjmmaaaa = (iso) => iso.split("-").reverse().join("/");
// Mention de confidentialité : première ligne de chaque export (spec § 4.2, texte mot pour mot).
export const mention = () =>
  `Barreau de Pointe-Noire — Document interne confidentiel — Liste arrêtée au ${jjmmaaaa(aujourdhui())} — Diffusion interdite hors des organes de l'Ordre.`;

/** Menu « Exporter » natif (<details>) : 4 formats, état d'attente par entrée. */
function MenuExport({ libelle, petit = false, onExport }) {
  const [ouvert, setOuvert] = useState(false);
  const [occupe, setOccupe] = useState(null);
  const resume = useRef(null);
  const fermer = () => { setOuvert(false); resume.current?.focus(); };
  const lancer = async (id) => {
    setOccupe(id);
    try { await onExport(id); } finally { setOccupe(null); fermer(); }
  };
  return (
    <details open={ouvert} className="relative"
      onToggle={(e) => setOuvert(e.currentTarget.open)}
      onKeyDown={(e) => { if (e.key === "Escape" && ouvert) { e.stopPropagation(); fermer(); } }}>
      <summary ref={resume} aria-label={libelle}
        className={`bpn-btn bpn-btn-ghost list-none cursor-pointer ${petit ? "bpn-btn-sm" : "min-h-[44px] sm:min-h-0"}`}>
        <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" /> {libelle}
        <ChevronDownIcon className="h-3 w-3" aria-hidden="true" />
      </summary>
      <div role="group" aria-label="Formats d'export"
        className={`absolute z-20 mt-1 w-56 max-w-[calc(100vw-2rem)] ${petit ? "right-0" : "left-0 sm:left-auto sm:right-0"} rounded border border-grisM bg-white p-1 text-left shadow-card`}>
        {FORMATS.map(({ id, label, ext, Icon }) => (
          <button key={id} type="button" disabled={occupe !== null} aria-busy={occupe === id}
            onClick={() => lancer(id)}
            className="inline-flex min-h-[44px] w-full items-center gap-2 rounded px-3 text-sm text-encre hover:bg-grisL disabled:opacity-60">
            {occupe === id
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-grisM border-t-navy" aria-hidden="true" />
              : <Icon className="h-4 w-4" aria-hidden="true" />}
            <span className="flex-1 text-left">{occupe === id && id === "pdf" ? "Génération du PDF…" : label}</span>
            <span className="font-mono text-xs text-gris">{ext}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

/** Bouton inerte tant que la liste est vide ou en chargement (pas de menu focalisable). */
const ExporterInactif = ({ libelle }) => (
  <button type="button" className="bpn-btn bpn-btn-ghost" disabled>
    <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" /> {libelle}
  </button>
);

export function Avocats() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const peutImporter = user?.role === "SECRETAIRE_GENERAL" || user?.role === "ADMIN";
  const estAdmin = user?.role === "ADMIN";
  const voitFinances = peutImporter || !!user?.permissions?.includes("finances");
  const [params, setParams] = useSearchParams();
  const [attestation, setAttestation] = useState(null);
  const [importOuvert, setImportOuvert] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [membres, setMembres] = useState([]);
  const [statutCot, setStatutCot] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [zonePdf, setZonePdf] = useState([]);

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
    const params = {
      qualiteNot: "STAGIAIRE",
      ...(recherche ? { q: recherche } : {}),
      ...(filtre !== "tous" ? { statut: filtre.toUpperCase() } : {}),
      pageSize: 200,
    };
    (async () => {
      const d = await listerMembres(params);
      const items = [...(d.items ?? [])];
      for (let page = 2; page <= (d.totalPages ?? 1); page++) items.push(...((await listerMembres({ ...params, page })).items ?? []));
      setMembres(items);
    })()
      .catch(() => setErreur(true))
      .finally(() => setChargement(false));
  }, [recherche, filtre]);
  useEffect(() => { charger(); }, [charger, refresh]);

  // Statut de cotisation de l'exercice courant (jointure côté client).
  // Indépendant des filtres/recherche : on le charge une fois (et à chaque
  // rafraîchissement explicite), pas à chaque rechargement de la liste.
  useEffect(() => {
    // Sans permission « finances » (ex. Bâtonnier) l'API répond 403 : appel évité.
    if (!voitFinances) return;
    getCotisations(EXERCICE_COURANT)
      .then((lignes) => setStatutCot(Object.fromEntries(lignes.map((l) => [l.membre.id, l.statut]))))
      .catch(() => toast.error("Statuts de cotisation indisponibles."));
  }, [toast, refresh, voitFinances]);

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

  // Export de `lignes` (liste filtrée ou sélection) dans le format demandé.
  const exporter = async (format, lignes, { selection = false } = {}) => {
    const nom = selection ? "Avocats-selection" : "Avocats";
    // Journal serveur (avis C-04) écrit AVANT de produire le fichier : pas de trace, pas d'export.
    const libelleFiltre = selection
      ? `sélection de ${lignes.length}`
      : [filtre !== "tous" ? `statut ${filtre.toUpperCase()}` : "", recherche ? `recherche « ${recherche} »` : ""].filter(Boolean).join(", ") || "tous";
    const tracer = (f) => journaliserExport({ format: f, filtre: libelleFiltre.slice(0, 200), lignes: lignes.length });
    try {
      if (format !== "pdf") await tracer(format);
      if (format === "csv") {
        telechargerTexte(`${nom}.csv`, `﻿${mention()}\r\n${versDelimite(COLONNES_EXPORT, lignes, ";")}`, "text/csv;charset=utf-8;");
      } else if (format === "txt") {
        telechargerTexte(`${nom}.txt`, `${mention()}\r\n${versDelimite(COLONNES_EXPORT, lignes, "\t")}`, "text/plain;charset=utf-8;");
      } else if (format === "xlsx") {
        await exporterExcel(nom, [
          [mention()],
          COLONNES_EXPORT.map((c) => c.label),
          ...lignes.map((m) => COLONNES_EXPORT.map((c) => c.valeur(m) ?? "")),
        ], "Avocats");
      } else {
        try {
          await telechargerAvocatsPdf({
            qualiteNot: "STAGIAIRE",
            ...(selection
              ? { ids: lignes.map((m) => m.id).join(",") }
              : { ...(recherche ? { q: recherche } : {}), ...(filtre !== "tous" ? { statut: filtre.toUpperCase() } : {}) }),
          });
        } catch {
          // Repli : PDF capturé sur l'appareil (qualité réduite) si le serveur échoue.
          await tracer("pdf-local");
          setZonePdf(lignes);
          await new Promise((r) => setTimeout(r, 80));
          await exporterPdf(`${nom}-${aujourdhui()}`, "#zone-impression-avocats");
          setZonePdf([]);
          toast.info("PDF généré sur cet appareil (serveur indisponible) : qualité réduite.");
        }
      }
    } catch (e) {
      setZonePdf([]);
      toast.error(`Export impossible : ${e.message}.`);
    }
  };
  const peutExporter = !chargement && !erreur && membres.length > 0;

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
          <button type="button" onClick={() => navigate(`/avocats/${m.id}`)} className="bpn-btn bpn-btn-ghost bpn-btn-sm">Fiche</button>
          {peutImporter && m.statut !== "radie" && m.statut !== "decede" && (
            <button type="button" onClick={() => setAttestation(m)} className="bpn-btn bpn-btn-ghost bpn-btn-sm">Attestation</button>
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
        {peutExporter
          ? <MenuExport libelle="Exporter" onExport={(f) => exporter(f, membres)} />
          : <ExporterInactif libelle="Exporter" />}
        {peutImporter && (
          <button className="bpn-btn bpn-btn-ghost" onClick={() => setImportOuvert(true)}>
            <ArrowUpTrayIcon className="h-4 w-4" /> Importer (Excel/CSV/TXT)
          </button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
          <input type="text" value={recherche} onChange={(e) => setParam("q", e.target.value, "")} placeholder="Rechercher par nom, cabinet ou n°…" aria-label="Rechercher un avocat" className="bpn-input pl-9" />
        </div>
        <select value={filtre} onChange={(e) => setParam("statut", e.target.value, "tous")} aria-label="Filtrer par statut" className="bpn-input sm:w-56">
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
            <MenuExport libelle="Exporter la sélection" petit
              onExport={(f) => exporter(f, membres.filter((m) => ids.includes(m.id)), { selection: true })} />
          )}
        />
      </div>

      {zonePdf.length > 0 && (
        <div id="zone-impression-avocats" aria-hidden="true"
          style={{ position: "absolute", left: -9999, top: 0, width: 1100, background: "#fff", color: "#14213D", padding: 16, fontSize: 11 }}>
          <p style={{ marginBottom: 8 }}>{mention()}</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{COLONNES_EXPORT.map((c) => <th key={c.label} style={{ border: "1px solid #E0DBD0", padding: 4, textAlign: "left" }}>{c.label}</th>)}</tr></thead>
            <tbody>{zonePdf.map((m) => (
              <tr key={m.id}>{COLONNES_EXPORT.map((c) => <td key={c.label} style={{ border: "1px solid #E0DBD0", padding: 4 }}>{c.valeur(m) ?? ""}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <AttestationModal membre={attestation} onClose={() => setAttestation(null)} />
      <ImportMembresModal open={importOuvert} onClose={() => setImportOuvert(false)} onDone={() => setRefresh((n) => n + 1)} />
    </div>
  );
}

export default Avocats;
