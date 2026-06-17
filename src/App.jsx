import { useLocation } from "react-router-dom";
import BarreauLayout from "@/barreau/layout/BarreauLayout";
import EspaceAvocatLayout from "@/barreau/layout/EspaceAvocatLayout";
import { ErrorBoundary, ToastProvider, ConfirmProvider } from "@/barreau/components";
import { AuthProvider, useAuth } from "@/barreau/auth/AuthContext";
import { AuthShell } from "@/barreau/auth/AuthShell";
import { ActivationCompte } from "@/barreau/auth/ActivationCompte";
import { ReinitialiserMotDePasse } from "@/barreau/auth/ReinitialiserMotDePasse";
import { VerificationPublique } from "@/barreau/pages/VerificationPublique";

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
  // Aiguillage par rôle : les avocats ont leur propre espace cloisonné ;
  // les 4 profils du Conseil de l'Ordre accèdent au back-office.
  const Layout = user.role === "AVOCAT" ? EspaceAvocatLayout : BarreauLayout;
  return (
    <ConfirmProvider>
      <Layout />
    </ConfirmProvider>
  );
}

/**
 * Aiguillage : les pages publiques de vérification (/verifier/:type/:numero,
 * atteintes via QR code) court-circuitent l'authentification ; tout le reste
 * passe par la connexion puis le layout applicatif.
 */
function PublicOrApp() {
  const location = useLocation();
  const m = location.pathname.match(/^\/verifier\/([^/]+)\/(.+?)\/?$/);
  if (m) return <VerificationPublique type={decodeURIComponent(m[1])} numero={decodeURIComponent(m[2])} />;
  // Activation publique de l'espace avocat (lien envoyé par le secrétariat).
  const a = location.pathname.match(/^\/activer\/([^/]+)\/?$/);
  if (a) return <ActivationCompte token={decodeURIComponent(a[1])} />;
  // Réinitialisation publique de mot de passe (lien envoyé par e-mail).
  const r = location.pathname.match(/^\/reinitialiser\/([^/]+)\/?$/);
  if (r) return <ReinitialiserMotDePasse token={decodeURIComponent(r[1])} />;
  return <AuthGate />;
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
          <PublicOrApp />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
