import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { LockClosedIcon, ArrowRightIcon, ExclamationCircleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { AuthLayout } from "./AuthLayout";
import { Field } from "./Field";
import { Button } from "../components";
import { getActivation, activerCompte } from "../api/resources";

/**
 * Page publique d'activation de l'espace avocat (lien « /activer/:token »).
 * L'avocat vérifie son identité via le token, choisit son mot de passe et
 * active son compte ; il est ensuite invité à se connecter.
 */
export function ActivationCompte({ token }) {
  const [etat, setEtat] = useState("verification"); // verification | formulaire | invalide | succes
  const [compte, setCompte] = useState(null); // { nom, email }
  const [password, setPassword] = useState("");
  const [confirme, setConfirme] = useState("");
  const [erreur, setErreur] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let actif = true;
    getActivation(token)
      .then((c) => { if (actif) { setCompte(c); setEtat("formulaire"); } })
      .catch(() => { if (actif) setEtat("invalide"); });
    return () => { actif = false; };
  }, [token]);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(null);
    if (password.length < 8) { setErreur("Le mot de passe doit comporter au moins 8 caractères."); return; }
    if (password !== confirme) { setErreur("Les deux mots de passe ne correspondent pas."); return; }
    setLoading(true);
    try {
      await activerCompte(token, password);
      setEtat("succes");
    } catch (err) {
      setErreur(err.message || "Activation impossible. Le lien est peut-être expiré.");
    } finally {
      setLoading(false);
    }
  };

  const base = {
    devise: "La probité, l'indépendance et l'honneur sont les premiers devoirs de l'avocat.",
    deviseAuteur: "Serment de l'avocat",
    eyebrow: "Espace avocat",
  };

  if (etat === "verification") {
    return (
      <AuthLayout {...base} titre="Activation" sousTitre="Vérification de votre lien d'activation…">
        <div className="text-sm text-white/50">Un instant…</div>
      </AuthLayout>
    );
  }

  if (etat === "invalide") {
    return (
      <AuthLayout {...base} titre="Lien invalide" sousTitre="Ce lien d'activation est invalide ou a expiré.">
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-[#c2554f]/40 bg-[#c2554f]/[0.12] px-3.5 py-3 text-sm text-[#eab1ad]">
          <ExclamationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Rapprochez-vous du Secrétariat Général pour obtenir un nouveau lien d'activation.</span>
        </div>
        <div className="mt-7 border-t border-white/10 pt-5 text-sm text-white/50">
          <a href="/" className="font-medium text-or-2 underline-offset-4 transition hover:text-or-3 hover:underline">Retour à la connexion</a>
        </div>
      </AuthLayout>
    );
  }

  if (etat === "succes") {
    return (
      <AuthLayout {...base} titre="Compte activé" sousTitre="Votre espace est prêt.">
        <div className="flex items-start gap-2.5 rounded-lg border border-vert/40 bg-vert/[0.12] px-3.5 py-3 text-sm text-[#a7d7b4]">
          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Votre mot de passe a été enregistré. Vous pouvez maintenant vous connecter à votre espace.</span>
        </div>
        <a href="/" className="mt-6 inline-block">
          <Button variant="or" className="!rounded-lg !py-2.5 !text-sm">Se connecter <ArrowRightIcon className="h-4 w-4" /></Button>
        </a>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...base} titre="Activez votre espace" sousTitre={compte ? `Bienvenue ${compte.nom} — définissez votre mot de passe.` : "Définissez votre mot de passe."}>
      <form onSubmit={soumettre} noValidate className="space-y-4">
        {erreur && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-[#c2554f]/40 bg-[#c2554f]/[0.12] px-3.5 py-3 text-sm text-[#eab1ad]">
            <ExclamationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erreur}</span>
          </div>
        )}
        {compte?.email && (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/55">
            Identifiant : <span className="text-white/80">{compte.email}</span>
          </div>
        )}
        <Field
          id="activation-password"
          label="Nouveau mot de passe"
          icon={LockClosedIcon}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          autoComplete="new-password"
          placeholder="••••••••"
          hint="8 caractères minimum"
        />
        <Field
          id="activation-confirme"
          label="Confirmer le mot de passe"
          icon={LockClosedIcon}
          type="password"
          value={confirme}
          onChange={(e) => setConfirme(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="••••••••"
        />
        <Button type="submit" variant="or" loading={loading} className="!w-full justify-center !rounded-lg !py-2.5 !text-sm">
          Activer mon compte <ArrowRightIcon className="h-4 w-4" />
        </Button>
      </form>
    </AuthLayout>
  );
}

ActivationCompte.propTypes = { token: PropTypes.string.isRequired };

export default ActivationCompte;
