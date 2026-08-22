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
