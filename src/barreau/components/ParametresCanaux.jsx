import { useCallback, useEffect, useState } from "react";
import { BanknotesIcon, EnvelopeIcon, DevicePhoneMobileIcon, SignalIcon } from "@heroicons/react/24/outline";
import { Notice } from "./Notice";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { ErrorState } from "./ErrorState";
import { DataTable } from "./DataTable";
import { useToast } from "./Toast";
import { getParametres, majParametres, testerCanal, getNotifications } from "../api/resources";
import { formatDateTime } from "../utils/format";

/** Champs secrets : le serveur les renvoie masqués (••••1234) ; une valeur masquée non modifiée n'est jamais renvoyée. */
const SECRETS = new Set(["abonnementCle", "cleSecrete", "cleApi", "cleWebhook", "pass"]);
const estMasque = (v) => typeof v === "string" && v.startsWith("••••");

/** Libellés des événements du journal des envois (repris de l'ancien onglet Notifications). */
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

/** Retire du patch les secrets inchangés ou vides (le serveur conserve alors l'existant). */
function sansSecretsInchanges(o) {
  if (Array.isArray(o) || o === null || typeof o !== "object") return o;
  const r = {};
  for (const [k, v] of Object.entries(o)) {
    if (SECRETS.has(k) && (v === "" || estMasque(v))) continue;
    r[k] = sansSecretsInchanges(v);
  }
  return r;
}

const fixer = (o, chemin, v) => {
  const [k, ...reste] = chemin;
  return { ...o, [k]: reste.length ? fixer(o?.[k] ?? {}, reste, v) : v };
};

