import { Routes, Route, Navigate, NavLink } from "react-router-dom";
import {
  ArrowRightOnRectangleIcon, HomeIcon, FolderIcon, BookOpenIcon,
  BuildingLibraryIcon, MegaphoneIcon, ArchiveBoxIcon, ScaleIcon,
} from "@heroicons/react/24/outline";
import { Sceau } from "../components";
import { useAuth } from "../auth/AuthContext";
import MaSituation from "../pages/espace/MaSituation";
import MesDocuments from "../pages/espace/MesDocuments";
import EspaceAnnuaire from "../pages/espace/EspaceAnnuaire";
import EspaceAssemblees from "../pages/espace/EspaceAssemblees";
import EspacePublications from "../pages/espace/EspacePublications";
import EspaceArchives from "../pages/espace/EspaceArchives";
import EspaceDiscipline from "../pages/espace/EspaceDiscipline";

const NAV = [
  { to: "/", label: "Ma situation", icon: HomeIcon, end: true },
  { to: "/documents", label: "Mes documents", icon: FolderIcon, end: false },
  { to: "/annuaire", label: "Annuaire", icon: BookOpenIcon, end: false },
  { to: "/assemblees", label: "Assemblées", icon: BuildingLibraryIcon, end: false },
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
  return (
    <div className="min-h-screen bg-creme">
      <header className="bg-navy-3 text-white">
        <div className="mx-auto flex max-w-container items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-full bg-white p-1.5"><Sceau size={36} /></div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-or-2">Barreau de Pointe-Noire</div>
              <div className="font-display text-base leading-tight">Espace avocat</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/70 sm:inline">{user?.nom}</span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" /> Se déconnecter
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-container gap-1 overflow-x-auto px-4 md:px-8">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition ${
                  isActive ? "border-or text-white" : "border-transparent text-white/55 hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-container px-4 py-6 md:px-8 md:py-8">
        <Routes>
          <Route path="/" element={<MaSituation />} />
          <Route path="/documents" element={<MesDocuments />} />
          <Route path="/annuaire" element={<EspaceAnnuaire />} />
          <Route path="/assemblees" element={<EspaceAssemblees />} />
          <Route path="/publications" element={<EspacePublications />} />
          <Route path="/archives" element={<EspaceArchives />} />
          <Route path="/discipline" element={<EspaceDiscipline />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default EspaceAvocatLayout;
