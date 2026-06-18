import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { PaperClipIcon, ArrowUpTrayIcon, EyeIcon, TrashIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Badge } from "./Badge";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";
import { TYPE_PIECE_LABEL as TYPE_LABEL, STATUT_PIECE_META as STATUT, PIECES_REQUISES as REQUISES, PIECE_TAILLE_MAX as MAX } from "../data/pieces";
import { listerPieces, televerserPiece, verifierPiece, rejeterPiece, supprimerPiece, voirPiece } from "../api/resources";

const lireBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1]);
  r.onerror = reject;
  r.readAsDataURL(file);
});

/** Bouton de téléversement (input fichier masqué). */
function BoutonTeleverser({ onFile, label = "Téléverser", busy }) {
  return (
    <label className={`bpn-btn bpn-btn-ghost !py-1.5 text-xs ${busy ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
      <ArrowUpTrayIcon className="h-3.5 w-3.5" /> {label}
      <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
    </label>
  );
}
BoutonTeleverser.propTypes = { onFile: PropTypes.func, label: PropTypes.string, busy: PropTypes.bool };

/**
 * Dossier des pièces (vérification documentaire) : checklist par qualité,
 * téléversement, consultation et vérification/rejet (SG/Admin). Le Bâtonnier
 * consulte sans gérer.
 */
export function PiecesDossier({ membreId, qualite, peutGerer }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [pieces, setPieces] = useState([]);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(() => {
    listerPieces(membreId).then(setPieces).catch((e) => toast.error(e.message));
  }, [membreId, toast]);
  useEffect(() => { charger(); }, [charger]);

  const requises = REQUISES[qualite] ?? REQUISES.avocat;
  const parType = (type) => pieces.find((p) => p.type === type);
  const autres = pieces.filter((p) => !requises.includes(p.type));
  const verifiees = requises.filter((t) => parType(t)?.statut === "VERIFIEE").length;

  const televerser = async (type, file) => {
    if (!file) return;
    if (file.size > MAX) { toast.error("Fichier trop volumineux (max 5 Mo)."); return; }
    setBusy(true);
    try {
      const donnees = await lireBase64(file);
      await televerserPiece(membreId, { type, nomFichier: file.name, mimeType: file.type || "application/octet-stream", donnees });
      toast.success(`Pièce ajoutée — ${TYPE_LABEL[type]}.`);
      charger();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const action = async (fn, msg) => {
    try { await fn(); toast.success(msg); charger(); } catch (e) { toast.error(e.message); }
  };
  const supprimer = async (p) => {
    const ok = await confirm({ title: "Supprimer la pièce ?", message: `« ${p.nomFichier} » sera définitivement supprimée.`, confirmLabel: "Supprimer", danger: true });
    if (ok) action(() => supprimerPiece(p.id), "Pièce supprimée.");
  };
  const rejeter = async (p) => {
    const note = window.prompt("Motif du rejet (optionnel) :", p.note ?? "");
    if (note === null) return;
    action(() => rejeterPiece(p.id, note || undefined), "Pièce rejetée.");
  };

  const Ligne = ({ type, piece, requise }) => {
    const meta = piece ? STATUT[piece.statut] : null;
    return (
      <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <PaperClipIcon className={`h-4 w-4 shrink-0 ${piece ? "text-gris" : "text-grisM"}`} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-encre">
              {TYPE_LABEL[type] ?? type}
              {requise && <span className="text-xs uppercase tracking-wide text-or">requise</span>}
            </div>
            {piece ? (
              <div className="truncate text-xs text-gris">{piece.nomFichier}{piece.statut === "REJETEE" && piece.note ? ` · motif : ${piece.note}` : ""}</div>
            ) : (
              <div className="text-xs text-gris">Aucun document.</div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {piece ? (
            <>
              <Badge ton={meta.ton}>{meta.label}</Badge>
              <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs" onClick={() => voirPiece(piece.id).catch((e) => toast.error(e.message))}>
                <EyeIcon className="h-3.5 w-3.5" /> Voir
              </button>
              {peutGerer && piece.statut !== "VERIFIEE" && (
                <button className="bpn-btn bpn-btn-or !py-1.5 text-xs" onClick={() => action(() => verifierPiece(piece.id), "Pièce vérifiée.")}>
                  <CheckIcon className="h-3.5 w-3.5" /> Vérifier
                </button>
              )}
              {peutGerer && piece.statut !== "REJETEE" && (
                <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs" onClick={() => rejeter(piece)}>
                  <XMarkIcon className="h-3.5 w-3.5" /> Rejeter
                </button>
              )}
              {peutGerer && <BoutonTeleverser onFile={(f) => televerser(type, f)} label="Remplacer" busy={busy} />}
              {peutGerer && (
                <button className="bpn-btn bpn-btn-ghost !px-2 !py-1.5 text-gris hover:text-rouge" title="Supprimer" onClick={() => supprimer(piece)}>
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          ) : peutGerer ? (
            <BoutonTeleverser onFile={(f) => televerser(type, f)} busy={busy} />
          ) : (
            <Badge ton="gris">Manquante</Badge>
          )}
        </div>
      </li>
    );
  };
  Ligne.propTypes = { type: PropTypes.string, piece: PropTypes.object, requise: PropTypes.bool };

  return (
    <div className="bpn-card">
      <div className="bpn-card-header">
        <span className="bpn-card-heading flex items-center gap-2"><PaperClipIcon className="h-4 w-4 text-or" /> Pièces du dossier</span>
        <Badge ton={verifiees === requises.length ? "vert" : "gris"}>{verifiees}/{requises.length} vérifiées</Badge>
      </div>
      <ul className="divide-y divide-grisL">
        {requises.map((type) => <Ligne key={type} type={type} piece={parType(type)} requise />)}
        {autres.map((p) => <Ligne key={p.id} type={p.type} piece={p} requise={false} />)}
      </ul>
      {peutGerer && (
        <div className="flex items-center justify-between gap-3 border-t border-grisM px-4 py-2.5">
          <span className="text-xs text-gris">Formats acceptés : images et PDF · 5 Mo max.</span>
          <BoutonTeleverser onFile={(f) => televerser("AUTRE", f)} label="Ajouter une autre pièce" busy={busy} />
        </div>
      )}
    </div>
  );
}

PiecesDossier.propTypes = {
  membreId: PropTypes.number.isRequired,
  qualite: PropTypes.string,
  peutGerer: PropTypes.bool,
};

export default PiecesDossier;
