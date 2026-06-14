import { useEffect, useState } from "react";
import { UserPlusIcon, KeyIcon, CheckIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, useToast } from "../components";
import { useAuth } from "../auth/AuthContext";
import { listerUsers, creerUser, majUser, resetPasswordUser } from "../api/resources";

const ROLE_LABEL = {
  SECRETAIRE_GENERAL: "Secrétaire Général",
  BATONNIER: "Bâtonnier",
  TRESORIERE: "Trésorière",
  ADMIN: "Administrateur",
};
const ROLE_TON = { SECRETAIRE_GENERAL: "vert", BATONNIER: "bleu", TRESORIERE: "or", ADMIN: "gris" };
const ROLES = Object.keys(ROLE_LABEL);

const videCreation = () => ({ nom: "", email: "", role: "SECRETAIRE_GENERAL", password: "" });

/** Gestion des comptes utilisateurs et des rôles (CDC §5.1). Réservé SG/Admin. */
export function Utilisateurs() {
  const toast = useToast();
  const { user: courant } = useAuth();
  const [users, setUsers] = useState([]);
  const [creation, setCreation] = useState(null); // form objet ou null
  const [motDePasse, setMotDePasse] = useState(null); // { id, nom, password }
  const [loading, setLoading] = useState(false);

  const charger = () => listerUsers().then(setUsers).catch((e) => toast.error(e.message));
  useEffect(() => { charger(); /* eslint-disable-line */ }, []);

  const changerRole = async (u, role) => {
    try { setUsers(await majUser(u.id, { role }).then(() => listerUsers())); toast.success(`Rôle mis à jour — ${u.nom}.`); }
    catch (e) { toast.error(e.message); }
  };
  const basculerActif = async (u) => {
    try { await majUser(u.id, { actif: !u.actif }); await charger(); toast.success(u.actif ? "Compte désactivé." : "Compte réactivé."); }
    catch (e) { toast.error(e.message); }
  };

  const enregistrerCreation = async () => {
    setLoading(true);
    try {
      await creerUser(creation);
      toast.success(`Compte créé — ${creation.nom}.`);
      setCreation(null);
      await charger();
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const enregistrerMotDePasse = async () => {
    setLoading(true);
    try {
      await resetPasswordUser(motDePasse.id, motDePasse.password);
      toast.success(`Mot de passe réinitialisé — ${motDePasse.nom}.`);
      setMotDePasse(null);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const setC = (k) => (e) => setCreation({ ...creation, [k]: e.target.value });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="bpn-eyebrow">Système</div>
          <h2 className="bpn-title mt-2">Utilisateurs</h2>
          <p className="mt-1 text-sm text-gris">Comptes d'accès à l'application et attribution des rôles (RBAC).</p>
        </div>
        <button className="bpn-btn bpn-btn-or shrink-0" onClick={() => setCreation(videCreation())}>
          <UserPlusIcon className="h-4 w-4" /> Nouveau compte
        </button>
      </div>

      <div className="bpn-card overflow-x-auto">
        <table className="bpn-table">
          <thead>
            <tr>
              <th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const moi = u.id === courant?.id;
              return (
                <tr key={u.id}>
                  <td className="font-medium text-encre">{u.nom}{moi && <span className="ml-1 text-[10px] text-gris">(vous)</span>}</td>
                  <td className="text-gris">{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => changerRole(u, e.target.value)}
                      disabled={moi}
                      className="bpn-input !w-auto !py-1 text-xs disabled:opacity-60"
                      title={moi ? "Vous ne pouvez pas changer votre propre rôle" : ""}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td><Badge ton={u.actif ? "vert" : "gris"}>{u.actif ? "Actif" : "Désactivé"}</Badge></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button className="bpn-btn bpn-btn-ghost !px-2 !py-1 text-[11px]" onClick={() => setMotDePasse({ id: u.id, nom: u.nom, password: "" })}>
                        <KeyIcon className="h-3.5 w-3.5" /> Mot de passe
                      </button>
                      <button
                        className="bpn-btn bpn-btn-ghost !px-2 !py-1 text-[11px] disabled:opacity-50"
                        onClick={() => basculerActif(u)}
                        disabled={moi}
                        title={moi ? "Vous ne pouvez pas désactiver votre propre compte" : ""}
                      >
                        {u.actif ? "Désactiver" : "Réactiver"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Création de compte */}
      <Modal
        open={!!creation}
        onClose={() => setCreation(null)}
        title="Nouveau compte"
        footer={
          <button className="bpn-btn bpn-btn-or" onClick={enregistrerCreation}
            disabled={loading || !creation?.nom?.trim() || !creation?.email?.trim() || (creation?.password?.length ?? 0) < 6}>
            <CheckIcon className="h-4 w-4" /> Créer le compte
          </button>
        }
      >
        {creation && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="bpn-label">Nom</span>
              <input value={creation.nom} onChange={setC("nom")} className="bpn-input mt-1" placeholder="Me KOUMBA Jean" /></label>
            <label className="block"><span className="bpn-label">Email</span>
              <input type="email" value={creation.email} onChange={setC("email")} className="bpn-input mt-1" /></label>
            <label className="block"><span className="bpn-label">Rôle</span>
              <select value={creation.role} onChange={setC("role")} className="bpn-input mt-1">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select></label>
            <label className="block sm:col-span-2"><span className="bpn-label">Mot de passe (min. 6 caractères)</span>
              <input type="password" value={creation.password} onChange={setC("password")} className="bpn-input mt-1" /></label>
          </div>
        )}
      </Modal>

      {/* Réinitialisation mot de passe */}
      <Modal
        open={!!motDePasse}
        onClose={() => setMotDePasse(null)}
        title={motDePasse ? `Mot de passe — ${motDePasse.nom}` : ""}
        footer={
          <button className="bpn-btn bpn-btn-primary" onClick={enregistrerMotDePasse}
            disabled={loading || (motDePasse?.password?.length ?? 0) < 6}>
            <CheckIcon className="h-4 w-4" /> Réinitialiser
          </button>
        }
      >
        {motDePasse && (
          <label className="block"><span className="bpn-label">Nouveau mot de passe (min. 6 caractères)</span>
            <input type="password" value={motDePasse.password} onChange={(e) => setMotDePasse({ ...motDePasse, password: e.target.value })} className="bpn-input mt-1" /></label>
        )}
      </Modal>
    </div>
  );
}

export default Utilisateurs;
