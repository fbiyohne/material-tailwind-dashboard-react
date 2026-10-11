import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Stockage de fichiers — abstraction (StorageProvider). Implémentation par
 * défaut : disque local sous STORAGE_DIR (./uploads). Conçue pour être
 * remplacée par un stockage objet S3-compatible sans toucher aux appelants.
 */
const RACINE = process.env.STORAGE_DIR || path.resolve(process.cwd(), "uploads");

/** Enregistre un contenu base64 et renvoie le chemin relatif + la taille. */
export function enregistrerFichier(sousDossier: string, donneesBase64: string, extension = ""): { chemin: string; taille: number } {
  const dossier = path.join(RACINE, sousDossier);
  fs.mkdirSync(dossier, { recursive: true });
  const buffer = Buffer.from(donneesBase64, "base64");
  const nom = `${randomUUID()}${extension}`;
  fs.writeFileSync(path.join(dossier, nom), buffer);
  return { chemin: path.join(sousDossier, nom), taille: buffer.length };
}

/** Lit un fichier par son chemin relatif (renvoyé par enregistrerFichier). */
export function lireFichier(chemin: string): Buffer {
  return fs.readFileSync(path.join(RACINE, chemin));
}

/** Supprime un fichier (idempotent). */
export function supprimerFichier(chemin: string): void {
  try {
    fs.unlinkSync(path.join(RACINE, chemin));
  } catch {
    /* déjà absent : rien à faire */
  }
}

/** Types acceptés pour les pièces (messagerie, dossier) : PDF, DOCX, JPG, PNG. */
export type TypePiece = "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | "image/jpeg" | "image/png";

/**
 * Type RÉEL d'un fichier d'après ses octets de signature, sans faire confiance
 * au nom ni au Content-Type déclarés par le client (un exécutable renommé en
 * .pdf est refusé). Renvoie null pour tout format hors liste.
 */
export function typeReel(buffer: Buffer): TypePiece | null {
  if (buffer.length < 4) return null;
  if (buffer.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  // DOCX = archive zip (PK\3\4) contenant une entrée word/… : un .xlsx ou un zip quelconque est refusé.
  if (buffer.subarray(0, 4).toString("latin1") === "PK\x03\x04" && buffer.includes("word/", 0, "latin1")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}
