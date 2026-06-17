import { useCallback, useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon, EyeIcon, CheckIcon, XMarkIcon, TrashIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Badge, useToast, useConfirm, PageHeader, DataTable } from "../components";
import { formatDate } from "../utils/format";
import { useAuth } from "../auth/AuthContext";
import { TYPE_PIECE_LABEL as TYPE_LABEL, STATUT_PIECE_META as STATUT } from "../data/pieces";
import { listerToutesPieces, verifierPiece, rejeterPiece, supprimerPiece, voirPiece } from "../api/resources";

const FILTRES = [
  { cle: "A_VERIFIER", label: "À vérifier" },
  { cle: "VERIFIEE", label: "Vérifiées" },
  { cle: "REJETEE", label: "Rejetées" },
  { cle: "toutes", label: "Toutes" },
];
const tailleLisible = (n) => (n < 1024 ? `${n} o` : n < 1_048_576 ? `${Math.round(n / 1024)} Ko` : `${(n / 1_048_576).toFixed(1)} Mo`);

/**
 * Back-office — file d'attente de vérification documentaire (KYC, RG-15).
 * Vue transverse de toutes les pièces déposées : le SG vérifie / rejette /
 * supprime ; le Bâtonnier consulte sans gérer. Les pièces d'un membre se gèrent
 * aussi depuis sa fiche ; cet écran centralise la validation.
 */
export function Pieces() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const peutGerer = ["SECRETAIRE_GENERAL", "ADMIN"].includes(user?.role);

  const [pieces, setPieces] = useState([]);
  const [filtre, setFiltre] = useState("A_VERIFIER");
  const [recherche, setRecherche] = useState("");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  const charger = useCallback(() => {
    setChargement(true);
    setErreur(false);
    listerToutesPieces().then(setPieces).catch(() => setErreur(true)).finally(() => setChargement(false));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const compte = useMemo(() => {
    const c = { A_VERIFIER: 0, VERIFIEE: 0, REJETEE: 0, toutes: pieces.length };
    for (const p of pieces) c[p.statut] = (c[p.statut] ?? 0) + 1;
    return c;
  }, [pieces]);

  const action = async (fn, msg) => {
    try { await fn(); toast.success(msg); charger(); } catch (e) { toast.error(e.message); }
  };
  const rejeter = (p) => {
    const note = window.prompt("Motif du rejet (optionnel) :", p.note ?? "");
    if (note === null) return;
    action(() => rejeterPiece(p.id, note || undefined), "Pièce rejetée.");
  };
  const supprimer = async (p) => {
    const ok = await confirm({ title: "Supprimer la pièce ?", message: `« ${p.nomFichier} » de Me ${p.membre?.nom} sera définitivement supprimée.`, confirmLabel: "Supprimer", danger: true });
    if (ok) action(() => supprimerPiece(p.id), "Pièce supprimée.");
  };

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return pieces.filter((p) => {
      if (filtre !== "toutes" && p.statut !== filtre) return false;
      if (!q) return true;
      return (p.membre?.nom ?? "").toLowerCase().includes(q) || (TYPE_LABEL[p.type] ?? p.type).toLowerCase().includes(q);
    });
  }, [pieces, filtre, recherche]);

  const colonnes = [
    { key: "membre", label: "Membre", sortable: true, sortValue: (p) => (p.membre?.nom ?? "").toLowerCase(),
      cell: (p) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-encre">Me {p.membre?.nom ?? "—"}</div>
          <div className="text-[11px] text-gris">N° {p.membre?.num ?? "—"} · {p.membre?.qualite ?? ""}</div>
        </div>
      ) },
    { key: "type", label: "Pièce", sortable: true, sortValue: (p) => TYPE_LABEL[p.type] ?? p.type,
      cell: (p) => (
        <div className="min-w-0">
          <div className="text-sm text-encre">{TYPE_LABEL[p.type] ?? p.type}</div>
          <div className="truncate text-[11px] text-gris">{p.nomFichier} · {tailleLisible(p.taille)}</div>
          {p.statut === "REJETEE" && p.note && <div className="truncate text-[11px] text-rouge">Motif : {p.note}</div>}
        </div>
      ) },
    { key: "createdAt", label: "Déposée", sortable: true, sortValue: (p) => p.createdAt,
      cell: (p) => <span className="text-xs text-gris">{formatDate(String(p.createdAt).slice(0, 10))}</span> },
    { key: "statut", label: "Statut", sortable: true, sortValue: (p) => p.statut,
      cell: (p) => {
        const m = STATUT[p.statut] ?? { label: p.statut, ton: "gris" };
        return <Badge ton={m.ton}>{m.label}</Badge>;
      } },
    { key: "actions", label: "Action", align: "right",
      cell: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs" onClick={() => voirPiece(p.id).catch((e) => toast.error(e.message))}>
            <EyeIcon className="h-3.5 w-3.5" /> Voir
          </button>
          {peutGerer && p.statut !== "VERIFIEE" && (
            <button className="bpn-btn bpn-btn-or !px-2.5 !py-1 text-xs" onClick={() => action(() => verifierPiece(p.id), "Pièce vérifiée.")}>
              <CheckIcon className="h-3.5 w-3.5" /> Vérifier
            </button>
          )}
          {peutGerer && p.statut !== "REJETEE" && (
            <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs" onClick={() => rejeter(p)}>
              <XMarkIcon className="h-3.5 w-3.5" /> Rejeter
            </button>
          )}
          {peutGerer && (
            <button type="button" onClick={() => supprimer(p)} title="Supprimer la pièce" aria-label="Supprimer la pièce"
              className="rounded p-1.5 text-gris transition hover:bg-rougeL hover:text-rouge">
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Membres" titre="Vérification des pièces" sousTitre="Validation documentaire (KYC) des dossiers d'inscription. Le Secrétaire Général vérifie ou rejette ; le Bâtonnier consulte (RG-15)." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTRES.map((f) => (
            <button
              key={f.cle}
              onClick={() => setFiltre(f.cle)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${filtre === f.cle ? "bg-navy text-white" : "bg-grisL text-gris hover:bg-grisM/30"}`}
            >
              {f.label}
              <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${filtre === f.cle ? "bg-white/20" : "bg-white text-gris"}`}>{compte[f.cle] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
          <input type="text" value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher par nom ou type…" className="bpn-input pl-9" />
        </div>
      </div>

      <div className="bpn-card">
        <DataTable
          columns={colonnes}
          rows={lignes}
          getRowId={(p) => p.id}
          loading={chargement}
          error={erreur}
          onRetry={charger}
          pageSize={12}
          libelle="pièces"
          initialSort={{ key: "createdAt", dir: "desc" }}
          emptyIcon={ShieldCheckIcon}
          emptyTitle="Aucune pièce"
          emptyDescription={filtre === "A_VERIFIER" ? "Aucune pièce en attente de vérification." : "Aucune pièce ne correspond à ce filtre."}
        />
      </div>
    </div>
  );
}

export default Pieces;
