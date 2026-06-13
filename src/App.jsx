import BarreauLayout from "@/barreau/layout/BarreauLayout";
import { BarreauProvider } from "@/barreau/store/BarreauStore";
import { ErrorBoundary, ToastProvider, ConfirmProvider } from "@/barreau/components";

/**
 * Application de gestion du Secrétariat Général du Barreau de Pointe-Noire.
 * Providers transverses : capture d'erreurs, notifications (toasts) et
 * dialogues de confirmation, autour du store et du layout institutionnel.
 */
function App() {
  return (
    <ErrorBoundary>
      <BarreauProvider>
        <ToastProvider>
          <ConfirmProvider>
            <BarreauLayout />
          </ConfirmProvider>
        </ToastProvider>
      </BarreauProvider>
    </ErrorBoundary>
  );
}

export default App;
