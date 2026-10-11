import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { ScaleIcon, ExclamationTriangleIcon, InformationCircleIcon, NoSymbolIcon, HeartIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { FormField } from "./FormField";
import { Notice } from "./Notice";
import { Button } from "./Button";
import { useToast } from "./Toast";
import { radierMembre, declarerDeces } from "../api/resources";
import { dateLocaleISO, formatDateCourte } from "../utils/format";

const MOTIF_MAX = 300;

/*
 * Un acte = un seul écran : bandeau juridique, date, (référence), conséquences,
 * bouton d'engagement. Le bouton `danger` vaut confirmation — pas de dialogue
 * empilé (spec T2 § 2.2, H-U1).
 */
const MODES = {
  radiation: {
    titre: (nom) => `Radier Me ${nom}`,
    bandeau: {
      ton: "bleu",
      icon: ScaleIcon,
      texte: "La radiation est prononcée par le Conseil siégeant en matière disciplinaire (art. 36 loi n° 026-92). Enregistrez ici la date et la référence de la décision notifiée (art. 39).",
    },
    dateLabel: "Date de la décision",
    dateHint: undefined,
    dateDefaut: () => dateLocaleISO(),
    consequences: "L'avocat sera retiré du tableau de l'Ordre, du corps électoral et des cotisations ; son accès à l'espace avocat sera désactivé.",
    bouton: "Radier",
    Icone: NoSymbolIcon,
    envoyer: (membre, date, motif) => radierMembre(membre.id, { dateRadiation: date, motifRadiation: motif.trim() || undefined }),
    toast: (nom, date) => `Me ${nom} radié(e) — décision du ${formatDateCourte(date)}.`,
  },
  // T21 : radiation décidée en mode EXPIRATION_RECOURS, rendue exécutoire depuis le dossier
  // disciplinaire (organe, référence de la décision et pièce obligatoires).
  execution: {
    titre: (nom) => `Rendre exécutoire la radiation de Me ${nom}`,
    bandeau: {
      ton: "bleu",
      icon: ScaleIcon,
      texte: "La décision de radiation prend effet à l'expiration du délai de recours (R-40, provisoire). Enregistrez la date d'effet, la référence de la décision et la pièce qui atteste l'absence de recours.",
    },
    dateLabel: "Date d'effet",
    dateHint: "jour où la décision devient exécutoire",
    dateDefaut: () => dateLocaleISO(),
    consequences: "L'avocat sera retiré du tableau de l'Ordre, du corps électoral et des cotisations ; son accès à l'espace avocat sera désactivé. L'événement est ajouté à son parcours.",
    bouton: "Rendre exécutoire",
    Icone: NoSymbolIcon,
    envoyer: (membre, date, _motif, x) => radierMembre(membre.id, { dateRadiation: date, dossierId: x.dossier.id, motifRadiation: `${x.reference.trim()} — pièce : ${x.piece.trim()}` }),
    toast: (nom, date) => `Radiation de Me ${nom} exécutoire au ${formatDateCourte(date)}.`,
  },
  deces: {
    titre: (nom) => `Déclarer le décès de Me ${nom}`,
    bandeau: {
      ton: "rouge",
      icon: ExclamationTriangleIcon,
      texte: "Enregistrement sur présentation de l'acte de décès. Le compte espace sera désactivé et l'avocat retiré du tableau, du corps électoral et des cotisations.",
    },
    dateLabel: "Date du décès",
    dateHint: "date portée sur l'acte de décès",
    dateDefaut: () => "",
    consequences: null,
    bouton: "Déclarer le décès",
    Icone: HeartIcon,
    envoyer: (membre, date) => declarerDeces(membre.id, date),
    toast: (nom, date) => `Décès de Me ${nom} enregistré au ${formatDateCourte(date)}.`,
  },
};

/**
 * Modale d'acte sur le statut d'un membre : radiation (date de la décision +
 * référence facultative), radiation rendue exécutoire (`execution`, avec `dossier` :
 * référence de la décision et pièce obligatoires) ou déclaration de décès (date de
 * l'acte obligatoire). `onDone` est appelé après succès pour recharger la fiche.
 */
export function ActeStatutModal({ mode, membre, dossier, open, onClose, onDone }) {
  const toast = useToast();
  const cfg = MODES[mode];
  const [date, setDate] = useState("");
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState("");
  const [reference, setReference] = useState("");
  const [piece, setPiece] = useState("");
  const [manque, setManque] = useState({});
  const [loading, setLoading] = useState(false);
  const dateRef = useRef(null);
  const aujourdhui = dateLocaleISO();
  // Garde de fermeture stable (Modal la met en dépendance de son effet de focus :
  // une fonction recréée à chaque rendu lui volerait le focus à chaque frappe).
  const loadingRef = useRef(false);
  loadingRef.current = loading;
  const garderOuvert = useCallback(() => !loadingRef.current, []);

  // Formulaire réinitialisé à chaque ouverture (date du jour en radiation, vide en décès).
  useEffect(() => {
    if (open) {
      setDate(cfg.dateDefaut());
      setMotif("");
      setReference(dossier?.reference ?? "");
      setPiece("");
      setManque({});
      setErreur("");
      setLoading(false);
    }
  }, [open, cfg, dossier?.reference]);

  if (!open || !membre) return null;

  const soumettre = async (e) => {
    e.preventDefault();
    if (!date) {
      setErreur("Indiquez la date.");
      dateRef.current?.focus();
      return;
    }
    if (date > aujourdhui) {
      setErreur("La date ne peut pas être postérieure à aujourd'hui.");
      dateRef.current?.focus();
      return;
    }
    if (mode === "execution") {
      const m = {
        reference: reference.trim() ? undefined : "Indiquez la référence de la décision.",
        piece: piece.trim() ? undefined : "Indiquez la pièce qui atteste l'expiration du délai de recours.",
      };
      setManque(m);
      if (m.reference || m.piece) {
        document.getElementById(m.reference ? "execution-reference" : "execution-piece")?.focus();
        return;
      }
    }
    setLoading(true);
    setErreur("");
    try {
      await cfg.envoyer(membre, date, motif, { dossier, reference, piece });
      toast.success(cfg.toast(membre.nom, date));
      onDone?.();
      onClose?.();
    } catch (err) {
      // Le message serveur (date invalide, accès refusé, réseau) reste sous le
      // champ : la saisie est conservée et la modale ouverte.
      setErreur(err.message || "Enregistrement impossible.");
      setLoading(false);
      dateRef.current?.focus();
    }
  };

  const idDate = `${mode}-date`;
  const idMotif = `${mode}-motif`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      onBeforeClose={garderOuvert}
      title={cfg.titre(membre.nom)}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" className="min-h-[44px] justify-center sm:min-h-0" disabled={loading} onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="acte-statut" variant="danger" className="min-h-[44px] justify-center sm:min-h-0" loading={loading} disabled={!date}>
            {!loading && <cfg.Icone className="h-4 w-4" aria-hidden="true" />} {cfg.bouton}
          </Button>
        </div>
      }
    >
      <form id="acte-statut" onSubmit={soumettre} noValidate autoComplete="off" className="space-y-4">
        <Notice ton={cfg.bandeau.ton} icon={cfg.bandeau.icon} role="note">{cfg.bandeau.texte}</Notice>

        <FormField label={cfg.dateLabel} required hint={cfg.dateHint} htmlFor={idDate} error={erreur}>
          <input
            ref={dateRef}
            id={idDate}
            name={mode === "deces" ? "dateDeces" : "dateRadiation"}
            type="date"
            value={date}
            max={aujourdhui}
            required
            disabled={loading}
            onChange={(e) => { setDate(e.target.value); setErreur(""); }}
            className={`bpn-input ${erreur ? "is-invalid" : ""}`}
          />
        </FormField>

        {mode === "radiation" && (
          <FormField label="Référence et motif de la décision" hint="facultatif, 300 caractères" htmlFor={idMotif}>
            <>
              <textarea
                id={idMotif}
                name="motifRadiation"
                rows={2}
                maxLength={MOTIF_MAX}
                value={motif}
                disabled={loading}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex. : Décision du Conseil n° 12 du 01/10/2026"
                className="bpn-input"
              />
              {motif.length >= 250 && (
                <span className="mt-1 block text-right font-mono text-xs tabular-nums text-gris">{motif.length}/{MOTIF_MAX}</span>
              )}
            </>
          </FormField>
        )}

        {mode === "execution" && (
          <>
            <p className="text-sm text-gris">
              Décision : <span className="text-encre">{dossier?.sanction ?? "Radiation"}</span>
              {dossier?.dateDecision ? <> du {formatDateCourte(dossier.dateDecision)}</> : null}
              {dossier?.decidePar ? <> · {dossier.decidePar}</> : null}
            </p>
            <FormField label="Référence de la décision" required htmlFor="execution-reference" error={manque.reference}>
              <input id="execution-reference" value={reference} maxLength={120} disabled={loading} required
                onChange={(e) => { setReference(e.target.value); setManque({ ...manque, reference: undefined }); }}
                className={`bpn-input ${manque.reference ? "is-invalid" : ""}`} />
            </FormField>
            <FormField label="Pièce justificative" required hint="certificat de non-recours ou de non-appel du greffe" htmlFor="execution-piece" error={manque.piece}>
              <input id="execution-piece" value={piece} maxLength={160} disabled={loading} required
                onChange={(e) => { setPiece(e.target.value); setManque({ ...manque, piece: undefined }); }}
                placeholder="Ex. : Certificat de non-appel du greffe n° 88"
                className={`bpn-input ${manque.piece ? "is-invalid" : ""}`} />
            </FormField>
          </>
        )}

        {cfg.consequences && (
          <Notice ton="gris" icon={InformationCircleIcon}>{cfg.consequences}</Notice>
        )}
      </form>
    </Modal>
  );
}

ActeStatutModal.propTypes = {
  mode: PropTypes.oneOf(["radiation", "execution", "deces"]).isRequired,
  membre: PropTypes.shape({ id: PropTypes.number, nom: PropTypes.string, statut: PropTypes.string }),
  dossier: PropTypes.shape({ id: PropTypes.number, reference: PropTypes.string, sanction: PropTypes.string, decidePar: PropTypes.string, dateDecision: PropTypes.string }),
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onDone: PropTypes.func,
};

export default ActeStatutModal;
