import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, CheckIcon } from "@heroicons/react/24/outline";
import { Badge, useToast, FormField } from "../components";
import { STATUT_PUBLICATION_META } from "../data/publications";
import { getPublication, majPublication, changerStatutPublication } from "../api/resources";

export function PublicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [publication, setPublication] = useState(null);
  const [form, setForm] = useState({});

  const charger = () =>
    getPublication(Number(id)).then((p) => { setPublication(p); setForm(p); }).catch(() => setPublication(false));
  useEffect(() => { charger(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (publication === false) {
    return (
      <div className="py-20 text-center">
        <p className="text-gris">Publication introuvable.</p>
        <button className="bpn-btn bpn-btn-ghost mt-4" onClick={() => navigate("/publications")}>Retour</button>
      </div>
    );
  }
  if (!publication) return <div className="py-20 text-center text-sm text-gris">Chargement…</div>;

  const meta = STATUT_PUBLICATION_META[publication.statut];
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const enregistrer = async () => {
    try {
      await majPublication(publication.id, { titre: form.titre, type: form.type, contenu: form.contenu });
      toast.success("Publication enregistrée.");
      charger();
    } catch (e) {
      toast.error(e.message);
    }
  };
  const transition = async (statut, label) => {
    try {
      await changerStatutPublication(publication.id, statut);
      toast.success(label);
      charger();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/publications" className="inline-flex items-center gap-1.5 text-sm text-gris hover:text-navy">
        <ArrowLeftIcon className="h-4 w-4" /> Retour aux publications
      </Link>

      <div className="bpn-card flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge ton="gris" dot={false}>{publication.type}</Badge>
            <h2 className="font-display text-2xl text-navy">{publication.titre}</h2>
            <Badge ton={meta.ton}>{meta.label}</Badge>
          </div>
          <div className="mt-1 font-mono text-xs text-gris">{publication.date}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {publication.statut === "brouillon" && (
            <button className="bpn-btn bpn-btn-primary" onClick={() => transition("a_valider", "Soumis pour validation.")}>Soumettre</button>
          )}
          {publication.statut === "a_valider" && (
            <button className="bpn-btn bpn-btn-primary" onClick={() => transition("valide", "Validé par le Bâtonnier.")}>Valider (Bâtonnier)</button>
          )}
          {publication.statut === "valide" && (
            <button className="bpn-btn bpn-btn-or" onClick={() => transition("publie", "Publication diffusée.")}>Publier</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Édition */}
        <div className="bpn-card">
          <div className="bpn-card-header">
            <span className="bpn-card-heading">Rédaction</span>
            <button className="bpn-btn bpn-btn-primary !px-3 !py-1 text-[11px]" onClick={enregistrer}><CheckIcon className="h-3.5 w-3.5" /> Enregistrer</button>
          </div>
          <div className="space-y-3 p-4">
            <FormField label="Titre">
              <input value={form.titre ?? ""} onChange={set("titre")} className="bpn-input" />
            </FormField>
            <FormField label="Type">
              <select value={form.type ?? "Avis"} onChange={set("type")} className="bpn-input"><option>Avis</option><option>Communiqué</option></select>
            </FormField>
            <FormField label="Contenu">
              <textarea rows={8} value={form.contenu ?? ""} onChange={set("contenu")} className="bpn-input" />
            </FormField>
          </div>
        </div>

        {/* Aperçu */}
        <div className="bpn-card">
          <div className="bpn-card-header"><span className="bpn-card-heading">Aperçu de diffusion</span></div>
          <div className="p-6">
            <div className="overflow-hidden rounded border border-grisM">
              <div className="bg-navy px-5 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-or">Barreau de Pointe-Noire</div>
                <div className="text-[9px] text-white/60">{form.type ?? publication.type} officiel</div>
              </div>
              <div className="h-[3px] bg-gradient-to-r from-or via-or-2 to-or" />
              <div className="px-6 py-5">
                <div className="font-display text-xl text-navy">{form.titre || "—"}</div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-encre">{form.contenu || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PublicationDetail;
