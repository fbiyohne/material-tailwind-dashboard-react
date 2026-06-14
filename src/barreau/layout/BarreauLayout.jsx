import { useState } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { allModules, detailRoutes, aAcces } from "../routes";
import Placeholder from "../pages/Placeholder";
import { InscriptionModal } from "../components";
import { useAuth } from "../auth/AuthContext";

/**
 * Ossature de l'application du Secrétariat Général :
 * sidebar institutionnelle fixe + barre supérieure + zone de contenu routée.
 */
export function BarreauLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [inscription, setInscription] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const role = user?.role;
  const peutInscrire = aAcces({ roles: ["SECRETAIRE_GENERAL", "ADMIN"] }, role);

  // Titre de la barre : module exact, sinon module parent d'une page de détail.
  const moduleCourant = allModules.find((m) => m.path === location.pathname);
  const detail = detailRoutes.find((d) =>
    new RegExp(`^${d.path.replace(/:\w+/g, "[^/]+")}$`).test(location.pathname)
  );
  const parent = detail && allModules.find((m) => m.path === detail.parent);
  const titre = moduleCourant?.name ?? parent?.name ?? "Tableau de bord";

  return (
    <div className="min-h-screen bg-creme">
      <a
        href="#contenu-principal"
        className="sr-only z-[90] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded focus:bg-navy focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Aller au contenu
      </a>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="min-h-screen bg-white xl:ml-[260px]">
        <Topbar
          title={titre}
          onOpenMenu={() => setMenuOpen(true)}
          onAddAvocat={peutInscrire ? () => setInscription(true) : null}
        />

        <main id="contenu-principal" tabIndex={-1} className="mx-auto max-w-container px-4 py-6 outline-none md:px-8 md:py-8">
          <Routes>
            {allModules.map(({ path, name, element, roles }) => (
              <Route
                key={path}
                path={path}
                element={
                  aAcces({ roles }, role) ? (element ?? <Placeholder title={name} />) : <Navigate to="/" replace />
                }
              />
            ))}
            {detailRoutes.map(({ path, element }) => (
              <Route key={path} path={path} element={element} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <InscriptionModal open={inscription} onClose={() => setInscription(false)} />
    </div>
  );
}

export default BarreauLayout;
