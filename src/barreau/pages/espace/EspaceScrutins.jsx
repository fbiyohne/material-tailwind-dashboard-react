import { useCallback, useEffect, useState } from "react";
import { CheckBadgeIcon, MegaphoneIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, useToast, TableSkeleton, ErrorState, EmptyState } from "../../components";
import { getEspaceScrutins, voterScrutin } from "../../api/resources";

const TYPE = { CONSEIL: "Conseil de l'Ordre", BATONNIER: "Bâtonnier", AUTRE: "Scrutin" };

/** Espace avocat — vote en ligne aux scrutins ouverts (confidentiel et unique). */
export function EspaceScrutins() {
  const toast = useToast();
  const [scrutins, setScrutins] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [choix, setChoix] = useState({}); // scrutinId -> Set(candidatId)
  const [envoi, setEnvoi] = useState(null);

  const charger = useCallback(() => {
    setErreur(false);
    getEspaceScrutins().then(setScrutins).catch(() => setErreur(true));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const basculer = (sid, cid, nbSieges) => setChoix((c) => {
    const set = new Set(c[sid] ?? []);
    if (set.has(cid)) set.delete(cid);
    else if (set.size < nbSieges) set.add(cid);
    else { toast.error(`Vous ne pouvez choisir que ${nbSieges} candidat(s).`); return c; }
    return { ...c, [sid]: set };
  });

  const voter = async (s) => {
    const ids = [...(choix[s.id] ?? [])];
    if (ids.length === 0) { toast.error("Sélectionnez au moins un candidat."); return; }
    setEnvoi(s.id);
    try {
      await voterScrutin(s.id, ids);
      toast.success("Votre vote a été enregistré. Merci de votre participation.");
      charger();
    } catch (e) { toast.error(e.message); } finally { setEnvoi(null); }
  };

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Les scrutins n'ont pas pu être chargés." onRetry={charger} /></div>;
  if (!scrutins) return <div className="bpn-card p-6"><TableSkeleton rows={4} cols={2} /></div>;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mon espace" titre="Élections" sousTitre="Votez aux scrutins de l'Ordre. Votre vote est confidentiel." />

      {scrutins.length === 0 ? (
        <div className="bpn-card p-6"><EmptyState icon={MegaphoneIcon} title="Aucun scrutin" description="Aucun scrutin n'est ouvert au vote pour le moment." /></div>
      ) : (
        scrutins.map((s) => {
          const total = s.candidats.reduce((a, c) => a + (c.voix ?? 0), 0);
          const peutVoter = s.statut === "OUVERT" && !s.aDejaVote;
          const set = choix[s.id] ?? new Set();
          return (
            <div key={s.id} className="bpn-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-semibold text-encre">{s.titre}</h3>
                  <div className="mt-0.5 text-[12px] text-gris">{TYPE[s.type]} · {s.nbSieges} siège(s) à pourvoir</div>
                </div>
                {s.statut === "PUBLIE" ? <Badge ton="bleu" dot={false}>Résultats publiés</Badge>
                  : s.aDejaVote ? <Badge ton="vert" dot={false}>Vous avez voté</Badge>
                  : s.statut === "CLOS" ? <Badge ton="or" dot={false}>Dépouillement</Badge>
                  : <Badge ton="vert">Ouvert</Badge>}
              </div>

              {peutVoter && <p className="mt-3 text-[12.5px] text-gris">Sélectionnez jusqu'à {s.nbSieges} candidat(s), puis validez votre vote.</p>}

              <ul className="mt-3 space-y-2">
                {s.candidats.map((c) => {
                  const coche = set.has(c.id);
                  const pct = total > 0 ? Math.round(((c.voix ?? 0) / total) * 100) : 0;
                  return (
                    <li key={c.id}>
                      <label className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${peutVoter ? "cursor-pointer" : ""} ${coche ? "border-or bg-or-L" : "border-grisL"}`}>
                        <span className="flex items-center gap-2.5 font-medium text-encre">
                          {peutVoter && <input type="checkbox" checked={coche} onChange={() => basculer(s.id, c.id, s.nbSieges)} className="h-4 w-4 accent-[var(--bpn-or)]" />}
                          {c.nom}
                        </span>
                        {s.statut === "PUBLIE" && <span className="font-mono text-sm text-gris">{c.voix ?? 0} voix · {pct}%</span>}
                      </label>
                      {s.statut === "PUBLIE" && <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.nom} : ${c.voix ?? 0} voix, ${pct}%`} className="mt-1 h-1.5 overflow-hidden rounded bg-grisM"><div className="h-full rounded bg-or" style={{ width: `${pct}%` }} /></div>}
                    </li>
                  );
                })}
              </ul>

              {peutVoter && (
                <button className="bpn-btn bpn-btn-or mt-4" disabled={envoi === s.id || set.size === 0} onClick={() => voter(s)}>
                  <CheckBadgeIcon className="h-4 w-4" /> Voter
                </button>
              )}
              {s.aDejaVote && s.statut !== "PUBLIE" && <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-vert"><CheckBadgeIcon className="h-4 w-4" /> Votre participation a été enregistrée.</p>}
            </div>
          );
        })
      )}
    </div>
  );
}

export default EspaceScrutins;
