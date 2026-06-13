import BarreauLayout from "@/barreau/layout/BarreauLayout";
import { BarreauProvider } from "@/barreau/store/BarreauStore";

/**
 * Application de gestion du Secrétariat Général du Barreau de Pointe-Noire.
 * Le store partage les membres, cotisations et reçus entre tous les modules ;
 * le layout institutionnel gère le routage des 15 modules.
 */
function App() {
  return (
    <BarreauProvider>
      <BarreauLayout />
    </BarreauProvider>
  );
}

export default App;
