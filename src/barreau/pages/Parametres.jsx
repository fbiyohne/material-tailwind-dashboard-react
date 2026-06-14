import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { Badge, useToast, PageHeader } from "../components";
import { EXERCICES } from "../data/dashboard-data";
import { formatFCFA } from "../utils/format";
import { getParametres, majParametres } from "../api/resources";

const DEFAUT = {
  tarifs: { avocat: 150000, stagiaire: 75000, droitsPlaidoirie: 60000 },
  exerciceCourant: 2026,
  identite: { denomination: "", ordre: "", batonnier: "", tresoriere: "", secretaireGeneral: "", adresse: "" },
};

const ROLES = [
  { role: "Secrétaire Général", mission: "Administrateur fonctionnel principal", acces: "Accès complet", ton: "vert" },
  { role: "Bâtonnier", mission: "Validation des publications et décisions", acces: "Consultation + validation", ton: "bleu" },
  { role: "Trésorière", mission: "Gestion financière et validation des quitus", acces: "Finances uniquement", ton: "or" },
  { role: "Administrateur système", mission: "Configuration et maintenance", acces: "Accès technique total", ton: "gris" },
];

function Section({ titre, description, children }) {
  return (
    <div className="bpn-card">
      <div className="bpn-card-header"><span className="bpn-card-heading">{titre}</span></div>
      <div className="p-5">
        {description && <p className="mb-4 text-sm text-gris">{description}</p>}
        {children}
      </div>
    </div>
  );
}

export function Parametres() {
  const toast = useToast();
  const [tarifs, setTarifs] = useState(DEFAUT.tarifs);
  const [exercice, setExercice] = useState(DEFAUT.exerciceCourant);
  const [identite, setIdentite] = useState(DEFAUT.identite);

  useEffect(() => {
    getParametres().then((p) => {
      setTarifs({ ...DEFAUT.tarifs, ...p.tarifs });
      setExercice(p.exerciceCourant ?? DEFAUT.exerciceCourant);
      setIdentite({ ...DEFAUT.identite, ...p.identite });
    }).catch((e) => toast.error(e.message));
  }, [toast]);

  const setT = (k) => (e) => setTarifs({ ...tarifs, [k]: Number(e.target.value) });
  const setI = (k) => (e) => setIdentite({ ...identite, [k]: e.target.value });

  const sauverTarifs = async () => {
    try { await majParametres({ tarifs, exerciceCourant: exercice }); toast.success("Tarifs et exercice courant enregistrés."); }
    catch (e) { toast.error(e.message); }
  };
  const sauverIdentite = async () => {
    try { await majParametres({ identite }); toast.success("Identité de l'institution enregistrée."); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Système" titre="Paramètres" sousTitre="Tarifs de référence, exercice courant, identité de l'institution et rôles." />

      <Section titre="Tarifs de référence & exercice" description="Montants annuels appliqués aux calculs de cotisations et de droits (BR-07 / BR-08).">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block"><span className="bpn-label">Cotisation avocat (FCFA)</span>
            <input type="number" step={25000} value={tarifs.avocat} onChange={setT("avocat")} className="bpn-input mt-1" /></label>
          <label className="block"><span className="bpn-label">Cotisation stagiaire (FCFA)</span>
            <input type="number" step={25000} value={tarifs.stagiaire} onChange={setT("stagiaire")} className="bpn-input mt-1" /></label>
          <label className="block"><span className="bpn-label">Droit de plaidoirie (FCFA)</span>
            <input type="number" step={10000} value={tarifs.droitsPlaidoirie} onChange={setT("droitsPlaidoirie")} className="bpn-input mt-1" /></label>
          <label className="block"><span className="bpn-label">Exercice courant</span>
            <select value={exercice} onChange={(e) => setExercice(Number(e.target.value))} className="bpn-input mt-1">
              {EXERCICES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select></label>
        </div>
        <div className="mt-3 text-xs text-gris">
          Aperçu : avocat {formatFCFA(tarifs.avocat)} · stagiaire {formatFCFA(tarifs.stagiaire)} · honoraires exonérés.
        </div>
        <div className="mt-4 flex justify-end">
          <button className="bpn-btn bpn-btn-primary" onClick={sauverTarifs}><CheckIcon className="h-4 w-4" /> Enregistrer</button>
        </div>
      </Section>

      <Section titre="Identité de l'institution" description="Utilisée dans les documents officiels et l'interface.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block"><span className="bpn-label">Dénomination</span>
            <input value={identite.denomination} onChange={setI("denomination")} className="bpn-input mt-1" /></label>
          <label className="block"><span className="bpn-label">Ordre</span>
            <input value={identite.ordre} onChange={setI("ordre")} className="bpn-input mt-1" /></label>
          <label className="block"><span className="bpn-label">Bâtonnier</span>
            <input value={identite.batonnier} onChange={setI("batonnier")} className="bpn-input mt-1" /></label>
          <label className="block"><span className="bpn-label">Trésorière</span>
            <input value={identite.tresoriere} onChange={setI("tresoriere")} className="bpn-input mt-1" /></label>
          <label className="block"><span className="bpn-label">Secrétaire Général</span>
            <input value={identite.secretaireGeneral} onChange={setI("secretaireGeneral")} className="bpn-input mt-1" /></label>
          <label className="block"><span className="bpn-label">Adresse</span>
            <input value={identite.adresse} onChange={setI("adresse")} className="bpn-input mt-1" /></label>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="bpn-btn bpn-btn-primary" onClick={sauverIdentite}><CheckIcon className="h-4 w-4" /> Enregistrer</button>
        </div>
      </Section>

      <Section titre="Rôles & permissions" description="Profils d'accès de l'application (parties prenantes du CDC).">
        <div className="overflow-x-auto">
          <table className="bpn-table">
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2.5 font-medium">Profil</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Mission</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Niveau d'accès</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.role} className="border-b border-grisL">
                  <td className="px-3 py-2.5 font-medium">{r.role}</td>
                  <td className="px-3 py-2.5 text-gris">{r.mission}</td>
                  <td className="px-3 py-2.5"><Badge ton={r.ton} dot={false}>{r.acces}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded border-l-[3px] border-or bg-or-L px-4 py-2.5 text-xs text-gris">
          <LockClosedIcon className="mt-0.5 h-4 w-4 shrink-0 text-or" />
          Authentification multi-utilisateurs (JWT + RBAC) active. La création des comptes et
          l'attribution des rôles se font dans la page{" "}
          <Link to="/utilisateurs" className="font-medium text-navy underline">Utilisateurs</Link>.
        </div>
      </Section>
    </div>
  );
}

export default Parametres;
