import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { BellAlertIcon, ExclamationTriangleIcon, PaperAirplaneIcon, ArrowUturnLeftIcon, ArrowRightOnRectangleIcon, PlayIcon, ArrowLeftOnRectangleIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { FormField } from "./FormField";
import { Frise } from "./Frise";
import { MentionJuridique } from "./MentionJuridique";
import { useToast } from "./Toast";
import { enregistrerEvenement, listerPieces } from "../api/resources";

export const LIBELLES = {
  INSCRIPTION: "Inscription", PASSAGE_TABLEAU: "Passage au tableau", ADMISSION_DIRECTE: "Admission directe",
  RAPPEL: "Rappel de cotisation", MISE_EN_DEMEURE: "Mise en demeure", TRANSMISSION: "Transmission au Conseil de l'Ordre national",
  OMISSION: "Omission", REINSCRIPTION: "Réinscription", SANCTION: "Sanction enregistrée", SUSPENSION: "Interdiction temporaire",
  REPRISE: "Reprise d'exercice", RADIATION: "Radiation", DECES: "Décès", DEMISSIONNAIRE: "Démission", RETRAITE: "Retraite",
  CESSATION: "Cessation d'activité", CHANGEMENT_STATUT: "Changement de situation", REFORMATION: "Décision réformée",
};
const CAUSES = [
  ["35-4", "Art. 35-4° — contribution non acquittée"],
  ["35-1", "Art. 35-1° — maladie ou infirmité (aucun détail médical)"],
  ["35-2", "Art. 35-2°"], ["35-3", "Art. 35-3°"], ["35-5", "Art. 35-5°"],
];
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Phrase d'explication affichée en tête de l'onglet Parcours (O3). */
export const EXPLICATION_PARCOURS = "Historique daté de chaque changement de situation de l'avocat : qui l'a décidé, quand, pourquoi, sur quelle pièce.";

/** Libellé et détail d'un événement du parcours : qui (organe), quand, pourquoi, pièce. */
export function etapeDe(e) {
  const d = e.details ?? {};
  const organe = d.decidePar ?? d.organe;
  // Omission pour maladie ou infirmité : le code d'article seul, jamais de détail médical (R-15).
  const motif = d.cause === "35-1" ? "Art. 35-1° loi n° 026-92" : e.motif;
  // Une ligne par question : qui a décidé, pourquoi, sur quelle pièce, qui l'a saisi.
  const lignes = [
    organe && `Décidé par ${organe}`,
    motif,
    [e.reference && `Réf. ${e.reference}`, e.pieceId && `Pièce n° ${e.pieceId}`].filter(Boolean).join(" · "),
    e.acteurNom && <span className="text-encre/70">Enregistré par {e.acteurNom}</span>,
  ].filter(Boolean);
  return {
    id: e.id, libelle: `${LIBELLES[e.type] ?? e.type}${d.sursis ? " — avec sursis" : ""}`, date: e.dateEffet,
    detail: lignes.length ? lignes.map((l, i) => <span key={i} className="block">{l}</span>) : undefined,
  };
}

/** Plus récent en haut ; à date égale, le dernier enregistré d'abord. */
const recentsDabord = (evenements) =>
  [...(evenements ?? [])].sort((a, b) => (a.dateEffet < b.dateEffet ? 1 : a.dateEffet > b.dateEffet ? -1 : (b.id ?? 0) - (a.id ?? 0)));

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
  DEMISSIONNAIRE: { titre: "Démission", icone: ArrowLeftOnRectangleIcon, role: true, statuts: ["inscrit", "suspendu", "omis"] },
  RETRAITE: { titre: "Retraite", icone: ArrowLeftOnRectangleIcon, role: true, statuts: ["inscrit", "suspendu", "omis"] },
  CESSATION: { titre: "Cessation d'activité", icone: ArrowLeftOnRectangleIcon, role: true, statuts: ["inscrit", "suspendu", "omis"] },
};

/**
 * Actions du parcours (circuit des impayés, omission, réinscription, reprise, sorties
 * volontaires) permises pour ce membre et cet utilisateur, dans l'ordre du circuit.
 * Le serveur reste l'autorité ; l'omission est décidée par le Conseil de l'Ordre national.
 */
