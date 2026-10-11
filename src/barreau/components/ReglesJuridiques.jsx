import PropTypes from "prop-types";
import { CheckIcon } from "@heroicons/react/24/outline";
import { FormField } from "./FormField";
import { MentionJuridique } from "./MentionJuridique";

const QUALITES = [
  { v: "AVOCAT", l: "Avocats inscrits" },
  { v: "STAGIAIRE", l: "Avocats stagiaires" },
  { v: "HONORAIRE", l: "Avocats honoraires" },
];
const STATUTS = [
  ["STAGIAIRE", "Stagiaire"], ["SUSPENDU", "Suspendu"], ["OMIS", "Omis"], ["RADIE", "Radié"], ["DECEDE", "Décédé"],
  ["DEMISSIONNAIRE", "Démissionnaire"], ["RETRAITE", "Retraité"], ["CESSATION", "Cessation d'activité"],
];
const ELIGIBILITE = [
  ["BATONNIER", "Bâtonnier"], ["CONSEIL", "Conseil de l'Ordre"], ["CONSEIL_BARREAU", "Conseil du barreau"], ["AUTRE", "Autre scrutin"],
];
const EFFETS = { AUCUN: "Sans effet sur le tableau", SUSPENSION: "Suspension du tableau", RADIATION: "Radiation du tableau" };

const num = (e) => Math.max(0, Number(e.target.value) || 0);
const SOUS = "mb-2 text-xs font-semibold uppercase tracking-wider text-gris";

/** Carte de bloc : même gabarit que les sections de Paramètres, avec la mention C-05. */
function Bloc({ titre, description, children }) {
  return (
    <div className="bpn-card">
      <div className="bpn-card-header"><span className="bpn-card-heading">{titre}</span></div>
      <div className="space-y-4 p-5">
        {description && <p className="text-sm text-gris">{description}</p>}
        <MentionJuridique type="regles" />
        {children}
      </div>
    </div>
  );
}
Bloc.propTypes = { titre: PropTypes.string, description: PropTypes.string, children: PropTypes.node };

const Case = ({ checked, onChange, children }) => (
  <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-grisL/40">
    <span className={checked ? "font-medium text-encre" : "text-gris"}>{children}</span>
    <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-navy" />
  </label>
);
Case.propTypes = { checked: PropTypes.bool, onChange: PropTypes.func, children: PropTypes.node };

const basculer = (liste, v) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]);

/**
 * Règles juridiques paramétrables (provisoires). `valeur` est l'objet complet
 * { stage, ...regles } ; `onChange` reçoit toujours l'objet complet (le serveur
 * exige la section entière).
 */
