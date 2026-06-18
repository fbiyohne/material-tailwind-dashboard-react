import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusIcon, MegaphoneIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, EmptyState, ErrorState, Skeleton, useToast, useConfirm, PageHeader, FormField } from "../components";
import { formatDate } from "../utils/format";
import { STATUT_PUBLICATION_META } from "../data/publications";
import { typesPublication } from "../data/config";
import { listerPublications, creerPublication as apiCreerPublication, changerStatutPublication as apiChangerStatut, supprimerPublication } from "../api/resources";

function NouvellePublicationModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const types = typesPublication();
  const [form, setForm] = useState({ titre: "", type: types[0] ?? "Avis", contenu: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valider = async () => {
    if (!form.titre.trim()) return;
    try {
      await apiCreerPublication(form);
      onCreated?.();
      onClose();
      setForm({ titre: "", type: types[0] ?? "Avis", contenu: "" });
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nouvelle publication"
      footer={<button className="bpn-btn bpn-btn-primary" onClick={valider}>Soumettre pour validation</button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Titre" className="col-span-2">
            <input value={form.titre} onChange={set("titre")} className="bpn-input" />
          </FormField>
          <FormField label="Type">
            <select value={form.type} onChange={set("type")} className="bpn-input">
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Contenu">
          <textarea rows={5} value={form.contenu} onChange={set("contenu")} className="bpn-input" />
        </FormField>
      </div>
    </Modal>
  );
}

export function Publications() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [publications, setPublications] = useState([]);
  const [creer, setCreer] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  const charger = () => {
    setChargement(true);
    setErreur(false);
    listerPublications().then(setPublications).catch(() => setErreur(true)).finally(() => setChargement(false));
  };
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changerStatutPublication = async (id, statut) => {
    try { await apiChangerStatut(id, statut); charger(); } catch (e) { toast.error(e.message); }
  };
  const supprimer = async (p) => {
    const ok = await confirm({
      title: "Supprimer la publication",
      message: `« ${p.titre} » sera définitivement supprimée. Continuer ?`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try { await supprimerPublication(p.id); toast.success("Publication supprimée."); charger(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Documents" titre="Publications institutionnelles" sousTitre="Avis et communiqués — validation par le Bâtonnier avant diffusion.">
        <button className="bpn-btn bpn-btn-or" onClick={() => setCreer(true)}>
          <PlusIcon className="h-4 w-4" /> Nouvelle publication
        </button>
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
      ) : publications.length === 0 ? (
        <div className="bpn-card">
          <EmptyState
            icon={MegaphoneIcon}
            title="Aucune publication"
            description="Rédigez un avis ou un communiqué ; il sera soumis à la validation du Bâtonnier avant diffusion."
            action={<button className="bpn-btn bpn-btn-or" onClick={() => setCreer(true)}><PlusIcon className="h-4 w-4" /> Nouvelle publication</button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {publications.map((p) => {
          const meta = STATUT_PUBLICATION_META[p.statut];
          return (
            <div key={p.id} className="bpn-card h-full p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge ton="gris" dot={false}>{p.type}</Badge>
                    <span className="font-display text-base text-navy">{p.titre}</span>
                    <Badge ton={meta.ton}>{meta.label}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-gris">{p.contenu}</p>
                  <div className="mt-1 font-mono text-xs text-gris">{formatDate(p.date)}</div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {p.statut === "a_valider" && (
                    <button className="bpn-btn bpn-btn-primary !py-1.5 text-xs"
                      onClick={() => changerStatutPublication(p.id, "valide")}>
                      Valider (Bâtonnier)
                    </button>
                  )}
                  {p.statut === "valide" && (
                    <button className="bpn-btn bpn-btn-or !py-1.5 text-xs"
                      onClick={() => changerStatutPublication(p.id, "publie")}>
                      Publier
                    </button>
                  )}
                  <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs" onClick={() => navigate(`/publications/${p.id}`)}>
                    Ouvrir
                  </button>
                  {p.statut !== "publie" && (
                    <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs text-rouge" onClick={() => supprimer(p)} title="Supprimer">
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      <NouvellePublicationModal open={creer} onClose={() => setCreer(false)} onCreated={charger} />
    </div>
  );
}

export default Publications;
