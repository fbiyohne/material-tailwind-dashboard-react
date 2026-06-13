import { useState } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { allModules } from "../routes";
import Placeholder from "../pages/Placeholder";

/**
 * Ossature de l'application du Secrétariat Général :
 * sidebar institutionnelle fixe + barre supérieure + zone de contenu routée.
 */
export function BarreauLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const moduleCourant = allModules.find((m) => m.path === location.pathname);
  const titre = moduleCourant?.name ?? "Tableau de bord";

  return (
    <div className="min-h-screen bg-creme">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="xl:ml-[260px]">
        <Topbar title={titre} onOpenMenu={() => setMenuOpen(true)} />

        <main className="mx-auto max-w-container px-4 py-6 md:px-8 md:py-8">
          <Routes>
            {allModules.map(({ path, name, element }) => (
              <Route
                key={path}
                path={path}
                element={element ?? <Placeholder title={name} />}
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default BarreauLayout;
