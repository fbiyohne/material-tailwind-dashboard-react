import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { UserIcon, PhoneIcon, IdentificationIcon, PencilSquareIcon, AcademicCapIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { FormField } from "./FormField";
import { FormSection } from "./FormSection";
import { useToast } from "./Toast";
import { modifierMembre } from "../api/resources";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const champ = (error) => `bpn-input ${error ? "is-invalid" : ""}`;

/** Édition de la fiche d'un membre (FR-AV-01 : modifier). */
export function EditMembreModal({ membre, open, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(membre ?? {});
  const [erreurs, setErreurs] = useState({});
  const [loading, setLoading] = useState(false);

  // On aplatit les champs de stage (normalisés en objet `stage`) pour l'édition,
  // afin de pouvoir renseigner/corriger la prestation de serment depuis la fiche.
  useEffect(() => {
    if (membre) {
      setForm({
        ...membre,
        dateServment: membre.stage?.dateServment ?? "",
        maitreStage: membre.stage?.maitreStage ?? "",
        dureeMois: membre.stage?.dureeMois ?? "",
      });
      setErreurs({});
    }
  }, [membre]);

  if (!membre) return null;
  const estStagiaire = membre.qualite === "stagiaire";
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (erreurs[k]) setErreurs((er) => ({ ...er, [k]: undefined }));
  };

  const valider = async () => {
    const e = {};
    if (!form.nom?.trim()) e.nom = "Le nom est requis.";
    if (form.email?.trim() && !EMAIL_RE.test(form.email.trim())) e.email = "Adresse email invalide.";
    setErreurs(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      const maj = await modifierMembre(membre.id, {
        nom: form.nom, cabinet: form.cabinet, statut: form.statut, sexe: form.sexe || null,
        tel: form.tel, email: form.email, adresse: form.adresse, rccm: form.rccm, cnss: form.cnss,
        observations: form.observations, dateNaissance: form.dateNaissance, dateInscription: form.dateInscription,
        // Champs de stage : envoyés seulement pour un stagiaire ; on n'envoie la
        // durée que si renseignée (le serveur exige un entier positif).
        ...(estStagiaire
          ? {
              dateServment: form.dateServment || undefined,
              maitreStage: form.maitreStage || undefined,
              ...(form.dureeMois ? { dureeMois: Number(form.dureeMois) } : {}),
            }
          : {}),
      });
      toast.success(`Fiche mise à jour — Me ${maj.nom}`);
      onSaved?.(maj);
      onClose();
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
      title={`Modifier — Me ${membre.nom}`}
      footer={<button className="bpn-btn bpn-btn-primary" onClick={valider} disabled={!form.nom?.trim() || loading}>Enregistrer</button>}
    >
      <div className="space-y-6">
        <FormSection icon={UserIcon} titre="Identité & statut">
          <FormField label="Nom et prénom" required full error={erreurs.nom}>
            <input value={form.nom ?? ""} onChange={set("nom")} className={champ(erreurs.nom)} />
          </FormField>
          <FormField label="Statut">
            <select value={form.statut ?? "inscrit"} onChange={set("statut")} className="bpn-input">
              <option value="inscrit">Inscrit</option>
              <option value="suspendu">Suspendu</option>
              <option value="omis">Omis</option>
              <option value="honoraire">Honoraire</option>
              <option value="radie">Radié</option>
            </select>
          </FormField>
          <FormField label="Sexe" hint="reporting de parité">
            <select value={form.sexe ?? ""} onChange={set("sexe")} className="bpn-input">
              <option value="">Non renseigné</option>
              <option value="H">Homme</option>
              <option value="F">Femme</option>
            </select>
          </FormField>
          <FormField label="Date de naissance">
            <input type="date" value={form.dateNaissance ?? ""} onChange={set("dateNaissance")} className="bpn-input" />
          </FormField>
        </FormSection>

        <FormSection icon={PhoneIcon} titre="Coordonnées">
          <FormField label="Téléphone">
            <input value={form.tel ?? ""} onChange={set("tel")} className="bpn-input" />
          </FormField>
          <FormField label="Email" error={erreurs.email}>
            <input type="email" value={form.email ?? ""} onChange={set("email")} className={champ(erreurs.email)} />
          </FormField>
          <FormField label="Cabinet" full>
            <input value={form.cabinet ?? ""} onChange={set("cabinet")} className="bpn-input" />
          </FormField>
          <FormField label="Adresse professionnelle" full>
            <input value={form.adresse ?? ""} onChange={set("adresse")} className="bpn-input" />
          </FormField>
        </FormSection>

        <FormSection icon={IdentificationIcon} titre="Inscription & identifiants">
          <FormField label="Date d'inscription">
            <input type="date" value={form.dateInscription ?? ""} onChange={set("dateInscription")} className="bpn-input" />
          </FormField>
          <span className="hidden sm:block" aria-hidden="true" />
          <FormField label="RCCM" hint="le cas échéant">
            <input value={form.rccm ?? ""} onChange={set("rccm")} className="bpn-input" />
          </FormField>
          <FormField label="CNSS" hint="le cas échéant">
            <input value={form.cnss ?? ""} onChange={set("cnss")} className="bpn-input" />
          </FormField>
        </FormSection>

        {estStagiaire && (
          <FormSection icon={AcademicCapIcon} titre="Stage (avocat stagiaire)">
            <FormField label="Prestation de serment" hint="ouvre le suivi de stage">
              <input type="date" value={form.dateServment ?? ""} onChange={set("dateServment")} className="bpn-input" />
            </FormField>
            <FormField label="Durée du stage" hint="en mois (défaut 24)">
              <input type="number" min={1} max={120} value={form.dureeMois ?? ""} onChange={set("dureeMois")} className="bpn-input" placeholder="24" />
            </FormField>
            <FormField label="Maître de stage" full>
              <input value={form.maitreStage ?? ""} onChange={set("maitreStage")} className="bpn-input" />
            </FormField>
          </FormSection>
        )}

        <FormSection icon={PencilSquareIcon} titre="Observations">
          <FormField label="Notes internes" full>
            <textarea rows={2} value={form.observations ?? ""} onChange={set("observations")} className="bpn-input" />
          </FormField>
        </FormSection>
      </div>
    </Modal>
  );
}

EditMembreModal.propTypes = {
  membre: PropTypes.object,
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onSaved: PropTypes.func,
};

export default EditMembreModal;
