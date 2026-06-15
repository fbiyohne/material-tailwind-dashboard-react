import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, DocumentPlusIcon, PencilSquareIcon, NoSymbolIcon, TrashIcon, IdentificationIcon, BanknotesIcon, FolderIcon } from "@heroicons/react/24/outline";
import { ScaleIcon } from "@heroicons/react/24/outline";
import { Badge, StatutBadge, AttestationModal, EditMembreModal, PiecesDossier, useConfirm, useToast, PageHeader, Tabs, EmptyState, TableSkeleton, ErrorState } from "../components";
import { QUALITE_LABEL, STATUT_META, infoStage } from "../data/derivations";
import { EXERCICES, EXERCICE_COURANT } from "../data/dashboard-data";
import { formatFCFA, formatDate } from "../utils/format";
import { getMembre, radierMembre, supprimerMembre, getDroits } from "../api/resources";
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
      <span className="text-gris">{label}</span>
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
  const [membre, setMembre] = useState(null);
  const [droit, setDroit] = useState(null); // ligne de droits réelle (rôles finances)
  const [attestation, setAttestation] = useState(null);
  const [edition, setEdition] = useState(false);

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
  const du = cot?.montantDu ?? (membre.qualite === "honoraire" ? 0 : membre.qualite === "stagiaire" ? 75000 : 150000);
  const paye = cot?.montantPaye ?? 0;
  const cotMeta = STATUT_META[statutLigne(du, paye)];

  const documents = [
    ...(membre.quitus ?? []).map((q) => ({ type: "Quitus", ref: q.numero, date: q.date })),
    ...(membre.recus ?? []).map((r) => ({ type: "Reçu", ref: r.numero, date: r.date })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

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
        <button className="bpn-btn bpn-btn-ghost" onClick={() => setEdition(true)}><PencilSquareIcon className="h-4 w-4" /> Modifier</button>
        {membre.qualite !== "stagiaire" && (
          <button className="bpn-btn bpn-btn-primary" onClick={() => setAttestation(membre)}><DocumentPlusIcon className="h-4 w-4" /> Attestation</button>
        )}
        {membre.statut !== "radie" && (
          <button className="bpn-btn bpn-btn-danger" onClick={async () => {
            const ok = await confirm({ title: "Radier cet avocat ?", message: `Me ${membre.nom} sera radié(e) du tableau et exclu(e) du corps électoral.`, confirmLabel: "Radier", danger: true });
            if (ok) { try { await radierMembre(membre.id); toast.success(`Me ${membre.nom} a été radié(e).`); charger(); } catch (e) { toast.error(e.message); } }
          }}>
            <NoSymbolIcon className="h-4 w-4" /> Radier
          </button>
        )}
        {estAdmin && (
          <button className="bpn-btn bpn-btn-ghost text-rouge" onClick={async () => {
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
                  <Ligne label="Date de naissance" value={formatDate(membre.dateNaissance)} />
                  <Ligne label="Adresse" value={membre.adresse} />
                  <Ligne label="Téléphone" value={membre.tel} />
                  <Ligne label="Email" value={membre.email} />
                  <Ligne label="RCCM" value={membre.rccm} />
                  <Ligne label="CNSS" value={membre.cnss} />
                  {membre.observations && <Ligne label="Observations" value={membre.observations} />}
                  {stage && (
                    <>
                      <Ligne label="Prestation de serment" value={formatDate(stage.debut)} />
                      <Ligne label="Maître de stage" value={stage.maitreStage} />
                      <div className="pt-3">
                        <div className="mb-1 flex justify-between text-xs"><span className="text-gris">Progression du stage</span><span className="font-mono text-or">{stage.progression}%</span></div>
                        <div className="h-2 overflow-hidden rounded bg-grisM"><div className="h-full rounded bg-or" style={{ width: `${stage.progression}%` }} /></div>
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
                        <div className="mt-1 text-xs text-gris">sur {formatFCFA(du)} dus</div>
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
                        <div><div className="text-[11px] uppercase tracking-wide text-gris">Dû</div><div className="mt-1 font-medium">{formatFCFA(droit.du)}</div></div>
                        <div><div className="text-[11px] uppercase tracking-wide text-gris">Perçu</div><div className="mt-1 font-medium text-vert">{droit.paye ? formatFCFA(droit.paye) : "—"}</div></div>
                        <div><div className="text-[11px] uppercase tracking-wide text-gris">Solde</div><div className="mt-1 font-medium text-rouge">{droit.solde ? formatFCFA(droit.solde) : "✓"}</div></div>
                      </div>
                    </Carte>
                  )}
                </div>
              </div>
            ),
          },
          {
            id: "cotisations",
            label: "Cotisations",
            icon: BanknotesIcon,
            content: (
              <Carte titre="Historique des cotisations">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-gris">
                        <th className="pb-2">Exercice</th><th className="pb-2 text-right">Dû</th><th className="pb-2 text-right">Payé</th><th className="pb-2 text-right">Solde</th><th className="pb-2 pl-4">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {EXERCICES.map((annee) => {
                        const c = cotParAnnee[annee];
                        const d = c?.montantDu ?? du;
                        const p = c?.montantPaye ?? 0;
                        const m = STATUT_META[statutLigne(d, p)];
                        return (
                          <tr key={annee} className="border-t border-grisL">
                            <td className="py-2 font-mono text-xs text-gris">{annee}</td>
                            <td className="py-2 text-right">{formatFCFA(d)}</td>
                            <td className="py-2 text-right">{p ? formatFCFA(p) : "—"}</td>
                            <td className="py-2 text-right">{d - p > 0 ? formatFCFA(d - p) : "✓"}</td>
                            <td className="py-2 pl-4"><Badge ton={m.ton}>{m.label}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Carte>
            ),
          },
          {
            id: "documents",
            label: "Documents",
            icon: FolderIcon,
            content: (
              <div className="space-y-5">
                <PiecesDossier membreId={membre.id} qualite={membre.qualite} peutGerer={["SECRETAIRE_GENERAL", "ADMIN"].includes(user?.role)} />

                <Carte titre="Documents émis">
                  {documents.length === 0 ? (
                    <EmptyState title="Aucun document émis" description="Les quitus et reçus délivrés à cet avocat apparaîtront ici." />
                  ) : (
                    <ul className="divide-y divide-grisL">
                      {documents.map((d, i) => (
                        <li key={i} className="flex items-center justify-between py-2 text-sm">
                          <span className="flex items-center gap-2"><Badge ton="bleu" dot={false}>{d.type}</Badge><span className="font-mono text-xs text-or">{d.ref}</span></span>
                          <span className="text-xs text-gris">{formatDate(d.date)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Carte>
              </div>
            ),
          },
          {
            id: "discipline",
            label: "Discipline",
            icon: ScaleIcon,
            content: (
              <Carte titre="Historique disciplinaire">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gris">
                    Les dossiers disciplinaires sont consultables dans le module dédié — accès restreint et
                    journalisé (RG-13).
                  </p>
                  <Link to="/discipline" className="bpn-btn bpn-btn-ghost shrink-0">
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
    </div>
  );
}

export default AvocatDetail;
