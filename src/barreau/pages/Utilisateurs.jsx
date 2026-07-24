import { useEffect, useState } from "react";
import { UserPlusIcon, KeyIcon, CheckIcon, XMarkIcon, TrashIcon, InboxArrowDownIcon, IdentificationIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { Badge, Modal, PageHeader, FormField, useToast, useConfirm, DataTable, AccesActivationModal } from "../components";
import { formatDate } from "../utils/format";
import { useAuth } from "../auth/AuthContext";
import {
  listerUsers, creerUser, majUser, resetPasswordUser, supprimerUser,
  listerDemandesAcces, approuverDemandeAcces, approuverDemandeEspace, refuserDemandeAcces,
} from "../api/resources";

const ROLE_LABEL = {
  SECRETAIRE_GENERAL: "Secrétaire Général",
  BATONNIER: "Bâtonnier",
  TRESORIERE: "Trésorière",
  ADMIN: "Administrateur",
  AVOCAT: "Avocat",
};
// Rôles attribuables manuellement : le rôle AVOCAT n'en fait pas partie — un
// compte avocat se provisionne depuis la fiche du membre (accès espace).
const ROLES = ["SECRETAIRE_GENERAL", "BATONNIER", "TRESORIERE", "ADMIN"];

// `type` : "personnel" (compte back-office, rôle + mot de passe) ou "avocat"
// (accès espace, lien d'activation). Le toggle n'apparaît que pour une demande.
const videCreation = (prefill = {}) => ({ nom: "", email: "", role: "SECRETAIRE_GENERAL", password: "", demandeId: null, type: "personnel", ...prefill });

/** Gestion des comptes utilisateurs et des rôles (CDC §5.1). Réservé SG/Admin. */
export function Utilisateurs() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user: courant } = useAuth();
  const [users, setUsers] = useState([]);
  const [demandes, setDemandes] = useState([]);
  const [creation, setCreation] = useState(null); // form objet ou null
  const [acces, setAcces] = useState(null); // { email, lien, renvoi } après provisionnement espace
  const [motDePasse, setMotDePasse] = useState(null); // { id, nom, password }
  const [loading, setLoading] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  const charger = () =>
    listerUsers()
      .then((d) => { setUsers(d); setErreur(false); })
      .catch((e) => { setErreur(true); toast.error(e.message); })
      .finally(() => setChargement(false));
  const chargerDemandes = () => listerDemandesAcces("EN_ATTENTE").then(setDemandes).catch((e) => toast.error(e.message));
  useEffect(() => { charger(); chargerDemandes(); /* eslint-disable-line */ }, []);

  // Une demande émane d'un avocat (champs n° d'inscription / cabinet) : on
  // propose l'accès espace par défaut, le SG pouvant basculer vers un compte staff.
  const provisionner = (d) => setCreation(videCreation({ nom: d.nom, email: d.email, demandeId: d.id, type: "avocat" }));
  const refuser = async (d) => {
    try { await refuserDemandeAcces(d.id); await chargerDemandes(); toast.success(`Demande de ${d.nom} refusée.`); }
    catch (e) { toast.error(e.message); }
  };

  const changerRole = async (u, role) => {
    try { setUsers(await majUser(u.id, { role }).then(() => listerUsers())); toast.success(`Rôle mis à jour — ${u.nom}.`); }
    catch (e) { toast.error(e.message); }
  };
  const basculerActif = async (u) => {
    const desactiver = u.actif;
    const ok = await confirm({
      title: desactiver ? "Désactiver le compte" : "Réactiver le compte",
      message: desactiver
        ? `${u.nom} ne pourra plus se connecter à l'application jusqu'à réactivation.`
        : `${u.nom} pourra de nouveau se connecter à l'application.`,
      confirmLabel: desactiver ? "Désactiver" : "Réactiver",
      danger: desactiver,
    });
    if (!ok) return;
    try { await majUser(u.id, { actif: !u.actif }); await charger(); toast.success(desactiver ? "Compte désactivé." : "Compte réactivé."); }
    catch (e) { toast.error(e.message); }
  };
  // Suppression définitive d'un compte — réservée au super-administrateur (ADMIN).
  const estAdmin = courant?.role === "ADMIN";
  // Anti-escalade (miroir serveur) : seul un ADMIN peut agir sur un compte ADMIN
  // (changement de rôle, mot de passe, désactivation). On verrouille donc ces
  // actions dans l'UI pour un SG plutôt que de le laisser buter sur un 403.
  const geleAdmin = (u) => !estAdmin && u.role === "ADMIN";
  const supprimer = async (u) => {
    const ok = await confirm({
      title: "Supprimer le compte",
      message: `Le compte de ${u.nom} sera définitivement supprimé. Cette action est irréversible.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try { await supprimerUser(u.id); await charger(); toast.success(`Compte supprimé — ${u.nom}.`); }
    catch (e) { toast.error(e.message); }
  };

  const enregistrerCreation = async () => {
    setLoading(true);
    try {
      if (creation.type === "avocat" && creation.demandeId) {
        // Accès espace avocat : provisionne la fiche + le lien d'activation, puis approuve.
        const r = await approuverDemandeEspace(creation.demandeId);
        setCreation(null);
        setAcces(r);
        await chargerDemandes();
      } else {
        const { demandeId, type, ...payload } = creation; // eslint-disable-line no-unused-vars
        await creerUser(payload);
        // Si le compte provient d'une demande d'accès, on la marque approuvée.
        if (demandeId) { await approuverDemandeAcces(demandeId); await chargerDemandes(); }
        toast.success(`Compte créé — ${creation.nom}.`);
        setCreation(null);
        await charger();
      }
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
      <PageHeader eyebrow="Système" titre="Utilisateurs" sousTitre="Comptes d'accès à l'application et attribution des rôles (RBAC).">
        <button className="bpn-btn bpn-btn-or shrink-0" onClick={() => setCreation(videCreation())}>
          <UserPlusIcon className="h-4 w-4" /> Nouveau compte
        </button>
      </PageHeader>

      {demandes.length > 0 && (
        <div className="bpn-card">
          <div className="bpn-card-header">
            <span className="bpn-card-heading flex items-center gap-2">
              <InboxArrowDownIcon className="h-4 w-4 text-or" /> Demandes d'accès
            </span>
            <Badge ton="or">{demandes.length} en attente</Badge>
          </div>
          <ul className="divide-y divide-grisL">
            {demandes.map((d) => (
              <li key={d.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium text-encre">{d.nom}</span>
                    <span className="text-sm text-gris">{d.email}</span>
                    <span className="text-xs text-gris">· {formatDate(d.createdAt)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gris">
                    {d.numInscription && <span className="inline-flex items-center gap-1"><IdentificationIcon className="h-3.5 w-3.5" /> {d.numInscription}</span>}
                    {d.cabinet && <span className="inline-flex items-center gap-1"><BuildingOffice2Icon className="h-3.5 w-3.5" /> {d.cabinet}</span>}
                  </div>
                  {d.motif && <p className="mt-1.5 max-w-prose text-sm text-encre/80">{d.motif}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button className="bpn-btn bpn-btn-or !py-1.5 text-xs" onClick={() => provisionner(d)}>
                    <CheckIcon className="h-3.5 w-3.5" /> Provisionner
                  </button>
                  <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs" onClick={() => refuser(d)}>
                    <XMarkIcon className="h-3.5 w-3.5" /> Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bpn-card">
        <DataTable
          columns={[
            {
              key: "nom",
              label: "Nom",
              sortable: true,
              sortValue: (u) => u.nom,
              cell: (u) => (
                <span className="font-medium text-encre">
                  {u.nom}{u.id === courant?.id && <span className="ml-1 text-xs text-gris">(vous)</span>}
                </span>
              ),
            },
            {
              key: "email",
              label: "Email",
              sortable: true,
              sortValue: (u) => u.email,
              cell: (u) => <span className="text-gris">{u.email}</span>,
            },
            {
              key: "role",
              label: "Rôle",
              cell: (u) =>
                // Un compte avocat (espace) n'est pas un rôle du back-office : non modifiable ici.
                u.role === "AVOCAT" ? (
                  <Badge ton="bleu" dot={false}>Avocat</Badge>
                ) : (
                  <select
                    value={u.role}
                    onChange={(e) => changerRole(u, e.target.value)}
                    disabled={u.id === courant?.id || geleAdmin(u)}
                    className="bpn-input !w-auto !py-1 text-xs disabled:opacity-60"
                    title={u.id === courant?.id ? "Vous ne pouvez pas changer votre propre rôle" : geleAdmin(u) ? "Seul un administrateur peut agir sur un compte administrateur" : ""}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                ),
            },
            {
              key: "statut",
              label: "Statut",
              sortable: true,
              sortValue: (u) => (u.actif ? 0 : 1),
              cell: (u) => <Badge ton={u.actif ? "vert" : "gris"}>{u.actif ? "Actif" : "Désactivé"}</Badge>,
            },
            {
              key: "actions",
              label: "Actions",
              align: "right",
              cell: (u) => (
                <div className="flex justify-end gap-2">
                  {!geleAdmin(u) && (
                    <button className="bpn-btn bpn-btn-ghost !px-2 !py-1 text-xs" onClick={() => setMotDePasse({ id: u.id, nom: u.nom, password: "" })}>
                      <KeyIcon className="h-3.5 w-3.5" /> Mot de passe
                    </button>
                  )}
                  <button
                    className="bpn-btn bpn-btn-ghost !px-2 !py-1 text-xs disabled:opacity-50"
                    onClick={() => basculerActif(u)}
                    disabled={u.id === courant?.id || geleAdmin(u)}
                    title={u.id === courant?.id ? "Vous ne pouvez pas désactiver votre propre compte" : geleAdmin(u) ? "Seul un administrateur peut agir sur un compte administrateur" : ""}
                  >
                    {u.actif ? "Désactiver" : "Réactiver"}
                  </button>
                  {estAdmin && (
                    <button
                      className="bpn-btn bpn-btn-ghost !px-2 !py-1 text-xs text-rouge disabled:opacity-50"
                      onClick={() => supprimer(u)}
                      disabled={u.id === courant?.id}
                      title={u.id === courant?.id ? "Vous ne pouvez pas supprimer votre propre compte" : "Supprimer définitivement"}
                    >
                      <TrashIcon className="h-3.5 w-3.5" /> Supprimer
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          rows={users}
          loading={chargement}
          error={erreur}
          onRetry={charger}
          emptyTitle="Aucun compte"
          emptyDescription="Aucun compte utilisateur n'a encore été créé."
          libelle="comptes"
          initialSort={{ key: "nom", dir: "asc" }}
        />
      </div>

      {/* Création de compte */}
      <Modal
        open={!!creation}
        onClose={() => setCreation(null)}
        title={creation?.demandeId ? `Provisionner l'accès — ${creation.nom || "demande"}` : "Nouveau compte"}
        footer={
          <button className="bpn-btn bpn-btn-or" onClick={enregistrerCreation}
            disabled={loading || !creation?.nom?.trim() || !creation?.email?.trim() || (creation?.type !== "avocat" && (creation?.password?.length ?? 0) < 8)}>
            <CheckIcon className="h-4 w-4" /> {creation?.type === "avocat" ? "Créer l'accès espace" : "Créer le compte"}
          </button>
        }
      >
        {creation && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {creation.demandeId && (
              <div className="flex gap-1.5 rounded-lg bg-grisL p-1 sm:col-span-2">
                {[["avocat", "Accès espace avocat"], ["personnel", "Compte du personnel"]].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setCreation({ ...creation, type: v })}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${creation.type === v ? "bg-white text-navy shadow-sm" : "text-gris hover:text-encre"}`}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            <FormField label="Nom" required full>
              <input value={creation.nom} onChange={setC("nom")} className="bpn-input" placeholder="Me KOUMBA Jean" />
            </FormField>
            <FormField label="Email" required full={creation.type === "avocat"}>
              <input type="email" value={creation.email} onChange={setC("email")} className="bpn-input" />
            </FormField>
            {creation.type === "avocat" ? (
              <p className="rounded border-l-[3px] border-or bg-or-L px-3 py-2 text-xs text-gris sm:col-span-2">
                Un accès à l'espace avocat sera créé (la fiche membre est établie si elle n'existe pas). L'avocat recevra un
                lien d'activation pour définir lui-même son mot de passe — aucun rôle du back-office ne lui est attribué.
              </p>
            ) : (
              <>
                <FormField label="Rôle">
                  <select value={creation.role} onChange={setC("role")} className="bpn-input">
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </FormField>
                <FormField label="Mot de passe" hint="min. 8 caractères" required full>
                  <input type="password" value={creation.password} onChange={setC("password")} className="bpn-input" />
                </FormField>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Lien d'activation de l'espace avocat (après provisionnement depuis une demande) */}
      <AccesActivationModal acces={acces} onClose={() => setAcces(null)} />

      {/* Réinitialisation mot de passe */}
      <Modal
        open={!!motDePasse}
        onClose={() => setMotDePasse(null)}
        title={motDePasse ? `Mot de passe — ${motDePasse.nom}` : ""}
        footer={
          <button className="bpn-btn bpn-btn-primary" onClick={enregistrerMotDePasse}
            disabled={loading || (motDePasse?.password?.length ?? 0) < 8}>
            <CheckIcon className="h-4 w-4" /> Réinitialiser
          </button>
        }
      >
        {motDePasse && (
          <FormField label="Nouveau mot de passe" hint="min. 8 caractères" required>
            <input type="password" value={motDePasse.password} onChange={(e) => setMotDePasse({ ...motDePasse, password: e.target.value })} className="bpn-input" />
          </FormField>
        )}
      </Modal>
    </div>
  );
}

export default Utilisateurs;
