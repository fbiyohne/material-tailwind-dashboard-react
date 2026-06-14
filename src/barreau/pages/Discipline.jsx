import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LockClosedIcon,
  ShieldExclamationIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { Badge, Modal, SortTh, Pagination, useToast, PageHeader } from "../components";
import { useDataTable } from "../hooks/useDataTable";
import { STATUT_DOSSIER_META } from "../data/institutionnel";
import { listerMembres, listerDossiers, ouvrirDossier as apiOuvrirDossier, journalDiscipline as apiJournal } from "../api/resources";

const ACCESSORS = {
  reference: (d) => d.reference,
  avocat: (d) => (d.avocatNom ?? "").toLowerCase(),
  saisine: (d) => d.dateSaisine,
  statut: (d) => d.statut,
};

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function OuvrirDossierModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [avocats, setAvocats] = useState([]);
  const [form, setForm] = useState({ avocatNom: "", objet: "", dateSaisine: new Date().toISOString().slice(0, 10) });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    if (open) listerMembres().then((d) => {
      const a = d.items.filter((m) => m.qualite !== "stagiaire");
      setAvocats(a);
      setForm((f) => ({ ...f, avocatNom: f.avocatNom || a[0]?.nom || "" }));
    }).catch(() => {});
  }, [open]);

  const valider = async () => {
    if (!form.objet.trim()) return;
    try {
      await apiOuvrirDossier(form);
      onCreated?.();
      onClose();
      setForm({ avocatNom: avocats[0]?.nom ?? "", objet: "", dateSaisine: new Date().toISOString().slice(0, 10) });
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Ouvrir un dossier disciplinaire"
      footer={<button className="bpn-btn bpn-btn-danger" onClick={valider}>Ouvrir le dossier</button>}>
      <div className="mb-3 rounded border-l-[3px] border-or bg-or-L px-3 py-2 text-xs text-gris">
        Référence unique attribuée automatiquement (format <span className="font-mono font-medium text-navy">AAAA-NN</span>, non réutilisable).
      </div>
      <div className="space-y-3">
        <label className="block"><span className="bpn-label">Avocat mis en cause</span>
          <select value={form.avocatNom} onChange={set("avocatNom")} className="bpn-input mt-1">
            {avocats.map((m) => <option key={m.id} value={m.nom}>Me {m.nom}</option>)}
          </select></label>
        <label className="block"><span className="bpn-label">Objet de la saisine</span>
          <textarea rows={3} value={form.objet} onChange={set("objet")} className="bpn-input mt-1" placeholder="Nature de la plainte ou de la saisine…" /></label>
        <label className="block"><span className="bpn-label">Date de saisine</span>
          <input type="date" value={form.dateSaisine} onChange={set("dateSaisine")} className="bpn-input mt-1" /></label>
      </div>
    </Modal>
  );
}

export function Discipline() {
  const navigate = useNavigate();
  const toast = useToast();
  const [acces, setAcces] = useState(false);
  const [ouvrir, setOuvrir] = useState(false);
  const [dossiers, setDossiers] = useState([]);
  const [journalDiscipline, setJournalDiscipline] = useState([]);

  // Hook appelé inconditionnellement (avant la barrière d'accès RG-13).
  const { rows, total, page, setPage, totalPages, sortKey, sortDir, toggleSort } = useDataTable(dossiers, {
    accessors: ACCESSORS, pageSize: 10, initialSort: { key: "reference", dir: "desc" },
  });

  const charger = () => {
    listerDossiers().then(setDossiers).catch((e) => toast.error(e.message));
    apiJournal().then(setJournalDiscipline).catch(() => {});
  };

  // ─── Écran d'accès restreint (RG-13) ───────────────────────────────────
  if (!acces) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-rouge/30 bg-[#f4e6e6]/40 px-6 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f4e6e6] text-rouge">
          <ShieldExclamationIcon className="h-7 w-7" />
        </div>
        <h2 className="font-display text-2xl text-navy">Accès restreint</h2>
        <p className="mt-2 max-w-md text-sm text-gris">
          Le Conseil de discipline contient des données strictement confidentielles. L'accès est
          réservé aux profils Secrétaire Général, Bâtonnier et Administrateur. Toute consultation
          est <strong>journalisée</strong> (règle RG-13).
        </p>
        <button
          className="bpn-btn bpn-btn-danger mt-6"
          onClick={() => { setAcces(true); charger(); }}
        >
          <LockClosedIcon className="h-4 w-4" /> Accéder — consultation journalisée
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Institutionnel · Confidentiel" titre="Conseil de discipline" sousTitre="Dossiers disciplinaires — accès restreint et journalisé.">
        <button className="bpn-btn bpn-btn-danger" onClick={() => setOuvrir(true)}>
          <PlusIcon className="h-4 w-4" /> Ouvrir un dossier
        </button>
      </PageHeader>

      <div className="flex items-center gap-2 rounded border-l-[3px] border-rouge bg-[#f4e6e6] px-4 py-2.5 text-sm text-rouge">
        <ShieldExclamationIcon className="h-5 w-5 shrink-0" />
        Données confidentielles — chaque consultation est enregistrée dans le journal d'accès.
      </div>

      <div className="bpn-card">
        <div className="overflow-x-auto">
          <table className="bpn-table">
            <thead>
              <tr>
                <SortTh label="Référence" sortKey="reference" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Avocat mis en cause" sortKey="avocat" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 font-medium">Objet</th>
                <SortTh label="Saisine" sortKey="saisine" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 font-medium">Audience</th>
                <SortTh label="Statut" sortKey="statut" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const meta = STATUT_DOSSIER_META[d.statut];
                return (
                  <tr key={d.id} className="border-b border-grisL hover:bg-grisL/60">
                    <td className="px-3 py-2.5 font-mono text-xs font-medium text-rouge">{d.reference}</td>
                    <td className="px-3 py-2.5 font-medium">{d.avocatNom === "Confidentiel" ? <span className="italic text-gris">Confidentiel</span> : `Me ${d.avocatNom}`}</td>
                    <td className="px-3 py-2.5 text-gris">{d.objet}</td>
                    <td className="px-3 py-2.5 text-xs text-gris">{d.dateSaisine}</td>
                    <td className="px-3 py-2.5 text-xs text-gris">{d.dateAudience ?? "—"}</td>
                    <td className="px-3 py-2.5"><Badge ton={meta.ton}>{meta.label}</Badge></td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-[10px]"
                        onClick={() => navigate(`/discipline/${d.id}`)}
                      >
                        Ouvrir
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-gris">Aucun dossier disciplinaire.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} libelle="dossiers" />
      </div>

      {/* Journal d'accès (RG-13) */}
      <div className="bpn-card">
        <div className="bpn-card-header">
          <span className="bpn-card-heading">Journal d'accès</span>
          <span className="font-mono text-xs text-gris">{journalDiscipline.length}</span>
        </div>
        <ul className="divide-y divide-grisL">
          {journalDiscipline.map((j, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
              <span className="text-encre">{j.action}</span>
              <span className="font-mono text-gris">{fmtDateTime(j.quand)}</span>
            </li>
          ))}
          {journalDiscipline.length === 0 && (
            <li className="px-4 py-4 text-center text-xs text-gris">Aucune entrée.</li>
          )}
        </ul>
      </div>

      <OuvrirDossierModal open={ouvrir} onClose={() => setOuvrir(false)} onCreated={charger} />
    </div>
  );
}

export default Discipline;
