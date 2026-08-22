import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LockClosedIcon,
  ShieldExclamationIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Badge, Modal, useToast, useConfirm, PageHeader, FormField, Notice, DataTable, Pagination } from "../components";
import { useAuth } from "../auth/AuthContext";
import { STATUT_DOSSIER_META } from "../data/institutionnel";
import { formatDate, formatDateTime } from "../utils/format";
import { listerMembres, listerDossiers, ouvrirDossier as apiOuvrirDossier, supprimerDossier, journalDiscipline as apiJournal } from "../api/resources";

const VIDE_DOSSIER = { membreId: "", objet: "", dateSaisine: new Date().toISOString().slice(0, 10), plaignant: "", rapporteur: "" };
function OuvrirDossierModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [avocats, setAvocats] = useState([]);
  const [form, setForm] = useState(VIDE_DOSSIER);
  const [creation, setCreation] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    if (open) listerMembres().then((d) => {
      const a = d.items.filter((m) => m.qualite !== "stagiaire");
      setAvocats(a);
      setForm((f) => ({ ...f, membreId: f.membreId || (a[0]?.id ?? "") }));
    }).catch(() => {});
  }, [open]);

  const valider = async () => {
    // Garde anti double-clic : une référence AAAA-NN est consommée par ouverture
    // et n'est pas réutilisable — un double-clic créerait deux dossiers.
    if (!form.objet.trim() || creation) return;
    // On rattache le dossier à la fiche de l'avocat (membreId) pour alimenter son
    // casier disciplinaire, et on transmet l'avocatNom (dénormalisé) + plaignant/rapporteur.
    const avocat = avocats.find((m) => String(m.id) === String(form.membreId));
    setCreation(true);
    try {
      await apiOuvrirDossier({
        avocatNom: avocat?.nom ?? "",
        membreId: form.membreId ? Number(form.membreId) : undefined,
        objet: form.objet,
        dateSaisine: form.dateSaisine,
        plaignant: form.plaignant.trim() || undefined,
        rapporteur: form.rapporteur.trim() || undefined,
      });
      toast.success("Dossier disciplinaire ouvert.");
      onCreated?.();
      onClose();
      setForm({ ...VIDE_DOSSIER, membreId: avocats[0]?.id ?? "" });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCreation(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Ouvrir un dossier disciplinaire"
      footer={<button className="bpn-btn bpn-btn-danger" onClick={valider} disabled={creation || !form.objet.trim()}>{creation ? "Ouverture…" : "Ouvrir le dossier"}</button>}>
      <Notice ton="or" className="mb-4">
        Référence unique attribuée automatiquement (format <span className="font-mono font-medium text-navy">AAAA-NN</span>, non réutilisable).
      </Notice>
      <div className="space-y-3">
        <FormField label="Avocat mis en cause">
          <select value={form.membreId} onChange={set("membreId")} className="bpn-input">
            {avocats.map((m) => <option key={m.id} value={m.id}>Me {m.nom}</option>)}
          </select>
        </FormField>
        <FormField label="Objet de la saisine" required>
          <textarea rows={3} value={form.objet} onChange={set("objet")} className="bpn-input" placeholder="Nature de la plainte ou de la saisine…" />
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Plaignant" hint="le cas échéant">
            <input value={form.plaignant} onChange={set("plaignant")} className="bpn-input" placeholder="Auteur de la saisine" />
          </FormField>
          <FormField label="Rapporteur" hint="le cas échéant">
            <input value={form.rapporteur} onChange={set("rapporteur")} className="bpn-input" placeholder="Membre chargé de l'instruction" />
          </FormField>
        </div>
        <FormField label="Date de saisine">
          <input type="date" value={form.dateSaisine} onChange={set("dateSaisine")} className="bpn-input" />
        </FormField>
      </div>
    </Modal>
  );
}

export function Discipline() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const estAdmin = user?.role === "ADMIN";
  const [acces, setAcces] = useState(false);
  const [ouvrir, setOuvrir] = useState(false);
  const [dossiers, setDossiers] = useState([]);
  const [journalDiscipline, setJournalDiscipline] = useState([]);
  const [pageJournal, setPageJournal] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  const charger = () => {
    setChargement(true);
    setErreur(false);
    listerDossiers().then(setDossiers).catch(() => setErreur(true)).finally(() => setChargement(false));
    apiJournal().then(setJournalDiscipline).catch(() => {});
  };

  // Suppression d'un dossier disciplinaire — réservée au super-administrateur (ADMIN).
  const supprimer = async (d) => {
    const ok = await confirm({
      title: "Supprimer le dossier",
      message: `Le dossier disciplinaire ${d.reference} sera définitivement supprimé. Cette action est irréversible.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try { await supprimerDossier(d.id); charger(); toast.success(`Dossier ${d.reference} supprimé.`); }
    catch (e) { toast.error(e.message); }
  };

  const colonnes = [
    { key: "reference", label: "Référence", sortable: true, sortValue: (d) => d.reference,
      cell: (d) => <span className="font-mono text-xs font-medium text-rouge">{d.reference}</span> },
    { key: "avocat", label: "Avocat mis en cause", sortable: true, sortValue: (d) => (d.avocatNom ?? "").toLowerCase(),
      cell: (d) => d.avocatNom === "Confidentiel" ? <span className="italic text-gris">Confidentiel</span> : <span className="font-medium">Me {d.avocatNom}</span> },
    { key: "objet", label: "Objet", cell: (d) => <span className="text-gris">{d.objet}</span> },
    { key: "saisine", label: "Saisine", sortable: true, sortValue: (d) => d.dateSaisine,
      cell: (d) => <span className="text-xs text-gris">{formatDate(d.dateSaisine)}</span> },
    { key: "audience", label: "Audience", cell: (d) => <span className="text-xs text-gris">{formatDate(d.dateAudience)}</span> },
    { key: "statut", label: "Statut", sortable: true, sortValue: (d) => d.statut,
      cell: (d) => { const meta = STATUT_DOSSIER_META[d.statut]; return <Badge ton={meta.ton}>{meta.label}</Badge>; } },
    { key: "actions", label: "Actions", align: "right",
      cell: (d) => (
        <div className="flex justify-end gap-2">
          <button className="bpn-btn bpn-btn-ghost bpn-btn-sm" onClick={() => navigate(`/discipline/${d.id}`)}>
            Ouvrir
          </button>
          {estAdmin && (
            <button className="bpn-btn bpn-btn-ghost !px-2 !py-1 text-xs text-rouge" onClick={() => supprimer(d)} title="Supprimer définitivement">
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) },
  ];

  // ─── Écran d'accès restreint (RG-13) ───────────────────────────────────
  if (!acces) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-rouge/30 bg-rougeL/40 px-6 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rougeL text-rouge">
          <ShieldExclamationIcon className="h-7 w-7" />
        </div>
        <h2 className="font-display text-2xl text-navy">Module confidentiel</h2>
        <p className="mt-2 max-w-md text-sm text-gris">
          Le Conseil de discipline contient des données strictement confidentielles.
          <strong> Vous y avez accès</strong> (Secrétaire Général, Bâtonnier, Administrateur) ;
          conformément à la règle RG-13, chaque consultation est <strong>journalisée</strong>.
        </p>
        <button
          className="bpn-btn bpn-btn-danger mt-6"
          onClick={() => { setAcces(true); charger(); }}
        >
          <LockClosedIcon className="h-4 w-4" /> Entrer dans le module — consultation journalisée
        </button>
      </div>
    );
  }

  // Journal d'accès (RG-13) paginé côté client : il peut grossir vite (chaque
  // consultation y est tracée), on ne rend qu'une page à la fois.
  const TAILLE_JOURNAL = 12;
  const totalPagesJournal = Math.max(1, Math.ceil(journalDiscipline.length / TAILLE_JOURNAL));
  const pageJournalEff = Math.min(Math.max(1, pageJournal), totalPagesJournal);
  const journalAffiche = journalDiscipline.slice((pageJournalEff - 1) * TAILLE_JOURNAL, pageJournalEff * TAILLE_JOURNAL);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Institutionnel · Confidentiel" titre="Conseil de discipline" sousTitre="Dossiers disciplinaires — accès restreint et journalisé.">
        <button className="bpn-btn bpn-btn-danger" onClick={() => setOuvrir(true)}>
          <PlusIcon className="h-4 w-4" /> Ouvrir un dossier
        </button>
      </PageHeader>

      <Notice ton="rouge" icon={ShieldExclamationIcon} className="text-sm">
        Données confidentielles — chaque consultation est enregistrée dans le journal d'accès.
      </Notice>

      <div className="bpn-card">
        <DataTable
          columns={colonnes}
          rows={dossiers}
          getRowId={(d) => d.id}
          loading={chargement}
          error={erreur}
          onRetry={charger}
          libelle="dossiers"
          initialSort={{ key: "saisine", dir: "desc" }}
          emptyIcon={ShieldExclamationIcon}
          emptyTitle="Aucun dossier"
          emptyDescription="Aucun dossier disciplinaire enregistré."
        />
      </div>

      {/* Journal d'accès (RG-13) */}
      <div className="bpn-card">
        <div className="bpn-card-header">
          <span className="bpn-card-heading">Journal d'accès</span>
          <span className="font-mono text-xs text-gris">{journalDiscipline.length}</span>
        </div>
        <ul className="divide-y divide-grisL">
          {journalAffiche.map((j, i) => (
            <li key={`${pageJournalEff}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
              <span className="text-encre">{j.action}</span>
              <span className="font-mono text-gris">{formatDateTime(j.quand)}</span>
            </li>
          ))}
          {journalDiscipline.length === 0 && (
            <li className="px-4 py-4 text-center text-xs text-gris">Aucune entrée.</li>
          )}
        </ul>
        {journalDiscipline.length > TAILLE_JOURNAL && (
          <Pagination page={pageJournalEff} totalPages={totalPagesJournal} total={journalDiscipline.length} onPage={setPageJournal} libelle="consultations" />
        )}
      </div>

      <OuvrirDossierModal open={ouvrir} onClose={() => setOuvrir(false)} onCreated={charger} />
    </div>
  );
}

export default Discipline;
