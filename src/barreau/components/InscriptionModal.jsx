import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import {
  UserPlusIcon, UserIcon, PhoneIcon, IdentificationIcon, AcademicCapIcon,
  PencilSquareIcon, SparklesIcon, ScaleIcon,
} from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { FormField } from "./FormField";
import { FormSection } from "./FormSection";
import { Notice } from "./Notice";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";
import { MentionJuridique } from "./MentionJuridique";
import { useAuth } from "../auth/AuthContext";
import { inscrireMembre, admettreDirectement, getParametres } from "../api/resources";

const vide = () => ({
  nom: "", qualite: "avocat", cabinet: "",
  dateInscription: new Date().toISOString().slice(0, 10), dateNaissance: "",
  tel: "", email: "", adresse: "", rccm: "", cnss: "", observations: "",
  dateServment: "", maitreStage: "", dureeMois: "24",
  cas: "", ancienneteAns: "", reference: "",
});

// Statut dérivé de la qualité : un nouveau membre est toujours actif.
const STATUT_PAR_QUALITE = { avocat: "inscrit", stagiaire: "stagiaire", honoraire: "honoraire" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const champ = (error) => `bpn-input ${error ? "is-invalid" : ""}`;

/** Formulaire d'inscription d'un avocat au tableau (FR-AV-01). Réservé SG/Admin. */
export function InscriptionModal({ open, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(vide());
  const [erreurs, setErreurs] = useState({});
  const [loading, setLoading] = useState(false);
  const [modifie, setModifie] = useState(false); // saisie modifiée (garde anti perte)
  const { user } = useAuth();
  // Admission directe : action admission_directe (matrice d'accès, /auth/me).
  const peutAdmettre = user?.role === "ADMIN" || !!user?.permissions?.includes("admission_directe");
  const [direct, setDirect] = useState(false);
  const [cas, setCas] = useState([]); // cas d'admission lus en Paramètres, jamais écrits en dur
  const estStagiaire = !direct && form.qualite === "stagiaire";

  useEffect(() => {
    if (!open || !peutAdmettre) return;
    getParametres().then((p) => setCas(p.regles?.admissionDirecte?.cas ?? [])).catch(() => {});
  }, [open, peutAdmettre]);
  const casChoisi = cas.find((c) => c.code === form.cas);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setModifie(true);
    if (erreurs[k]) setErreurs((er) => ({ ...er, [k]: undefined }));
  };

  // Garde anti perte de saisie : confirme avant de fermer un formulaire d'inscription
  // renseigné mais non soumis (voile / Échap / croix), puis réinitialise.
  const avantFermeture = async () => {
    if (!modifie) return true;
    const ok = await confirm({
      title: "Abandonner l'inscription ?",
      message: "Les informations saisies pour ce nouvel avocat seront perdues.",
      confirmLabel: "Abandonner",
      danger: true,
    });
    if (ok) { setForm(vide()); setErreurs({}); setModifie(false); }
    return ok;
  };

  const valider = () => {
    const e = {};
    if (form.nom.trim().length < 2) e.nom = "Indiquez le nom et le prénom.";
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) e.email = "Adresse email invalide.";
    if (direct) {
      if (!form.cas) e.cas = "Choisissez le cas d'admission.";
      if (form.ancienneteAns === "" || Number(form.ancienneteAns) < 0) e.ancienneteAns = "Indiquez l'ancienneté.";
      else if (casChoisi && Number(form.ancienneteAns) < casChoisi.ancienneteMinAns) e.ancienneteAns = `${casChoisi.ancienneteMinAns} ans au moins pour ce cas.`;
      if (!form.reference.trim()) e.reference = "Indiquez la référence de la décision.";
    }
    if (estStagiaire && form.dureeMois && Number(form.dureeMois) <= 0) e.dureeMois = "Durée invalide.";
    return e;
  };

  const soumettre = async () => {
    const e = valider();
    setErreurs(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      if (direct) {
        const m = await admettreDirectement({
          nom: form.nom.trim(), cas: form.cas, ancienneteAns: Number(form.ancienneteAns), reference: form.reference.trim(),
          dateDecision: form.dateInscription || undefined, dateNaissance: form.dateNaissance || undefined,
          cabinet: form.cabinet.trim() || undefined, tel: form.tel.trim() || undefined, email: form.email.trim() || undefined,
          adresse: form.adresse.trim() || undefined, rccm: form.rccm.trim() || undefined, cnss: form.cnss.trim() || undefined,
          observations: form.observations.trim() || undefined,
        });
        toast.success(`Admission directe enregistrée — ${m.numInscription}`);
        setForm(vide()); setErreurs({}); setModifie(false); setDirect(false);
        onClose();
        navigate(`/avocats/${m.id}`);
        return;
      }
      const payload = {
        nom: form.nom.trim(),
        qualite: form.qualite,
        statut: STATUT_PAR_QUALITE[form.qualite],
        cabinet: form.cabinet.trim() || undefined,
        dateInscription: form.dateInscription || undefined,
        dateNaissance: form.dateNaissance || undefined,
        tel: form.tel.trim() || undefined,
        email: form.email.trim() || undefined,
        adresse: form.adresse.trim() || undefined,
        rccm: form.rccm.trim() || undefined,
        cnss: form.cnss.trim() || undefined,
        observations: form.observations.trim() || undefined,
        ...(estStagiaire
          ? { dateServment: form.dateServment || undefined, maitreStage: form.maitreStage.trim() || undefined, dureeMois: form.dureeMois ? Number(form.dureeMois) : undefined }
          : {}),
      };
      const m = await inscrireMembre(payload);
      toast.success(`Inscription enregistrée — ${m.numInscription}`);
      setForm(vide());
      setErreurs({});
      setModifie(false);
      onClose();
      navigate(`/avocats/${m.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      onBeforeClose={avantFermeture}
      title="Inscription d'un avocat"
      footer={
        <button className="bpn-btn bpn-btn-or" onClick={soumettre} disabled={!form.nom.trim() || loading}>
          {loading
            ? <span className="inline-block h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-current border-t-transparent" />
            : <UserPlusIcon className="h-4 w-4" />}
          {direct ? "Admettre au tableau" : "Inscrire au tableau"}
        </button>
      }
    >
      <Notice ton="or" icon={SparklesIcon} className="mb-5">
        Le numéro d'inscription <span className="font-mono font-medium text-navy">PN-AAAA-NNN</span> et le statut sont attribués automatiquement à l'enregistrement.
      </Notice>

      {peutAdmettre && (
        <div role="group" aria-label="Mode d'inscription" className="mb-5 inline-flex rounded-md border border-grisM p-0.5 text-sm">
          {[[false, "Inscription ordinaire"], [true, "Admission directe"]].map(([v, label]) => (
            <button key={label} type="button" aria-pressed={direct === v} onClick={() => setDirect(v)}
              className={`rounded px-3 py-1.5 font-medium transition ${direct === v ? "bg-navy text-white" : "text-encre hover:bg-grisL"}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-6">
        <FormSection icon={UserIcon} titre="Identité">
          <FormField label="Nom et prénom" required hint="NOM Prénom" full error={erreurs.nom}>
            <input value={form.nom} onChange={set("nom")} className={champ(erreurs.nom)} placeholder="KOUMBA Jean" autoFocus />
          </FormField>
          <FormField label="Qualité">
            <select value={direct ? "avocat" : form.qualite} onChange={set("qualite")} disabled={direct} className="bpn-input">
              <option value="avocat">Avocat</option>
              <option value="stagiaire">Avocat stagiaire</option>
              <option value="honoraire">Avocat honoraire</option>
            </select>
          </FormField>
          <FormField label="Date de naissance">
            <input type="date" value={form.dateNaissance} onChange={set("dateNaissance")} className="bpn-input" />
          </FormField>
        </FormSection>

        <FormSection icon={PhoneIcon} titre="Coordonnées">
          <FormField label="Téléphone">
            <input value={form.tel} onChange={set("tel")} className="bpn-input" placeholder="+242 06 …" />
          </FormField>
          <FormField label="Email" error={erreurs.email}>
            <input type="email" value={form.email} onChange={set("email")} className={champ(erreurs.email)} placeholder="prenom.nom@cabinet.cg" />
          </FormField>
          <FormField label="Cabinet" full>
            <input value={form.cabinet} onChange={set("cabinet")} className="bpn-input" placeholder="SCPA …" />
          </FormField>
          <FormField label="Adresse professionnelle" full>
            <input value={form.adresse} onChange={set("adresse")} className="bpn-input" />
          </FormField>
        </FormSection>

        {direct && (
          <FormSection icon={ScaleIcon} titre="Admission directe">
            <FormField label="Cas d'admission" required error={erreurs.cas} full>
              <select value={form.cas} onChange={set("cas")} className={champ(erreurs.cas)}>
                <option value="">Choisir…</option>
                {cas.map((c) => <option key={c.code} value={c.code}>{c.libelle}</option>)}
              </select>
            </FormField>
            <FormField label="Ancienneté" required hint={casChoisi ? `${casChoisi.ancienneteMinAns} ans au moins` : "années"} error={erreurs.ancienneteAns}>
              <input type="number" min="0" max="60" value={form.ancienneteAns} onChange={set("ancienneteAns")} className={champ(erreurs.ancienneteAns)} />
            </FormField>
            <FormField label="Référence de la décision" required error={erreurs.reference}>
              <input value={form.reference} maxLength={120} onChange={set("reference")} className={champ(erreurs.reference)} />
            </FormField>
            <div className="sm:col-span-2">
              <MentionJuridique nature="provisoire" article={casChoisi?.article ?? "Loi n° 026-92, art. 32"}>
                Provisoire, à confirmer par les textes : les cas d'admission et l'ancienneté minimale se règlent en Paramètres. Le logiciel enregistre la décision d'admission.
              </MentionJuridique>
            </div>
          </FormSection>
        )}

        {estStagiaire && (
          <FormSection icon={AcademicCapIcon} titre="Stage">
            <FormField label="Prestation de serment">
              <input type="date" value={form.dateServment} onChange={set("dateServment")} className="bpn-input" />
            </FormField>
            <FormField label="Durée du stage" hint="mois" error={erreurs.dureeMois}>
              <input type="number" min="1" max="120" value={form.dureeMois} onChange={set("dureeMois")} className={champ(erreurs.dureeMois)} />
            </FormField>
            <FormField label="Maître de stage" full>
              <input value={form.maitreStage} onChange={set("maitreStage")} className="bpn-input" placeholder="Me …" />
            </FormField>
          </FormSection>
        )}

        <FormSection icon={IdentificationIcon} titre="Inscription & identifiants">
          <FormField label={direct ? "Date de la décision" : "Date d'inscription"}>
            <input type="date" value={form.dateInscription} onChange={set("dateInscription")} className="bpn-input" />
          </FormField>
          <span className="hidden sm:block" aria-hidden="true" />
          <FormField label="RCCM" hint="le cas échéant">
            <input value={form.rccm} onChange={set("rccm")} className="bpn-input" />
          </FormField>
          <FormField label="CNSS" hint="le cas échéant">
            <input value={form.cnss} onChange={set("cnss")} className="bpn-input" />
          </FormField>
        </FormSection>

        <FormSection icon={PencilSquareIcon} titre="Observations">
          <FormField label="Notes internes" full>
            <textarea rows={2} value={form.observations} onChange={set("observations")} className="bpn-input" placeholder="Mentions particulières, antécédents…" />
          </FormField>
        </FormSection>
      </div>
    </Modal>
  );
}

InscriptionModal.propTypes = { open: PropTypes.bool, onClose: PropTypes.func };

export default InscriptionModal;
