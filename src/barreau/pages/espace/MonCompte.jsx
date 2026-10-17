import { useEffect, useState } from "react";
import { KeyIcon, IdentificationIcon, CheckIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, FormField, Notice, useToast, TableSkeleton, ErrorState } from "../../components";
import { QUALITE_LABEL } from "../../data/derivations";
import { formatDate } from "../../utils/format";
import { getEspaceMoi, majEspaceCoordonnees, changerMotDePasse } from "../../api/resources";

const videMdp = () => ({ currentPassword: "", newPassword: "", confirm: "" });

function Critere({ ok, children }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${ok ? "text-vert" : "text-gris"}`}>
      <CheckIcon className={`h-3.5 w-3.5 shrink-0 ${ok ? "opacity-100" : "opacity-30"}`} /> {children}
    </li>
  );
}

/** Espace avocat — Mon compte : identité, coordonnées de contact (modifiables) et mot de passe. */
export function MonCompte() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [coord, setCoord] = useState({ tel: "", email: "", adresse: "" });
  const [envoiCoord, setEnvoiCoord] = useState(false);
  const [mdp, setMdp] = useState(videMdp());
  const [envoiMdp, setEnvoiMdp] = useState(false);

  const charger = () => {
    setErreur(false);
    getEspaceMoi()
      .then((d) => { setData(d); setCoord({ tel: d.membre.tel ?? "", email: d.membre.email ?? "", adresse: d.membre.adresse ?? "" }); })
      .catch((e) => { setErreur(true); toast.error(e.message); });
  };
  useEffect(() => { charger(); /* eslint-disable-line */ }, []);

  const setC = (k) => (e) => setCoord({ ...coord, [k]: e.target.value });
  const setM = (k) => (e) => setMdp({ ...mdp, [k]: e.target.value });

  const enregistrerCoord = async () => {
    if (envoiCoord) return;
    setEnvoiCoord(true);
    try {
      await majEspaceCoordonnees({ tel: coord.tel, email: coord.email, adresse: coord.adresse });
      toast.success("Coordonnées mises à jour.");
    } catch (e) { toast.error(e.message); } finally { setEnvoiCoord(false); }
  };

  const assezLong = mdp.newPassword.length >= 8;
  const different = mdp.newPassword.length > 0 && mdp.newPassword !== mdp.currentPassword;
  const correspond = mdp.confirm.length > 0 && mdp.newPassword === mdp.confirm;
  const mdpValide = mdp.currentPassword.length >= 1 && assezLong && different && correspond;

  const enregistrerMdp = async () => {
    if (!mdpValide || envoiMdp) return;
    setEnvoiMdp(true);
    try {
      await changerMotDePasse(mdp.currentPassword, mdp.newPassword);
      toast.success("Mot de passe modifié.");
      setMdp(videMdp());
    } catch (e) { toast.error(e.message); } finally { setEnvoiMdp(false); }
  };

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Votre compte n'a pas pu être chargé." onRetry={charger} /></div>;
  if (!data) return <div className="bpn-card p-6"><TableSkeleton rows={5} cols={2} /></div>;

  const m = data.membre;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mon espace" titre="Mon compte" sousTitre="Vos informations, vos coordonnées de contact et votre mot de passe." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Identité (lecture seule) */}
        <div className="bpn-card">
          <div className="bpn-card-header"><span className="bpn-card-heading">Identité</span></div>
          <div className="p-4">
            <dl className="divide-y divide-grisL text-sm">
              <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-gris">Avocat</dt><dd className="font-medium text-encre">Me {m.nom}</dd></div>
              <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-gris">Qualité</dt><dd><Badge ton="bleu" dot={false}>{QUALITE_LABEL[m.qualite] ?? m.qualite}</Badge></dd></div>
              <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-gris">N° d'inscription</dt><dd className="font-mono text-xs text-encre">{m.numInscription ?? `N° ${m.num}`}</dd></div>
              <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-gris">Inscrit depuis</dt><dd className="text-encre">{formatDate(m.dateInscription)}</dd></div>
              <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-gris">Cabinet</dt><dd className="text-encre">{m.cabinet || "—"}</dd></div>
            </dl>
            <Notice ton="or" icon={IdentificationIcon} className="mt-3">
              Nom, qualité et cabinet sont tenus par le Secrétariat. Pour toute correction, contactez-le via la messagerie.
            </Notice>
          </div>
        </div>

        {/* Coordonnées de contact (modifiables) */}
        <div className="bpn-card">
          <div className="bpn-card-header"><span className="bpn-card-heading">Mes coordonnées</span></div>
          <div className="space-y-3 p-4">
            <FormField label="Téléphone"><input value={coord.tel} onChange={setC("tel")} className="bpn-input" placeholder="+242 …" /></FormField>
            <FormField label="Email de contact"><input type="email" value={coord.email} onChange={setC("email")} className="bpn-input" /></FormField>
            <FormField label="Adresse professionnelle"><input value={coord.adresse} onChange={setC("adresse")} className="bpn-input" /></FormField>
            <div className="flex justify-end">
              <button className="bpn-btn bpn-btn-primary" onClick={enregistrerCoord} disabled={envoiCoord}>
                <CheckIcon className="h-4 w-4" /> {envoiCoord ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mot de passe */}
      <div className="bpn-card max-w-2xl">
        <div className="bpn-card-header"><span className="bpn-card-heading flex items-center gap-2"><KeyIcon className="h-4 w-4 text-or-fonce" /> Mot de passe</span></div>
        <div className="space-y-3 p-4">
          <FormField label="Mot de passe actuel"><input type="password" value={mdp.currentPassword} onChange={setM("currentPassword")} className="bpn-input" autoComplete="current-password" /></FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Nouveau mot de passe"><input type="password" value={mdp.newPassword} onChange={setM("newPassword")} className="bpn-input" autoComplete="new-password" /></FormField>
            <FormField label="Confirmer"><input type="password" value={mdp.confirm} onChange={setM("confirm")} className="bpn-input" autoComplete="new-password" /></FormField>
          </div>
          <ul className="space-y-1">
            <Critere ok={assezLong}>Au moins 8 caractères</Critere>
            <Critere ok={different}>Différent du mot de passe actuel</Critere>
            <Critere ok={correspond}>Les deux saisies correspondent</Critere>
          </ul>
          <div className="flex justify-end">
            <button className="bpn-btn bpn-btn-primary" onClick={enregistrerMdp} disabled={!mdpValide || envoiMdp}>
              <KeyIcon className="h-4 w-4" /> {envoiMdp ? "Modification…" : "Changer le mot de passe"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MonCompte;
