import { useState } from "react";
import { KeyIcon, CheckIcon } from "@heroicons/react/24/outline";
import { Badge, useToast } from "../components";
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

/** Mon compte — informations du profil et changement de mot de passe en libre-service. */
export function Profil() {
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState(vide());
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const valide =
    form.currentPassword.length >= 1 && form.newPassword.length >= 6 && form.newPassword === form.confirm;

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
      <div>
        <div className="bpn-eyebrow">Compte</div>
        <h2 className="bpn-title mt-2">Mon profil</h2>
        <p className="mt-1 text-sm text-gris">Informations de votre compte et sécurité.</p>
      </div>

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
          <div className="bpn-card-header"><span className="bpn-card-heading">Changer mon mot de passe</span></div>
          <div className="space-y-3 p-4">
            <label className="block"><span className="bpn-label">Mot de passe actuel</span>
              <input type="password" value={form.currentPassword} onChange={set("currentPassword")} className="bpn-input mt-1" autoComplete="current-password" /></label>
            <label className="block"><span className="bpn-label">Nouveau mot de passe (min. 6 caractères)</span>
              <input type="password" value={form.newPassword} onChange={set("newPassword")} className="bpn-input mt-1" autoComplete="new-password" /></label>
            <label className="block"><span className="bpn-label">Confirmer le nouveau mot de passe</span>
              <input type="password" value={form.confirm} onChange={set("confirm")} className="bpn-input mt-1" autoComplete="new-password" /></label>
            {form.confirm.length > 0 && form.newPassword !== form.confirm && (
              <p className="text-xs text-rouge">Les mots de passe ne correspondent pas.</p>
            )}
            <div className="flex justify-end pt-1">
              <button className="bpn-btn bpn-btn-primary" onClick={enregistrer} disabled={!valide || loading}>
                {loading ? "Enregistrement…" : <><KeyIcon className="h-4 w-4" /> Mettre à jour</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profil;
