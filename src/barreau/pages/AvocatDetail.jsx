import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, DocumentPlusIcon, PencilSquareIcon, NoSymbolIcon, HeartIcon, TrashIcon, IdentificationIcon, BanknotesIcon, FolderIcon, KeyIcon, AcademicCapIcon, ArrowDownTrayIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { ScaleIcon } from "@heroicons/react/24/outline";
import { Badge, StatutBadge, AttestationModal, EditMembreModal, ActeStatutModal, PiecesDossier, AccesActivationModal, StagePanel, CasierDiscipline, useConfirm, useToast, PageHeader, Tabs, TableSkeleton, ErrorState, DataTable } from "../components";
import { QUALITE_LABEL, STATUT_META, infoStage } from "../data/derivations";
import { EXERCICES, EXERCICE_COURANT } from "../data/dashboard-data";
import { formatFCFA, formatDate, formatDateCourte } from "../utils/format";
import { getMembre, supprimerMembre, getDroits, provisionnerAccesAvocat, telechargerQuitusPdf, telechargerRecuPdf } from "../api/resources";
import { useAuth } from "../auth/AuthContext";

const FINANCES = ["SECRETAIRE_GENERAL", "TRESORIERE", "ADMIN"];
const statutLigne = (du, paye) => (du === 0 ? "exonere" : paye <= 0 ? "retard" : paye >= du ? "ajour" : "partiel");

