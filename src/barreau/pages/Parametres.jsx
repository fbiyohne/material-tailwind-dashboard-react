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
  AdjustmentsHorizontalIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Badge, useToast, PageHeader, FormField, Tabs, DataTable } from "../components";
import { formatFCFA, formatDateTime } from "../utils/format";
import { appliquerConfig } from "../data/config";
import { STATUT_META_CLES, STATUT_MEMBRE_META_CLES } from "../data/derivations";
import { STATUT_DOSSIER_META_CLES } from "../data/institutionnel";
import { STATUT_PUBLICATION_META_CLES } from "../data/publications";
import { getParametres, majParametres, getNotifications } from "../api/resources";

const EVT_LABEL = {
  RELANCE: "Relance cotisation",
  DEMANDE_ACCUSE: "Demande d'accès — accusé",
  DEMANDE_DECISION: "Demande d'accès — décision",
  RECU: "Reçu émis",
  CONVOCATION: "Convocation",
  ACCES_AVOCAT: "Accès espace avocat",
  MESSAGE: "Messagerie — message avocat",
  RESET_MDP: "Réinitialisation de mot de passe",
};

const DEFAUT = {
  tarifs: { avocat: 150000, stagiaire: 75000, droitsPlaidoirie: 60000 },
  exerciceCourant: 2026,
  premierExercice: 2020,
  identite: { denomination: "", ordre: "", batonnier: "", tresoriere: "", secretaireGeneral: "", adresse: "" },
  categoriesArchives: [],
  typesPublication: [],
  canauxActifs: ["MTN", "AIRTEL", "CARTE", "VIREMENT"],
  dureeStage: 24,
  fonctionsConseil: ["Bâtonnier", "Vice-Bâtonnier", "Secrétaire Général", "Trésorière", "Membre du Conseil"],
  libelles: { membre: {}, cotisation: {}, dossier: {}, publication: {} },
};

const ROLES = [
  { role: "Secrétaire Général", mission: "Administrateur fonctionnel principal", acces: "Accès complet", ton: "vert" },
  { role: "Bâtonnier", mission: "Validation des publications et décisions", acces: "Consultation + validation", ton: "bleu" },
  { role: "Trésorière", mission: "Gestion financière et validation des quitus", acces: "Finances uniquement", ton: "or" },
  { role: "Administrateur système", mission: "Configuration et maintenance", acces: "Accès technique total", ton: "gris" },
  { role: "Avocat", mission: "Espace personnel en libre-service", acces: "Ses propres données uniquement", ton: "bleu" },
];

const CANAUX_DISPO = [
  { value: "MTN", label: "MTN Mobile Money" },
  { value: "AIRTEL", label: "Airtel Money" },
  { value: "CARTE", label: "Carte (Visa / MasterCard)" },
  { value: "VIREMENT", label: "Virement (UBA / Ecobank)" },
];

const DOMAINES_STATUT = [
  { cle: "membre", titre: "Statuts de membre", defauts: STATUT_MEMBRE_META_CLES },
  { cle: "cotisation", titre: "Statuts de cotisation", defauts: STATUT_META_CLES },
  { cle: "dossier", titre: "Statuts de dossier disciplinaire", defauts: STATUT_DOSSIER_META_CLES },
  { cle: "publication", titre: "Statuts de publication", defauts: STATUT_PUBLICATION_META_CLES },
];

function Section({ titre, description, children, action }) {
  return (
    <div className="bpn-card">
      <div className="bpn-card-header">
        <span className="bpn-card-heading">{titre}</span>
        {action}
      </div>
      <div className="p-5">
        {description && <p className="mb-4 text-sm text-gris">{description}</p>}
        {children}
      </div>
    </div>
  );
}

/** Intitulé de sous-section homogène à l'intérieur des cartes de réglages. */
const SOUS_TITRE = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-gris";

