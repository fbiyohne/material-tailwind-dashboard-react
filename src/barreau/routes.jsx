import {
  Squares2X2Icon,
  UsersIcon,
  AcademicCapIcon,
  CheckBadgeIcon,
  BanknotesIcon,
  DocumentCheckIcon,
  ReceiptPercentIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  BuildingLibraryIcon,
  ScaleIcon,
  ArchiveBoxIcon,
  BookOpenIcon,
  MegaphoneIcon,
  NewspaperIcon,
} from "@heroicons/react/24/outline";

import Dashboard from "./pages/Dashboard";
import Cotisations from "./pages/Cotisations";
import Recus from "./pages/Recus";
import Quitus from "./pages/Quitus";
import Avocats from "./pages/Avocats";
import Stagiaires from "./pages/Stagiaires";
import CorpsElectoral from "./pages/CorpsElectoral";
import Reunions from "./pages/Reunions";
import Assemblees from "./pages/Assemblees";
import Discipline from "./pages/Discipline";
import DroitsPlaidoirie from "./pages/DroitsPlaidoirie";
import Archives from "./pages/Archives";
import Annuaire from "./pages/Annuaire";
import Publications from "./pages/Publications";
import LettreBatonnier from "./pages/LettreBatonnier";

/**
 * Arborescence des 15 modules fonctionnels du Secrétariat Général,
 * groupés exactement comme la sidebar de la maquette UI/UX.
 *
 * Étape 1 : seul le Tableau de bord possède une page complète ; les autres
 * modules pointent vers un écran « en construction » (élément par défaut).
 * Les compteurs `badge` reprennent la maquette et deviendront dynamiques en V2.
 */
export const navSections = [
  {
    label: "Tableau de bord",
    items: [
      { name: "Tableau de bord", path: "/", icon: Squares2X2Icon, element: <Dashboard /> },
    ],
  },
  {
    label: "Membres",
    items: [
      { name: "Avocats inscrits", path: "/avocats", icon: UsersIcon, element: <Avocats /> },
      { name: "Avocats stagiaires", path: "/stagiaires", icon: AcademicCapIcon, element: <Stagiaires /> },
      { name: "Corps électoral", path: "/corps-electoral", icon: CheckBadgeIcon, element: <CorpsElectoral /> },
    ],
  },
  {
    label: "Finances",
    items: [
      { name: "Cotisations", path: "/cotisations", icon: BanknotesIcon, badge: 3, element: <Cotisations /> },
      { name: "Quitus", path: "/quitus", icon: DocumentCheckIcon, element: <Quitus /> },
      { name: "Reçus de paiement", path: "/recus", icon: ReceiptPercentIcon, element: <Recus /> },
      { name: "Droits de plaidoirie", path: "/droits-plaidoirie", icon: CurrencyDollarIcon, element: <DroitsPlaidoirie /> },
    ],
  },
  {
    label: "Institutionnel",
    items: [
      { name: "Réunions", path: "/reunions", icon: CalendarDaysIcon, element: <Reunions /> },
      { name: "Assemblées générales", path: "/assemblees", icon: BuildingLibraryIcon, element: <Assemblees /> },
      { name: "Discipline", path: "/discipline", icon: ScaleIcon, badge: 2, element: <Discipline /> },
    ],
  },
  {
    label: "Documents",
    items: [
      { name: "Archives", path: "/archives", icon: ArchiveBoxIcon, element: <Archives /> },
      { name: "Annuaire", path: "/annuaire", icon: BookOpenIcon, element: <Annuaire /> },
      { name: "Publications", path: "/publications", icon: MegaphoneIcon, element: <Publications /> },
      { name: "Lettre du Bâtonnier", path: "/lettre-batonnier", icon: NewspaperIcon, element: <LettreBatonnier /> },
    ],
  },
];

/** Liste à plat de tous les modules (pour le routage). */
export const allModules = navSections.flatMap((s) => s.items);

export default navSections;
