import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import {
  ArrowRightOnRectangleIcon, HomeIcon, FolderIcon, BookOpenIcon,
  BuildingLibraryIcon, MegaphoneIcon, ArchiveBoxIcon, ScaleIcon, ChatBubbleLeftRightIcon, HandRaisedIcon,
} from "@heroicons/react/24/outline";
import { Sceau } from "../components";
import { useAuth } from "../auth/AuthContext";
import { useFocusAuChangementDeRoute } from "../hooks/useFocusAuChangementDeRoute";
import { getEspaceMessagerieNonLus } from "../api/resources";
import { onRealtime } from "../api/realtime";
const MaSituation = lazy(() => import("../pages/espace/MaSituation"));
const MesDocuments = lazy(() => import("../pages/espace/MesDocuments"));
const EspaceAnnuaire = lazy(() => import("../pages/espace/EspaceAnnuaire"));
const EspaceAssemblees = lazy(() => import("../pages/espace/EspaceAssemblees"));
const EspacePublications = lazy(() => import("../pages/espace/EspacePublications"));
const EspaceArchives = lazy(() => import("../pages/espace/EspaceArchives"));
const EspaceDiscipline = lazy(() => import("../pages/espace/EspaceDiscipline"));
const EspaceMessagerie = lazy(() => import("../pages/espace/EspaceMessagerie"));
const EspaceScrutins = lazy(() => import("../pages/espace/EspaceScrutins"));

const NAV = [
  { to: "/", label: "Ma situation", icon: HomeIcon, end: true },
  { to: "/documents", label: "Mes documents", icon: FolderIcon, end: false },
  { to: "/messagerie", label: "Messagerie", icon: ChatBubbleLeftRightIcon, end: false, badge: "messagerie" },
  { to: "/annuaire", label: "Annuaire", icon: BookOpenIcon, end: false },
  { to: "/assemblees", label: "Assemblées", icon: BuildingLibraryIcon, end: false },
  { to: "/elections", label: "Élections", icon: HandRaisedIcon, end: false },
  { to: "/publications", label: "Publications", icon: MegaphoneIcon, end: false },
  { to: "/archives", label: "Archives", icon: ArchiveBoxIcon, end: false },
  { to: "/discipline", label: "Discipline", icon: ScaleIcon, end: false },
];

/**
 * Ossature de l'espace avocat (rôle AVOCAT) : en-tête institutionnel, navigation
 * réduite et zone de contenu. Totalement distinct du back-office du Secrétariat
 * Général — un avocat n'accède qu'à ses propres données.
 */
export function EspaceAvocatLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const mainRef = useFocusAuChangementDeRoute();
  const [nonLus, setNonLus] = useState(0);

  // Pastille de messagerie : rafraîchie au changement de page (lecture incluse),
  // en temps réel (WebSocket) et par sondage léger (filet de sécurité).
  useEffect(() => {
    let actif = true;
    const charger = () => getEspaceMessagerieNonLus().then((d) => actif && setNonLus(d.total)).catch(() => {});
    charger();
    const t = setInterval(charger, 30000);
    const off = onRealtime((evt) => { if (evt.type === "messagerie") charger(); });
    // Rafraîchissement immédiat quand un fil est lu dans la page (sans changer de route).
    const surLecture = () => charger();
    window.addEventListener("bpn:messagerie-lu", surLecture);
    return () => { actif = false; clearInterval(t); off(); window.removeEventListener("bpn:messagerie-lu", surLecture); };
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-creme">
      <a
        href="#contenu-principal"
        className="sr-only z-[90] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded focus:bg-navy focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Aller au contenu
      </a>
      <header className="bg-navy-3 text-white">
        {/* En-tête sur une seule rangée : logo à gauche, menu centré au milieu,
            déconnexion à droite (le menu occupe l'espace central au lieu d'une
            deuxième barre en dessous). */}
        <div className="mx-auto flex max-w-container items-center gap-4 px-4 py-2 md:px-8">
          {/* Logo — gauche */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="shrink-0 rounded-full bg-white p-1.5"><Sceau size={36} /></div>
            <div className="hidden sm:block">
              <div className="text-2xs uppercase tracking-[0.2em] text-or-2">Barreau de Pointe-Noire</div>
              <div className="font-display text-base leading-tight">Espace avocat</div>
            </div>
          </div>

          {/* Menu — centre, réparti pour « respirer » (justify-evenly). Le nav en
              flex-1 écarte le logo (gauche) et la déconnexion (droite) aux extrémités.
              S'il ne tient pas, il passe à la ligne (flex-wrap) au lieu de défiler. */}
          <nav className="flex flex-1 flex-wrap items-center justify-evenly gap-x-1 gap-y-1">
            {NAV.map(({ to, label, icon: Icon, end, badge }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition ${
                    isActive ? "bg-white/10 font-medium text-white" : "text-white/55 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <Icon className="h-4 w-4" /> {label}
                {badge === "messagerie" && nonLus > 0 && (
                  <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rouge px-1 text-2xs font-semibold leading-none text-white">{nonLus}</span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Déconnexion — droite */}
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden max-w-[10rem] truncate text-sm text-white/70 xl:inline">{user?.nom}</span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" /> <span className="hidden sm:inline">Se déconnecter</span>
            </button>
          </div>
        </div>
      </header>

      <main ref={mainRef} id="contenu-principal" tabIndex={-1} className="mx-auto max-w-container px-4 py-6 outline-none md:px-8 md:py-8">
        {/* Suspense : pages de l'espace chargées à la demande (code-splitting). */}
        <Suspense fallback={<div className="py-16 text-center text-sm text-gris">Chargement…</div>}>
          <Routes>
            <Route path="/" element={<MaSituation />} />
            <Route path="/documents" element={<MesDocuments />} />
            <Route path="/messagerie" element={<EspaceMessagerie />} />
            <Route path="/annuaire" element={<EspaceAnnuaire />} />
            <Route path="/assemblees" element={<EspaceAssemblees />} />
            <Route path="/elections" element={<EspaceScrutins />} />
            <Route path="/publications" element={<EspacePublications />} />
            <Route path="/archives" element={<EspaceArchives />} />
            <Route path="/discipline" element={<EspaceDiscipline />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default EspaceAvocatLayout;
