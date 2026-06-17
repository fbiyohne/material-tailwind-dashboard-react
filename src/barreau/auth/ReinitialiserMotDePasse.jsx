import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { LockClosedIcon, ArrowRightIcon, ExclamationCircleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { AuthLayout } from "./AuthLayout";
import { Field } from "./Field";
import { Button } from "../components";
import { verifierResetToken, reinitialiserMdp } from "../api/resources";

/**
 * Page publique de réinitialisation du mot de passe (lien « /reinitialiser/:token »).
 * Le token (aléatoire, à durée limitée) fait foi : l'utilisateur définit un
 * nouveau mot de passe puis se reconnecte.
 */
export function ReinitialiserMotDePasse({ token }) {
  const [etat, setEtat] = useState("verification"); // verification | formulaire | invalide | succes
  const [compte, setCompte] = useState(null); // { email }
  const [password, setPassword] = useState("");
  const [confirme, setConfirme] = useState("");
  const [erreur, setErreur] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let actif = true;
    verifierResetToken(token)
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
      await reinitialiserMdp(token, password);
      setEtat("succes");
    } catch (err) {
      setErreur(err.message || "Réinitialisation impossible. Le lien est peut-être expiré.");
    } finally {
      setLoading(false);
    }
  };

  const base = {
    devise: "La probité, l'indépendance et l'honneur sont les premiers devoirs de l'avocat.",
    deviseAuteur: "Serment de l'avocat",
    eyebrow: "Accès sécurisé",
  };

  if (etat === "verification") {
    return (
      <AuthLayout {...base} titre="Réinitialisation" sousTitre="Vérification de votre lien…">
        <div className="text-sm text-white/50">Un instant…</div>
      </AuthLayout>
    );
  }

  if (etat === "invalide") {
    return (
      <AuthLayout {...base} titre="Lien invalide" sousTitre="Ce lien de réinitialisation est invalide ou a expiré.">
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-[#c2554f]/40 bg-[#c2554f]/[0.12] px-3.5 py-3 text-sm text-[#eab1ad]">
          <ExclamationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Demandez un nouveau lien depuis la page de connexion (« Mot de passe oublié ? »).</span>
        </div>
        <div className="mt-7 border-t border-white/10 pt-5 text-sm text-white/50">
          <a href="/" className="font-medium text-or-2 underline-offset-4 transition hover:text-or-3 hover:underline">Retour à la connexion</a>
        </div>
      </AuthLayout>
    );
  }

  if (etat === "succes") {
    return (
      <AuthLayout {...base} titre="Mot de passe modifié" sousTitre="Votre nouveau mot de passe est enregistré.">
        <div className="flex items-start gap-2.5 rounded-lg border border-vert/40 bg-vert/[0.12] px-3.5 py-3 text-sm text-[#a7d7b4]">
          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</span>
        </div>
        <a href="/" className="mt-6 inline-block">
          <Button variant="or" className="!rounded-lg !py-2.5 !text-sm">Se connecter <ArrowRightIcon className="h-4 w-4" /></Button>
        </a>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...base} titre="Nouveau mot de passe" sousTitre={compte?.email ? `Compte : ${compte.email}` : "Définissez votre nouveau mot de passe."}>
      <form onSubmit={soumettre} noValidate className="space-y-4">
        {erreur && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-[#c2554f]/40 bg-[#c2554f]/[0.12] px-3.5 py-3 text-sm text-[#eab1ad]">
            <ExclamationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erreur}</span>
          </div>
        )}
        <Field
          id="reset-password"
          label="Nouveau mot de passe"
          icon={LockClosedIcon}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="••••••••"
          hint="8 caractères minimum"
        />
        <Field
          id="reset-confirme"
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
          Enregistrer le mot de passe <ArrowRightIcon className="h-4 w-4" />
        </Button>
      </form>
    </AuthLayout>
  );
}

ReinitialiserMotDePasse.propTypes = { token: PropTypes.string.isRequired };

export default ReinitialiserMotDePasse;
