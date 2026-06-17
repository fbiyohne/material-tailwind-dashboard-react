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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grisL text-left text-[11px] uppercase tracking-wide text-gris">
                <th className="w-14 px-4 py-2.5 font-medium">N°</th>
                <th className="px-4 py-2.5 font-medium">Nom</th>
                <th className="px-4 py-2.5 font-medium">Cabinet</th>
                <th className="px-4 py-2.5 font-medium">Inscription</th>
                <th className="px-4 py-2.5 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grisL">
              {s.membres.map((m) => (
                <tr key={m.id} className="hover:bg-grisL/40">
                  <td className="px-4 py-2.5 font-mono text-or">{m.rang}</td>
                  <td className="px-4 py-2.5 font-medium text-encre">Me {m.nom}</td>
                  <td className="px-4 py-2.5 text-gris">{m.cabinet ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gris">{m.dateInscription ? formatDate(m.dateInscription) : "—"}</td>
                  <td className="px-4 py-2.5">
                    {MENTION[m.statut]
                      ? <Badge ton={MENTION[m.statut].ton} dot={false} className="whitespace-nowrap">{MENTION[m.statut].label}</Badge>
                      : <span className="text-xs text-gris">En exercice</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export default TableauOrdre;
