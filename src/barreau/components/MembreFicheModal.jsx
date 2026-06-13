import PropTypes from "prop-types";
import { Modal } from "./Modal";
import { Badge } from "./Badge";
import { StatutBadge } from "./StatutBadge";
import {
  QUALITE_LABEL,
  STATUT_META,
  ligneCotisation,
  infoStage,
} from "../data/derivations";
import { EXERCICES } from "../data/dashboard-data";
import { formatFCFA } from "../utils/format";

function Ligne({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-grisL py-1.5 text-sm">
      <span className="text-gris">{label}</span>
      <span className="text-right font-medium text-encre">{value ?? "—"}</span>
    </div>
  );
}

/** Fiche individuelle d'un membre (FR-AV-04 / FR-ST) + historique paiements. */
export function MembreFicheModal({ membre, onClose, onAttestation }) {
  if (!membre) return null;
  const stage = infoStage(membre);

  return (
    <Modal
      open={!!membre}
      onClose={onClose}
      title={`Fiche — Me ${membre.nom}`}
      footer={
        membre.qualite !== "stagiaire" && (
          <button type="button" className="bpn-btn bpn-btn-primary" onClick={() => onAttestation?.(membre)}>
            Générer une attestation
          </button>
        )
      }
    >
      <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <StatutBadge statut={membre.statut} />
            <Badge ton={membre.qualite === "honoraire" ? "or" : "bleu"} dot={false}>
              {QUALITE_LABEL[membre.qualite]}
            </Badge>
          </div>
          <Ligne label="N° au tableau" value={membre.num} />
          <Ligne label="Cabinet" value={membre.cabinet} />
          <Ligne label="Date d'inscription" value={membre.dateInscription} />
          <Ligne label="RCCM" value={membre.rccm} />
        </div>
        <div>
          <Ligne label="Téléphone" value={membre.tel} />
          <Ligne label="Email" value={membre.email} />
          {stage && (
            <>
              <Ligne label="Prestation de serment" value={stage.debut.toLocaleDateString("fr-FR")} />
              <Ligne label="Maître de stage" value={stage.maitreStage} />
              <Ligne label="Fin de stage prévue" value={stage.fin.toLocaleDateString("fr-FR")} />
            </>
          )}
        </div>
      </div>

      {stage && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-gris">Progression du stage</span>
            <span className="font-mono text-or">{stage.progression}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-grisM">
            <div
              className="h-full rounded bg-or transition-all"
              style={{ width: `${stage.progression}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 text-[10px] uppercase tracking-wide text-gris">
          Historique des cotisations
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-gris">
              <th className="pb-1">Exercice</th>
              <th className="pb-1">Payé</th>
              <th className="pb-1">Statut</th>
            </tr>
          </thead>
          <tbody>
            {EXERCICES.map((annee) => {
              const l = ligneCotisation(membre, annee);
              const meta = STATUT_META[l.statut];
              return (
                <tr key={annee} className="border-t border-grisL">
                  <td className="py-1.5 font-mono text-xs text-gris">{annee}</td>
                  <td className="py-1.5">{l.montantPaye ? formatFCFA(l.montantPaye) : "—"}</td>
                  <td className="py-1.5">
                    <Badge ton={meta.ton}>{meta.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

MembreFicheModal.propTypes = {
  membre: PropTypes.object,
  onClose: PropTypes.func,
  onAttestation: PropTypes.func,
};

export default MembreFicheModal;