/** Liste de chaînes éditable (ajout/suppression) — catégories, types… */
function ListeEditable({ valeurs, onChange, placeholder }) {
  const [saisie, setSaisie] = useState("");
  const ajouter = () => {
    const v = saisie.trim();
    if (v && !valeurs.includes(v)) onChange([...valeurs, v]);
    setSaisie("");
  };
  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouter(); } }}
          placeholder={placeholder}
          className="bpn-input text-sm"
        />
        <button type="button" onClick={ajouter} className="bpn-btn bpn-btn-ghost shrink-0 text-sm">
          <PlusIcon className="h-4 w-4" /> Ajouter
        </button>
      </div>
      <div className="flex min-h-[2.75rem] flex-wrap content-start gap-1.5 rounded-lg border border-dashed border-grisM bg-grisL/30 p-2">
        {valeurs.length === 0 ? (
          <span className="px-1 py-0.5 text-xs text-gris">Aucune entrée pour l'instant.</span>
        ) : (
          valeurs.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full border border-grisM bg-white px-2.5 py-1 text-xs text-encre">
              {v}
              <button type="button" aria-label={`Retirer ${v}`} onClick={() => onChange(valeurs.filter((x) => x !== v))} className="text-gris transition hover:text-rouge">
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export function Parametres() {
  const toast = useToast();
  const [tarifs, setTarifs] = useState(DEFAUT.tarifs);
  const [exercice, setExercice] = useState(DEFAUT.exerciceCourant);
  const [premierExercice, setPremierExercice] = useState(DEFAUT.premierExercice);
  const [identite, setIdentite] = useState(DEFAUT.identite);
  const [categories, setCategories] = useState(DEFAUT.categoriesArchives);
  const [typesPub, setTypesPub] = useState(DEFAUT.typesPublication);
  const [canaux, setCanaux] = useState(DEFAUT.canauxActifs);
  const [dureeStage, setDureeStage] = useState(DEFAUT.dureeStage);
  const [fonctions, setFonctions] = useState(DEFAUT.fonctionsConseil);
  const [libelles, setLibelles] = useState(DEFAUT.libelles);
  const [notif, setNotif] = useState(null);

  useEffect(() => {
    getParametres().then((p) => {
      setTarifs({ ...DEFAUT.tarifs, ...p.tarifs });
      setExercice(p.exerciceCourant ?? DEFAUT.exerciceCourant);
      setPremierExercice(p.exercices?.premier ?? DEFAUT.premierExercice);
      setIdentite({ ...DEFAUT.identite, ...p.identite });
      setCategories(p.documents?.categoriesArchives ?? []);
      setTypesPub(p.documents?.typesPublication ?? []);
      setCanaux(p.paiement?.canauxActifs ?? DEFAUT.canauxActifs);
      setDureeStage(p.stage?.dureeMois ?? DEFAUT.dureeStage);
      setFonctions(p.conseil?.fonctions ?? DEFAUT.fonctionsConseil);
      setLibelles({ membre: {}, cotisation: {}, dossier: {}, publication: {}, ...p.libellesStatuts });
    }).catch((e) => toast.error(e.message));
    getNotifications().then(setNotif).catch(() => setNotif(null));
  }, [toast]);

  // Saisie des montants : on accepte les espaces de milliers en affichage et on
  // ne conserve que les chiffres en valeur (parseNb), pour un champ lisible.
  const parseNb = (v) => Number(String(v).replace(/\D/g, "")) || 0;
  const fmtNb = (n) => String(n ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const setT = (k) => (e) => setTarifs({ ...tarifs, [k]: parseNb(e.target.value) });
  const setI = (k) => (e) => setIdentite({ ...identite, [k]: e.target.value });
  const setLib = (dom, cle) => (e) =>
    setLibelles((l) => ({ ...l, [dom]: { ...l[dom], [cle]: e.target.value } }));
  const basculerCanal = (v) =>
    setCanaux((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]));

  // Enregistre un patch et l'applique immédiatement à la configuration vivante
  // (les dérivations — exercices, libellés… — se recalculent sans rechargement).
  const enregistrer = async (patch, message) => {
    try {
      await majParametres(patch);
      appliquerConfig(patch);
      toast.success(message);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const sauverTarifs = () =>
    enregistrer(
      { tarifs, exerciceCourant: exercice, exercices: { premier: premierExercice } },
      "Tarifs et exercices enregistrés."
    );
  const sauverIdentite = () => enregistrer({ identite }, "Identité de l'institution enregistrée.");
  const sauverReference = () =>
    enregistrer(
      {
        documents: { categoriesArchives: categories, typesPublication: typesPub },
        paiement: { canauxActifs: canaux },
        stage: { dureeMois: Number(dureeStage) },
        conseil: { fonctions },
        libellesStatuts: libelles,
      },
      "Données de référence enregistrées."
    );

  const panneauTarifs = (
    <Section titre="Tarifs de référence & exercices" description="Montants annuels des calculs de cotisations et de droits (BR-07 / BR-08), et plage d'exercices affichée.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField label="Cotisation avocat (FCFA)">
          <input type="text" inputMode="numeric" value={fmtNb(tarifs.avocat)} onChange={setT("avocat")} className="bpn-input" />
        </FormField>
        <FormField label="Cotisation stagiaire (FCFA)">
          <input type="text" inputMode="numeric" value={fmtNb(tarifs.stagiaire)} onChange={setT("stagiaire")} className="bpn-input" />
        </FormField>
        <FormField label="Droit de plaidoirie (FCFA)">
          <input type="text" inputMode="numeric" value={fmtNb(tarifs.droitsPlaidoirie)} onChange={setT("droitsPlaidoirie")} className="bpn-input" />
        </FormField>
        <FormField label="Exercice courant">
          <input type="number" value={exercice} onChange={(e) => setExercice(Number(e.target.value))} className="bpn-input" />
        </FormField>
        <FormField label="Premier exercice" hint="borne basse des filtres">
          <input type="number" value={premierExercice} onChange={(e) => setPremierExercice(Number(e.target.value))} className="bpn-input" />
        </FormField>
      </div>
      <div className="mt-3 text-xs text-gris">
        Aperçu : avocat {formatFCFA(tarifs.avocat)} · stagiaire {formatFCFA(tarifs.stagiaire)} · honoraires exonérés · exercices {exercice}→{premierExercice}.
      </div>
      <div className="mt-4 flex justify-end">
        <button className="bpn-btn bpn-btn-primary" onClick={sauverTarifs}><CheckIcon className="h-4 w-4" /> Enregistrer</button>
      </div>
    </Section>
  );

  const panneauIdentite = (
    <Section titre="Identité de l'institution" description="Utilisée dans les documents officiels et l'interface.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Dénomination"><input value={identite.denomination} onChange={setI("denomination")} className="bpn-input" /></FormField>
        <FormField label="Ordre"><input value={identite.ordre} onChange={setI("ordre")} className="bpn-input" /></FormField>
        <FormField label="Bâtonnier"><input value={identite.batonnier} onChange={setI("batonnier")} className="bpn-input" /></FormField>
        <FormField label="Trésorière"><input value={identite.tresoriere} onChange={setI("tresoriere")} className="bpn-input" /></FormField>
        <FormField label="Secrétaire Général"><input value={identite.secretaireGeneral} onChange={setI("secretaireGeneral")} className="bpn-input" /></FormField>
        <FormField label="Adresse"><input value={identite.adresse} onChange={setI("adresse")} className="bpn-input" /></FormField>
      </div>
      <div className="mt-4 flex justify-end">
        <button className="bpn-btn bpn-btn-primary" onClick={sauverIdentite}><CheckIcon className="h-4 w-4" /> Enregistrer</button>
      </div>
    </Section>
  );

  const panneauReference = (
    <div className="space-y-5">
      <Tabs
        tabs={[
          { id: "documents", label: "Documents", content: (
      <Section titre="Catégories & types de documents" description="Listes de référence utilisées dans l'archivage et les publications.">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <div className={SOUS_TITRE}>Catégories d'archives</div>
            <ListeEditable valeurs={categories} onChange={setCategories} placeholder="Nouvelle catégorie…" />
          </div>
          <div>
            <div className={SOUS_TITRE}>Types de publication</div>
            <ListeEditable valeurs={typesPub} onChange={setTypesPub} placeholder="Nouveau type…" />
          </div>
        </div>
      </Section>
          ) },
          { id: "conseil", label: "Conseil de l'Ordre", content: (
      <Section titre="Fonctions du Conseil de l'Ordre" description="Intitulés proposés à l'ajout ou à la modification d'un membre du Conseil (Bâtonnier, Trésorière, Membre du Conseil…).">
        <ListeEditable valeurs={fonctions} onChange={setFonctions} placeholder="Nouvelle fonction…" />
      </Section>
          ) },
          { id: "paiement", label: "Paiement & stage", content: (
      <Section titre="Canaux de paiement & stage" description="Moyens de paiement proposés en ligne et durée de stage par défaut.">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <div className={SOUS_TITRE}>Canaux de paiement actifs</div>
            <div className="overflow-hidden rounded-lg border border-grisM">
              {CANAUX_DISPO.map((c, i) => {
                const actif = canaux.includes(c.value);
                return (
                  <label key={c.value} className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm transition hover:bg-grisL/40 ${i > 0 ? "border-t border-grisL" : ""}`}>
                    <span className={actif ? "font-medium text-encre" : "text-gris"}>{c.label}</span>
                    <input type="checkbox" checked={actif} onChange={() => basculerCanal(c.value)} className="h-4 w-4 accent-navy" />
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <div className={SOUS_TITRE}>Durée du stage par défaut</div>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={120} value={dureeStage} onChange={(e) => setDureeStage(Number(e.target.value))} className="bpn-input w-28 text-sm" />
              <span className="text-sm text-gris">mois</span>
            </div>
            <p className="mt-2 text-xs text-gris">Appliquée automatiquement aux avocats stagiaires lors de leur inscription.</p>
          </div>
        </div>
      </Section>
          ) },
          { id: "statuts", label: "Libellés des statuts", content: (
      <Section titre="Libellés des statuts" description="Renommez l'affichage des statuts sans changer la logique. Laissez vide pour conserver le libellé par défaut.">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
          {DOMAINES_STATUT.map((dom) => (
            <div key={dom.cle}>
              <div className={SOUS_TITRE}>{dom.titre}</div>
              <div className="space-y-2">
                {Object.entries(dom.defauts).map(([cle, meta]) => (
                  <div key={cle} className="grid grid-cols-[7.5rem_1fr] items-center gap-3">
                    <span className="flex"><Badge ton={meta.ton} dot={false}>{meta.label}</Badge></span>
                    <input
                      value={libelles[dom.cle]?.[cle] ?? ""}
                      onChange={setLib(dom.cle, cle)}
                      placeholder={`Par défaut : ${meta.label}`}
                      className="bpn-input text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
          ) },
        ]}
      />

      <div className="flex justify-end">
        <button className="bpn-btn bpn-btn-primary" onClick={sauverReference}><CheckIcon className="h-4 w-4" /> Enregistrer les données de référence</button>
      </div>
    </div>
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
      <DataTable
        columns={[
          { key: "canal", label: "Canal", sortable: true, sortValue: (n) => n.canal, cell: (n) => <Badge ton={n.canal === "EMAIL" ? "bleu" : "gris"} dot={false}>{n.canal}</Badge> },
          { key: "destinataire", label: "Destinataire", sortable: true, sortValue: (n) => n.destinataire, cell: (n) => <span className="text-gris">{n.destinataire}</span> },
          { key: "evenement", label: "Événement", sortable: true, sortValue: (n) => EVT_LABEL[n.evenement] ?? n.evenement, cell: (n) => <span className="text-gris">{EVT_LABEL[n.evenement] ?? n.evenement}</span> },
          { key: "statut", label: "Statut", sortable: true, sortValue: (n) => (n.statut === "ENVOYE" ? (n.simulation ? 1 : 0) : 2), cell: (n) => (
            <Badge ton={n.statut === "ENVOYE" ? (n.simulation ? "or" : "vert") : "rouge"} dot={false}>{n.statut === "ENVOYE" ? (n.simulation ? "Simulé" : "Envoyé") : "Échec"}</Badge>
          ) },
          { key: "date", label: "Date", sortable: true, sortValue: (n) => new Date(n.createdAt).getTime(), cell: (n) => <span className="font-mono text-[11px] text-gris">{formatDateTime(n.createdAt)}</span> },
        ]}
        rows={notif?.journal ?? []}
        density="compact"
        libelle="envois"
        emptyTitle="Aucune notification"
        emptyDescription="Aucune notification émise pour l'instant. Les envois apparaîtront ici (mode simulation tant que SMTP/SMS ne sont pas configurés)."
        initialSort={{ key: "date", dir: "desc" }}
      />
    </Section>
  );

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Système" titre="Paramètres" sousTitre="Tarifs, identité de l'institution, données de référence centralisées, rôles et notifications." />

      <Tabs
        tabs={[
          { id: "tarifs", label: "Tarifs & exercices", icon: BanknotesIcon, content: panneauTarifs },
          { id: "identite", label: "Institution", icon: BuildingLibraryIcon, content: panneauIdentite },
          { id: "reference", label: "Données de référence", icon: AdjustmentsHorizontalIcon, content: panneauReference },
          { id: "roles", label: "Rôles & sécurité", icon: ShieldCheckIcon, content: panneauRoles },
          { id: "notifications", label: "Notifications", icon: BellIcon, badge: notif?.journal?.length || null, content: panneauNotifications },
        ]}
      />
    </div>
  );
}

export default Parametres;
