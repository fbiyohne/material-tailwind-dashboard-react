import { useState } from "react";
import { KeyIcon, CheckIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { Badge, useToast, PageHeader, FormField } from "../components";
import { useAuth } from "../auth/AuthContext";
import { changerMotDePasse } from "../api/resources";

const ROLE_LABEL = {
  SECRETAIRE_GENERAL: "Secrétaire Général",
  BATONNIER: "Bâtonnier",
  TRESORIERE: "Trésorière",
  ADMIN: "Administrateur",
};
const ROLE_TON = { SECRETAIRE_GENERAL: "vert", BATONNIER: "bleu", TRESORIERE: "or", ADMIN: "gris" };

const vide = () => ({ currentPassword: "", newPassword: "", confirm: "" });

/** Ligne d'un critère de validation du nouveau mot de passe. */
function Critere({ ok, children }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${ok ? "text-vert" : "text-gris"}`}>
      <CheckIcon className={`h-3.5 w-3.5 shrink-0 ${ok ? "opacity-100" : "opacity-30"}`} />
      {children}
    </li>
  );
}

/** Mon compte — informations du profil et changement de mot de passe en libre-service. */
export function Profil() {
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState(vide());
  const [loading, setLoading] = useState(false);
  const [montrer, setMontrer] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const assezLong = form.newPassword.length >= 8;
  const different = form.newPassword.length > 0 && form.newPassword !== form.currentPassword;
  const correspond = form.confirm.length > 0 && form.newPassword === form.confirm;
  const valide = form.currentPassword.length >= 1 && assezLong && different && correspond;

  const enregistrer = async () => {
    if (!valide) return;
    setLoading(true);
    try {
      await changerMotDePasse(form.currentPassword, form.newPassword);
      toast.success("Mot de passe modifié.");
      setForm(vide());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Compte" titre="Mon profil" sousTitre="Informations de votre compte et sécurité." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="bpn-card">
          <div className="bpn-card-header"><span className="bpn-card-heading">Identité</span></div>
          <div className="p-4">
            <dl className="divide-y divide-grisL text-sm">
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-gris">Nom</dt><dd className="font-medium text-encre">{user?.nom}</dd></div>
              <div className="flex justify-between gap-4 py-2.5"><dt className="text-gris">Email</dt><dd className="font-medium text-encre">{user?.email}</dd></div>
              <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-gris">Rôle</dt><dd><Badge ton={ROLE_TON[user?.role] ?? "gris"} dot={false}>{ROLE_LABEL[user?.role] ?? user?.role}</Badge></dd></div>
            </dl>
          </div>
        </div>

        <div className="bpn-card">
          <div className="bpn-card-header">
            <span className="bpn-card-heading">Changer mon mot de passe</span>
            <button type="button" onClick={() => setMontrer((v) => !v)} className="flex items-center gap-1 text-xs text-gris transition hover:text-encre">
              {montrer ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              {montrer ? "Masquer" : "Afficher"}
            </button>
          </div>
          <form className="space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); enregistrer(); }}>
            <FormField label="Mot de passe actuel">
              <input type={montrer ? "text" : "password"} value={form.currentPassword} onChange={set("currentPassword")} className="bpn-input" autoComplete="current-password" />
            </FormField>
            <FormField label="Nouveau mot de passe">
              <input type={montrer ? "text" : "password"} value={form.newPassword} onChange={set("newPassword")} className="bpn-input" autoComplete="new-password" />
            </FormField>
            <FormField label="Confirmer le nouveau mot de passe">
              <input type={montrer ? "text" : "password"} value={form.confirm} onChange={set("confirm")} className="bpn-input" autoComplete="new-password" />
            </FormField>
            {form.newPassword.length > 0 && (
              <ul className="space-y-1 pt-0.5">
                <Critere ok={assezLong}>Au moins 8 caractères</Critere>
                <Critere ok={different}>Différent du mot de passe actuel</Critere>
                <Critere ok={correspond}>Les deux saisies correspondent</Critere>
              </ul>
            )}
            <div className="flex justify-end pt-1">
              <button type="submit" className="bpn-btn bpn-btn-primary" disabled={!valide || loading}>
                {loading ? "Enregistrement…" : <><KeyIcon className="h-4 w-4" /> Mettre à jour</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Profil;
