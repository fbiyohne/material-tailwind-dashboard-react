import { useEffect, useState } from "react";
import { identite } from "../data/config";
import { useParams, Link } from "react-router-dom";
import { ArrowLeftIcon, ShieldExclamationIcon, CheckIcon, ArrowDownTrayIcon, PaperClipIcon, PlusIcon, XMarkIcon, DocumentTextIcon, ScaleIcon, PencilSquareIcon, NoSymbolIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { Badge, ActeStatutModal, DocumentModal, EditeurDocument, Notice, MentionJuridique, useToast, useConfirm, FormField, PageHeader, Tabs, ErrorState, TableSkeleton } from "../components";
import { useAuth } from "../auth/AuthContext";
import { STATUT_DOSSIER_META } from "../data/institutionnel";
import { formatDate, formatDateCourte, dateLocaleISO } from "../utils/format";
import { assainirHtml } from "../utils/sanitizeHtml";
import { getDossier, majDossier, archiverDoc, telechargerDecisionDisciplinePdf, getParametres, enregistrerDecisionDossier, listerEvenements, reformerDecisionDossier } from "../api/resources";

const STATUTS = ["ouvert", "instruction", "audience", "decision", "classe"];
const DECISION_VIDE = { sanctionCode: "", dureeMois: "", sursis: false, peineAccessoireMois: "", motivation: "", decidePar: "", dateDecision: new Date().toISOString().slice(0, 10), dateNotification: "" };

/**
 * Formulaire « Enregistrer la décision » (C-07). Le logiciel enregistre la décision
 * du conseil de discipline ; il ne la prononce pas. Catalogue lu en Paramètres.
 */
function DecisionForm({ dossier, regles, onDone }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState(DECISION_VIDE);
  const [envoi, setEnvoi] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const peine = regles.sanctions.find((s) => s.code === f.sanctionCode);
  const avecDuree = peine?.effet === "SUSPENSION";
  const sursisOffert = regles.sursisAutorise && peine?.sursisPossible;
  const pret = peine && f.motivation.trim().length >= 10 && (!avecDuree || Number(f.dureeMois) > 0) && !envoi;

  const valider = async () => {
    const ok = await confirm({
      title: "Enregistrer la décision",
      message: `Enregistrer « ${peine.libelle} » sur le dossier ${dossier.reference} ? L'effet sur la situation de l'avocat est appliqué immédiatement et la décision ne pourra plus être modifiée ici.`,
      confirmLabel: "Enregistrer",
    });
    if (!ok) return;
    setEnvoi(true);
    try {
      await enregistrerDecisionDossier(dossier.id, {
        sanctionCode: f.sanctionCode,
        dureeMois: avecDuree ? Number(f.dureeMois) : undefined,
        sursis: !!(f.sursis && sursisOffert),
        peineAccessoireMois: f.peineAccessoireMois ? Number(f.peineAccessoireMois) : undefined,
        motivation: f.motivation.trim(),
        decidePar: f.decidePar.trim() || undefined,
        dateDecision: f.dateDecision || undefined,
        dateNotification: f.dateNotification || undefined,
      });
      toast.success("Décision enregistrée.");
      onDone();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="space-y-3">
      <MentionJuridique type="sanction" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Peine (art. 36)" required>
          <select value={f.sanctionCode} onChange={(e) => setF({ ...f, sanctionCode: e.target.value, dureeMois: "", sursis: false })} className="bpn-input">
            <option value="">— Choisir —</option>
            {regles.sanctions.map((s) => <option key={s.code} value={s.code}>{s.libelle}</option>)}
          </select>
        </FormField>
        {avecDuree && (
          <FormField label="Durée (mois)" required hint={peine.dureeMaxMois ? `${peine.dureeMaxMois} mois au plus` : undefined}>
            <input type="number" min="1" max={peine.dureeMaxMois ?? undefined} value={f.dureeMois} onChange={set("dureeMois")} className="bpn-input" />
          </FormField>
        )}
        {sursisOffert && (
          <div className="space-y-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-encre">
              <input type="checkbox" checked={f.sursis} onChange={set("sursis")} /> Avec sursis (l'avocat reste au tableau)
            </label>
            <MentionJuridique type="sursis" />
          </div>
        )}
        <FormField label="Peine accessoire d'inéligibilité (mois)" hint={`${regles.peineAccessoireMaxMois} mois au plus`}>
          <input type="number" min="1" max={regles.peineAccessoireMaxMois} value={f.peineAccessoireMois} onChange={set("peineAccessoireMois")} className="bpn-input" />
        </FormField>
        <FormField label="Organe décideur" hint="par défaut : conseil de discipline">
          <input value={f.decidePar} onChange={set("decidePar")} className="bpn-input" placeholder="Conseil de discipline (art. 36, loi n° 026-92)" />
        </FormField>
        <FormField label="Date de la décision">
          <input type="date" value={f.dateDecision} onChange={set("dateDecision")} className="bpn-input" />
        </FormField>
        <FormField label="Date de notification">
          <input type="date" value={f.dateNotification} onChange={set("dateNotification")} className="bpn-input" />
        </FormField>
        <FormField label="Motivation" required hint="10 caractères au moins" full>
          <textarea rows={3} value={f.motivation} onChange={set("motivation")} className="bpn-input" />
        </FormField>
      </div>
      <div className="flex justify-end">
        <button type="button" className="bpn-btn bpn-btn-danger" onClick={valider} disabled={!pret}>Enregistrer la décision</button>
      </div>
    </div>
  );
}

/**
 * Formulaire « Enregistrer une réformation » (T21, R-35/R-36) : la décision de radiation
 * réformée sur opposition ou appel est tracée par un événement REFORMATION côté serveur,
 * qui rétablit la situation antérieure si l'avocat est radié par ce dossier. Rien n'est effacé.
 */
function ReformationForm({ dossier, onDone, onCancel }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState({ voie: "", reference: "", dateEffet: dateLocaleISO(), motif: "" });
  const [envoi, setEnvoi] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pret = f.voie && f.reference.trim() && f.dateEffet && !envoi;

  const valider = async () => {
    const ok = await confirm({
      title: "Enregistrer la réformation",
      message: `La décision de radiation du dossier ${dossier.reference} sera inscrite comme réformée sur ${f.voie === "APPEL" ? "appel" : "opposition"}. Si l'avocat est radié par ce dossier, sa situation antérieure est rétablie. Aucun événement n'est effacé et l'action est tracée.`,
      confirmLabel: "Enregistrer",
    });
    if (!ok) return;
    setEnvoi(true);
    try {
      await reformerDecisionDossier(dossier.id, { voie: f.voie, reference: f.reference.trim(), dateEffet: f.dateEffet, motif: f.motif.trim() || undefined });
      toast.success("Réformation enregistrée.");
      onDone();
    } catch (e) {
      toast.error(e.message);
      setEnvoi(false);
    }
  };

  return (
    <div className="space-y-3 rounded border border-grisM p-4">
      <p className="text-sm font-medium text-navy">Réformation de la décision</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Voie de recours" required htmlFor="reformation-voie">
          <select id="reformation-voie" value={f.voie} onChange={set("voie")} className="bpn-input">
            <option value="">— Choisir —</option>
            <option value="OPPOSITION">Opposition</option>
            <option value="APPEL">Appel</option>
          </select>
        </FormField>
        <FormField label="Date d'effet" required htmlFor="reformation-date">
          <input id="reformation-date" type="date" value={f.dateEffet} max={dateLocaleISO()} onChange={set("dateEffet")} className="bpn-input" />
        </FormField>
        <FormField label="Référence de la décision de réformation" required htmlFor="reformation-reference" full>
          <input id="reformation-reference" value={f.reference} maxLength={120} onChange={set("reference")} className="bpn-input" placeholder="Ex. : Cour d'appel, arrêt n° 45 du 08/10/2026" />
        </FormField>
        <FormField label="Motif" hint="facultatif" htmlFor="reformation-motif" full>
          <textarea id="reformation-motif" rows={2} maxLength={500} value={f.motif} onChange={set("motif")} className="bpn-input" />
        </FormField>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="bpn-btn bpn-btn-ghost min-h-[44px] justify-center sm:min-h-0" onClick={onCancel} disabled={envoi}>Annuler</button>
        <button type="button" className="bpn-btn bpn-btn-primary min-h-[44px] justify-center sm:min-h-0" onClick={valider} disabled={!pret}>Enregistrer la réformation</button>
      </div>
    </div>
  );
}

export function DossierDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  // Enregistrer la décision : action discipline_decider (bâtonnier par défaut), pas le SG.
  const peutDecider = !!user?.permissions?.includes("discipline_decider");
  const [regles, setRegles] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [form, setForm] = useState(null);
  const [enregistre, setEnregistre] = useState(false);
  const [convocation, setConvocation] = useState(false);
  const [nouvellePiece, setNouvellePiece] = useState("");
  const [editerDecision, setEditerDecision] = useState(false);
  // Parcours de l'avocat : dit si la radiation de ce dossier est exécutée ou réformée (T21).
  const [evenements, setEvenements] = useState(null);
  const [executer, setExecuter] = useState(false);
  const [reformer, setReformer] = useState(false);

  // getDossier journalise la consultation côté serveur (RG-13).
  const charger = () => getDossier(Number(id)).then((d) => { setDossier(d); setForm(d); }).catch(() => setDossier(false));
  useEffect(() => { charger(); }, [id]);
  useEffect(() => {
    if (peutDecider && dossier?.membreId && dossier.sanctionCode)
      listerEvenements(dossier.membreId).then(setEvenements).catch(() => setEvenements([]));
  }, [dossier, peutDecider]);
  useEffect(() => { if (peutDecider) getParametres().then((p) => setRegles(p.regles)).catch(() => {}); }, [peutDecider]);

  if (dossier === false) {
    return (
      <div className="space-y-4">
        <Link to="/discipline" className="inline-flex items-center gap-1.5 text-sm text-gris hover:text-navy">
          <ArrowLeftIcon className="h-4 w-4" /> Retour aux dossiers
        </Link>
        <div className="bpn-card p-6">
          <ErrorState title="Dossier introuvable" description="Ce dossier n'existe pas ou n'est plus accessible." onRetry={charger} />
        </div>
      </div>
    );
  }
  if (!dossier || !form) return <div className="bpn-card p-6"><TableSkeleton rows={5} cols={2} /></div>;

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setEnregistre(false); };
  const meta = STATUT_DOSSIER_META[form.statut];
  const pieces = form.pieces ?? [];
  // Radiation : exécutoire à la demande en mode EXPIRATION_RECOURS, réformable tant qu'elle ne l'a pas été.
  const estRadiation = regles?.sanctions?.find((s) => s.code === dossier.sanctionCode)?.effet === "RADIATION";
  const duDossier = (type) => evenements?.find((e) => e.type === type && e.dossierId === dossier.id);
  const execution = duDossier("RADIATION");
  const reformation = duDossier("REFORMATION");
  const suiviRadiation = peutDecider && estRadiation && !!evenements;
  const peutExecuter = suiviRadiation && regles.effetRadiation === "EXPIRATION_RECOURS" && !execution && !reformation;
  const peutReformer = suiviRadiation && !reformation;
  const apresActe = () => { setReformer(false); charger(); };

  const ajouterPiece = () => {
    const v = nouvellePiece.trim();
    if (!v) return;
    setForm({ ...form, pieces: [...pieces, v] });
    setNouvellePiece("");
    setEnregistre(false);
  };
  const retirerPiece = (i) => { setForm({ ...form, pieces: pieces.filter((_, j) => j !== i) }); setEnregistre(false); };

  const enregistrer = async () => {
    try {
      await majDossier(dossier.id, {
        statut: form.statut, dateConvocation: form.dateConvocation, dateAudience: form.dateAudience,
        decision: form.decision, sanction: form.sanction, pieces: form.pieces ?? [],
        plaignant: form.plaignant ?? "", rapporteur: form.rapporteur ?? "",
        recours: form.recours ?? "", dateRecours: form.dateRecours || undefined,
        origine: form.origine ?? "", conclusionRapport: form.conclusionRapport ?? "",
        orientation: form.orientation || undefined, juridiction: form.juridiction ?? "",
        dateDesignationRapporteur: form.dateDesignationRapporteur || undefined,
        dateRapport: form.dateRapport || undefined, dateNotification: form.dateNotification || undefined,
      });
      setEnregistre(true);
      toast.success("Dossier mis à jour.");
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  };

  const telechargerDecision = async () => {
    // On ne génère le PDF que si l'enregistrement a réussi : sinon le document
    // refléterait un état non persisté (décision/sanction perdues au rechargement).
    if (!(await enregistrer())) return;
    try {
      await telechargerDecisionDisciplinePdf(dossier.id);
      toast.success("Décision générée, archivée et téléchargée (PDF).");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <PageHeader
        breadcrumb={[{ label: "Conseil de discipline", to: "/discipline" }, { label: dossier.reference }]}
        titre={`Dossier N° ${dossier.reference}`}
        sousTitre={
          <span className="flex flex-wrap items-center gap-2">
            <Badge ton={meta.ton}>{meta.label}</Badge>
            <span>Mis en cause : <span className="font-medium text-encre">{dossier.avocatNom === "Confidentiel" ? "Confidentiel" : `Me ${dossier.avocatNom}`}</span> · saisine du {formatDate(dossier.dateSaisine)}</span>
          </span>
        }
      >
        <button className="bpn-btn bpn-btn-danger" onClick={() => setConvocation(true)}>
          Convocation disciplinaire
        </button>
      </PageHeader>

      <Notice ton="rouge" icon={ShieldExclamationIcon} className="text-sm">Dossier confidentiel — consultation journalisée (RG-13).</Notice>

      <Tabs
        tabs={[
          {
            id: "saisine",
            label: "Saisine",
            icon: DocumentTextIcon,
            content: (
              <div className="bpn-card">
                <div className="bpn-card-header"><span className="bpn-card-heading">Objet de la saisine</span></div>
                <p className="p-4 text-sm text-encre">{dossier.objet}</p>
              </div>
            ),
          },
          {
            id: "pieces",
            label: "Pièces",
            icon: PaperClipIcon,
            badge: pieces.length || null,
            content: (
              <div className="bpn-card">
                <div className="bpn-card-header"><span className="bpn-card-heading">Pièces du dossier</span><span className="font-mono text-xs text-gris">{pieces.length}</span></div>
                <div className="p-4">
                  {pieces.length > 0 ? (
                    <ul className="mb-3 space-y-1.5">
                      {pieces.map((p, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 rounded border border-grisL bg-grisL/40 px-3 py-2 text-sm">
                          <span className="flex items-center gap-2 text-encre"><PaperClipIcon className="h-4 w-4 shrink-0 text-gris" /> {p}</span>
                          <button type="button" onClick={() => retirerPiece(i)} title="Retirer" className="text-gris transition hover:text-rouge"><XMarkIcon className="h-4 w-4" /></button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mb-3 text-sm text-gris">Aucune pièce enregistrée. Référencez ici les pièces versées au dossier (plaintes, PV d'audition, correspondances…).</p>
                  )}
                  <div className="flex gap-2">
                    <input value={nouvellePiece} onChange={(e) => setNouvellePiece(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), ajouterPiece())}
                      className="bpn-input flex-1" placeholder="Référence ou intitulé de la pièce…" />
                    <button type="button" className="bpn-btn bpn-btn-ghost shrink-0" onClick={ajouterPiece}><PlusIcon className="h-4 w-4" /> Ajouter</button>
                  </div>
                  <p className="mt-2 text-xs text-gris">Pensez à « Enregistrer le dossier » pour conserver les pièces.</p>
                </div>
              </div>
            ),
          },
          {
            id: "instruction",
            label: "Instruction & décision",
            icon: ScaleIcon,
            content: (
              <div className="bpn-card">
                <div className="bpn-card-header"><span className="bpn-card-heading">Instruction & décision</span></div>
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                  <FormField label="Statut de la procédure">
                    <select value={form.statut} onChange={set("statut")} className="bpn-input">
                      {STATUTS.filter((s) => s !== "decision" || peutDecider || form.statut === "decision").map((s) => <option key={s} value={s}>{STATUT_DOSSIER_META[s].label}</option>)}
                    </select>
                  </FormField>
                  <div />
                  <FormField label="Plaignant">
                    <input value={form.plaignant ?? ""} onChange={set("plaignant")} className="bpn-input" placeholder="Auteur de la saisine" />
                  </FormField>
                  <FormField label="Rapporteur">
                    <input value={form.rapporteur ?? ""} onChange={set("rapporteur")} className="bpn-input" placeholder="Membre chargé de l'instruction" />
                  </FormField>
                  <FormField label="Origine de la saisine">
                    <input value={form.origine ?? ""} onChange={set("origine")} className="bpn-input" placeholder="Plainte, saisine d'office, parquet…" />
                  </FormField>
                  <FormField label="Date de désignation du rapporteur">
                    <input type="date" value={form.dateDesignationRapporteur ?? ""} onChange={set("dateDesignationRapporteur")} className="bpn-input" />
                  </FormField>
                  <FormField label="Date du rapport">
                    <input type="date" value={form.dateRapport ?? ""} onChange={set("dateRapport")} className="bpn-input" />
                  </FormField>
                  <FormField label="Orientation">
                    <select value={form.orientation ?? ""} onChange={set("orientation")} className="bpn-input">
                      <option value="">— Non arrêtée —</option>
                      <option value="CLASSEMENT">Classement</option>
                      <option value="POURSUITE">Poursuite</option>
                    </select>
                  </FormField>
                  <FormField label="Conclusion du rapport" full>
                    <textarea rows={2} value={form.conclusionRapport ?? ""} onChange={set("conclusionRapport")} className="bpn-input" />
                  </FormField>
                  <FormField label="Juridiction saisie" hint="le cas échéant">
                    <input value={form.juridiction ?? ""} onChange={set("juridiction")} className="bpn-input" />
                  </FormField>
                  <FormField label="Date de notification">
                    <input type="date" value={form.dateNotification ?? ""} onChange={set("dateNotification")} className="bpn-input" />
                  </FormField>
                  <FormField label="Date de convocation">
                    <input type="date" value={form.dateConvocation ?? ""} onChange={set("dateConvocation")} className="bpn-input" />
                  </FormField>
                  <FormField label="Date d'audience">
                    <input type="date" value={form.dateAudience ?? ""} onChange={set("dateAudience")} className="bpn-input" />
                  </FormField>
                  <FormField label="Décision rendue" full>
                    <div className="rounded border border-grisM">
                      <div className="flex items-center justify-between border-b border-grisM bg-grisL/50 px-3 py-1.5">
                        <span className="text-xs text-gris">Motifs et dispositif</span>
                        {peutDecider && (
                          <button type="button" className="bpn-btn bpn-btn-ghost bpn-btn-sm" onClick={() => setEditerDecision(true)}>
                            <PencilSquareIcon className="h-3.5 w-3.5" /> Rédiger
                          </button>
                        )}
                      </div>
                      {form.decision && assainirHtml(form.decision)
                        ? <div className="bpn-doc px-3 py-2" dangerouslySetInnerHTML={{ __html: assainirHtml(form.decision) }} />
                        : <p className="px-3 py-4 text-center text-sm text-gris">Aucune décision rédigée. Cliquez sur « Rédiger ».</p>}
                    </div>
                  </FormField>
                  <div className="space-y-3 sm:col-span-2">
                    <p className="text-sm font-medium text-navy">Décision du conseil de discipline</p>
                    {dossier.sanctionCode ? (
                      <>
                        <Notice ton="vert" icon={CheckIcon} className="text-sm">
                          <p className="font-medium text-encre">Décision enregistrée : {dossier.sanction}</p>
                          <ul className="mt-1 space-y-0.5 text-gris">
                            <li>Organe : {dossier.decidePar}</li>
                            <li>Date de la décision : {formatDate(dossier.dateDecision)}{dossier.dateNotification ? ` · notifiée le ${formatDate(dossier.dateNotification)}` : ""}</li>
                            <li>Référence : <span className="font-mono">{dossier.reference}</span></li>
                            <li>Pièce : décision en PDF (bouton « Décision (PDF) »)</li>
                            {dossier.peineAccessoireMois ? <li>Peine accessoire d'inéligibilité : {dossier.peineAccessoireMois} mois</li> : null}
                          </ul>
                          {dossier.motivation && <p className="mt-1 text-encre">Motivation : {dossier.motivation}</p>}
                        </Notice>
                        {dossier.sursis && <MentionJuridique type="sursis" />}
                        {suiviRadiation && (
                          <div className="space-y-3">
                            {reformation ? (
                              <Notice ton="gris" icon={ArrowUturnLeftIcon} className="text-sm">
                                Décision réformée le {formatDateCourte(reformation.dateEffet)}{reformation.reference ? ` — réf. ${reformation.reference}` : ""}. Elle ne peut plus être exécutée.
                              </Notice>
                            ) : execution ? (
                              <Notice ton="gris" icon={NoSymbolIcon} className="text-sm">Radiation exécutée le {formatDateCourte(execution.dateEffet)}.</Notice>
                            ) : peutExecuter ? (
                              <Notice ton="or" icon={ScaleIcon} className="text-sm">
                                Radiation décidée, non encore exécutoire : elle prend effet à l'expiration du délai de recours (R-40, provisoire).
                              </Notice>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-2">
                              {peutExecuter && (
                                <button type="button" className="bpn-btn bpn-btn-ghost min-h-[44px] text-rouge hover:!bg-rougeL hover:!text-rouge sm:min-h-0" onClick={() => setExecuter(true)}>
                                  <NoSymbolIcon className="h-4 w-4" aria-hidden="true" /> Rendre la radiation exécutoire
                                </button>
                              )}
                              {peutReformer && !reformer && (
                                <button type="button" className="bpn-btn bpn-btn-ghost min-h-[44px] sm:min-h-0" onClick={() => setReformer(true)}>
                                  <ArrowUturnLeftIcon className="h-4 w-4" aria-hidden="true" /> Enregistrer une réformation
                                </button>
                              )}
                              {(execution || reformation) && (
                                <Link to={`/avocats/${dossier.membreId}`} className="text-sm text-navy underline-offset-2 hover:underline">Voir le parcours de l'avocat</Link>
                              )}
                            </div>
                            {reformer && <ReformationForm dossier={dossier} onDone={apresActe} onCancel={() => setReformer(false)} />}
                          </div>
                        )}
                      </>
                    ) : peutDecider ? (
                      regles ? <DecisionForm dossier={dossier} regles={regles} onDone={charger} />
                        : <p className="text-sm text-gris">Chargement du catalogue des peines…</p>
                    ) : (
                      <Notice ton="gris" className="text-sm">L'enregistrement de la décision est réservé au bâtonnier. Vous pouvez instruire le dossier (rapport, orientation, convocation).</Notice>
                    )}
                  </div>
                  <FormField label="Recours (appel)" hint="le cas échéant" full>
                    <textarea rows={2} value={form.recours ?? ""} onChange={set("recours")} className="bpn-input" placeholder="Recours formé devant la Cour d'appel : objet, référence…" />
                  </FormField>
                  <FormField label="Date du recours">
                    <input type="date" value={form.dateRecours ?? ""} onChange={set("dateRecours")} className="bpn-input" />
                  </FormField>
                </div>
                <div className="flex items-center justify-end gap-3 border-t border-grisM px-4 py-3">
                  {enregistre && <span className="flex items-center gap-1 text-sm text-vert"><CheckIcon className="h-4 w-4" /> Enregistré</span>}
                  <button className="bpn-btn bpn-btn-ghost" onClick={telechargerDecision} disabled={!form.decision} title={form.decision ? "" : "Renseigner la décision d'abord"}>
                    <ArrowDownTrayIcon className="h-4 w-4" /> Décision (PDF)
                  </button>
                  <button className="bpn-btn bpn-btn-primary" onClick={enregistrer}>Enregistrer le dossier</button>
                </div>
              </div>
            ),
          },
        ]}
      />

      <DocumentModal
        open={convocation}
        onClose={() => setConvocation(false)}
        title="Convocation disciplinaire"
        org="Conseil de discipline"
        reference={`Dossier N° ${dossier.reference}`}
        pdfPath={`/discipline/${dossier.id}/convocation/pdf`} pdfFilename={`Convocation-disciplinaire-${dossier.reference}.pdf`}
        signataire={{ role: "Le Bâtonnier, Président du Conseil de discipline", nom: identite().batonnier }}
        onArchive={() => archiverDoc({ categorie: "Convocation disciplinaire", titre: `Convocation — dossier ${dossier.reference}`, reference: dossier.reference, date: new Date().toISOString().slice(0, 10) })}
      >
        <p>
          Dans le cadre du dossier disciplinaire <strong>N° {dossier.reference}</strong>,{" "}
          <strong>{dossier.avocatNom === "Confidentiel" ? "l'avocat concerné" : `Me ${dossier.avocatNom}`}</strong>{" "}
          est invité(e) à comparaître devant le Conseil de discipline de l'Ordre des Avocats du
          {identite().denomination}{form.dateAudience ? <>, le <strong>{formatDate(form.dateAudience)}</strong></> : null}.
        </p>
        <p className="mt-3">Objet : {dossier.objet}.</p>
        <p className="mt-3 text-xs text-gris">L'intéressé(e) pourra se faire assister du conseil de son choix.</p>
      </DocumentModal>

      {executer && (
        <ActeStatutModal
          mode="execution"
          open
          membre={{ id: dossier.membreId, nom: dossier.avocatNom }}
          dossier={{ id: dossier.id, reference: duDossier("SANCTION")?.reference ?? dossier.reference, sanction: dossier.sanction, decidePar: dossier.decidePar, dateDecision: dossier.dateDecision }}
          onClose={() => setExecuter(false)}
          onDone={apresActe}
        />
      )}

      <EditeurDocument
        open={editerDecision}
        title={`Décision — dossier ${dossier.reference}`}
        value={form.decision ?? ""}
        note="Rédigez les motifs et le dispositif. L'en-tête institutionnel, la sanction et la signature du Bâtonnier avec cachet sont ajoutés automatiquement au PDF."
        onSave={async (html) => {
          await majDossier(dossier.id, { decision: html });
          setForm({ ...form, decision: html });
          toast.success("Décision enregistrée.");
        }}
        onClose={() => setEditerDecision(false)}
      />
    </div>
  );
}

export default DossierDetail;
