import { useState } from "react";
import PropTypes from "prop-types";
import { EnvelopeIcon, ArrowRightIcon, ExclamationCircleIcon, CheckCircleIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { AuthLayout } from "./AuthLayout";
import { Field } from "./Field";
import { Button } from "../components";
import { demanderResetMdp } from "../api/resources";

/**
 * Demande publique de réinitialisation de mot de passe. La réponse est toujours
 * neutre (on ne divulgue pas l'existence d'un compte) : un lien est envoyé si un
 * compte actif correspond à l'adresse.
 */
export function MotDePasseOublie({ onRetour }) {
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [loading, setLoading] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(null);
    setLoading(true);
    try {
      await demanderResetMdp(email);
      setEnvoye(true);
    } catch (err) {
      setErreur(err.message || "Demande impossible. Réessayez plus tard.");
    } finally {
      setLoading(false);
    }
  };

  const base = {
    devise: "La probité, l'indépendance et l'honneur sont les premiers devoirs de l'avocat.",
    deviseAuteur: "Serment de l'avocat",
    eyebrow: "Accès sécurisé",
  };

  if (envoye) {
    return (
      <AuthLayout {...base} titre="Vérifiez vos e-mails" sousTitre="Si un compte correspond, un lien vous a été envoyé.">
        <div className="flex items-start gap-2.5 rounded-lg border border-vert/40 bg-vert/[0.12] px-3.5 py-3 text-sm text-[#a7d7b4]">
          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Un lien de réinitialisation (valable 1 heure) a été envoyé à l'adresse indiquée, si elle est associée à un compte actif.</span>
        </div>
        <div className="mt-7 border-t border-white/10 pt-5 text-sm text-white/50">
          <button type="button" onClick={onRetour} className="inline-flex items-center gap-1.5 font-medium text-or-2 underline-offset-4 transition hover:text-or-3 hover:underline">
            <ArrowLeftIcon className="h-3.5 w-3.5" /> Retour à la connexion
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      {...base}
      titre="Mot de passe oublié"
      sousTitre="Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation."
      pied={
        <button type="button" onClick={onRetour} className="inline-flex items-center gap-1.5 font-medium text-or-2 underline-offset-4 transition hover:text-or-3 hover:underline">
          <ArrowLeftIcon className="h-3.5 w-3.5" /> Retour à la connexion
        </button>
      }
    >
      <form onSubmit={soumettre} noValidate className="space-y-4">
        {erreur && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-[#c2554f]/40 bg-[#c2554f]/[0.12] px-3.5 py-3 text-sm text-[#eab1ad]">
            <ExclamationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erreur}</span>
          </div>
        )}
        <Field
          id="oubli-email"
          label="Adresse email"
          icon={EnvelopeIcon}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="username"
          placeholder="vous@barreau-pn.cg"
        />
        <Button type="submit" variant="or" loading={loading} className="!w-full justify-center !rounded-lg !py-2.5 !text-sm">
          Envoyer le lien <ArrowRightIcon className="h-4 w-4" />
        </Button>
      </form>
    </AuthLayout>
  );
}

MotDePasseOublie.propTypes = { onRetour: PropTypes.func.isRequired };

export default MotDePasseOublie;
