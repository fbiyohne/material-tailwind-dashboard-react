import { useCallback, useEffect, useState } from "react";
import { PlusIcon, TrashIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, useToast, useConfirm, TableSkeleton, ErrorState, EmptyState } from "../components";
import { formatDate } from "../utils/format";
import { useAuth } from "../auth/AuthContext";
import { listerConseil, ajouterMembreConseil, majMembreConseil, supprimerMembreConseil } from "../api/resources";

const videForm = { nom: "", fonction: "Membre du Conseil" };

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

  const charger = useCallback(() => {
    setErreur(false);
    listerConseil(true).then(setMembres).catch(() => setErreur(true));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const action = async (fn, msg) => { try { await fn(); toast.success(msg); charger(); } catch (e) { toast.error(e.message); } };
  const ajouter = () => { if (form.nom.trim() && form.fonction.trim()) { action(() => ajouterMembreConseil({ ...form, ordre: (membres?.length ?? 0) + 1 }), "Membre ajouté."); setForm(videForm); } };
  const supprimer = (m) => confirm({ title: "Retirer du Conseil ?", message: `${m.nom} sera retiré(e) de la composition.`, confirmLabel: "Retirer", danger: true }).then((ok) => ok && action(() => supprimerMembreConseil(m.id), "Membre retiré."));

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="La composition n'a pas pu être chargée." onRetry={charger} /></div>;
  if (!membres) return <div className="bpn-card p-6"><TableSkeleton rows={6} cols={3} /></div>;

  const actifs = membres.filter((m) => m.actif).length;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Institutionnel" titre="Conseil de l'Ordre" sousTitre={`Composition et mandats — ${actifs} membre(s) en exercice.`} />

      {peutGerer && (
        <div className="flex flex-col gap-2 rounded-lg border border-grisL bg-grisL/30 p-3 sm:flex-row">
          <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Nom (Me …)" className="bpn-input flex-1" />
          <input value={form.fonction} onChange={(e) => setForm({ ...form, fonction: e.target.value })} placeholder="Fonction" className="bpn-input sm:w-64" />
          <button className="bpn-btn bpn-btn-or" onClick={ajouter} disabled={!form.nom.trim()}><PlusIcon className="h-4 w-4" /> Ajouter</button>
        </div>
      )}

      <div className="bpn-card overflow-hidden">
        {membres.length === 0 ? (
          <div className="p-6"><EmptyState icon={UserGroupIcon} title="Conseil vide" description="Ajoutez les membres du Conseil ou publiez une élection." /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grisL text-left text-[11px] uppercase tracking-wide text-gris">
                <th className="w-12 px-4 py-2.5 font-medium">Ordre</th>
                <th className="px-4 py-2.5 font-medium">Membre</th>
                <th className="px-4 py-2.5 font-medium">Fonction</th>
                <th className="px-4 py-2.5 font-medium">Mandat depuis</th>
                <th className="px-4 py-2.5 text-right font-medium">{peutGerer ? "Actions" : "Statut"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grisL">
              {membres.map((m) => (
                <tr key={m.id} className={`hover:bg-grisL/40 ${m.actif ? "" : "opacity-60"}`}>
                  <td className="px-4 py-2.5 font-mono text-or">{m.ordre}</td>
                  <td className="px-4 py-2.5 font-medium text-encre">{m.nom}</td>
                  <td className="px-4 py-2.5">
                    {peutGerer ? (
                      <input defaultValue={m.fonction} className="bpn-input !w-48 !py-1 text-sm"
                        onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== m.fonction) action(() => majMembreConseil(m.id, { fonction: v }), "Fonction mise à jour."); }} />
                    ) : <span className="text-gris">{m.fonction}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gris">{m.mandatDebut ? formatDate(m.mandatDebut) : "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Badge ton={m.actif ? "vert" : "gris"}>{m.actif ? "En exercice" : "Ancien"}</Badge>
                      {peutGerer && (
                        <>
                          <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs" onClick={() => action(() => majMembreConseil(m.id, { actif: !m.actif }), m.actif ? "Mandat clôturé." : "Membre réactivé.")}>
                            {m.actif ? "Clôturer" : "Réactiver"}
                          </button>
                          <button type="button" onClick={() => supprimer(m)} title="Retirer" aria-label="Retirer du Conseil" className="rounded p-1.5 text-gris transition hover:bg-rougeL hover:text-rouge">
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
