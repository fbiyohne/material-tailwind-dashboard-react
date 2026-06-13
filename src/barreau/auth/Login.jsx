import { useState } from "react";
import { ScaleIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { useAuth } from "./AuthContext";
import { Button } from "../components";

const COMPTES = [
  { email: "sg@barreau-pn.cg", role: "Secrétaire Général" },
  { email: "tresoriere@barreau-pn.cg", role: "Trésorière" },
  { email: "batonnier@barreau-pn.cg", role: "Bâtonnier" },
];

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("sg@barreau-pn.cg");
  const [password, setPassword] = useState("barreau");
  const [erreur, setErreur] = useState(null);
  const [loading, setLoading] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setErreur(err.message || "Échec de la connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-3 p-4" style={{ backgroundImage: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(196,153,10,.08) 0%, transparent 70%)" }}>
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-or/40 bg-navy-2 shadow-[0_0_0_4px_rgba(196,153,10,0.08)]">
            <ScaleIcon className="h-8 w-8 text-or-2" />
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-or">République du Congo</div>
          <h1 className="mt-1 font-display text-2xl text-white">Barreau de Pointe-Noire</h1>
          <p className="mt-1 text-xs text-white/45">Secrétariat Général — accès sécurisé</p>
        </div>

        <form onSubmit={soumettre} className="rounded-xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          {erreur && (
            <div className="mb-4 rounded border-l-[3px] border-rouge bg-rouge/10 px-3 py-2 text-sm text-rouge" role="alert">
              {erreur}
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-white/45">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bpn-input-dark" autoComplete="username" />
          </label>
          <label className="mt-4 block">
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-white/45">Mot de passe</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bpn-input-dark" autoComplete="current-password" />
          </label>

          <Button type="submit" variant="or" loading={loading} className="mt-6 w-full justify-center !py-2.5">
            Se connecter <ArrowRightIcon className="h-4 w-4" />
          </Button>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="mb-2 text-[10px] uppercase tracking-wide text-white/30">Comptes de démonstration (mdp : barreau)</div>
            <div className="flex flex-wrap gap-1.5">
              {COMPTES.map((c) => (
                <button key={c.email} type="button" onClick={() => { setEmail(c.email); setPassword("barreau"); }}
                  className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:border-or/40 hover:text-or-2">
                  {c.role}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
