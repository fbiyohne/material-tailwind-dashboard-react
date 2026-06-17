import { useState } from "react";
import { Login } from "./Login";
import { DemandeAcces } from "./DemandeAcces";
import { MotDePasseOublie } from "./MotDePasseOublie";

/**
 * Coquille publique (non authentifiée) : bascule entre la connexion, la demande
 * d'accès et le mot de passe oublié, sans routeur (l'AuthGate ne monte pas de
 * routes publiques).
 */
export function AuthShell() {
  const [vue, setVue] = useState("login");
  if (vue === "demande") return <DemandeAcces onRetour={() => setVue("login")} />;
  if (vue === "oubli") return <MotDePasseOublie onRetour={() => setVue("login")} />;
  return <Login onDemande={() => setVue("demande")} onOubli={() => setVue("oubli")} />;
}

export default AuthShell;
