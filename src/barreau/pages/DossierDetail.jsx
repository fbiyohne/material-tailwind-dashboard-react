import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, ShieldExclamationIcon, CheckIcon } from "@heroicons/react/24/outline";
import { Badge, DocumentModal, useToast } from "../components";
import { STATUT_DOSSIER_META } from "../data/institutionnel";
import { getDossier, majDossier, archiverDoc } from "../api/resources";

const STATUTS = ["ouvert", "instruction", "audience", "decision", "classe"];

export function DossierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [dossier, setDossier] = useState(null);
  const [form, setForm] = useState(null);
  const [enregistre, setEnregistre] = useState(false);
  const [convocation, setConvocation] = useState(false);

  // getDossier journalise la consultation côté serveur (RG-13).
  useEffect(() => {
    getDossier(Number(id)).then((d) => { setDossier(d); setForm(d); }).catch(() => setDossier(false));
  }, [id]);

  if (dossier === false) {
    return (
      <div className="py-20 text-center">
        <p className="text-gris">Dossier introuvable.</p>
        <button className="bpn-btn bpn-btn-ghost mt-4" onClick={() => navigate("/discipline")}>Retour</button>
      </div>
    );
  }
  if (!dossier || !form) return <div className="py-20 text-center text-sm text-gris">Chargement…</div>;

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setEnregistre(false); };
  const meta = STATUT_DOSSIER_META[form.statut];

  const enregistrer = async () => {
    try {
      await majDossier(dossier.id, {
        statut: form.statut, dateConvocation: form.dateConvocation, dateAudience: form.dateAudience,
        decision: form.decision, sanction: form.sanction,
      });
      setEnregistre(true);
      toast.success("Dossier mis à jour.");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/discipline" className="inline-flex items-center gap-1.5 text-sm text-gris hover:text-navy">
        <ArrowLeftIcon className="h-4 w-4" /> Retour aux dossiers
      </Link>

      <div className="flex items-center gap-2 rounded border-l-[3px] border-rouge bg-[#f4e6e6] px-4 py-2.5 text-sm text-rouge">
        <ShieldExclamationIcon className="h-5 w-5 shrink-0" /> Dossier confidentiel — consultation journalisée (RG-13).
      </div>

      {/* En-tête */}
      <div className="bpn-card flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl text-navy">Dossier N° {dossier.reference}</h2>
            <Badge ton={meta.ton}>{meta.label}</Badge>
          </div>
          <div className="mt-1 text-sm text-gris">
            Mis en cause : <span className="font-medium text-encre">{dossier.avocatNom === "Confidentiel" ? "Confidentiel" : `Me ${dossier.avocatNom}`}</span> · saisine du {dossier.dateSaisine}
          </div>
        </div>
        <button className="bpn-btn bpn-btn-danger" onClick={() => { journaliserDiscipline(`Génération convocation — dossier ${dossier.reference}`); setConvocation(true); }}>
          Convocation disciplinaire
        </button>
      </div>

      <div className="bpn-card">
        <div className="bpn-card-header"><span className="bpn-card-heading">Objet de la saisine</span></div>
        <p className="p-4 text-sm text-encre">{dossier.objet}</p>
      </div>

      {/* Instruction du dossier */}
      <div className="bpn-card">
        <div className="bpn-card-header"><span className="bpn-card-heading">Instruction & décision</span></div>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <label className="block"><span className="bpn-label">Statut de la procédure</span>
            <select value={form.statut} onChange={set("statut")} className="bpn-input mt-1">
              {STATUTS.map((s) => <option key={s} value={s}>{STATUT_DOSSIER_META[s].label}</option>)}
            </select></label>
          <div />
          <label className="block"><span className="bpn-label">Date de convocation</span>
            <input type="date" value={form.dateConvocation ?? ""} onChange={set("dateConvocation")} className="bpn-input mt-1" /></label>
          <label className="block"><span className="bpn-label">Date d'audience</span>
            <input type="date" value={form.dateAudience ?? ""} onChange={set("dateAudience")} className="bpn-input mt-1" /></label>
          <label className="block sm:col-span-2"><span className="bpn-label">Décision rendue</span>
            <textarea rows={3} value={form.decision ?? ""} onChange={set("decision")} className="bpn-input mt-1" placeholder="Motifs et dispositif de la décision…" /></label>
          <label className="block sm:col-span-2"><span className="bpn-label">Sanction éventuelle</span>
            <input value={form.sanction ?? ""} onChange={set("sanction")} className="bpn-input mt-1" placeholder="Avertissement, blâme, suspension, radiation…" /></label>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-grisM px-4 py-3">
          {enregistre && <span className="flex items-center gap-1 text-sm text-vert"><CheckIcon className="h-4 w-4" /> Enregistré</span>}
          <button className="bpn-btn bpn-btn-primary" onClick={enregistrer}>Enregistrer le dossier</button>
        </div>
      </div>

      <DocumentModal
        open={convocation}
        onClose={() => setConvocation(false)}
        title="Convocation disciplinaire"
        org="Conseil de discipline"
        reference={`Dossier N° ${dossier.reference}`}
        signataire={{ role: "Le Bâtonnier, Président du Conseil de discipline", nom: "Me BIKINDOU Audrey Séverin" }}
        onArchive={() => archiverDoc({ categorie: "Convocation disciplinaire", titre: `Convocation — dossier ${dossier.reference}`, reference: dossier.reference, date: new Date().toISOString().slice(0, 10) })}
      >
        <p>
          Dans le cadre du dossier disciplinaire <strong>N° {dossier.reference}</strong>,{" "}
          <strong>{dossier.avocatNom === "Confidentiel" ? "l'avocat concerné" : `Me ${dossier.avocatNom}`}</strong>{" "}
          est invité(e) à comparaître devant le Conseil de discipline de l'Ordre des Avocats du
          Barreau de Pointe-Noire{form.dateAudience ? <>, le <strong>{new Date(form.dateAudience).toLocaleDateString("fr-FR")}</strong></> : null}.
        </p>
        <p className="mt-3">Objet : {dossier.objet}.</p>
        <p className="mt-3 text-[12px] text-gris">L'intéressé(e) pourra se faire assister du conseil de son choix.</p>
      </DocumentModal>
    </div>
  );
}

export default DossierDetail;
