import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { assainirHtml } from "../utils/sanitizeHtml";

// Une commande d'édition = un bouton de la barre d'outils (document.execCommand :
// déprécié mais universellement supporté ; adéquat pour un éditeur interne).
// Glyphes texte stylés (convention d'une barre de mise en forme) — sans dépendance.
const OUTILS = [
  { cmd: "bold", label: <span className="font-bold">G</span>, titre: "Gras (Ctrl+B)" },
  { cmd: "italic", label: <span className="font-serif italic">I</span>, titre: "Italique (Ctrl+I)" },
  { cmd: "underline", label: <span className="underline">S</span>, titre: "Souligné (Ctrl+U)" },
  { cmd: "formatBlock", val: "H3", label: <span className="text-xs font-bold">Titre</span>, titre: "Titre de section" },
  { cmd: "formatBlock", val: "P", label: <span className="text-xs">¶</span>, titre: "Paragraphe" },
  { cmd: "insertUnorderedList", label: <span>•</span>, titre: "Liste à puces" },
  { cmd: "insertOrderedList", label: <span className="text-xs">1.</span>, titre: "Liste numérotée" },
  { cmd: "undo", label: <span>↶</span>, titre: "Annuler" },
  { cmd: "redo", label: <span>↷</span>, titre: "Rétablir" },
];

/**
 * Éditeur de document en panneau latéral gauche (slide-over), bien stylé, avec les
 * outils de mise en forme du texte. Le contenu est édité en HTML puis assaini à
 * l'enregistrement. Surface « feuille » pour rédiger confortablement.
 */
export function EditeurDocument({ open, title, value = "", note, onSave, onClose }) {
  const zoneRef = useRef(null);
  const [enregistrement, setEnregistrement] = useState(false);

  // Initialise le contenu à l'ouverture (contentEditable non contrôlé : on n'écrit
  // l'innerHTML qu'une fois pour ne pas déplacer le curseur à chaque frappe).
  useEffect(() => {
    if (!open) return undefined;
    if (zoneRef.current) zoneRef.current.innerHTML = value || "";
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    // Laisse le panneau s'installer puis place le curseur dans la zone.
    const t = setTimeout(() => zoneRef.current?.focus(), 50);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const executer = (cmd, val) => {
    zoneRef.current?.focus();
    document.execCommand(cmd, false, val);
  };
  // Collage en texte brut : neutralise le principal vecteur d'injection.
  const onPaste = (e) => {
    e.preventDefault();
    const texte = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, texte);
  };

  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      await onSave(assainirHtml(zoneRef.current?.innerHTML ?? ""));
      onClose?.();
    } finally {
      setEnregistrement(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex" role="dialog" aria-modal="true" aria-label={title}>
      {/* Voile : ne ferme pas (évite la perte de saisie) ; fermeture via ✕ / Annuler / Échap. */}
      <div className="absolute inset-0 bg-navy-3/70 backdrop-blur-[2px]" aria-hidden="true" />

      <div className="relative flex h-full w-full max-w-2xl flex-col bg-creme shadow-modal">
        {/* En-tête */}
        <div className="flex items-center justify-between bg-navy px-5 py-3 text-white">
          <div>
            <div className="text-2xs uppercase tracking-[0.15em] text-or-2">Rédaction du document</div>
            <h2 className="font-display text-base">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Barre d'outils */}
        <div className="flex flex-wrap items-center gap-1 border-b border-grisM bg-white px-3 py-2">
          {OUTILS.map(({ cmd, val, label, titre }) => (
            <button key={titre} type="button" title={titre} aria-label={titre}
              onMouseDown={(e) => { e.preventDefault(); executer(cmd, val); }}
              className="flex h-8 min-w-8 items-center justify-center rounded px-2 text-navy transition hover:bg-grisL">
              {label}
            </button>
          ))}
        </div>

        {note && <p className="border-b border-grisM bg-or-L/50 px-5 py-2 text-xs text-gris">{note}</p>}

        {/* Surface d'édition — feuille */}
        <div className="flex-1 overflow-y-auto bg-grisL/40 p-5">
          <div
            ref={zoneRef}
            contentEditable
            suppressContentEditableWarning
            onPaste={onPaste}
            className="bpn-doc mx-auto min-h-full max-w-[720px] rounded-lg border border-grisM bg-white p-8 shadow-card outline-none focus:ring-2 focus:ring-or/40"
          />
        </div>

        {/* Pied */}
        <div className="flex justify-end gap-2 border-t border-grisM bg-white px-5 py-3">
          <button type="button" className="bpn-btn bpn-btn-ghost" onClick={onClose}>Annuler</button>
          <button type="button" className="bpn-btn bpn-btn-or" onClick={enregistrer} disabled={enregistrement}>
            <CheckIcon className="h-4 w-4" /> {enregistrement ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

EditeurDocument.propTypes = {
  open: PropTypes.bool,
  title: PropTypes.string,
  value: PropTypes.string,
  note: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default EditeurDocument;
