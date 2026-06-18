import { useEffect, useState } from "react";
import { ArrowDownTrayIcon, ScaleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, useToast, TableSkeleton, ErrorState, EmptyState } from "../../components";
import { STATUT_DOSSIER_META } from "../../data/institutionnel";
import { formatDate } from "../../utils/format";
import { getEspaceDiscipline, telechargerEspaceDecisionPdf } from "../../api/resources";

function Ligne({ label, valeur }) {
  if (!valeur) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wider text-gris">{label}</span>
      <span className="text-encre">{valeur}</span>
    </div>
  );
}

/** Espace avocat — procédures disciplinaires concernant l'avocat connecté. */
export function EspaceDiscipline() {
  const toast = useToast();
  const [dossiers, setDossiers] = useState(null);
  const [erreur, setErreur] = useState(false);

  const charger = () => {
    setErreur(false);
    getEspaceDiscipline().then(setDossiers).catch((e) => { setErreur(true); toast.error(e.message); });
  };
  useEffect(() => { charger(); /* eslint-disable-line */ }, []);

  const tele = async (fn) => { try { await fn(); } catch (e) { toast.error(e.message || "Téléchargement impossible."); } };

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Vos dossiers n'ont pas pu être chargés." onRetry={charger} /></div>;
  if (!dossiers) return <div className="bpn-card p-6"><TableSkeleton rows={3} cols={3} /></div>;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mon espace" titre="Discipline" sousTitre="Procédures disciplinaires vous concernant. Ces informations sont strictement confidentielles." />

      {dossiers.length === 0 ? (
        <div className="bpn-card p-4">
          <EmptyState icon={ShieldCheckIcon} title="Aucune procédure" description="Aucune procédure disciplinaire ne vous concerne à ce jour." />
        </div>
      ) : (
        dossiers.map((d) => {
          const meta = STATUT_DOSSIER_META[d.statut] ?? { ton: "gris", label: d.statut };
          return (
            <div key={d.id} className="bpn-card">
              <div className="bpn-card-header">
                <span className="bpn-card-heading flex items-center gap-2">
                  <ScaleIcon className="h-4 w-4 text-or" /> Dossier {d.reference}
                </span>
                <Badge ton={meta.ton} dot={false}>{meta.label}</Badge>
              </div>
              <div className="space-y-2 p-4">
                <Ligne label="Objet" valeur={d.objet} />
                <Ligne label="Saisine" valeur={formatDate(d.dateSaisine)} />
                <Ligne label="Convocation" valeur={d.dateConvocation ? formatDate(d.dateConvocation) : null} />
                <Ligne label="Audience" valeur={d.dateAudience ? formatDate(d.dateAudience) : null} />
                <Ligne label="Décision" valeur={d.decision} />
                <Ligne label="Sanction" valeur={d.sanction} />
                {d.decision && (
                  <div className="pt-1">
                    <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs" onClick={() => tele(() => telechargerEspaceDecisionPdf(d.id, d.reference))}>
                      <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Décision (PDF)
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default EspaceDiscipline;
