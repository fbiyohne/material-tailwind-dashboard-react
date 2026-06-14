import BarreauLayout from "@/barreau/layout/BarreauLayout";
import { ErrorBoundary, ToastProvider, ConfirmProvider } from "@/barreau/components";
import { AuthProvider, useAuth } from "@/barreau/auth/AuthContext";
import { AuthShell } from "@/barreau/auth/AuthShell";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-3 text-sm text-white/50">
      Chargement…
    </div>
  );
}

/** Affiche la connexion tant que l'utilisateur n'est pas authentifié. */
function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <AuthShell />;
  return (
    <ConfirmProvider>
      <BarreauLayout />
    </ConfirmProvider>
  );
}

/**
 * Application de gestion du Secrétariat Général du Barreau de Pointe-Noire.
 * Authentification (JWT) puis layout institutionnel et store applicatif.
 */
function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