function Carte({ titre, children }) {
  return (
    <div className="bpn-card">
      <div className="bpn-card-header"><span className="bpn-card-heading">{titre}</span></div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function Ligne({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-grisL py-2 text-sm last:border-0">
      <span className="shrink-0 text-gris">{label}</span>
      <span className="text-right font-medium text-encre">{value ?? "—"}</span>
    </div>
  );
}

export function AvocatDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const { user } = useAuth();
  const peutVoirFinances = FINANCES.includes(user?.role);
  const estAdmin = user?.role === "ADMIN";
  const peutGererAcces = ["SECRETAIRE_GENERAL", "ADMIN"].includes(user?.role);
  // Modification, attestation et radiation sont réservées au SG côté serveur
  // (PATCH /membres/:id, /attestation, /radier) : on ne les propose pas au
  // Bâtonnier, qui peut consulter la fiche mais pas la muter.
  const peutGererFiche = peutGererAcces;
  const [membre, setMembre] = useState(null);
  const [droit, setDroit] = useState(null); // ligne de droits réelle (rôles finances)
  const [attestation, setAttestation] = useState(null);
  const [edition, setEdition] = useState(false);
  const [acces, setAcces] = useState(null); // { email, lien, renvoi } après provisionnement
  const [acte, setActe] = useState(null); // "radiation" | "deces" : modale d'acte ouverte

  const charger = useCallback(() => {
    getMembre(Number(id)).then(setMembre).catch(() => setMembre(false));
  }, [id]);
  useEffect(() => { charger(); }, [charger]);

  // Droits de plaidoirie : source unique (API), réservée aux rôles financiers (RG-15).
  useEffect(() => {
    if (!peutVoirFinances) return;
    getDroits(EXERCICE_COURANT)
      .then((d) => setDroit((d.lignes ?? []).find((l) => l.membre.id === Number(id)) ?? null))
      .catch(() => setDroit(null));
  }, [id, peutVoirFinances]);

  const cotParAnnee = useMemo(() => Object.fromEntries((membre?.cotisations ?? []).map((c) => [c.annee, c])), [membre]);

  // Provisionne l'accès à l'espace avocat (SG/Admin) et affiche le lien d'activation.
  const creerAcces = async () => {
    try { setAcces(await provisionnerAccesAvocat(membre.id)); }
    catch (e) { toast.error(e.message); }
  };

  if (membre === false) {
    return (
      <div className="space-y-4">
        <Link to="/avocats" className="inline-flex items-center gap-1.5 text-sm text-gris hover:text-navy">
          <ArrowLeftIcon className="h-4 w-4" /> Retour au tableau du Barreau
        </Link>
        <div className="bpn-card p-6">
          <ErrorState title="Avocat introuvable" description="Cette fiche n'existe pas ou n'est plus accessible." onRetry={charger} />
        </div>
      </div>
    );
  }
  if (!membre) return <div className="bpn-card p-6"><TableSkeleton rows={5} cols={3} /></div>;

  const stage = infoStage(membre);
  const cot = cotParAnnee[EXERCICE_COURANT];
  // Sans ligne de cotisation persistée, on n'invente pas un « dû » (qui afficherait
  // un faux « En retard ») : état neutre « Non générée » (cf. Avocats.jsx qui évite
  // aussi ce faux positif).
  const cotConnu = !!cot;
  const du = cot?.montantDu ?? (membre.qualite === "honoraire" ? 0 : membre.qualite === "stagiaire" ? 75000 : 150000);
  const paye = cot?.montantPaye ?? 0;
  const META_NON_GENEREE = { label: "Non générée", ton: "gris" };
  const cotMeta = cotConnu ? STATUT_META[statutLigne(du, paye)] : META_NON_GENEREE;

  const documents = [
    ...(membre.quitus ?? []).map((q) => ({ kind: "quitus", type: "Quitus", ton: "bleu", id: q.id, ref: q.numero, annee: q.annee, date: q.date })),
    ...(membre.recus ?? []).map((r) => ({ kind: "recu", type: "Reçu", ton: "or", id: r.id, ref: r.numero, annee: r.annee, date: r.date })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  // Historique des cotisations (une ligne par exercice ; « Non générée » si absente).
  const lignesCotisations = EXERCICES.map((annee) => {
    const c = cotParAnnee[annee];
    if (!c) return { annee, du: null, paye: null, solde: null, meta: META_NON_GENEREE };
    const d = c.montantDu;
    const p = c.montantPaye ?? 0;
    return { annee, du: d, paye: p, solde: Math.max(0, d - p), meta: STATUT_META[statutLigne(d, p)] };
  });

  const telechargerDoc = (d) =>
    (d.kind === "quitus" ? telechargerQuitusPdf(d.id, d.ref) : telechargerRecuPdf(d.id, d.ref)).catch((e) => toast.error(e.message));

  // Un radié ou un décédé n'a plus d'accès espace, d'attestation ni de radiation
  // possible ; un radié peut encore décéder (H-09, spec T2 § 3.1).
  const decede = membre.statut === "decede";
  const auTableau = !decede && membre.statut !== "radie";
  // Cibles tactiles ≥ 44 px sous `sm`, hauteur `bpn-btn` native sur bureau.
  const btn = "bpn-btn min-h-[44px] sm:min-h-0";
  const btnRouge = `${btn} bpn-btn-ghost text-rouge hover:!bg-rougeL hover:!text-rouge`;

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={[{ label: "Avocats inscrits", to: "/avocats" }, { label: `Me ${membre.nom}` }]}
        titre={`Me ${membre.nom}`}
        sousTitre={
          <span className="flex flex-wrap items-center gap-2">
            <StatutBadge statut={membre.statut} />
            <Badge ton={membre.qualite === "honoraire" ? "or" : "bleu"} dot={false}>{QUALITE_LABEL[membre.qualite]}</Badge>
            <span className="font-mono text-xs text-gris">{membre.numInscription ?? `N° ${membre.num}`} · tableau N° {membre.num} · {membre.cabinet}</span>
          </span>
        }
      >
        {peutGererFiche && (
          <button className={`${btn} bpn-btn-ghost`} onClick={() => setEdition(true)}><PencilSquareIcon className="h-4 w-4" /> Modifier</button>
        )}
        {peutGererAcces && auTableau && (
          <button className={`${btn} bpn-btn-ghost`} onClick={creerAcces} title="Ouvrir l'accès à l'espace avocat"><KeyIcon className="h-4 w-4" /> Accès espace</button>
        )}
        {peutGererFiche && membre.qualite !== "stagiaire" && auTableau && (
          <button className={`${btn} bpn-btn-primary`} onClick={() => setAttestation(membre)}><DocumentPlusIcon className="h-4 w-4" /> Attestation</button>
        )}
        {peutGererFiche && auTableau && (
          <button className={btnRouge} onClick={() => setActe("radiation")}>
            <NoSymbolIcon className="h-4 w-4" /> Radier
          </button>
        )}
        {peutGererFiche && !decede && (
          <button className={btnRouge} onClick={() => setActe("deces")}>
            <HeartIcon className="h-4 w-4" /> Déclarer le décès
          </button>
        )}
        {estAdmin && (
          <button className={btnRouge} onClick={async () => {
            const ok = await confirm({
              title: "Supprimer définitivement",
              message: `Me ${membre.nom} sera définitivement supprimé(e), ainsi que tout son historique financier (cotisations, droits, reçus, quitus, paiements). Cette action est irréversible.`,
              confirmLabel: "Supprimer",
              danger: true,
            });
            if (ok) {
              try { await supprimerMembre(membre.id); toast.success(`Me ${membre.nom} supprimé(e).`); navigate(membre.qualite === "stagiaire" ? "/stagiaires" : "/avocats"); }
              catch (e) { toast.error(e.message); }
            }
          }}>
            <TrashIcon className="h-4 w-4" /> Supprimer
          </button>
        )}
      </PageHeader>

      <Tabs
        tabs={[
          {
            id: "identite",
            label: "Identité",
            icon: IdentificationIcon,
            content: (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Carte titre="Identité & coordonnées">
                  <Ligne label="Cabinet" value={membre.cabinet} />
                  <Ligne label="Date d'inscription" value={formatDate(membre.dateInscription)} />
                  {membre.statut === "radie" && (
                    <Ligne label="Radié le" value={[formatDateCourte(membre.dateRadiation), membre.motifRadiation].filter(Boolean).join(" — ")} />
                  )}
                  {decede && <Ligne label="Décédé le" value={formatDateCourte(membre.dateDeces)} />}
                  <Ligne label="Date de naissance" value={formatDate(membre.dateNaissance)} />
                  <Ligne label="Adresse" value={membre.adresse} />
                  <Ligne label="Téléphone" value={membre.tel} />
                  <Ligne label="Email" value={membre.email} />
                  <Ligne label="RCCM" value={membre.rccm} />
                  <Ligne label="CNSS" value={membre.cnss} />
                  {membre.observations && <Ligne label="Observations" value={membre.observations} />}
                  {membre.qualite === "stagiaire" && (
                    <>
                      {/* Affiché même sans date de serment (stage null) : « — » signale
                          une prestation de serment encore à renseigner, plutôt que de
                          masquer silencieusement le bloc stage. */}
                      <Ligne label="Prestation de serment" value={stage ? formatDate(stage.debut) : "—"} />
                      <Ligne label="Maître de stage" value={stage?.maitreStage ?? "—"} />
                      <div className="pt-3">
                        <div className="mb-1 flex justify-between text-xs"><span className="text-gris">Progression du stage</span><span className="font-mono text-or-fonce">{stage?.progression ?? 0}%</span></div>
                        <div className="h-2 overflow-hidden rounded bg-grisM"><div className="h-full rounded bg-or" style={{ width: `${stage?.progression ?? 0}%` }} /></div>
                      </div>
                    </>
                  )}
                </Carte>

                <div className="space-y-5">
                  <Carte titre={`Cotisation ${EXERCICE_COURANT}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-display text-2xl font-bold" style={{ color: `var(--bpn-${cotMeta.ton === "vert" ? "vert" : cotMeta.ton === "rouge" ? "rouge" : cotMeta.ton === "or" ? "or" : "gris"})` }}>
                          {paye ? formatFCFA(paye) : "—"}
                        </div>
                        <div className="mt-1 text-xs text-gris">{cotConnu ? `sur ${formatFCFA(du)} dus` : "cotisation non générée pour cet exercice"}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge ton={cotMeta.ton}>{cotMeta.label}</Badge>
                        {statutLigne(du, paye) === "ajour" && cot?.valideTresoriere && <Badge ton="vert">Validé Trésorière</Badge>}
                      </div>
                    </div>
                  </Carte>

                  {peutVoirFinances && droit && (
                    <Carte titre={`Droits de plaidoirie ${EXERCICE_COURANT}`}>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div><div className="text-xs uppercase tracking-wide text-gris">Dû</div><div className="mt-1 font-medium">{formatFCFA(droit.du)}</div></div>
                        <div><div className="text-xs uppercase tracking-wide text-gris">Perçu</div><div className="mt-1 font-medium text-vert">{droit.paye ? formatFCFA(droit.paye) : "—"}</div></div>
                        <div><div className="text-xs uppercase tracking-wide text-gris">Solde</div><div className="mt-1 font-medium text-rouge">{droit.solde ? formatFCFA(droit.solde) : "✓"}</div></div>
                      </div>
                    </Carte>
                  )}
                </div>
              </div>
            ),
          },
          ...(membre.qualite === "stagiaire"
            ? [{ id: "stage", label: "Stage", icon: AcademicCapIcon, content: <StagePanel membre={membre} onChange={charger} /> }]
            : []),
          {
            id: "cotisations",
            label: "Cotisations",
            icon: BanknotesIcon,
            content: (
              <div className="bpn-card">
                <div className="bpn-card-header"><span className="bpn-card-heading">Historique des cotisations</span></div>
                <DataTable
                  columns={[
                    { key: "annee", label: "Exercice", sortable: true, sortValue: (l) => l.annee,
                      cell: (l) => <span className="font-mono text-xs text-gris">{l.annee}</span> },
                    { key: "du", label: "Dû", align: "right",
                      cell: (l) => (l.du == null ? <span className="text-gris">—</span> : formatFCFA(l.du)) },
                    { key: "paye", label: "Payé", align: "right", sortable: true, sortValue: (l) => l.paye ?? -1,
                      cell: (l) => (l.paye ? formatFCFA(l.paye) : <span className="text-gris">—</span>) },
                    { key: "solde", label: "Solde", align: "right",
                      cell: (l) => (l.solde == null ? <span className="text-gris">—</span> : l.solde > 0 ? formatFCFA(l.solde) : <span className="text-vert">✓</span>) },
                    { key: "statut", label: "Statut",
                      cell: (l) => <Badge ton={l.meta.ton} dot={false}>{l.meta.label}</Badge> },
                  ]}
                  rows={lignesCotisations}
                  getRowId={(l) => l.annee}
                  libelle="exercices"
                  initialSort={{ key: "annee", dir: "desc" }}
                />
              </div>
            ),
          },
          {
            id: "documents",
            label: "Documents",
            icon: FolderIcon,
            content: (
              <div className="space-y-5">
                <PiecesDossier membreId={membre.id} qualite={membre.qualite} peutGerer={["SECRETAIRE_GENERAL", "ADMIN"].includes(user?.role)} />

                <div className="bpn-card">
                  <div className="bpn-card-header">
                    <span className="bpn-card-heading">Documents émis</span>
                    <span className="font-mono text-xs text-gris">{documents.length}</span>
                  </div>
                  <DataTable
                    columns={[
                      { key: "type", label: "Type", sortable: true, sortValue: (d) => d.type,
                        cell: (d) => <Badge ton={d.ton} dot={false}>{d.type}</Badge> },
                      { key: "ref", label: "Référence", sortable: true, sortValue: (d) => d.ref,
                        cell: (d) => <span className="font-mono text-xs text-or-fonce">{d.ref}</span> },
                      { key: "annee", label: "Exercice",
                        cell: (d) => <span className="font-mono text-xs text-gris">{d.annee ?? "—"}</span> },
                      { key: "date", label: "Date", sortable: true, sortValue: (d) => d.date ?? "",
                        cell: (d) => <span className="text-xs text-gris">{formatDate(d.date)}</span> },
                      { key: "actions", label: "", align: "right",
                        cell: (d) => (
                          <div className="flex items-center justify-end gap-3">
                            {peutVoirFinances && (
                              <button type="button" onClick={() => telechargerDoc(d)}
                                title={`Télécharger le ${d.type.toLowerCase()} (PDF)`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-navy transition hover:text-or-fonce">
                                <ArrowDownTrayIcon className="h-4 w-4" /> PDF
                              </button>
                            )}
                            <a href={`/verifier/${d.kind}/${encodeURIComponent(d.ref)}`} target="_blank" rel="noreferrer"
                              title="Ouvrir la page de vérification publique"
                              className="inline-flex items-center gap-1 text-xs font-medium text-navy transition hover:text-or-fonce">
                              <ShieldCheckIcon className="h-4 w-4" /> Vérifier
                            </a>
                          </div>
                        ) },
                    ]}
                    rows={documents}
                    getRowId={(d) => `${d.kind}-${d.id}`}
                    libelle="documents"
                    initialSort={{ key: "date", dir: "desc" }}
                    emptyIcon={FolderIcon}
                    emptyTitle="Aucun document émis"
                    emptyDescription="Les quitus et reçus délivrés à cet avocat apparaîtront ici."
                  />
                </div>
              </div>
            ),
          },
          {
            id: "discipline",
            label: "Discipline",
            icon: ScaleIcon,
            content: (
              <Carte titre="Casier disciplinaire">
                <CasierDiscipline membreId={membre.id} />
                <div className="mt-3 border-t border-grisL pt-3">
                  <Link to="/discipline" className="bpn-btn bpn-btn-ghost">
                    <ScaleIcon className="h-4 w-4" /> Conseil de discipline
                  </Link>
                </div>
              </Carte>
            ),
          },
        ]}
      />

      <AttestationModal membre={attestation} onClose={() => setAttestation(null)} />
      <EditMembreModal membre={edition ? membre : null} open={edition} onClose={() => setEdition(false)} onSaved={charger} />
      {acte && <ActeStatutModal mode={acte} membre={membre} open onClose={() => setActe(null)} onDone={charger} />}

      {/* Lien d'activation de l'espace avocat (après provisionnement) */}
      <AccesActivationModal acces={acces} onClose={() => setAcces(null)} />
    </div>
  );
}

export default AvocatDetail;
