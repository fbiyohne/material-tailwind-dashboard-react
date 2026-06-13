import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, DocumentPlusIcon } from "@heroicons/react/24/outline";
import { Badge, StatutBadge, AttestationModal } from "../components";
import { useBarreau } from "../store/BarreauStore";
import {
  ligneCotisation,
  statutCotisation,
  STATUT_META,
  QUALITE_LABEL,
  infoStage,
} from "../data/derivations";
import { ligneDroit } from "../data/droits";
import { EXERCICES } from "../data/dashboard-data";
import { formatFCFA } from "../utils/format";

const EXERCICE_COURANT = 2026;

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
  const { membres, attestations, quitus, recus, estValide } = useBarreau();
  const [attestation, setAttestation] = useState(null);

  const membre = membres.find((m) => m.id === Number(id));

  const documents = useMemo(() => {
    if (!membre) return [];
    return [
      ...attestations.filter((a) => a.membreId === membre.id).map((a) => ({ type: "Attestation", ref: a.numero, date: a.date })),
      ...quitus.filter((q) => q.membreId === membre.id).map((q) => ({ type: "Quitus", ref: q.numero, date: q.date })),
      ...recus.filter((r) => r.membreId === membre.id).map((r) => ({ type: "Reçu", ref: r.numero, date: r.date })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [membre, attestations, quitus, recus]);

  if (!membre) {
    return (
      <div className="py-20 text-center">
        <p className="text-gris">Avocat introuvable.</p>
        <button className="bpn-btn bpn-btn-ghost mt-4" onClick={() => navigate("/avocats")}>Retour</button>
      </div>
    );
  }

  const stage = infoStage(membre);
  const cot = ligneCotisation(membre, EXERCICE_COURANT);
  const cotMeta = STATUT_META[cot.statut];
  const droit = ligneDroit(membre, EXERCICE_COURANT);

  return (
    <div className="space-y-5">
      <Link to="/avocats" className="inline-flex items-center gap-1.5 text-sm text-gris hover:text-navy">
        <ArrowLeftIcon className="h-4 w-4" /> Retour au tableau du Barreau
      </Link>

      {/* En-tête */}
      <div className="bpn-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl text-navy">Me {membre.nom}</h2>
            <StatutBadge statut={membre.statut} />
            <Badge ton={membre.qualite === "honoraire" ? "or" : "bleu"} dot={false}>
              {QUALITE_LABEL[membre.qualite]}
            </Badge>
          </div>
          <div className="mt-1 font-mono text-xs text-gris">
            {membre.numInscription ?? `N° ${membre.num}`} · tableau N° {membre.num} · {membre.cabinet}
          </div>
        </div>
        {membre.qualite !== "stagiaire" && (
          <button className="bpn-btn bpn-btn-primary" onClick={() => setAttestation(membre)}>
            <DocumentPlusIcon className="h-4 w-4" /> Générer une attestation
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Carte titre="Identité & coordonnées">
          <Ligne label="Cabinet" value={membre.cabinet} />
          <Ligne label="Date d'inscription" value={membre.dateInscription} />
          <Ligne label="RCCM" value={membre.rccm} />
          <Ligne label="Téléphone" value={membre.tel} />
          <Ligne label="Email" value={membre.email} />
          {stage && (
            <>
              <Ligne label="Prestation de serment" value={stage.debut.toLocaleDateString("fr-FR")} />
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
                  {cot.montantPaye ? formatFCFA(cot.montantPaye) : "—"}
                </div>
                <div className="mt-1 text-xs text-gris">sur {formatFCFA(cot.montantDu)} dus</div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge ton={cotMeta.ton}>{cotMeta.label}</Badge>
                {cot.statut === "ajour" && estValide(membre.id, EXERCICE_COURANT) && (
                  <Badge ton="vert">Validé Trésorière</Badge>
                )}
              </div>
            </div>
          </Carte>

          <Carte titre={`Droits de plaidoirie ${EXERCICE_COURANT}`}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-[10px] uppercase tracking-wide text-gris">Dû</div><div className="mt-1 font-medium">{formatFCFA(droit.du)}</div></div>
              <div><div className="text-[10px] uppercase tracking-wide text-gris">Perçu</div><div className="mt-1 font-medium text-vert">{droit.paye ? formatFCFA(droit.paye) : "—"}</div></div>
              <div><div className="text-[10px] uppercase tracking-wide text-gris">Solde</div><div className="mt-1 font-medium text-rouge">{droit.solde ? formatFCFA(droit.solde) : "✓"}</div></div>
            </div>
          </Carte>
        </div>
      </div>

      {/* Historique cotisations */}
      <Carte titre="Historique des cotisations">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-gris">
              <th className="pb-2">Exercice</th><th className="pb-2">Dû</th><th className="pb-2">Payé</th><th className="pb-2">Solde</th><th className="pb-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {EXERCICES.map((annee) => {
              const l = ligneCotisation(membre, annee);
              const m = STATUT_META[l.statut];
              return (
                <tr key={annee} className="border-t border-grisL">
                  <td className="py-2 font-mono text-xs text-gris">{annee}</td>
                  <td className="py-2">{formatFCFA(l.montantDu)}</td>
                  <td className="py-2">{l.montantPaye ? formatFCFA(l.montantPaye) : "—"}</td>
                  <td className="py-2">{l.solde ? formatFCFA(l.solde) : "✓"}</td>
                  <td className="py-2"><Badge ton={m.ton}>{m.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Carte>

      {/* Documents émis */}
      <Carte titre="Documents émis">
        {documents.length === 0 ? (
          <p className="py-4 text-center text-sm text-gris">Aucun document émis pour cet avocat.</p>
        ) : (
          <ul className="divide-y divide-grisL">
            {documents.map((d, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2"><Badge ton="bleu" dot={false}>{d.type}</Badge><span className="font-mono text-xs text-or">{d.ref}</span></span>
                <span className="text-xs text-gris">{d.date}</span>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <AttestationModal membre={attestation} onClose={() => setAttestation(null)} />
    </div>
  );
}

export default AvocatDetail;
