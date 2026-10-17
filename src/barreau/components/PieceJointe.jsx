import { useRef } from "react";
import PropTypes from "prop-types";
import { PaperClipIcon, XMarkIcon, EyeIcon, ArrowDownTrayIcon, DocumentCheckIcon } from "@heroicons/react/24/outline";
import { telechargerPdf, ouvrirFichierAuth } from "../api/client";
import { StatutMessage } from "./StatutMessage";

/** Mêmes limites que le serveur (lib/messagerie.ts) : une pièce par message, 5 Mo, PDF/DOCX/JPG/PNG. */
export const PIECE_MAX = 5 * 1024 * 1024;
const EXTENSIONS = ["pdf", "docx", "jpg", "jpeg", "png"];
export const PIECE_ACCEPT = ".pdf,.docx,.jpg,.jpeg,.png";
const APERCU = new Set(["application/pdf", "image/jpeg", "image/png"]);

/**
 * Contrôle côté client (confort) puis lecture en base64 sans préfixe `data:`.
 * Le serveur reste seul juge du type réel (octets de signature). Lève une Error
 * au message lisible si la pièce est refusée.
 */
export async function lirePieceJointe(fichier) {
  const ext = fichier.name.split(".").pop().toLowerCase();
  if (!EXTENSIONS.includes(ext)) throw new Error("Format refusé : PDF, DOCX, JPG ou PNG uniquement.");
  if (fichier.size > PIECE_MAX) throw new Error("Pièce trop volumineuse (5 Mo au plus).");
  const donnees = await new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => ko(new Error("Lecture du fichier impossible."));
    r.readAsDataURL(fichier);
  });
  return { nomFichier: fichier.name, donnees };
}

const taille = (o) => (o >= 1048576 ? `${(o / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);

/** Champ « Joindre un fichier » : bouton + nom de la pièce choisie + retrait. `onErreur(message)` signale un refus. */
export function ChampPieceJointe({ piece, onChange, onErreur, disabled }) {
  const ref = useRef(null);
  const choisir = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { onChange(await lirePieceJointe(f)); } catch (err) { onErreur?.(err.message); }
  };
  return (
    <div className="flex min-w-0 items-center gap-2">
      <input ref={ref} type="file" accept={PIECE_ACCEPT} aria-label="Joindre un fichier" className="sr-only" onChange={choisir} disabled={disabled} tabIndex={-1} />
      <button type="button" className="bpn-btn bpn-btn-ghost shrink-0" onClick={() => ref.current?.click()} disabled={disabled}>
        <PaperClipIcon className="h-4 w-4" /> Joindre
      </button>
      {piece ? (
        <span className="flex min-w-0 items-center gap-1 text-xs text-encre">
          <span className="truncate">{piece.nomFichier}</span>
          <button type="button" aria-label={`Retirer la pièce ${piece.nomFichier}`} onClick={() => onChange(null)} className="shrink-0 text-gris transition hover:text-rouge">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </span>
      ) : (
        <span className="text-xs text-gris">PDF, DOCX, JPG, PNG · 5 Mo au plus</span>
      )}
    </div>
  );
}

ChampPieceJointe.propTypes = { piece: PropTypes.object, onChange: PropTypes.func.isRequired, onErreur: PropTypes.func, disabled: PropTypes.bool };

/**
 * Pied d'une bulle : pièce jointe (aperçu PDF/images, téléchargement sinon),
 * statut envoyé/reçu/lu et lien vers l'accusé de lecture PDF pour mes messages.
 * `base` : « /espace/messagerie » ou « /messagerie ».
 */
export function PiedMessage({ message, base, estMoi }) {
  const { piece } = message;
  const lien = "inline-flex items-center gap-1 underline-offset-2 hover:underline";
  const ton = estMoi ? "text-or-2" : "text-navy";
  return (
    <div className="mt-1.5 space-y-1">
      {piece && (
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${ton}`}>
          <span className="inline-flex min-w-0 items-center gap-1"><PaperClipIcon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{piece.nom}</span> <span className="opacity-80">({taille(piece.taille)})</span></span>
          {APERCU.has(piece.mime) ? (
            <button type="button" className={lien} onClick={() => ouvrirFichierAuth(`${base}/messages/${message.id}/piece`)}><EyeIcon className="h-3.5 w-3.5" /> Aperçu</button>
          ) : null}
          <button type="button" className={lien} onClick={() => telechargerPdf(`${base}/messages/${message.id}/piece`, piece.nom)}><ArrowDownTrayIcon className="h-3.5 w-3.5" /> Télécharger</button>
        </div>
      )}
      {estMoi && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatutMessage envoyeLe={message.createdAt} recuLe={message.recuAt} luLe={message.luAt} inverse />
          <button type="button" className={`text-2xs ${ton} ${lien}`} onClick={() => telechargerPdf(`${base}/messages/${message.id}/accuse/pdf`, `Accuse-lecture-${message.id}.pdf`)}>
            <DocumentCheckIcon className="h-3.5 w-3.5" /> Accusé de lecture (PDF)
          </button>
        </div>
      )}
    </div>
  );
}

PiedMessage.propTypes = { message: PropTypes.object.isRequired, base: PropTypes.string.isRequired, estMoi: PropTypes.bool };
