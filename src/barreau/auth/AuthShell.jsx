import { useState } from "react";
import { Login } from "./Login";
import { DemandeAcces } from "./DemandeAcces";

/**
 * Coquille publique (non authentifiée) : bascule entre la connexion et la
 * demande d'accès sans routeur, l'AuthGate ne montant pas de routes publiques.
 */
export function AuthShell() {
  const [vue, setVue] = useState("login");
  return vue === "demande"
    ? <DemandeAcces onRetour={() => setVue("login")} />
    : <Login onDemande={() => setVue("demande")} />;
}

export default AuthShell;
