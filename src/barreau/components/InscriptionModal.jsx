import { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import {
  UserPlusIcon, UserIcon, PhoneIcon, IdentificationIcon, AcademicCapIcon,
  PencilSquareIcon, SparklesIcon,
} from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import { inscrireMembre } from "../api/resources";

const vide = () => ({
  nom: "", qualite: "avocat", cabinet: "",
  dateInscription: new Date().toISOString().slice(0, 10), dateNaissance: "",
  tel: "", email: "", adresse: "", rccm: "", cnss: "", observations: "",
  dateServment: "", maitreStage: "", dureeMois: "24",
});

// Statut dérivé de la qualité : un nouveau membre est toujours actif.
const STATUT_PAR_QUALITE = { avocat: "inscrit", stagiaire: "stagiaire", honoraire: "honoraire" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Bloc de section du formulaire (titre + grille). */
function Section({ icon: Icon, titre, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b border-grisM pb-1.5">
        <Icon className="h-4 w-4 text-or" />
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-navy">{titre}</h4>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}
Section.propTypes = { icon: PropTypes.elementType, titre: PropTypes.string, children: PropTypes.node };

/** Champ labellisé avec marqueur requis, indice et message d'erreur. */
function Champ({ label, required, error, hint, full, children }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="bpn-label">
        {label}{required && <span className="text-rouge"> *</span>}
        {hint && <span className="ml-1 font-normal lowercase tracking-normal text-gris/70">· {hint}</span>}
      </span>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-[11px] text-rouge">{error}</p>}
    </label>
  );
}
Champ.propTypes = { label: PropTypes.string, required: PropTypes.bool, error: PropTypes.string, hint: PropTypes.string, full: PropTypes.bool, children: PropTypes.node };

const cls = (error) => `bpn-input ${error ? "!border-rouge focus:!border-rouge focus:!shadow-[0_0_0_3px_rgba(139,26,26,0.12)]" : ""}`;

/** Formulaire d'inscription d'un avocat au tableau (FR-AV-01). Réservé SG/Admin. */
export function InscriptionModal({ open, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(vide());
  const [erreurs, setErreurs] = useState({});
  const [loading, setLoading] = useState(false);
  const estStagiaire = form.qualite === "stagiaire";

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (erreurs[k]) setErreurs((er) => ({ ...er, [k]: undefined }));
  };

  const valider = () => {
    const e = {};
    if (form.nom.trim().length < 2) e.nom = "Indiquez le nom et le prénom.";
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) e.email = "Adresse email invalide.";
    if (estStagiaire && form.dureeMois && Number(form.dureeMois) <= 0) e.dureeMois = "Durée invalide.";
    return e;
  };

  const soumettre = async () => {
    const e = valider();
    setErreurs(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
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
      title="Inscription d'un avocat"
      footer={
        <button className="bpn-btn bpn-btn-or" onClick={soumettre} disabled={!form.nom.trim() || loading}>
          {loading
            ? <span className="inline-block h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-current border-t-transparent" />
            : <UserPlusIcon className="h-4 w-4" />}
          Inscrire au tableau
        </button>
      }
    >
      <div className="mb-5 flex items-start gap-2.5 rounded-md border-l-[3px] border-or bg-or-L px-3 py-2.5 text-xs text-gris">
        <SparklesIcon className="mt-0.5 h-4 w-4 shrink-0 text-or" />
        <span>Le numéro d'inscription <span className="font-mono font-medium text-navy">PN-AAAA-NNN</span> et le statut sont attribués automatiquement à l'enregistrement.</span>
      </div>

      <div className="space-y-6">
        <Section icon={UserIcon} titre="Identité">
          <Champ label="Nom et prénom" required hint="NOM Prénom" full error={erreurs.nom}>
            <input value={form.nom} onChange={set("nom")} className={cls(erreurs.nom)} placeholder="KOUMBA Jean" autoFocus />
          </Champ>
          <Champ label="Qualité">
            <select value={form.qualite} onChange={set("qualite")} className="bpn-input">
              <option value="avocat">Avocat</option>
              <option value="stagiaire">Avocat stagiaire</option>
              <option value="honoraire">Avocat honoraire</option>
            </select>
          </Champ>
          <Champ label="Date de naissance">
            <input type="date" value={form.dateNaissance} onChange={set("dateNaissance")} className="bpn-input" />
          </Champ>
        </Section>

        <Section icon={PhoneIcon} titre="Coordonnées">
          <Champ label="Téléphone">
            <input value={form.tel} onChange={set("tel")} className="bpn-input" placeholder="+242 06 …" />
          </Champ>
          <Champ label="Email" error={erreurs.email}>
            <input type="email" value={form.email} onChange={set("email")} className={cls(erreurs.email)} placeholder="prenom.nom@cabinet.cg" />
          </Champ>
          <Champ label="Cabinet" full>
            <input value={form.cabinet} onChange={set("cabinet")} className="bpn-input" placeholder="SCPA …" />
          </Champ>
          <Champ label="Adresse professionnelle" full>
            <input value={form.adresse} onChange={set("adresse")} className="bpn-input" />
          </Champ>
        </Section>

        {estStagiaire && (
          <Section icon={AcademicCapIcon} titre="Stage">
            <Champ label="Prestation de serment">
              <input type="date" value={form.dateServment} onChange={set("dateServment")} className="bpn-input" />
            </Champ>
            <Champ label="Durée du stage" hint="mois" error={erreurs.dureeMois}>
              <input type="number" min="1" max="120" value={form.dureeMois} onChange={set("dureeMois")} className={cls(erreurs.dureeMois)} />
            </Champ>
            <Champ label="Maître de stage" full>
              <input value={form.maitreStage} onChange={set("maitreStage")} className="bpn-input" placeholder="Me …" />
            </Champ>
          </Section>
        )}

        <Section icon={IdentificationIcon} titre="Inscription & identifiants">
          <Champ label="Date d'inscription">
            <input type="date" value={form.dateInscription} onChange={set("dateInscription")} className="bpn-input" />
          </Champ>
          <span className="hidden sm:block" aria-hidden="true" />
          <Champ label="RCCM" hint="le cas échéant">
            <input value={form.rccm} onChange={set("rccm")} className="bpn-input" />
          </Champ>
          <Champ label="CNSS" hint="le cas échéant">
            <input value={form.cnss} onChange={set("cnss")} className="bpn-input" />
          </Champ>
        </Section>

        <Section icon={PencilSquareIcon} titre="Observations">
          <Champ label="Notes internes" full>
            <textarea rows={2} value={form.observations} onChange={set("observations")} className="bpn-input" placeholder="Mentions particulières, antécédents…" />
          </Champ>
        </Section>
      </div>
    </Modal>
  );
}

InscriptionModal.propTypes = { open: PropTypes.bool, onClose: PropTypes.func };

export default InscriptionModal;
