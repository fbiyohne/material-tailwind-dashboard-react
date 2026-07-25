import { useCallback, useEffect, useState } from "react";
import { ArrowDownTrayIcon, CheckBadgeIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, useToast, useConfirm, TableSkeleton, ErrorState } from "../components";
import { formatDate } from "../utils/format";
import { useAuth } from "../auth/AuthContext";
import { getTableau, telechargerTableauPdf, publierTableau } from "../api/resources";

const QUALITE = { AVOCAT: "Avocats", STAGIAIRE: "Avocats stagiaires", HONORAIRE: "Avocats honoraires" };
const MENTION = { SUSPENDU: { label: "Suspendu", ton: "rouge" }, OMIS: { label: "Omis", ton: "gris" } };

/**
 * Tableau de l'Ordre (RG-04..06) — registre officiel des membres par ordre
 * d'ancienneté, en sections par qualité. Téléchargeable en PDF ; l'arrêté
 * (publication datée au registre) est réservé au Secrétaire Général.
 */
export function TableauOrdre() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const peutPublier = ["SECRETAIRE_GENERAL", "ADMIN"].includes(user?.role);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(false);

  const charger = useCallback(() => {
    setErreur(false);
    getTableau().then(setData).catch(() => setErreur(true));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const publier = async () => {
    const ok = await confirm({ title: "Publier le tableau ?", message: "Le tableau de l'Ordre du jour sera arrêté et archivé au registre documentaire.", confirmLabel: "Publier" });
    if (!ok) return;
    try { const r = await publierTableau(); toast.success(`Tableau de l'Ordre publié (${r.reference}).`); }
    catch (e) { toast.error(e.message); }
  };

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Le tableau de l'Ordre n'a pas pu être chargé." onRetry={charger} /></div>;
  if (!data) return <div className="bpn-card p-6"><TableSkeleton rows={8} cols={4} /></div>;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Membres" titre="Tableau de l'Ordre" sousTitre={`Registre officiel des membres, dressé par ordre d'ancienneté — ${data.total} inscrits.`}>
        <button className="bpn-btn bpn-btn-ghost" onClick={() => telechargerTableauPdf().catch((e) => toast.error(e.message))}>
          <ArrowDownTrayIcon className="h-4 w-4" /> Télécharger le PDF
        </button>
        {peutPublier && (
          <button className="bpn-btn bpn-btn-or" onClick={publier}>
            <CheckBadgeIcon className="h-4 w-4" /> Publier
          </button>
        )}
      </PageHeader>

      {data.sections.map((s) => (
        <div key={s.qualite} className="bpn-card overflow-hidden">
          <div className="bpn-card-header">
            <span className="bpn-card-heading">{QUALITE[s.qualite] ?? s.qualite}</span>
            <Badge ton="bleu" dot={false}>{s.membres.length}</Badge>
          </div>
          <div className="overflow-x-auto">
          <table className="bpn-table">
            <thead>
              <tr>
                <th className="w-14">N°</th>
                <th>Nom</th>
                <th>Cabinet</th>
                <th>Inscription</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {s.membres.map((m) => (
                <tr key={m.id}>
                  <td className="font-mono text-or">{m.rang}</td>
                  <td className="font-medium text-encre">Me {m.nom}</td>
                  <td className="text-gris">{m.cabinet ?? "—"}</td>
                  <td className="text-xs text-gris">{m.dateInscription ? formatDate(m.dateInscription) : "—"}</td>
                  <td>
                    {MENTION[m.statut]
                      ? <Badge ton={MENTION[m.statut].ton} dot={false} className="whitespace-nowrap">{MENTION[m.statut].label}</Badge>
                      : <span className="text-xs text-gris">En exercice</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TableauOrdre;
