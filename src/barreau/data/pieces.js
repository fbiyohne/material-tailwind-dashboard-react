import { ClockIcon, CheckBadgeIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/**
 * Référentiel des pièces du dossier d'inscription (KYC), partagé par le
 * composant de fiche (PiecesDossier) et l'écran de validation (Pieces).
 */
export const TYPE_PIECE_LABEL = {
  IDENTITE: "Pièce d'identité (CNI / passeport)",
  DIPLOME: "Diplôme / Maîtrise en droit",
  SERMENT: "PV de prestation de serment",
  PHOTO: "Photo d'identité",
  CASIER: "Casier judiciaire",
  AUTRE: "Autre pièce",
};

export const STATUT_PIECE_META = {
  A_VERIFIER: { label: "À vérifier", ton: "or", icon: ClockIcon },
  VERIFIEE: { label: "Vérifiée", ton: "vert", icon: CheckBadgeIcon },
  REJETEE: { label: "Rejetée", ton: "rouge", icon: ExclamationTriangleIcon },
};

/** Pièces requises par qualité (checklist du dossier). */
export const PIECES_REQUISES = {
  avocat: ["IDENTITE", "DIPLOME", "SERMENT", "PHOTO"],
  stagiaire: ["IDENTITE", "DIPLOME", "SERMENT", "PHOTO"],
  honoraire: ["IDENTITE", "PHOTO"],
};

/** Taille maximale d'une pièce téléversée (5 Mo). */
export const PIECE_TAILLE_MAX = 5 * 1024 * 1024;
