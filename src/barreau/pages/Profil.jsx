import { useState } from "react";
import { KeyIcon, CheckIcon, EyeIcon, EyeSlashIcon, ShieldCheckIcon, EnvelopeIcon, IdentificationIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { Badge, useToast, PageHeader, FormField } from "../components";
import { useAuth } from "../auth/AuthContext";
import { changerMotDePasse } from "../api/resources";

const ROLE_LABEL = {
  SECRETAIRE_GENERAL: "Secrétaire Général",
  BATONNIER: "Bâtonnier",
  TRESORIERE: "Trésorière",
  ADMIN: "Administrateur",
  AVOCAT: "Avocat",
};
const ROLE_TON = { SECRETAIRE_GENERAL: "vert", BATONNIER: "bleu", TRESORIERE: "or", ADMIN: "gris", AVOCAT: "bleu" };
const ROLE_DESC = {
  SECRETAIRE_GENERAL: "Administration fonctionnelle de l'Ordre : membres, finances, documents et vie institutionnelle.",
  BATONNIER: "Présidence de l'Ordre : validation des publications et présidence du Conseil de discipline.",
  TRESORIERE: "Gestion financière : cotisations, droits de plaidoirie, reçus, quitus et timbres.",
  ADMIN: "Configuration du système, gestion des comptes et maintenance.",
  AVOCAT: "Accès à l'espace personnel de l'avocat.",
};

const initiales = (nom = "") =>
  nom.replace(/^me\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join("").toUpperCase() || "?";

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

/** Mon compte — profil, rôle et accès, changement de mot de passe en libre-service. */
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
      <PageHeader eyebrow="Compte" titre="Mon profil" sousTitre="Informations de votre compte, rôle et sécurité." />

      {/* En-tête identité */}
      <div className="overflow-hidden rounded-xl border border-grisM bg-navy-3">
        <div className="h-1.5 bg-gradient-to-r from-or via-or-2 to-or" />
        <div className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:items-center sm:text-left">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-navy-2 font-display text-2xl font-bold text-or ring-2 ring-or/50">
            {initiales(user?.nom)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-semibold text-white">{user?.nom}</h2>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge ton={ROLE_TON[user?.role] ?? "gris"} dot={false}>{ROLE_LABEL[user?.role] ?? user?.role}</Badge>
              <span className="inline-flex items-center gap-1 text-sm text-white/60"><EnvelopeIcon className="h-4 w-4" /> {user?.email}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Rôle & accès */}
        <div className="bpn-card">
          <div className="bpn-card-header"><span className="bpn-card-heading flex items-center gap-2"><IdentificationIcon className="h-4 w-4 text-or" /> Rôle & accès</span></div>
          <div className="space-y-4 p-4">
            <p className="text-sm leading-relaxed text-encre/80">{ROLE_DESC[user?.role] ?? "—"}</p>
            <dl className="divide-y divide-grisL text-sm">
              <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-gris">Nom</dt><dd className="font-medium text-encre">{user?.nom}</dd></div>
              <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-gris">Email de connexion</dt><dd className="font-medium text-encre">{user?.email}</dd></div>
              <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-gris">Rôle</dt><dd><Badge ton={ROLE_TON[user?.role] ?? "gris"} dot={false}>{ROLE_LABEL[user?.role] ?? user?.role}</Badge></dd></div>
              <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-gris">Statut du compte</dt><dd><Badge ton="vert" dot={false}>Actif</Badge></dd></div>
            </dl>
          </div>
        </div>

        {/* Sécurité */}
        <div className="bpn-card">
          <div className="bpn-card-header">
            <span className="bpn-card-heading flex items-center gap-2"><LockClosedIcon className="h-4 w-4 text-or" /> Sécurité</span>
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
              <ul className="space-y-1 rounded-lg bg-grisL/60 p-3">
                <Critere ok={assezLong}>Au moins 8 caractères</Critere>
                <Critere ok={different}>Différent du mot de passe actuel</Critere>
                <Critere ok={correspond}>Les deux saisies correspondent</Critere>
              </ul>
            )}
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="inline-flex items-center gap-1.5 text-xs text-gris"><ShieldCheckIcon className="h-4 w-4 text-vert" /> Vos sessions actives seront déconnectées.</span>
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