/** Charge les sections demandées de GET /parametres et fournit brouillon, enregistrement et rechargement. */
function useSections(cles) {
  const toast = useToast();
  const [etat, setEtat] = useState("chargement");
  const [brouillon, setBrouillon] = useState({});
  const [modifie, setModifie] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    setEtat("chargement");
    getParametres()
      .then((p) => { setBrouillon(Object.fromEntries(cles.map((c) => [c, p[c] ?? {}]))); setModifie(false); setEtat("pret"); })
      .catch(() => setEtat("erreur"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(charger, [charger]);

  const regler = (chemin) => (v) => { setBrouillon((b) => fixer(b, chemin, v)); setModifie(true); };
  const enregistrer = async () => {
    setEnCours(true);
    try {
      await majParametres(sansSecretsInchanges(brouillon));
      toast.success("Paramètres enregistrés.");
      charger(); // les secrets reviennent masqués
    } catch (e) { toast.error(e.message || "Enregistrement impossible."); }
    finally { setEnCours(false); }
  };
  return { etat, brouillon, modifie, enCours, regler, enregistrer, recharger: charger };
}

function Carte({ titre, icon: Icon, children, action }) {
  return (
    <div className="bpn-card flex flex-col">
      <div className="bpn-card-header">
        <span className="bpn-card-heading flex items-center gap-2">{Icon && <Icon className="h-4 w-4 text-gris" aria-hidden="true" />}{titre}</span>
        {action}
      </div>
      <div className="flex flex-1 flex-col p-5">{children}</div>
    </div>
  );
}

function Champ({ id, label, valeur, onChange, type = "text", hint, readOnly }) {
  const secret = type === "password";
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="bpn-label">
        {label}{hint && <span className="ml-1 font-normal lowercase tracking-normal text-gris/70">· {hint}</span>}
      </label>
      <input
        id={id} type={type} value={valeur ?? ""} readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={secret ? "new-password" : "off"} spellCheck={false}
        className={`bpn-input mt-1 text-sm ${secret ? "font-mono" : ""}`}
      />
    </div>
  );
}

function Interrupteur({ id, label, valeur, onChange, disabled }) {
  return (
    <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm text-encre sm:min-h-0">
      <input id={id} type="checkbox" checked={!!valeur} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-navy" />
      {label}
    </label>
  );
}

/** Bouton « Tester la connexion » + résultat annoncé (aria-live). Teste la configuration ENREGISTRÉE. */
function TestConnexion({ canal, desactive }) {
  const [res, setRes] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const lancer = async () => {
    setEnCours(true); setRes(null);
    try { setRes(await testerCanal(canal)); }
    catch (e) { setRes({ ok: false, message: e.message || "Test impossible." }); }
    finally { setEnCours(false); }
  };
  return (
    <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row sm:items-center">
      <button type="button" onClick={lancer} disabled={desactive || enCours} aria-busy={enCours || undefined}
        className="bpn-btn bpn-btn-ghost min-h-[44px] shrink-0 text-sm sm:min-h-0">
        <SignalIcon className="h-4 w-4" aria-hidden="true" /> {enCours ? "Test en cours…" : "Tester la connexion"}
      </button>
      <div role="status" aria-live="polite" className="min-w-0 text-xs">
        {res && <span className={`break-words ${res.ok ? "text-vert" : "text-rouge"}`}>{res.message}</span>}
        {!res && desactive && <span className="text-gris">Enregistrez d'abord les modifications pour tester.</span>}
      </div>
    </div>
  );
}

function BarreEnregistrer({ s }) {
  return (
    <div className="flex justify-end">
      <button type="button" onClick={s.enregistrer} disabled={!s.modifie || s.enCours} aria-busy={s.enCours || undefined}
        className="bpn-btn bpn-btn-primary min-h-[44px] sm:min-h-0">
        {s.enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}

function Etats({ s, children }) {
  if (s.etat === "chargement") return <Skeleton className="h-48 w-full" />;
  if (s.etat === "erreur") return <ErrorState description="Les paramètres n'ont pas pu être chargés." onRetry={s.recharger} />;
  return children;
}

const GRILLE = "grid grid-cols-1 items-end gap-3 sm:grid-cols-2";

/** Bloc d'une passerelle : activation, champs, test de connexion. */
function BlocPasserelle({ cle, titre, p, set, modifie, children }) {
  return (
    <Carte titre={titre} icon={BanknotesIcon}
      action={<Badge ton={p[cle]?.actif ? "vert" : "gris"} dot={false}>{p[cle]?.actif ? "Activé" : "Désactivé"}</Badge>}>
      <div className="mb-3"><Interrupteur id={`${cle}-actif`} label="Activer ce canal (test)" valeur={p[cle]?.actif} onChange={set(cle, "actif")} /></div>
      <div className={GRILLE}>{children}</div>
      <TestConnexion canal={cle} desactive={modifie} />
    </Carte>
  );
}

/** Paiements : MTN MoMo, Airtel Money, agrégateur ; mode Test verrouillé (CL-PAIEMENTS). */
export function PanneauPaiements() {
  const s = useSections(["passerelles"]);
  const p = s.brouillon.passerelles ?? {};
  const set = (...c) => s.regler(["passerelles", ...c]);
  const bloc = { p, set, modifie: s.modifie };
  return (
    <Etats s={s}>
      <div className="space-y-5">
        <Notice ton="or" icon={BanknotesIcon}>
          Mode test. Aucun paiement réel. L'encaissement réel est réservé à un prestataire de services de paiement agréé dans la CEMAC, sous contrat avec l'Ordre ; les fonds sont versés directement sur le compte de l'Ordre.
        </Notice>
        <div className="max-w-xs">
          <label htmlFor="pg-mode" className="bpn-label">Mode</label>
          <select id="pg-mode" className="bpn-input mt-1 text-sm" value="TEST" disabled aria-describedby="pg-mode-aide" onChange={() => {}}>
            <option value="TEST">Test</option>
          </select>
          <p id="pg-mode-aide" className="mt-1 text-xs text-gris">Le mode production est verrouillé : il exige une décision écrite du Barreau.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <BlocPasserelle cle="mtn" titre="MTN Mobile Money" {...bloc}>
          <Champ id="mtn-user" label="Utilisateur API" valeur={p.mtn?.apiUser} onChange={set("mtn", "apiUser")} />
          <Champ id="mtn-abo" label="Clé d'abonnement" type="password" valeur={p.mtn?.abonnementCle} onChange={set("mtn", "abonnementCle")} />
          <Champ id="mtn-sec" label="Clé secrète" type="password" valeur={p.mtn?.cleSecrete} onChange={set("mtn", "cleSecrete")} />
          <Champ id="mtn-env" label="Environnement" valeur="sandbox" readOnly onChange={() => {}} hint="bac à sable" />
        </BlocPasserelle>
        <BlocPasserelle cle="airtel" titre="Airtel Money" {...bloc}>
          <Champ id="air-id" label="Identifiant client" valeur={p.airtel?.clientId} onChange={set("airtel", "clientId")} />
          <Champ id="air-sec" label="Clé secrète" type="password" valeur={p.airtel?.cleSecrete} onChange={set("airtel", "cleSecrete")} />
        </BlocPasserelle>
        <BlocPasserelle cle="agregateur" titre="Agrégateur (CinetPay)" {...bloc}>
          <Champ id="ag-site" label="Identifiant du site" valeur={p.agregateur?.siteId} onChange={set("agregateur", "siteId")} />
          <Champ id="ag-cle" label="Clé API" type="password" valeur={p.agregateur?.cleApi} onChange={set("agregateur", "cleApi")} />
          <Champ id="ag-hook" label="Clé de webhook" type="password" valeur={p.agregateur?.cleWebhook} onChange={set("agregateur", "cleWebhook")} />
        </BlocPasserelle>
        </div>
        <BarreEnregistrer s={s} />
      </div>
    </Etats>
  );
}

/** Destinataires d'un envoi groupé : premier destinataire et « et N autres », liste complète au survol. */
function Destinataires({ valeur = "" }) {
  const liste = valeur.split(",").map((x) => x.trim()).filter(Boolean);
  if (liste.length <= 1) return <span className="text-gris">{valeur}</span>;
  return <span className="text-gris" title={liste.join(", ")}>{liste[0]} <span className="whitespace-nowrap text-encre">et {liste.length - 1} autre{liste.length > 2 ? "s" : ""}</span></span>;
}

/** Notifications : SMTP, SMS, expéditeur, journal des envois. */
export function PanneauNotifications() {
  const s = useSections(["smtp", "notifications"]);
  const [envois, setEnvois] = useState(null); // { journal, emailSimulation, smsSimulation }
  useEffect(() => { getNotifications().then(setEnvois).catch(() => setEnvois(null)); }, []);
  const journal = envois?.journal ?? [];
  // État réel du transport (variables d'environnement) : « Simulation » tant qu'il n'est pas configuré.
  const etat = (simulation) => <Badge ton={simulation === false ? "vert" : "or"} dot={false}>{simulation === false ? "Configuré" : "Simulation"}</Badge>;
  const smtp = s.brouillon.smtp ?? {};
  const sms = s.brouillon.notifications?.sms ?? {};
  return (
    <Etats s={s}>
      <div className="space-y-5">
        <Notice ton="gris">Les notifications sont de service et au contenu neutre : jamais le texte d'un message, d'une pièce ni une information disciplinaire.</Notice>
        {/* Cartes deux par deux sur grand écran. */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Carte titre="E-mail (SMTP)" icon={EnvelopeIcon} action={etat(envois?.emailSimulation)}>
          <div className={GRILLE}>
            <Champ id="smtp-host" label="Serveur" valeur={smtp.host} onChange={s.regler(["smtp", "host"])} />
            <Champ id="smtp-port" label="Port" valeur={smtp.port} onChange={(v) => s.regler(["smtp", "port"])(v === "" ? "" : Number(v) || v)} />
            <Champ id="smtp-user" label="Utilisateur" valeur={smtp.user} onChange={s.regler(["smtp", "user"])} />
            <Champ id="smtp-pass" label="Mot de passe" type="password" valeur={smtp.pass} onChange={s.regler(["smtp", "pass"])} />
            <Champ id="smtp-from" label="Expéditeur" valeur={smtp.from} onChange={s.regler(["smtp", "from"])} hint="adresse d'envoi" />
          </div>
          <div className="mt-3"><Interrupteur id="smtp-secure" label="Connexion sécurisée (TLS)" valeur={smtp.secure} onChange={s.regler(["smtp", "secure"])} /></div>
          <TestConnexion canal="smtp" desactive={s.modifie} />
        </Carte>
        <Carte titre="SMS" icon={DevicePhoneMobileIcon} action={etat(envois?.smsSimulation)}>
          <div className="mb-3"><Interrupteur id="sms-actif" label="Activer l'envoi de SMS (simulation)" valeur={sms.actif} onChange={s.regler(["notifications", "sms", "actif"])} /></div>
          <div className={GRILLE}>
            <Champ id="sms-url" label="URL du fournisseur" valeur={sms.url} onChange={s.regler(["notifications", "sms", "url"])} hint="https://" />
            <Champ id="sms-exp" label="Expéditeur" valeur={sms.expediteur} onChange={s.regler(["notifications", "sms", "expediteur"])} hint="11 caractères max" />
            <Champ id="sms-cle" label="Clé API" type="password" valeur={sms.cleApi} onChange={s.regler(["notifications", "sms", "cleApi"])} />
          </div>
          <TestConnexion canal="sms" desactive={s.modifie} />
        </Carte>
        </div>
        <BarreEnregistrer s={s} />
        <Carte titre="Journal des envois">
          <DataTable
            columns={[
              { key: "canal", label: "Canal", sortable: true, sortValue: (n) => n.canal, cell: (n) => <Badge ton={n.canal === "EMAIL" ? "bleu" : "gris"} dot={false}>{n.canal}</Badge> },
              { key: "destinataire", label: "Destinataire", sortable: true, sortValue: (n) => n.destinataire, cell: (n) => <Destinataires valeur={n.destinataire} /> },
              { key: "evenement", label: "Événement", sortable: true, sortValue: (n) => EVT_LABEL[n.evenement] ?? n.evenement, cell: (n) => <span className="text-gris">{EVT_LABEL[n.evenement] ?? n.evenement}</span> },
              { key: "statut", label: "Statut", sortable: true, sortValue: (n) => (n.statut === "ENVOYE" ? (n.simulation ? 1 : 0) : 2), cell: (n) => <Badge ton={n.statut === "ENVOYE" ? (n.simulation ? "or" : "vert") : "rouge"} dot={false}>{n.statut === "ENVOYE" ? (n.simulation ? "Simulé" : "Envoyé") : "Échec"}</Badge> },
              { key: "date", label: "Date", sortable: true, sortValue: (n) => new Date(n.createdAt).getTime(), cell: (n) => <span className="font-mono text-xs text-gris">{formatDateTime(n.createdAt)}</span> },
            ]}
            rows={journal} density="compact" libelle="envois" initialSort={{ key: "date", dir: "desc" }}
            emptyTitle="Aucune notification" emptyDescription="Les envois apparaîtront ici (simulation tant que SMTP et SMS ne sont pas configurés)."
          />
        </Carte>
      </div>
    </Etats>
  );
}

/** Messagerie : interne (pièces jointes, taille) et externe (relais d'avis neutres). */
export function PanneauMessagerie() {
  const s = useSections(["messagerie"]);
  const m = s.brouillon.messagerie ?? {};
  const set = (k) => s.regler(["messagerie", k]);
  return (
    <Etats s={s}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Carte titre="Messagerie interne">
          <div className="space-y-3">
            <Interrupteur id="msg-interne" label="Activer la messagerie interne" valeur={m.interneActive} onChange={set("interneActive")} />
            <Interrupteur id="msg-pj" label="Autoriser les pièces jointes" valeur={m.piecesJointes} onChange={set("piecesJointes")} />
            <div className="max-w-xs">
              <label htmlFor="msg-max" className="bpn-label">Taille maximale d'une pièce <span className="ml-1 font-normal lowercase tracking-normal text-gris/70">· Mo, 5 au plus</span></label>
              <input id="msg-max" type="number" min={1} max={5} step={1} value={m.pieceMaxMo ?? 5} disabled={!m.piecesJointes}
                onChange={(e) => set("pieceMaxMo")(Math.min(5, Math.max(1, Math.round(Number(e.target.value)) || 1)))}
                className="bpn-input mt-1 text-sm" />
            </div>
          </div>
        </Carte>
        <Carte titre="Messagerie externe">
          <p className="mb-3 text-xs text-gris">Avis neutre envoyé hors de la plateforme : « Vous avez un nouveau message sur votre espace », avec un lien vers l'espace authentifié. Le contenu du message n'est jamais relayé (secret professionnel).</p>
          <div className="space-y-3">
            <Interrupteur id="msg-mail" label="Relayer l'avis par e-mail" valeur={m.relaisEmail} onChange={set("relaisEmail")} />
            <Interrupteur id="msg-sms" label="Relayer l'avis par SMS" valeur={m.relaisSms} onChange={set("relaisSms")} />
          </div>
        </Carte>
        </div>
        <BarreEnregistrer s={s} />
      </div>
    </Etats>
  );
}
