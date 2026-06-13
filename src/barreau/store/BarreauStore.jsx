import { createContext, useContext, useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { membres as membresInitiaux } from "../data/membres";
import { ligneCotisation, statutCotisation } from "../data/derivations";

/**
 * Store applicatif en mémoire (sera remplacé par l'API REST en V2).
 * Source unique de vérité pour les membres, leurs cotisations, les reçus et les
 * quitus — ce qui permet d'appliquer les règles métier transverses :
 *   • BR-03 / RG-11 : l'émission d'un reçu met à jour le tableau des cotisations.
 *   • BR-01 / RG-01-02 : un quitus n'est émis que si l'avocat est à jour ET
 *     que sa situation a été validée par la Trésorière.
 */
const BarreauContext = createContext(null);

// Séquences reprises de la maquette (dernier reçu N° 0089, dernier quitus Q-2026-089).
const DERNIER_RECU = 89;
const formatNumeroRecu = (n) => String(n).padStart(4, "0");
const cleValidation = (membreId, exercice) => `${membreId}-${exercice}`;

// Situations déjà validées par la Trésorière au démarrage (avocats à jour 2026).
const VALIDATIONS_INITIALES = ["2-2026", "3-2026", "4-2026", "9-2026", "10-2026"];

// Registre des quitus déjà émis (pour que la numérotation suive Q-2026-090).
const QUITUS_INITIAUX = [
  {
    numero: "Q-2026-089",
    membreId: 3,
    membreNom: "BIKINDOU Audrey Séverin",
    exercice: 2026,
    date: "2026-05-20",
  },
];

export function BarreauProvider({ children }) {
  const [membres, setMembres] = useState(membresInitiaux);
  const [recus, setRecus] = useState([]);
  const [validations, setValidations] = useState(VALIDATIONS_INITIALES);
  const [quitus, setQuitus] = useState(QUITUS_INITIAUX);

  const prochainNumeroRecu = formatNumeroRecu(DERNIER_RECU + recus.length + 1);

  /** Liste consolidée des cotisations d'un exercice (FR-COT-*). */
  const cotisationsExercice = useCallback(
    (exercice) => membres.map((m) => ligneCotisation(m, exercice)),
    [membres]
  );

  /**
   * Enregistre un paiement et émet le reçu correspondant (FR-REC-06 / BR-03).
   * Renvoie le reçu créé (avec son numéro définitif).
   */
  const enregistrerPaiement = useCallback(
    ({ membreId, exercice, montant, mode, ref, date }) => {
      const membre = membres.find((m) => m.id === membreId);
      if (!membre) return null;

      const numero = formatNumeroRecu(DERNIER_RECU + recus.length + 1);

      setMembres((prev) =>
        prev.map((m) => {
          if (m.id !== membreId) return m;
          const dejaPaye = m.paiements?.[exercice]?.paye ?? 0;
          return {
            ...m,
            paiements: {
              ...m.paiements,
              [exercice]: { paye: dejaPaye + montant, date, mode, ref },
            },
          };
        })
      );

      const recu = {
        numero,
        membreId,
        membreNom: membre.nom,
        qualite: membre.qualite,
        montant,
        exercice,
        date,
        mode,
        ref,
        objet: `Cotisation ordinale ${exercice}`,
        emisLe: new Date().toISOString(),
      };
      setRecus((prev) => [recu, ...prev]);
      return recu;
    },
    [membres, recus.length]
  );

  // ─── Validation par la Trésorière (US-07 / FR-QUI-02) ────────────────────
  const estValide = useCallback(
    (membreId, exercice) => validations.includes(cleValidation(membreId, exercice)),
    [validations]
  );

  const basculerValidation = useCallback((membreId, exercice) => {
    const cle = cleValidation(membreId, exercice);
    setValidations((prev) =>
      prev.includes(cle) ? prev.filter((c) => c !== cle) : [...prev, cle]
    );
  }, []);

  // ─── Quitus (BR-01 / FR-QUI-01-03) ───────────────────────────────────────
  /** Un avocat est éligible au quitus s'il est à jour ET validé Trésorière. */
  const estEligibleQuitus = useCallback(
    (membre, exercice) =>
      statutCotisation(membre, exercice) === "ajour" && estValide(membre.id, exercice),
    [estValide]
  );

  const eligiblesQuitus = useCallback(
    (exercice) => membres.filter((m) => estEligibleQuitus(m, exercice)),
    [membres, estEligibleQuitus]
  );

  const prochainNumeroQuitus = useCallback(
    (exercice) => {
      const suffixes = quitus
        .filter((q) => q.exercice === exercice)
        .map((q) => parseInt(q.numero.split("-")[2], 10));
      const suivant = (suffixes.length ? Math.max(...suffixes) : 0) + 1;
      return `Q-${exercice}-${String(suivant).padStart(3, "0")}`;
    },
    [quitus]
  );

  /**
   * Génère un quitus si et seulement si l'avocat est éligible (BR-01).
   * Archive automatiquement le document (FR-QUI-03). Renvoie le quitus ou null.
   */
  const genererQuitus = useCallback(
    ({ membreId, exercice, date }) => {
      const membre = membres.find((m) => m.id === membreId);
      if (!membre || !estEligibleQuitus(membre, exercice)) return null;

      const quit = {
        numero: prochainNumeroQuitus(exercice),
        membreId,
        membreNom: membre.nom,
        exercice,
        date: date ?? new Date().toISOString().slice(0, 10),
        emisLe: new Date().toISOString(),
      };
      setQuitus((prev) => [quit, ...prev]);
      return quit;
    },
    [membres, estEligibleQuitus, prochainNumeroQuitus]
  );

  const value = useMemo(
    () => ({
      membres,
      recus,
      quitus,
      prochainNumeroRecu,
      cotisationsExercice,
      enregistrerPaiement,
      estValide,
      basculerValidation,
      estEligibleQuitus,
      eligiblesQuitus,
      prochainNumeroQuitus,
      genererQuitus,
    }),
    [
      membres,
      recus,
      quitus,
      prochainNumeroRecu,
      cotisationsExercice,
      enregistrerPaiement,
      estValide,
      basculerValidation,
      estEligibleQuitus,
      eligiblesQuitus,
      prochainNumeroQuitus,
      genererQuitus,
    ]
  );

  return <BarreauContext.Provider value={value}>{children}</BarreauContext.Provider>;
}

BarreauProvider.propTypes = { children: PropTypes.node };

export function useBarreau() {
  const ctx = useContext(BarreauContext);
  if (!ctx) throw new Error("useBarreau doit être utilisé dans <BarreauProvider>");
  return ctx;
}

export default BarreauProvider;
