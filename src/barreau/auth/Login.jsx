import { useState } from "react";
import PropTypes from "prop-types";
import { EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, ArrowRightIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "./AuthContext";
import { AuthLayout } from "./AuthLayout";
import { Field } from "./Field";
import { Button } from "../components";

const COMPTES = [
  { email: "sg@barreau-pn.cg", role: "Secrétaire Général" },
  { email: "tresoriere@barreau-pn.cg", role: "Trésorière" },
  { email: "batonnier@barreau-pn.cg", role: "Bâtonnier" },
];

export function Login({ onDemande, onOubli }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("sg@barreau-pn.cg");
  const [password, setPassword] = useState("barreau");
  const [voirMdp, setVoirMdp] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [loading, setLoading] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setErreur(err.message || "Identifiants invalides. Vérifiez votre email et votre mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      devise="La probité, l'indépendance et l'honneur sont les premiers devoirs de l'avocat."
      deviseAuteur="Serment de l'avocat"
      eyebrow="Espace sécurisé"
      titre="Connexion"
      sousTitre="Secrétariat Général — accès réservé aux membres du Conseil de l'Ordre."
      pied={
        <span>
          Pas encore d'accès ?{" "}
          <button type="button" onClick={onDemande} className="font-medium text-or-2 underline-offset-4 transition hover:text-or-3 hover:underline">
            Demander un accès
          </button>
        </span>
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
          id="login-email"
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

        <Field
          id="login-password"
          label="Mot de passe"
          icon={LockClosedIcon}
          type={voirMdp ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="••••••••"
          trailing={
            <button
              type="button"
              onClick={() => setVoirMdp((v) => !v)}
              aria-label={voirMdp ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="rounded-md p-1.5 text-white/35 transition hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-or/50"
            >
              {voirMdp ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          }
        />

        <Button type="submit" variant="or" loading={loading} className="!w-full justify-center !rounded-lg !py-2.5 !text-sm">
          Se connecter <ArrowRightIcon className="h-4 w-4" />
        </Button>

        <div className="text-right">
          <button type="button" onClick={onOubli} className="text-[12.5px] text-white/45 underline-offset-4 transition hover:text-or-2 hover:underline">
            Mot de passe oublié ?
          </button>
        </div>
      </form>

      <div className="mt-6">
        <div className="mb-2.5 text-[10px] uppercase tracking-[0.18em] text-white/30">Comptes de démonstration · mot de passe « barreau »</div>
        <div className="flex flex-wrap gap-2">
          {COMPTES.map((c) => {
            const actif = email === c.email;
            return (
              <button
                key={c.email}
                type="button"
                onClick={() => { setEmail(c.email); setPassword("barreau"); setErreur(null); }}
                className={`rounded-full border px-3 py-1.5 text-[11px] transition ${
                  actif ? "border-or/60 bg-or/15 text-or-2" : "border-white/10 bg-white/[0.03] text-white/55 hover:border-or/40 hover:text-or-2"
                }`}
              >
                {c.role}
              </button>
            );
          })}
        </div>
      </div>
    </AuthLayout>
  );
}

Login.propTypes = { onDemande: PropTypes.func, onOubli: PropTypes.func };

export default Login;
