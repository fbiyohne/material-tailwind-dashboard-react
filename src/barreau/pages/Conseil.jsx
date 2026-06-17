import { useCallback, useEffect, useRef, useState } from "react";
import { PlusIcon, TrashIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, useToast, useConfirm, TableSkeleton, ErrorState, EmptyState } from "../components";
import { formatDate } from "../utils/format";
import { fonctionsConseil } from "../data/config";
import { useAuth } from "../auth/AuthContext";
import { listerConseil, ajouterMembreConseil, majMembreConseil, supprimerMembreConseil, listerMembres } from "../api/resources";

const videForm = { nom: "", fonction: "Membre du Conseil", membreId: null };

/** Options de fonction = liste de référence + la valeur courante si elle en sort
 * (compatibilité avec d'anciens intitulés saisis librement). */
const optionsFonction = (courant) => {
  const base = fonctionsConseil();
  return courant && !base.includes(courant) ? [courant, ...base] : base;
};

/**
 * Composition du Conseil de l'Ordre — gestion des membres et mandats (SG).
 * La composition est recomposée automatiquement à la publication d'une élection
 * du Conseil ; cet écran permet l'ajustement manuel (fonctions, mandats, retraits).
 */
export function Conseil() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const peutGerer = ["SECRETAIRE_GENERAL", "ADMIN"].includes(user?.role);

  const [membres, setMembres] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [form, setForm] = useState(videForm);

  // Autocomplétion sur le nom : interroge l'annuaire des membres (débounce léger).
  const [suggestions, setSuggestions] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const champNom = useRef(null);

  const charger = useCallback(() => {
    setErreur(false);
    listerConseil(true).then(setMembres).catch(() => setErreur(true));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  // Recherche des correspondances dès 2 caractères, tant que le nom n'a pas été
  // figé par la sélection d'un avocat (membreId renseigné).
  useEffect(() => {
    const q = form.nom.trim();
    if (!peutGerer || form.membreId || q.length < 2) { setSuggestions([]); return undefined; }
    const t = setTimeout(() => {
      listerMembres({ q, pageSize: 6 })
        .then((d) => setSuggestions(d.items))
        .catch(() => setSuggestions([]));
    }, 220);
    return () => clearTimeout(t);
  }, [form.nom, form.membreId, peutGerer]);

  const choisir = (m) => {
    setForm((f) => ({ ...f, nom: `Me ${m.nom}`, membreId: m.id }));
    setOuvert(false);
    setSuggestions([]);
  };

  const action = async (fn, msg) => { try { await fn(); toast.success(msg); charger(); } catch (e) { toast.error(e.message); } };
  const ajouter = () => {
    if (form.nom.trim() && form.fonction.trim()) {
      action(() => ajouterMembreConseil({ ...form, ordre: (membres?.length ?? 0) + 1 }), "Membre ajouté.");
      setForm(videForm);
      setSuggestions([]);
    }
  };
  const supprimer = (m) => confirm({ title: "Retirer du Conseil ?", message: `${m.nom} sera retiré(e) de la composition.`, confirmLabel: "Retirer", danger: true }).then((ok) => ok && action(() => supprimerMembreConseil(m.id), "Membre retiré."));

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="La composition n'a pas pu être chargée." onRetry={charger} /></div>;
  if (!membres) return <div className="bpn-card p-6"><TableSkeleton rows={6} cols={3} /></div>;

  const actifs = membres.filter((m) => m.actif).length;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Institutionnel" titre="Conseil de l'Ordre" sousTitre={`Composition et mandats — ${actifs} membre(s) en exercice.`} />

      {peutGerer && (
        <div className="flex flex-col gap-2 rounded-lg border border-grisL bg-grisL/30 p-3 sm:flex-row">
          <div className="relative flex-1">
            <input
              ref={champNom}
              value={form.nom}
              onChange={(e) => { setForm({ ...form, nom: e.target.value, membreId: null }); setOuvert(true); }}
              onFocus={() => setOuvert(true)}
              onBlur={() => setTimeout(() => setOuvert(false), 120)}
              placeholder="Rechercher un avocat (Me …)"
              className="bpn-input w-full"
              autoComplete="off"
              role="combobox"
              aria-expanded={ouvert && suggestions.length > 0}
              aria-controls="conseil-suggestions"
            />
            {ouvert && suggestions.length > 0 && (
              <ul id="conseil-suggestions" className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-grisM bg-white shadow-card">
                {suggestions.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-grisL"
                      onMouseDown={(e) => { e.preventDefault(); choisir(m); }}
                    >
                      <span className="font-medium text-encre">Me {m.nom}</span>
                      <span className="font-mono text-[11px] text-gris">N° {m.num}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <select value={form.fonction} onChange={(e) => setForm({ ...form, fonction: e.target.value })} className="bpn-input sm:w-64">
            {optionsFonction(form.fonction).map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <button className="bpn-btn bpn-btn-or shrink-0" onClick={ajouter} disabled={!form.nom.trim()}><PlusIcon className="h-4 w-4" /> Ajouter</button>
        </div>
      )}

      <div className="bpn-card overflow-hidden">
        {membres.length === 0 ? (
          <div className="p-6"><EmptyState icon={UserGroupIcon} title="Conseil vide" description="Ajoutez les membres du Conseil ou publiez une élection." /></div>
        ) : (
          <table className="bpn-table">
            <thead>
              <tr>
                <th className="w-12">Ordre</th>
                <th>Membre</th>
                <th>Fonction</th>
                <th className="whitespace-nowrap">Mandat depuis</th>
                <th className="text-right">{peutGerer ? "Actions" : "Statut"}</th>
              </tr>
            </thead>
            <tbody>
              {membres.map((m) => (
                <tr key={m.id} className={m.actif ? "" : "opacity-60"}>
                  <td className="font-mono text-or">{m.ordre}</td>
                  <td className="font-medium text-encre">{m.nom}</td>
                  <td>
                    {peutGerer ? (
                      <select defaultValue={m.fonction} className="bpn-input !w-52 !py-1 text-sm"
                        onChange={(e) => { const v = e.target.value; if (v && v !== m.fonction) action(() => majMembreConseil(m.id, { fonction: v }), "Fonction mise à jour."); }}>
                        {optionsFonction(m.fonction).map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    ) : <span className="text-gris">{m.fonction}</span>}
                  </td>
                  <td className="whitespace-nowrap text-xs text-gris">{m.mandatDebut ? formatDate(m.mandatDebut) : "—"}</td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <Badge ton={m.actif ? "vert" : "gris"} className="whitespace-nowrap">{m.actif ? "En exercice" : "Ancien"}</Badge>
                      {peutGerer && (
                        <>
                          <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs" onClick={() => action(() => majMembreConseil(m.id, { actif: !m.actif }), m.actif ? "Mandat clôturé." : "Membre réactivé.")}>
                            {m.actif ? "Clôturer" : "Réactiver"}
                          </button>
                          <button type="button" onClick={() => supprimer(m)} title="Retirer" aria-label={`Retirer ${m.nom} du Conseil`} className="rounded p-1.5 text-gris transition hover:bg-rougeL hover:text-rouge">
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Conseil;