export function actionsParcours(membre, user) {
  const admin = user?.role === "ADMIN";
  const sg = admin || user?.role === "SECRETAIRE_GENERAL";
  return Object.entries(ACTIONS)
    .filter(([, a]) => a.statuts.includes(membre.statut) && (a.role ? sg : admin || !!user?.permissions?.includes(a.permission)))
    .map(([type, a]) => ({ type, titre: a.titre, icone: a.icone }));
}

/** Saisie d'un événement de parcours (`type` ouvert par le menu Actions de la fiche). */
export function EvenementModal({ membre, type, evenements, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({});
  const [pieces, setPieces] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const action = type && ACTIONS[type];

  useEffect(() => {
    if (!type) return;
    setForm({ dateEffet: aujourdhui(), reference: "", motif: "", pieceId: "", cause: "35-4" });
    // Les pièces sont facultatives : leur échec de chargement n'empêche pas la saisie.
    Promise.resolve().then(() => listerPieces(membre.id)).then((p) => setPieces(p ?? [])).catch(() => setPieces([]));
  }, [type, membre.id]);

  const refManquante = action?.decision && !form.reference?.trim();

  const valider = async () => {
    setBusy(true);
    try {
      await enregistrerEvenement(membre.id, {
        type, dateEffet: form.dateEffet || undefined,
        ...(form.reference?.trim() && { reference: form.reference.trim() }),
        ...(form.motif?.trim() && !(type === "OMISSION" && form.cause === "35-1") && { motif: form.motif.trim() }),
        ...(form.pieceId && { pieceId: Number(form.pieceId) }),
        ...(type === "OMISSION" && { cause: form.cause }),
        ...(["MISE_EN_DEMEURE", "TRANSMISSION", "OMISSION"].includes(type) && exerciceDuCircuit(evenements) && { annee: exerciceDuCircuit(evenements) }),
      });
      toast.success(`${LIBELLES[type]} enregistré(e).`);
      onClose();
      onDone?.();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open={!!action} onClose={onClose} title={action?.titre ?? ""}
      footer={<>
        <button className="bpn-btn bpn-btn-ghost" onClick={onClose}>Annuler</button>
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
        {/* 35-1° : le serveur refuse tout motif (donnée de santé) ; le champ disparaît. */}
        {!(type === "OMISSION" && form.cause === "35-1") && (
          <FormField label="Motif" htmlFor="ev-motif" full>
            <textarea id="ev-motif" rows={2} className="bpn-input" maxLength={500} value={form.motif ?? ""} onChange={set("motif")} />
          </FormField>
        )}
        <FormField label="Pièce du dossier" htmlFor="ev-piece" full hint="facultatif">
          <select id="ev-piece" className="bpn-input" value={form.pieceId ?? ""} onChange={set("pieceId")}>
            <option value="">Aucune</option>
            {pieces.map((p) => <option key={p.id} value={p.id}>{p.nomFichier}</option>)}
          </select>
        </FormField>
      </div>
      {action?.decision && <MentionJuridique type="omission" className="mt-4" />}
    </Modal>
  );
}

EvenementModal.propTypes = {
  membre: PropTypes.object.isRequired,
  type: PropTypes.string,
  evenements: PropTypes.array,
  onClose: PropTypes.func.isRequired,
  onDone: PropTypes.func,
};

/**
 * Onglet « Parcours » de la fiche : frise datée des changements de situation, du plus
 * récent au plus ancien, en lecture seule. Les actions sont au menu Actions de la fiche.
 */
export function SituationPanel({ evenements, erreur }) {
  return (
    <div className="bpn-card">
      <div className="bpn-card-header"><span className="bpn-card-heading">Parcours de l'avocat</span></div>
      <div className="space-y-4 p-4">
        <p className="max-w-[65ch] text-sm text-encre/70">{EXPLICATION_PARCOURS}</p>
        {erreur
          ? <p className="text-sm text-rouge" role="alert">Parcours indisponible : {erreur}</p>
          : <Frise titre="Parcours de l'avocat" etapes={recentsDabord(evenements).map(etapeDe)} vide="Aucun changement de situation enregistré depuis la mise en service du journal." />}
      </div>
    </div>
  );
}

SituationPanel.propTypes = {
  evenements: PropTypes.array,
  erreur: PropTypes.string,
};

export default SituationPanel;
