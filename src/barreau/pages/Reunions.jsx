import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusIcon, CalendarDaysIcon, MapPinIcon, ArrowRightIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, EmptyState, ErrorState, Skeleton, useToast, useConfirm, PageHeader, FormField } from "../components";
import { formatDate } from "../utils/format";
import { useAuth } from "../auth/AuthContext";
import { listerReunions, creerReunion as apiCreerReunion, supprimerReunion } from "../api/resources";

function NouvelleReunionModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ date: "", heure: "15:00", lieu: "Maison de l'Avocat — Pointe-Noire", odj: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valider = async () => {
    if (!form.date) return;
    try {
      await apiCreerReunion({ date: form.date, heure: form.heure, lieu: form.lieu, ordreDuJour: form.odj.split("\n").map((s) => s.trim()).filter(Boolean) });
      onCreated?.();
      onClose();
      setForm({ date: "", heure: "15:00", lieu: "Maison de l'Avocat — Pointe-Noire", odj: "" });
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Planifier une réunion du Conseil"
      footer={<button className="bpn-btn bpn-btn-primary" onClick={valider}>Créer la réunion</button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date"><input type="date" value={form.date} onChange={set("date")} className="bpn-input" /></FormField>
          <FormField label="Heure"><input type="time" value={form.heure} onChange={set("heure")} className="bpn-input" /></FormField>
        </div>
        <FormField label="Lieu"><input value={form.lieu} onChange={set("lieu")} className="bpn-input" /></FormField>
        <FormField label="Ordre du jour" hint="une ligne par point"><textarea rows={4} value={form.odj} onChange={set("odj")} className="bpn-input" /></FormField>
      </div>
    </Modal>
  );
}

export function Reunions() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  // Création/suppression réservées au SG (POST/DELETE réunions) : le Bâtonnier
  // consulte réunions, convocations et PV mais ne les crée/supprime pas.
  const peutGerer = ["SECRETAIRE_GENERAL", "ADMIN"].includes(user?.role);
  const [reunions, setReunions] = useState([]);
  const [creer, setCreer] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  const charger = () => {
    setChargement(true);
    setErreur(false);
    listerReunions().then(setReunions).catch(() => setErreur(true)).finally(() => setChargement(false));
  };
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const supprimer = async (r) => {
    const ok = await confirm({
      title: "Supprimer la réunion",
      message: `La réunion du ${formatDate(r.date)} et sa convocation seront supprimées. Cette action est irréversible.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try { await supprimerReunion(r.id); toast.success("Réunion supprimée."); charger(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Institutionnel" titre="Réunions du Conseil de l'Ordre" sousTitre="Planification, convocations, feuilles de présence et procès-verbaux.">
        {peutGerer && <button className="bpn-btn bpn-btn-or" onClick={() => setCreer(true)}><PlusIcon className="h-4 w-4" /> Nouvelle réunion</button>}
      </PageHeader>

      {chargement ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bpn-card h-full space-y-3 p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : erreur ? (
        <div className="bpn-card p-6"><ErrorState onRetry={charger} /></div>
      ) : reunions.length === 0 ? (
        <div className="bpn-card">
          <EmptyState
            icon={CalendarDaysIcon}
            title="Aucune réunion planifiée"
            description="Planifiez une réunion du Conseil de l'Ordre pour générer convocations, feuilles de présence et procès-verbaux."
            action={peutGerer ? <button className="bpn-btn bpn-btn-or" onClick={() => setCreer(true)}><PlusIcon className="h-4 w-4" /> Nouvelle réunion</button> : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {reunions.map((r) => (
          <div
            key={r.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/reunions/${r.id}`)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/reunions/${r.id}`); } }}
            className="bpn-card h-full cursor-pointer p-5 text-left transition hover:border-or hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-or"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg capitalize text-navy">{formatDate(r.date)}</span>
                  <Badge ton={r.statut === "tenue" ? "vert" : "or"}>{r.statut === "tenue" ? "Tenue" : "Planifiée"}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gris">
                  <span className="flex items-center gap-1"><CalendarDaysIcon className="h-3.5 w-3.5" /> {r.heure}</span>
                  <span className="flex items-center gap-1"><MapPinIcon className="h-3.5 w-3.5" /> {r.lieu}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {/* Une réunion « tenue » (avec PV) n'est pas supprimable — pas de bouton. */}
                {peutGerer && r.statut !== "tenue" && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); supprimer(r); }}
                    title="Supprimer la réunion"
                    aria-label={`Supprimer la réunion du ${formatDate(r.date)}`}
                    className="rounded p-1.5 text-gris transition hover:bg-rougeL hover:text-rouge"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
                <ArrowRightIcon className="h-5 w-5 text-gris" />
              </div>
            </div>
            <ul className="mt-3 list-inside list-decimal space-y-0.5 text-sm text-encre">
              {r.ordreDuJour.slice(0, 3).map((pt, i) => <li key={i}>{pt}</li>)}
              {r.ordreDuJour.length > 3 && <li className="list-none text-xs text-gris">+ {r.ordreDuJour.length - 3} autres points</li>}
            </ul>
          </div>
        ))}
        </div>
      )}

      <NouvelleReunionModal open={creer} onClose={() => setCreer(false)} onCreated={charger} />
    </div>
  );
}

export default Reunions;
