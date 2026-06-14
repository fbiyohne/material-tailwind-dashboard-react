import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckIcon,
  LockClosedIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  ShieldCheckIcon,
  BellIcon,
} from "@heroicons/react/24/outline";
import { Badge, useToast, PageHeader, FormField, Tabs } from "../components";
import { EXERCICES } from "../data/dashboard-data";
import { formatFCFA } from "../utils/format";
import { getParametres, majParametres, getNotifications } from "../api/resources";

const EVT_LABEL = {
  RELANCE: "Relance cotisation",
  DEMANDE_ACCUSE: "Demande d'accès — accusé",
  DEMANDE_DECISION: "Demande d'accès — décision",
  RECU: "Reçu émis",
  CONVOCATION: "Convocation",
};

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
  const [notif, setNotif] = useState(null);

  useEffect(() => {
    getParametres().then((p) => {
      setTarifs({ ...DEFAUT.tarifs, ...p.tarifs });
      setExercice(p.exerciceCourant ?? DEFAUT.exerciceCourant);
      setIdentite({ ...DEFAUT.identite, ...p.identite });
    }).catch((e) => toast.error(e.message));
    getNotifications().then(setNotif).catch(() => setNotif(null));
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

  const panneauTarifs = (
      <Section titre="Tarifs de référence & exercice" description="Montants annuels appliqués aux calculs de cotisations et de droits (BR-07 / BR-08).">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Cotisation avocat (FCFA)">
            <input type="number" step={25000} value={tarifs.avocat} onChange={setT("avocat")} className="bpn-input" />
          </FormField>
          <FormField label="Cotisation stagiaire (FCFA)">
            <input type="number" step={25000} value={tarifs.stagiaire} onChange={setT("stagiaire")} className="bpn-input" />
          </FormField>
          <FormField label="Droit de plaidoirie (FCFA)">
            <input type="number" step={10000} value={tarifs.droitsPlaidoirie} onChange={setT("droitsPlaidoirie")} className="bpn-input" />
          </FormField>
          <FormField label="Exercice courant">
            <select value={exercice} onChange={(e) => setExercice(Number(e.target.value))} className="bpn-input">
              {EXERCICES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </FormField>
        </div>
        <div className="mt-3 text-xs text-gris">
          Aperçu : avocat {formatFCFA(tarifs.avocat)} · stagiaire {formatFCFA(tarifs.stagiaire)} · honoraires exonérés.
        </div>
        <div className="mt-4 flex justify-end">
          <button className="bpn-btn bpn-btn-primary" onClick={sauverTarifs}><CheckIcon className="h-4 w-4" /> Enregistrer</button>
        </div>
      </Section>
  );

  const panneauIdentite = (
      <Section titre="Identité de l'institution" description="Utilisée dans les documents officiels et l'interface.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Dénomination">
            <input value={identite.denomination} onChange={setI("denomination")} className="bpn-input" />
          </FormField>
          <FormField label="Ordre">
            <input value={identite.ordre} onChange={setI("ordre")} className="bpn-input" />
          </FormField>
          <FormField label="Bâtonnier">
            <input value={identite.batonnier} onChange={setI("batonnier")} className="bpn-input" />
          </FormField>
          <FormField label="Trésorière">
            <input value={identite.tresoriere} onChange={setI("tresoriere")} className="bpn-input" />
          </FormField>
          <FormField label="Secrétaire Général">
            <input value={identite.secretaireGeneral} onChange={setI("secretaireGeneral")} className="bpn-input" />
          </FormField>
          <FormField label="Adresse">
            <input value={identite.adresse} onChange={setI("adresse")} className="bpn-input" />
          </FormField>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="bpn-btn bpn-btn-primary" onClick={sauverIdentite}><CheckIcon className="h-4 w-4" /> Enregistrer</button>
        </div>
      </Section>
  );

  const panneauRoles = (
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
  );

  const panneauNotifications = (
      <Section titre="Notifications" description="Canaux d'envoi (email / SMS) et journal des envois récents (RG-16).">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded border border-grisM bg-grisL/40 px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-encre"><EnvelopeIcon className="h-4 w-4 text-gris" /> Email (SMTP)</span>
            <Badge ton={notif?.emailSimulation === false ? "vert" : "or"} dot={false}>{notif?.emailSimulation === false ? "Configuré" : "Simulation"}</Badge>
          </div>
          <div className="flex items-center justify-between rounded border border-grisM bg-grisL/40 px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-encre"><DevicePhoneMobileIcon className="h-4 w-4 text-gris" /> SMS</span>
            <Badge ton={notif?.smsSimulation === false ? "vert" : "or"} dot={false}>{notif?.smsSimulation === false ? "Configuré" : "Simulation"}</Badge>
          </div>
        </div>
        {notif?.journal?.length ? (
          <div className="overflow-x-auto">
            <table className="bpn-table">
              <thead>
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-medium">Canal</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Destinataire</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Événement</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Statut</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {notif.journal.slice(0, 12).map((n) => (
                  <tr key={n.id} className="border-b border-grisL">
                    <td className="px-3 py-2"><Badge ton={n.canal === "EMAIL" ? "bleu" : "gris"} dot={false}>{n.canal}</Badge></td>
                    <td className="px-3 py-2 text-gris">{n.destinataire}</td>
                    <td className="px-3 py-2 text-gris">{EVT_LABEL[n.evenement] ?? n.evenement}</td>
                    <td className="px-3 py-2"><Badge ton={n.statut === "ENVOYE" ? (n.simulation ? "or" : "vert") : "rouge"} dot={false}>{n.statut === "ENVOYE" ? (n.simulation ? "Simulé" : "Envoyé") : "Échec"}</Badge></td>
                    <td className="px-3 py-2 font-mono text-[11px] text-gris">{new Date(n.createdAt).toLocaleString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gris">Aucune notification émise pour l'instant. Les envois apparaîtront ici (mode simulation tant que SMTP/SMS ne sont pas configurés).</p>
        )}
      </Section>
  );

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Système" titre="Paramètres" sousTitre="Tarifs de référence, exercice courant, identité de l'institution et rôles." />

      <Tabs
        tabs={[
          { id: "tarifs", label: "Tarifs & exercice", icon: BanknotesIcon, content: panneauTarifs },
          { id: "identite", label: "Identité", icon: BuildingLibraryIcon, content: panneauIdentite },
          { id: "roles", label: "Rôles & permissions", icon: ShieldCheckIcon, content: panneauRoles },
          {
            id: "notifications",
            label: "Notifications",
            icon: BellIcon,
            badge: notif?.journal?.length || null,
            content: panneauNotifications,
          },
        ]}
      />
    </div>
  );
}

export default Parametres;
