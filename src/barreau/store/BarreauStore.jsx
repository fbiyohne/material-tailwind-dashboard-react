import { createContext, useContext, useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { membres as membresInitiaux } from "../data/membres";
import { ligneCotisation } from "../data/derivations";

/**
 * Store applicatif en mémoire (sera remplacé par l'API REST en V2).
 * Source unique de vérité pour les membres, leurs cotisations et les reçus
 * émis — ce qui permet d'appliquer la règle BR-03 / RG-11 : l'émission d'un
 * reçu met immédiatement à jour le tableau des cotisations.
 */
const BarreauContext = createContext(null);

// Numéro du dernier reçu déjà émis (séquence reprise de la maquette : N° 0089).
const DERNIER_RECU = 89;
const formatNumeroRecu = (n) => String(n).padStart(4, "0");

export function BarreauProvider({ children }) {
  const [membres, setMembres] = useState(membresInitiaux);
  const [recus, setRecus] = useState([]);

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

  const value = useMemo(
    () => ({
      membres,
      recus,
      prochainNumeroRecu,
      cotisationsExercice,
      enregistrerPaiement,
    }),
    [membres, recus, prochainNumeroRecu, cotisationsExercice, enregistrerPaiement]
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
