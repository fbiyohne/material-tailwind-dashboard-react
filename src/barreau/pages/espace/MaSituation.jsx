import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { CreditCardIcon } from "@heroicons/react/24/outline";
import { Badge, Notice, PageHeader, EmptyState, useToast, TableSkeleton, ErrorState } from "../../components";
import { LIBELLES } from "../../components/SituationPanel";
import { STATUT_META, STATUT_MEMBRE_META, QUALITE_LABEL } from "../../data/derivations";
import { formatFCFA, formatDate } from "../../utils/format";
import { getEspaceMoi, getEspaceParcours } from "../../api/resources";
import { PaiementEspaceModal } from "./PaiementEspaceModal";

function CarteSituation({ titre, du, paye, solde, statut, valide, onPayer }) {
  const meta = STATUT_META[statut] ?? { ton: "gris", label: statut };
  return (
    <div className="bpn-card">
      <div className="bpn-card-header">
        <span className="bpn-card-heading">{titre}</span>
        <div className="flex items-center gap-1.5">
          <Badge ton={meta.ton} dot={false}>{meta.label}</Badge>
          {valide && <Badge ton="vert" dot={false}>Validé Trésorière</Badge>}
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><div className="text-xs uppercase tracking-wide text-gris">Dû</div><div className="mt-1 font-medium">{formatFCFA(du)}</div></div>
          <div><div className="text-xs uppercase tracking-wide text-gris">Payé</div><div className="mt-1 font-medium text-vert">{paye ? formatFCFA(paye) : "—"}</div></div>
          <div><div className="text-xs uppercase tracking-wide text-gris">Solde</div><div className={`mt-1 font-medium ${solde ? "text-rouge" : "text-vert"}`}>{solde ? formatFCFA(solde) : "✓ Soldé"}</div></div>
        </div>
        {solde > 0 && onPayer && (
          <div className="mt-3 flex justify-end">
            <button className="bpn-btn bpn-btn-or bpn-btn-sm" onClick={onPayer}>
              <CreditCardIcon className="h-4 w-4" /> Payer en ligne
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
CarteSituation.propTypes = {
  titre: PropTypes.string, du: PropTypes.number, paye: PropTypes.number, solde: PropTypes.number,
  statut: PropTypes.string, valide: PropTypes.bool, onPayer: PropTypes.func,
};

/** Tableau d'historique (cotisations ou droits) de l'avocat connecté. */
function Historique({ titre, lignes }) {
  return (
    <div className="bpn-card">
      <div className="bpn-card-header"><span className="bpn-card-heading">{titre}</span><span className="font-mono text-xs text-gris">{lignes.length}</span></div>
      {lignes.length === 0 ? (
        <div className="p-6"><EmptyState title="Aucun historique" description="Aucun exercice enregistré pour l'instant." /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="bpn-table">
            <thead>
              <tr>
                <th>Exercice</th>
                <th className="text-right">Dû</th>
                <th className="text-right">Payé</th>
                <th>Date</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const meta = STATUT_META[l.statut] ?? { ton: "gris", label: l.statut };
                return (
                  <tr key={l.annee}>
                    <td className="font-mono text-xs text-gris">{l.annee}</td>
                    <td className="text-right">{formatFCFA(l.du)}</td>
                    <td className="text-right">{l.paye ? formatFCFA(l.paye) : "—"}</td>
                    <td className="text-xs text-gris">{l.datePaiement ? formatDate(l.datePaiement) : "—"}</td>
                    <td><Badge ton={meta.ton} dot={false}>{meta.label}</Badge></td>
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

/** Parcours (changements de situation) et stage de l'avocat connecté : GET /espace/parcours. */
function Parcours() {
  const [p, setP] = useState(null);
  const [erreur, setErreur] = useState(false);
  const charger = () => { setErreur(false); getEspaceParcours().then(setP).catch(() => setErreur(true)); };
  useEffect(() => { charger(); }, []);
  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Votre parcours n'a pas pu être chargé." onRetry={charger} /></div>;
  if (!p) return <div className="bpn-card p-6"><TableSkeleton rows={3} cols={2} /></div>;
  const { evenements, stage } = p;
  return (
    <>
      {stage && (
        <div className="bpn-card">
          <div className="bpn-card-header"><span className="bpn-card-heading">Mon stage</span></div>
          <dl className="grid grid-cols-2 gap-3 p-4 text-sm lg:grid-cols-4">
            <div><dt className="text-xs uppercase tracking-wide text-gris">Prestation de serment</dt><dd className="mt-1 font-medium">{stage.dateServment ? formatDate(stage.dateServment) : "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-gris">Durée</dt><dd className="mt-1 font-medium">{stage.dureeMois} mois</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-gris">Fin prévue</dt><dd className="mt-1 font-medium">{stage.finPrevue ? formatDate(stage.finPrevue) : "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-gris">Maître de stage</dt><dd className="mt-1 font-medium">{stage.maitreStage || "—"}</dd></div>
          </dl>
          {stage.stageValideAt && <p className="border-t border-grisL px-4 py-3 text-sm text-vert">Stage validé le {formatDate(stage.stageValideAt)}.</p>}
        </div>
      )}
      <div className="bpn-card">
        <div className="bpn-card-header"><span className="bpn-card-heading">Mon parcours</span><span className="font-mono text-xs text-gris">{evenements.length}</span></div>
        {evenements.length === 0 ? (
          <div className="p-6"><EmptyState title="Aucun événement" description="Aucun changement de situation n'est enregistré à ce jour." /></div>
        ) : (
          <ul className="divide-y divide-grisL">
            {evenements.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                <span className="min-w-0">
                  <span className="text-sm font-medium text-encre">{LIBELLES[e.type] ?? e.type}</span>
                  {(e.reference || e.motif) && <span className="ml-2 text-xs text-gris">{[e.reference, e.motif].filter(Boolean).join(" · ")}</span>}
                </span>
                <span className="font-mono text-xs text-gris">{formatDate(e.dateEffet)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/** Page d'accueil de l'espace avocat : fiche + situation financière personnelle. */
export function MaSituation() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [paiement, setPaiement] = useState(null); // { type, annee, du, solde }

  const charger = () => {
    setErreur(false);
    getEspaceMoi().then(setData).catch((e) => { setErreur(true); toast.error(e.message); });
  };
  useEffect(() => { charger(); /* eslint-disable-line */ }, []);

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Votre situation n'a pas pu être chargée." onRetry={charger} /></div>;
  if (!data) return <div className="bpn-card p-6"><TableSkeleton rows={5} cols={3} /></div>;

  const { membre, annee, situation, cotisations, droits, recouvrement } = data;
  const statutMeta = STATUT_MEMBRE_META[membre.statut] ?? { ton: "gris", label: membre.statut };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mon espace"
        titre={`Me ${membre.nom}`}
        sousTitre={
          <span className="flex flex-wrap items-center gap-2">
            <Badge ton="bleu" dot={false}>{QUALITE_LABEL[membre.qualite] ?? membre.qualite}</Badge>
            <Badge ton={statutMeta.ton} dot={false}>{statutMeta.label}</Badge>
            <span className="font-mono text-xs text-gris">{membre.numInscription ?? `N° ${membre.num}`}{membre.cabinet ? ` · ${membre.cabinet}` : ""}</span>
          </span>
        }
      />

      {recouvrement && situation.cotisation.solde > 0 && (
        <Notice ton="or">
          {LIBELLES[recouvrement.type] ?? recouvrement.type} du {formatDate(recouvrement.dateEffet)} pour l'exercice {annee} : régularisez votre cotisation.
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CarteSituation
          titre={`Cotisation ${annee}`}
          {...situation.cotisation}
          valide={situation.cotisation.valideTresoriere}
          onPayer={() => setPaiement({ type: "cotisation", annee, du: situation.cotisation.du, solde: situation.cotisation.solde })}
        />
        {situation.droit && (
          <CarteSituation
            titre={`Droit de plaidoirie ${annee}`}
            {...situation.droit}
            valide={false}
            onPayer={() => setPaiement({ type: "droit", annee, du: situation.droit.du, solde: situation.droit.solde })}
          />
        )}
      </div>

      <Historique titre="Historique des cotisations" lignes={cotisations} />
      {situation.droit && <Historique titre="Historique des droits de plaidoirie" lignes={droits} />}

      <Parcours />

      <PaiementEspaceModal
        open={!!paiement}
        onClose={() => setPaiement(null)}
        type={paiement?.type}
        annee={paiement?.annee}
        du={paiement?.du}
        solde={paiement?.solde}
        onDone={charger}
      />
    </div>
  );
}

export default MaSituation;
