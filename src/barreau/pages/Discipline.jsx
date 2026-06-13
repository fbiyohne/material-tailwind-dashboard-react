import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LockClosedIcon,
  ShieldExclamationIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { Badge, Modal } from "../components";
import { useBarreau } from "../store/BarreauStore";
import { STATUT_DOSSIER_META } from "../data/institutionnel";

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function OuvrirDossierModal({ open, onClose }) {
  const { membres, ouvrirDossier, journaliserDiscipline, prochaineReferenceDossier } = useBarreau();
  const avocats = membres.filter((m) => m.qualite !== "stagiaire");
  const [form, setForm] = useState({ avocatNom: avocats[0]?.nom ?? "", objet: "", dateSaisine: new Date().toISOString().slice(0, 10) });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const valider = () => {
    if (!form.objet.trim()) return;
    const d = ouvrirDossier(form);
    journaliserDiscipline(`Ouverture du dossier ${d.reference} — ${form.avocatNom}`);
    onClose();
    setForm({ avocatNom: avocats[0]?.nom ?? "", objet: "", dateSaisine: new Date().toISOString().slice(0, 10) });
  };

  return (
    <Modal open={open} onClose={onClose} title="Ouvrir un dossier disciplinaire"
      footer={<button className="bpn-btn bpn-btn-danger" onClick={valider}>Ouvrir le dossier</button>}>
      <div className="mb-3 rounded border-l-[3px] border-or bg-or-L px-3 py-2 text-xs text-gris">
        Référence unique attribuée automatiquement : <span className="font-mono font-medium text-navy">{prochaineReferenceDossier()}</span> (format AAAA-NN, non réutilisable).
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
  const { dossiers, journalDiscipline, journaliserDiscipline } = useBarreau();
  const navigate = useNavigate();
  const [acces, setAcces] = useState(false);
  const [ouvrir, setOuvrir] = useState(false);

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
          onClick={() => {
            journaliserDiscipline("Accès au module Discipline");
            setAcces(true);
          }}
        >
          <LockClosedIcon className="h-4 w-4" /> Accéder — consultation journalisée
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="bpn-eyebrow">Institutionnel · Confidentiel</div>
          <h2 className="bpn-title mt-2">Conseil de discipline</h2>
          <p className="mt-1 text-sm text-gris">
            Dossiers disciplinaires — accès restreint et journalisé.
          </p>
        </div>
        <button className="bpn-btn bpn-btn-danger" onClick={() => setOuvrir(true)}>
          <PlusIcon className="h-4 w-4" /> Ouvrir un dossier
        </button>
      </div>

      <div className="flex items-center gap-2 rounded border-l-[3px] border-rouge bg-[#f4e6e6] px-4 py-2.5 text-sm text-rouge">
        <ShieldExclamationIcon className="h-5 w-5 shrink-0" />
        Données confidentielles — chaque consultation est enregistrée dans le journal d'accès.
      </div>

      <div className="bpn-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-[9px] uppercase tracking-[0.1em] text-white/90">
                <th className="px-3 py-2.5 font-medium">Référence</th>
                <th className="px-3 py-2.5 font-medium">Avocat mis en cause</th>
                <th className="px-3 py-2.5 font-medium">Objet</th>
                <th className="px-3 py-2.5 font-medium">Saisine</th>
                <th className="px-3 py-2.5 font-medium">Audience</th>
                <th className="px-3 py-2.5 font-medium">Statut</th>
                <th className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map((d) => {
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
            </tbody>
          </table>
        </div>
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

      <OuvrirDossierModal open={ouvrir} onClose={() => setOuvrir(false)} />
    </div>
  );
}

export default Discipline;
