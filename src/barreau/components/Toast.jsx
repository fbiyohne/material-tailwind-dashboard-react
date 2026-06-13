import { createContext, useContext, useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

const ToastContext = createContext(null);

const STYLES = {
  success: { border: "border-vert", bg: "bg-[#e6f4ee]", text: "text-vert", Icon: CheckCircleIcon },
  error: { border: "border-rouge", bg: "bg-[#f4e6e6]", text: "text-rouge", Icon: ExclamationTriangleIcon },
  info: { border: "border-navy", bg: "bg-[#e6edf4]", text: "text-navy", Icon: InformationCircleIcon },
};

/** Fournit `useToast()` et affiche les notifications (a11y : aria-live). */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((type, message, duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  const toast = useMemo(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed right-4 top-4 z-[80] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => {
          const s = STYLES[t.type];
          return (
            <div key={t.id} className={`flex items-start gap-2.5 rounded border-l-[3px] ${s.border} ${s.bg} ${s.text} px-4 py-3 text-sm shadow-card animate-[fadeIn_.2s_ease]`} role="status">
              <s.Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))} className="opacity-60 hover:opacity-100" aria-label="Fermer">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = { children: PropTypes.node };

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans <ToastProvider>");
  return ctx;
}

export default ToastProvider;
