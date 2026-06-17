import { useEffect, useId, useRef } from "react";
import PropTypes from "prop-types";
import { XMarkIcon } from "@heroicons/react/24/outline";

const SELECTEUR_FOCUS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Fenêtre modale institutionnelle accessible (WCAG 2.4.3 / 2.1.2) :
 * role="dialog", aria-modal, libellée par son titre ; piège le focus (Tab),
 * ferme à l'Escape et au clic sur le voile, verrouille le défilement et rend
 * le focus à l'élément déclencheur à la fermeture.
 */
export function Modal({ open, onClose, title, children, footer }) {
  const ref = useRef(null);
  const declencheur = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    declencheur.current = document.activeElement;
    document.body.style.overflow = "hidden";

    const node = ref.current;
    node?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      if (e.key === "Tab" && node) {
        const f = node.querySelectorAll(SELECTEUR_FOCUS);
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      declencheur.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-3/80 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-grisM bg-white shadow-modal focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-grisM px-5 py-3.5">
          <h3 id={titleId} className="font-display text-base text-navy">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-grisL text-gris hover:bg-grisM"
            aria-label="Fermer la fenêtre"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-grisM px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

Modal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.string,
  children: PropTypes.node,
  footer: PropTypes.node,
};

export default Modal;
