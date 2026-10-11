import { useState } from "react";
import PropTypes from "prop-types";
import { BellAlertIcon, ExclamationTriangleIcon, PaperAirplaneIcon, ArrowUturnLeftIcon, ArrowRightOnRectangleIcon, PlayIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { FormField } from "./FormField";
import { Frise } from "./Frise";
import { MentionJuridique } from "./MentionJuridique";
import { useToast } from "./Toast";
import { enregistrerEvenement, listerPieces } from "../api/resources";

const LIBELLES = {
  INSCRIPTION: "Inscription", PASSAGE_TABLEAU: "Passage au tableau", ADMISSION_DIRECTE: "Admission directe",
  RAPPEL: "Rappel de cotisation", MISE_EN_DEMEURE: "Mise en demeure", TRANSMISSION: "Transmission au Conseil de l'Ordre national",
  OMISSION: "Omission", REINSCRIPTION: "Réinscription", SANCTION: "Sanction enregistrée", SUSPENSION: "Interdiction temporaire",
  REPRISE: "Reprise d'exercice", RADIATION: "Radiation", DECES: "Décès", DEMISSIONNAIRE: "Démission", RETRAITE: "Retraite",
  CESSATION: "Cessation d'activité", CHANGEMENT_STATUT: "Changement de situation",
};
const CAUSES = [
  ["35-4", "Art. 35-4° — contribution non acquittée"],
  ["35-1", "Art. 35-1° — maladie ou infirmité (aucun détail médical)"],
  ["35-2", "Art. 35-2°"], ["35-3", "Art. 35-3°"], ["35-5", "Art. 35-5°"],
];
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Libellé et détail d'un événement de l'historique : qui, quand, pourquoi, pièce. */
export function etapeDe(e) {
  const d = e.details ?? {};
  const morceaux = [
    e.motif,
    e.reference && `Réf. ${e.reference}`,
    e.pieceId && `Pièce n° ${e.pieceId}`,
    d.decidePar,
    e.acteurNom && `Enregistré par ${e.acteurNom}`,
  ].filter(Boolean);
  return { id: e.id, libelle: `${LIBELLES[e.type] ?? e.type}${d.sursis ? " — avec sursis" : ""}`, date: e.dateEffet, detail: morceaux.join(" · ") || undefined };
}

/** Vrai si une sanction avec sursis figure à l'historique : mention à afficher sur la fiche (C-06). */
export const sursisEnCours = (evenements) => (evenements ?? []).some((e) => e.details?.sursis && ["SANCTION", "SUSPENSION"].includes(e.type));

/** Exercice du circuit en cours : celui de la dernière étape (rappel, mise en demeure, transmission) ; sinon le serveur retient l'année de la date d'effet. */
export const exerciceDuCircuit = (evenements) =>
  (evenements ?? []).find((e) => ["RAPPEL", "MISE_EN_DEMEURE", "TRANSMISSION"].includes(e.type) && e.annee)?.annee;

const ACTIONS = {
  RAPPEL: { titre: "Enregistrer un rappel", icone: BellAlertIcon, permission: "finances", statuts: ["inscrit", "suspendu"] },
  MISE_EN_DEMEURE: { titre: "Enregistrer une mise en demeure", icone: ExclamationTriangleIcon, permission: "finances", statuts: ["inscrit", "suspendu"] },
  TRANSMISSION: { titre: "Enregistrer la transmission", icone: PaperAirplaneIcon, permission: "finances", statuts: ["inscrit", "suspendu"] },
  OMISSION: { titre: "Enregistrer l'omission", icone: ArrowRightOnRectangleIcon, permission: "omission_prononcer", statuts: ["inscrit", "suspendu"], decision: true },
  REINSCRIPTION: { titre: "Réinscrire", icone: ArrowUturnLeftIcon, permission: "omission_prononcer", statuts: ["omis"], decision: true },
  REPRISE: { titre: "Enregistrer la reprise", icone: PlayIcon, role: true, statuts: ["suspendu"] },
  DEMISSIONNAIRE: { titre: "Démission", role: true, statuts: ["inscrit", "suspendu", "omis"] },
  RETRAITE: { titre: "Retraite", role: true, statuts: ["inscrit", "suspendu", "omis"] },
  CESSATION: { titre: "Cessation d'activité", role: true, statuts: ["inscrit", "suspendu", "omis"] },
};

/**
 * Historique de situation (frise) et actions du circuit d'omission et des sorties,
 * affichées selon les permissions de l'utilisateur (le serveur reste l'autorité).
 * L'omission est décidée par le Conseil de l'Ordre national : le logiciel enregistre.
 */
export function SituationPanel({ membre, evenements, erreur, user, onChange }) {
  const toast = useToast();
  const [type, setType] = useState(null);
  const [form, setForm] = useState({});
  const [pieces, setPieces] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const admin = user?.role === "ADMIN";
  const sg = admin || user?.role === "SECRETAIRE_GENERAL";
  const permis = ([, a]) => a.statuts.includes(membre.statut) && (a.role ? sg : admin || !!user?.permissions?.includes(a.permission));
  const disponibles = Object.entries(ACTIONS).filter(permis);
  const action = type && ACTIONS[type];

  const ouvrir = (t) => {
    setType(t);
    setForm({ dateEffet: aujourdhui(), reference: "", motif: "", pieceId: "", cause: "35-4" });
    // Les pièces sont facultatives : leur échec de chargement n'empêche pas la saisie.
    Promise.resolve().then(() => listerPieces(membre.id)).then((p) => setPieces(p ?? [])).catch(() => setPieces([]));
  };
  const refManquante = action?.decision && !form.reference?.trim();

  const valider = async () => {
    setBusy(true);
    try {
      await enregistrerEvenement(membre.id, {
        type, dateEffet: form.dateEffet || undefined,
        ...(form.reference?.trim() && { reference: form.reference.trim() }),
        ...(form.motif?.trim() && { motif: form.motif.trim() }),
        ...(form.pieceId && { pieceId: Number(form.pieceId) }),
        ...(type === "OMISSION" && { cause: form.cause }),
        ...(["MISE_EN_DEMEURE", "TRANSMISSION", "OMISSION"].includes(type) && exerciceDuCircuit(evenements) && { annee: exerciceDuCircuit(evenements) }),
      });
      toast.success(`${LIBELLES[type]} enregistré(e).`);
      setType(null);
      onChange?.();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="bpn-card">
        <div className="bpn-card-header"><span className="bpn-card-heading">Historique de la situation</span></div>
        <div className="p-4">
          {erreur
            ? <p className="text-sm text-rouge" role="alert">Historique indisponible : {erreur}</p>
            : <Frise titre="Historique de la situation" etapes={(evenements ?? []).map(etapeDe)} vide="Aucun changement de situation enregistré depuis la mise en service du journal." />}
        </div>
      </div>

      {disponibles.length > 0 && (
        <div className="bpn-card">
          <div className="bpn-card-header"><span className="bpn-card-heading">Actions sur la situation</span></div>
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              {disponibles.map(([t, a]) => {
                const Icone = a.icone;
                return (
                  <button key={t} type="button" className="bpn-btn bpn-btn-ghost min-h-[44px] sm:min-h-0" onClick={() => ouvrir(t)}
                    title={t === "OMISSION" ? "Mesure administrative temporaire, réversible par réinscription — distincte de la radiation disciplinaire." : undefined}>
                    {Icone && <Icone className="h-4 w-4" />} {a.titre}
                  </button>
                );
              })}
            </div>
            <MentionJuridique type="omission" />
          </div>
        </div>
      )}

      <Modal
        open={!!type} onClose={() => setType(null)} title={action?.titre ?? ""}
        footer={<>
          <button className="bpn-btn bpn-btn-ghost" onClick={() => setType(null)}>Annuler</button>
          <button className="bpn-btn bpn-btn-primary" disabled={busy || refManquante} onClick={valider}>Enregistrer</button>
        </>}
      >
        {action?.decision && <p className="mb-3 text-sm text-encre">Décision du Conseil de l'Ordre national : le logiciel l'enregistre, il ne la prononce pas.</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Date d'effet" htmlFor="ev-date" required>
            <input id="ev-date" type="date" className="bpn-input" max={aujourdhui()} value={form.dateEffet ?? ""} onChange={set("dateEffet")} />
          </FormField>
          <FormField label="Référence" htmlFor="ev-ref" required={!!action?.decision} hint={action?.decision ? "de la décision" : undefined}>
            <input id="ev-ref" className="bpn-input" maxLength={120} value={form.reference ?? ""} onChange={set("reference")} />
          </FormField>
          {type === "OMISSION" && (
            <FormField label="Cause" htmlFor="ev-cause" full>
              <select id="ev-cause" className="bpn-input" value={form.cause} onChange={set("cause")}>
                {CAUSES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
              </select>
            </FormField>
          )}
          <FormField label="Motif" htmlFor="ev-motif" full>
            <textarea id="ev-motif" rows={2} className="bpn-input" maxLength={500} value={form.motif ?? ""} onChange={set("motif")} />
          </FormField>
          <FormField label="Pièce du dossier" htmlFor="ev-piece" full hint="facultatif">
            <select id="ev-piece" className="bpn-input" value={form.pieceId ?? ""} onChange={set("pieceId")}>
              <option value="">Aucune</option>
              {pieces.map((p) => <option key={p.id} value={p.id}>{p.nomFichier}</option>)}
            </select>
          </FormField>
        </div>
      </Modal>
    </div>
  );
}

SituationPanel.propTypes = {
  membre: PropTypes.object.isRequired,
  evenements: PropTypes.array,
  erreur: PropTypes.string,
  user: PropTypes.object,
  onChange: PropTypes.func,
};

export default SituationPanel;
