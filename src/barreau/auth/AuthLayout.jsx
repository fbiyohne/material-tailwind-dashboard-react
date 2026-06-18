import PropTypes from "prop-types";
import { Sceau } from "../components";

/** Texture guilloché — fines hachures dorées, fondues radialement (document officiel). */
function Guilloche() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="auth-hatch" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 15 H30" stroke="#C4990A" strokeWidth="0.6" />
        </pattern>
        <radialGradient id="auth-fade" cx="42%" cy="34%" r="78%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="auth-mask"><rect width="100%" height="100%" fill="url(#auth-fade)" /></mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#auth-hatch)" mask="url(#auth-mask)" />
    </svg>
  );
}

const delay = (ms) => ({ animationDelay: `${ms}ms` });

/**
 * Gabarit split-screen des pages d'authentification : panneau gauche
 * institutionnel (sceau, devise) partagé, panneau droit pour le formulaire.
 * Sous `lg`, le panneau gauche se replie en en-tête compact.
 */
export function AuthLayout({ devise, deviseAuteur, eyebrow, titre, sousTitre, children, pied }) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-navy-3 text-white lg:grid-cols-[1.04fr_1fr]">
      {/* Panneau gauche — marque institutionnelle (desktop) */}
      <aside
        className="relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between xl:p-16"
        style={{ background: "radial-gradient(125% 80% at 50% -10%, #16335f 0%, #0b1c39 52%, #081326 100%)" }}
      >
        <Guilloche />
        <div className="relative auth-reveal" style={delay(60)}>
          <div className="bpn-eyebrow !text-or-2">Ordre National des Avocats du Congo</div>
        </div>

        <div className="relative flex flex-col items-start">
          <div className="auth-reveal mb-9 rounded-full bg-white p-3 shadow-[0_10px_45px_-10px_rgba(0,0,0,0.65)]" style={delay(120)}>
            <Sceau size={92} />
          </div>
          <h1 className="auth-reveal font-display text-[2.6rem] font-semibold leading-[1.05] xl:text-[3rem]" style={delay(180)}>
            Barreau de<br />Pointe-Noire
          </h1>
          <div className="auth-reveal mt-6 h-px w-16 bg-or" style={delay(240)} />
          <blockquote className="auth-reveal mt-6 max-w-sm font-display text-[1.15rem] italic leading-relaxed text-white/70" style={delay(300)}>
            «&nbsp;{devise}&nbsp;»
          </blockquote>
          {deviseAuteur && (
            <cite className="auth-reveal mt-3 text-xs not-italic tracking-wide text-white/40" style={delay(340)}>— {deviseAuteur}</cite>
          )}
        </div>

        <div className="relative auth-reveal text-xs tracking-wide text-white/35" style={delay(400)}>
          République du Congo · Secrétariat Général du Conseil de l'Ordre
        </div>
      </aside>

      {/* Panneau droit — formulaire */}
      <main className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-[400px]">
          {/* En-tête compact (mobile) */}
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <div className="shrink-0 rounded-full bg-white p-1.5"><Sceau size={42} /></div>
            <div>
              <div className="text-2xs uppercase tracking-[0.28em] text-or-2">Ordre National des Avocats</div>
              <div className="font-display text-lg leading-tight">Barreau de Pointe-Noire</div>
            </div>
          </div>

          <div className="auth-reveal" style={delay(80)}>
            <div className="bpn-eyebrow !text-or">{eyebrow}</div>
            <h2 className="mt-3 font-display text-[1.9rem] font-semibold leading-tight">{titre}</h2>
            {sousTitre && <p className="mt-2 text-sm leading-relaxed text-white/45">{sousTitre}</p>}
          </div>

          <div className="auth-reveal mt-8" style={delay(160)}>{children}</div>

          {pied && (
            <div className="auth-reveal mt-7 border-t border-white/10 pt-5 text-sm text-white/50" style={delay(240)}>{pied}</div>
          )}
        </div>
      </main>
    </div>
  );
}

AuthLayout.propTypes = {
  devise: PropTypes.string.isRequired,
  deviseAuteur: PropTypes.string,
  eyebrow: PropTypes.string.isRequired,
  titre: PropTypes.string.isRequired,
  sousTitre: PropTypes.string,
  children: PropTypes.node,
  pied: PropTypes.node,
};

export default AuthLayout;
