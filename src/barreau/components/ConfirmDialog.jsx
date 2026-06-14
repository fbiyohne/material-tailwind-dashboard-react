import { createContext, useContext, useCallback, useState } from "react";
import PropTypes from "prop-types";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";

const ConfirmContext = createContext(null);

/**
 * Fournit `useConfirm()` — une fonction asynchrone qui ouvre un dialogue et
 * résout `true`/`false`. Garantit la confirmation avant toute action
 * irréversible (Definition of Done).
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback(
    (options) => new Promise((resolve) => setState({ ...options, resolve })),
    []
  );

  const close = (value) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? "Confirmer"}
        footer={
          <>
            <button className="bpn-btn bpn-btn-ghost" onClick={() => close(false)}>
              {state?.cancelLabel ?? "Annuler"}
            </button>
            <button
              className={`bpn-btn ${state?.danger ? "bpn-btn-danger" : "bpn-btn-primary"}`}
              onClick={() => close(true)}
            >
              {state?.confirmLabel ?? "Confirmer"}
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          {state?.danger && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rougeL text-rouge">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </div>
          )}
          <p className="text-sm leading-6 text-encre">{state?.message}</p>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

ConfirmProvider.propTypes = { children: PropTypes.node };

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm doit être utilisé dans <ConfirmProvider>");
  return ctx;
}

export default ConfirmProvider;
