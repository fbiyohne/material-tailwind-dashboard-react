import { useEffect, useState } from "react";
import { Badge, StatCard, PageHeader, useToast, TableSkeleton, ErrorState } from "../../components";
import { STATUT_META, QUALITE_LABEL } from "../../data/derivations";
import { formatFCFA, formatDate } from "../../utils/format";
import { getEspaceMoi } from "../../api/resources";

function CarteSituation({ titre, du, paye, solde, statut, valide }) {
  const meta = STATUT_META[statut] ?? { ton: "gris", label: statut };
  return (
    <div className="bpn-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="bpn-card-heading">{titre}</span>
        <div className="flex items-center gap-1.5">
          <Badge ton={meta.ton}>{meta.label}</Badge>
          {valide && <Badge ton="vert">Validé Trésorière</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><div className="text-[11px] uppercase tracking-wide text-gris">Dû</div><div className="mt-1 font-medium">{formatFCFA(du)}</div></div>
        <div><div className="text-[11px] uppercase tracking-wide text-gris">Payé</div><div className="mt-1 font-medium text-vert">{paye ? formatFCFA(paye) : "—"}</div></div>
        <div><div className="text-[11px] uppercase tracking-wide text-gris">Solde</div><div className={`mt-1 font-medium ${solde ? "text-rouge" : "text-vert"}`}>{solde ? formatFCFA(solde) : "✓ Soldé"}</div></div>
      </div>
    </div>
  );
}

/** Tableau d'historique (cotisations ou droits) de l'avocat connecté. */
function Historique({ titre, lignes }) {
  return (
    <div className="bpn-card">
      <div className="bpn-card-header"><span className="bpn-card-heading">{titre}</span><span className="font-mono text-xs text-gris">{lignes.length}</span></div>
      {lignes.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gris">Aucun historique.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gris">
                <th className="px-4 pb-2 pt-3">Exercice</th><th className="pb-2 pt-3 text-right">Dû</th><th className="pb-2 pt-3 text-right">Payé</th><th className="pb-2 pt-3">Date</th><th className="px-4 pb-2 pt-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const meta = STATUT_META[l.statut] ?? { ton: "gris", label: l.statut };
                return (
                  <tr key={l.annee} className="border-t border-grisL">
                    <td className="px-4 py-2 font-mono text-xs text-gris">{l.annee}</td>
                    <td className="py-2 text-right">{formatFCFA(l.du)}</td>
                    <td className="py-2 text-right">{l.paye ? formatFCFA(l.paye) : "—"}</td>
                    <td className="py-2 text-xs text-gris">{formatDate(l.datePaiement)}</td>
                    <td className="px-4 py-2"><Badge ton={meta.ton}>{meta.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Page d'accueil de l'espace avocat : fiche + situation financière personnelle. */
export function MaSituation() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(false);

  const charger = () => {
    setErreur(false);
    getEspaceMoi().then(setData).catch((e) => { setErreur(true); toast.error(e.message); });
  };
  useEffect(() => { charger(); /* eslint-disable-line */ }, []);

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Votre situation n'a pas pu être chargée." onRetry={charger} /></div>;
  if (!data) return <div className="bpn-card p-6"><TableSkeleton rows={5} cols={3} /></div>;

  const { membre, annee, situation, cotisations, droits } = data;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mon espace"
        titre={`Me ${membre.nom}`}
        sousTitre={
          <span className="flex flex-wrap items-center gap-2">
            <Badge ton="bleu" dot={false}>{QUALITE_LABEL[membre.qualite] ?? membre.qualite}</Badge>
            <span className="font-mono text-xs text-gris">{membre.numInscription ?? `N° ${membre.num}`}{membre.cabinet ? ` · ${membre.cabinet}` : ""}</span>
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={`Cotisation ${annee} — solde`} value={situation.cotisation.solde ? formatFCFA(situation.cotisation.solde) : "À jour"} accent={situation.cotisation.solde ? "rouge" : "vert"} />
        {situation.droit && <StatCard label={`Droit de plaidoirie ${annee} — solde`} value={situation.droit.solde ? formatFCFA(situation.droit.solde) : "À jour"} accent={situation.droit.solde ? "rouge" : "vert"} />}
        <StatCard label="Inscription au tableau" value={membre.numInscription ?? `N° ${membre.num}`} accent="navy" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CarteSituation titre={`Cotisation ${annee}`} {...situation.cotisation} valide={situation.cotisation.valideTresoriere} />
        {situation.droit && <CarteSituation titre={`Droit de plaidoirie ${annee}`} {...situation.droit} valide={false} />}
      </div>

      <Historique titre="Historique des cotisations" lignes={cotisations} />
      {situation.droit && <Historique titre="Historique des droits de plaidoirie" lignes={droits} />}
    </div>
  );
}

export default MaSituation;