export function ReglesJuridiques({ valeur: v, onChange, onSave, enCours }) {
  const maj = (cle, patch) => onChange({ ...v, [cle]: { ...v[cle], ...patch } });
  const majListe = (cle, i, patch) => onChange({ ...v, [cle]: v[cle].map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const majElig = (cle, patch) => onChange({ ...v, eligibilite: { ...v.eligibilite, [cle]: { ...v.eligibilite[cle], ...patch } } });

  return (
    <div className="space-y-5">
      <Bloc titre="Stage" description="Durée du stage et pièce exigée pour le passage au tableau.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Durée du stage (mois)">
            <input type="number" min={1} max={120} value={v.stage.dureeMois} onChange={(e) => maj("stage", { dureeMois: num(e) })} className="bpn-input" />
          </FormField>
          <div className="self-end overflow-hidden rounded-lg border border-grisM">
            <Case checked={v.stage.certificatObligatoire} onChange={() => maj("stage", { certificatObligatoire: !v.stage.certificatObligatoire })}>
              Certificat de fin de stage obligatoire
            </Case>
          </div>
        </div>
      </Bloc>

      <Bloc titre="Admission directe" description="Cas d'inscription au tableau sans stage et ancienneté minimale exigée.">
        <div className="space-y-2">
          {v.admissionDirecte.cas.map((c, i) => (
            <div key={c.code} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_9rem]">
              <div className="text-sm text-encre">{c.libelle} <span className="font-mono text-2xs text-gris">{c.article}</span></div>
              <label className="flex items-center gap-2 text-sm text-gris">
                <input aria-label={`Ancienneté minimale — ${c.libelle}`} type="number" min={0} max={60} value={c.ancienneteMinAns}
                  onChange={(e) => majListe("admissionDirecte", i, { ancienneteMinAns: num(e) })} className="bpn-input w-20 text-sm" /> ans
              </label>
            </div>
          ))}
        </div>
      </Bloc>

      <Bloc titre="Impayés et omission" description="Délais entre les étapes du circuit : rappel, mise en demeure, transmission.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Rappel → mise en demeure (jours)">
            <input type="number" min={0} max={365} value={v.impayes.delaiRappelJours} onChange={(e) => maj("impayes", { delaiRappelJours: num(e) })} className="bpn-input" />
          </FormField>
          <FormField label="Mise en demeure → transmission (jours)">
            <input type="number" min={0} max={365} value={v.impayes.delaiMiseEnDemeureJours} onChange={(e) => maj("impayes", { delaiMiseEnDemeureJours: num(e) })} className="bpn-input" />
          </FormField>
        </div>
      </Bloc>

      <Bloc titre="Quitus" description="Durée de validité imprimée sur chaque quitus (date de fin calculée). Aucun texte ne la fixe : valeur provisoire (R-65), à confirmer par le Conseil de l'Ordre.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Validité du quitus (mois)" hint="de 1 à 24">
            <input type="number" min={1} max={24} value={v.quitus?.validiteMois ?? 3} onChange={(e) => maj("quitus", { validiteMois: num(e) })} className="bpn-input" />
          </FormField>
        </div>
      </Bloc>

      <Bloc titre="Sanctions et sursis" description="Catalogue des peines : durée maximale et sursis possible par peine.">
        <div className="space-y-2">
          {v.sanctions.map((s, i) => (
            <div key={s.code} className="grid grid-cols-1 items-center gap-2 rounded-lg border border-grisM p-3 sm:grid-cols-[1fr_8rem_9rem]">
              <div>
                <div className="text-sm font-medium text-encre">{s.libelle}</div>
                <div className="text-xs text-gris">{EFFETS[s.effet]}</div>
              </div>
              {s.effet === "SUSPENSION" ? (
                <label className="flex items-center gap-2 text-sm text-gris">
                  <input aria-label={`Durée maximale — ${s.libelle}`} type="number" min={0} max={120} value={s.dureeMaxMois ?? 0}
                    onChange={(e) => majListe("sanctions", i, { dureeMaxMois: num(e) })} className="bpn-input w-20 text-sm" /> mois
                </label>
              ) : <span />}
              <label className="flex items-center gap-2 text-sm text-gris">
                <input type="checkbox" className="h-4 w-4 accent-navy" aria-label={`Sursis possible — ${s.libelle}`} checked={s.sursisPossible}
                  onChange={() => majListe("sanctions", i, { sursisPossible: !s.sursisPossible })} /> Sursis possible
              </label>
            </div>
          ))}
        </div>
        <MentionJuridique type="sursis" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="self-end overflow-hidden rounded-lg border border-grisM">
            <Case checked={v.sursisAutorise} onChange={() => onChange({ ...v, sursisAutorise: !v.sursisAutorise })}>Sursis autorisé (général)</Case>
          </div>
          <FormField label="Effet de la radiation">
            <select value={v.effetRadiation} onChange={(e) => onChange({ ...v, effetRadiation: e.target.value })} className="bpn-input">
              <option value="ENREGISTREMENT">Dès l'enregistrement de la décision</option>
              <option value="EXPIRATION_RECOURS">À l'expiration des recours</option>
            </select>
          </FormField>
          <FormField label="Peine accessoire d'inéligibilité (mois, au plus)">
            <input type="number" min={0} max={120} value={v.peineAccessoireMaxMois} onChange={(e) => onChange({ ...v, peineAccessoireMaxMois: num(e) })} className="bpn-input" />
          </FormField>
        </div>
      </Bloc>

      <Bloc titre="Corps électoral" description="Qui vote : qualités retenues et statuts exclus à la date du scrutin.">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <div className={SOUS}>Qualités retenues</div>
            <div className="divide-y divide-grisL overflow-hidden rounded-lg border border-grisM">
              {QUALITES.map((q) => (
                <Case key={q.v} checked={v.electoral.qualites.includes(q.v)} onChange={() => maj("electoral", { qualites: basculer(v.electoral.qualites, q.v) })}>{q.l}</Case>
              ))}
            </div>
            <div className="mt-3 divide-y divide-grisL overflow-hidden rounded-lg border border-grisM">
              <Case checked={v.electoral.exigerCotisationAJour} onChange={() => maj("electoral", { exigerCotisationAJour: !v.electoral.exigerCotisationAJour })}>Cotisation à jour exigée</Case>
              <Case checked={v.electoral.honorairesElecteurs} onChange={() => maj("electoral", { honorairesElecteurs: !v.electoral.honorairesElecteurs })}>Honoraires électeurs</Case>
            </div>
          </div>
          <div>
            <div className={SOUS}>Statuts exclus</div>
            <div className="divide-y divide-grisL overflow-hidden rounded-lg border border-grisM">
              {STATUTS.map(([cle, lib]) => (
                <Case key={cle} checked={v.electoral.statutsExclus.includes(cle)} onChange={() => maj("electoral", { statutsExclus: basculer(v.electoral.statutsExclus, cle) })}>{lib}</Case>
              ))}
            </div>
          </div>
        </div>
      </Bloc>

      <Bloc titre="Éligibilité" description="Ancienneté d'inscription exigée pour se porter candidat, par type de scrutin.">
        <div className="space-y-2">
          {ELIGIBILITE.map(([cle, lib]) => (
            <div key={cle} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_9rem_12rem]">
              <div className="text-sm text-encre">{lib}</div>
              <label className="flex items-center gap-2 text-sm text-gris">
                <input aria-label={`Ancienneté minimale — ${lib}`} type="number" min={0} max={60} value={v.eligibilite[cle].ancienneteMinAns}
                  onChange={(e) => majElig(cle, { ancienneteMinAns: num(e) })} className="bpn-input w-20 text-sm" /> ans
              </label>
              <label className="flex items-center gap-2 text-sm text-gris">
                <input type="checkbox" className="h-4 w-4 accent-navy" aria-label={`Comparaison stricte — ${lib}`} checked={v.eligibilite[cle].stricte}
                  onChange={() => majElig(cle, { stricte: !v.eligibilite[cle].stricte })} /> Strictement plus
              </label>
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border border-grisM">
          <Case checked={v.exclurePeineAccessoire} onChange={() => onChange({ ...v, exclurePeineAccessoire: !v.exclurePeineAccessoire })}>Exclure les candidats sous peine accessoire</Case>
        </div>
      </Bloc>

      <div className="flex justify-end">
        <button type="button" className="bpn-btn bpn-btn-primary" disabled={enCours} onClick={onSave}>
          <CheckIcon className="h-4 w-4" /> Enregistrer les règles
        </button>
      </div>
    </div>
  );
}

ReglesJuridiques.propTypes = {
  valeur: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  enCours: PropTypes.bool,
};

export default ReglesJuridiques;
