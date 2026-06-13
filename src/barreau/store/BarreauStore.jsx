import { createContext, useContext, useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { membres as membresInitiaux } from "../data/membres";
import { ligneCotisation, statutCotisation } from "../data/derivations";
import {
  reunionsInitiales,
  assembleesInitiales,
  dossiersInitiaux,
} from "../data/institutionnel";
import {
  publicationsInitiales,
  genererBrouillonArticle,
} from "../data/publications";

// Quelques documents déjà archivés au démarrage (RG-14).
const ARCHIVES_INITIALES = [
  { categorie: "Quitus", titre: "Quitus Q-2026-089 — Me BIKINDOU Audrey Séverin", reference: "Q-2026-089", date: "2026-05-20", archiveLe: "2026-05-20T10:00:00Z" },
  { categorie: "Procès-verbal (Conseil)", titre: "PV réunion du 2026-05-14", reference: "2026-05-14", date: "2026-05-14", archiveLe: "2026-05-14T17:00:00Z" },
  { categorie: "Attestation d'inscription", titre: "Attestation ATT-2025-014 — Me NGOMA Patricia", reference: "ATT-2025-014", date: "2025-11-08", archiveLe: "2025-11-08T09:30:00Z" },
];

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
  const [attestations, setAttestations] = useState([]);
  const [archives, setArchives] = useState(ARCHIVES_INITIALES);
  const [reunions, setReunions] = useState(reunionsInitiales);
  const [assemblees, setAssemblees] = useState(assembleesInitiales);
  const [dossiers, setDossiers] = useState(dossiersInitiaux);
  const [journalDiscipline, setJournalDiscipline] = useState([]);
  const [publications, setPublications] = useState(publicationsInitiales);
  const [articlesLettre, setArticlesLettre] = useState({});

  const prochainNumeroRecu = formatNumeroRecu(DERNIER_RECU + recus.length + 1);

  /** Archive automatiquement un document généré (BR-05 / RG-14). */
  const archiver = useCallback((entree) => {
    setArchives((prev) => [{ ...entree, archiveLe: new Date().toISOString() }, ...prev]);
  }, []);

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
      archiver({
        categorie: "Reçu de paiement",
        titre: `Reçu N° ${numero} — Me ${membre.nom}`,
        reference: numero,
        date,
        membreNom: membre.nom,
      });
      return recu;
    },
    [membres, recus.length, archiver]
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
      archiver({
        categorie: "Quitus",
        titre: `Quitus ${quit.numero} — Me ${membre.nom}`,
        reference: quit.numero,
        date: quit.date,
        membreNom: membre.nom,
      });
      return quit;
    },
    [membres, estEligibleQuitus, prochainNumeroQuitus, archiver]
  );

  // ─── Attestation d'inscription (FR-AV-05) ────────────────────────────────
  const prochainNumeroAttestation = useCallback(() => {
    const annee = new Date().getFullYear();
    const n = attestations.filter((a) => a.numero.includes(`-${annee}-`)).length + 1;
    return `ATT-${annee}-${String(n).padStart(3, "0")}`;
  }, [attestations]);

  /** Génère une attestation d'inscription et l'archive automatiquement. */
  const genererAttestation = useCallback(
    ({ membreId, date }) => {
      const membre = membres.find((m) => m.id === membreId);
      if (!membre) return null;
      const att = {
        numero: prochainNumeroAttestation(),
        membreId,
        membreNom: membre.nom,
        date: date ?? new Date().toISOString().slice(0, 10),
        emisLe: new Date().toISOString(),
      };
      setAttestations((prev) => [att, ...prev]);
      archiver({
        categorie: "Attestation d'inscription",
        titre: `Attestation ${att.numero} — Me ${membre.nom}`,
        reference: att.numero,
        date: att.date,
        membreNom: membre.nom,
      });
      return att;
    },
    [membres, prochainNumeroAttestation, archiver]
  );

  // ─── Réunions du Conseil (FR-REU-*) ──────────────────────────────────────
  const creerReunion = useCallback((data) => {
    setReunions((prev) => [
      { id: Date.now(), statut: "planifiee", pv: null, ...data },
      ...prev,
    ]);
  }, []);

  const enregistrerPv = useCallback((reunionId, pv) => {
    setReunions((prev) =>
      prev.map((r) => (r.id === reunionId ? { ...r, pv, statut: "tenue" } : r))
    );
  }, []);

  // ─── Assemblées générales (FR-AG-*) ──────────────────────────────────────
  const creerAssemblee = useCallback((data) => {
    setAssemblees((prev) => [
      { id: Date.now(), quorumPresent: 0, statut: "convoquee", decisions: [], ...data },
      ...prev,
    ]);
  }, []);

  // ─── Conseil de discipline (FR-DIS-* / BR-06 / RG-12-13) ─────────────────
  /** Référence unique non réutilisable, format AAAA-NN (BR-06 / RG-12). */
  const prochaineReferenceDossier = useCallback(() => {
    const annee = new Date().getFullYear();
    const nums = dossiers
      .filter((d) => d.reference.startsWith(`${annee}-`))
      .map((d) => parseInt(d.reference.split("-")[1], 10));
    const suivant = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${annee}-${String(suivant).padStart(2, "0")}`;
  }, [dossiers]);

  const ouvrirDossier = useCallback(
    ({ avocatNom, objet, dateSaisine }) => {
      const dossier = {
        id: Date.now(),
        reference: prochaineReferenceDossier(),
        avocatNom,
        objet,
        dateSaisine,
        dateConvocation: null,
        dateAudience: null,
        decision: "",
        sanction: "",
        statut: "ouvert",
      };
      setDossiers((prev) => [dossier, ...prev]);
      return dossier;
    },
    [prochaineReferenceDossier]
  );

  /** Met à jour un dossier disciplinaire (statut, dates, décision, sanction). */
  const mettreAJourDossier = useCallback((id, patch) => {
    setDossiers((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  /** Journalise toute consultation de données disciplinaires (RG-13). */
  const journaliserDiscipline = useCallback((action) => {
    setJournalDiscipline((prev) => [
      { action, quand: new Date().toISOString() },
      ...prev,
    ]);
  }, []);

  // ─── Publications institutionnelles (FR-PUB) ─────────────────────────────
  const creerPublication = useCallback((data) => {
    setPublications((prev) => [
      { id: Date.now(), statut: "a_valider", date: new Date().toISOString().slice(0, 10), ...data },
      ...prev,
    ]);
  }, []);

  /** Validation par le Bâtonnier avant diffusion (FR-PUB / RG). */
  const changerStatutPublication = useCallback((id, statut) => {
    setPublications((prev) => prev.map((p) => (p.id === id ? { ...p, statut } : p)));
  }, []);

  // ─── Lettre du Bâtonnier (FR-BAT) ────────────────────────────────────────
  /** Génère un projet d'article (gabarit ; IA en V2) et l'archive. */
  const genererArticleLettre = useCallback(
    (mois, theme) => {
      const texte = genererBrouillonArticle(mois, theme);
      setArticlesLettre((prev) => ({ ...prev, [mois]: texte }));
      archiver({
        categorie: "Lettre du Bâtonnier",
        titre: `Projet d'article — ${mois}`,
        reference: mois,
        date: new Date().toISOString().slice(0, 10),
      });
      return texte;
    },
    [archiver]
  );

  const value = useMemo(
    () => ({
      membres,
      recus,
      quitus,
      attestations,
      archives,
      reunions,
      assemblees,
      dossiers,
      journalDiscipline,
      publications,
      articlesLettre,
      archiver,
      creerReunion,
      enregistrerPv,
      creerAssemblee,
      prochaineReferenceDossier,
      ouvrirDossier,
      mettreAJourDossier,
      journaliserDiscipline,
      creerPublication,
      changerStatutPublication,
      genererArticleLettre,
      prochainNumeroRecu,
      cotisationsExercice,
      enregistrerPaiement,
      estValide,
      basculerValidation,
      estEligibleQuitus,
      eligiblesQuitus,
      prochainNumeroQuitus,
      genererQuitus,
      prochainNumeroAttestation,
      genererAttestation,
    }),
    [
      membres,
      recus,
      quitus,
      attestations,
      archives,
      reunions,
      assemblees,
      dossiers,
      journalDiscipline,
      publications,
      articlesLettre,
      archiver,
      creerReunion,
      enregistrerPv,
      creerAssemblee,
      prochaineReferenceDossier,
      ouvrirDossier,
      mettreAJourDossier,
      journaliserDiscipline,
      creerPublication,
      changerStatutPublication,
      genererArticleLettre,
      prochainNumeroRecu,
      cotisationsExercice,
      enregistrerPaiement,
      estValide,
      basculerValidation,
      estEligibleQuitus,
      eligiblesQuitus,
      prochainNumeroQuitus,
      genererQuitus,
      prochainNumeroAttestation,
      genererAttestation,
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
