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
  Cog6ToothIcon,
  UserGroupIcon,
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
import Parametres from "./pages/Parametres";
import Utilisateurs from "./pages/Utilisateurs";
import Profil from "./pages/Profil";
import AvocatDetail from "./pages/AvocatDetail";
import DossierDetail from "./pages/DossierDetail";
import ReunionDetail from "./pages/ReunionDetail";
import AssembleeDetail from "./pages/AssembleeDetail";
import PublicationDetail from "./pages/PublicationDetail";

// Groupes de rôles (RBAC). Un item sans `roles` est visible par tous.
const INSTITUTIONNEL = ["SECRETAIRE_GENERAL", "BATONNIER", "ADMIN"]; // hors finances (RG-15)
const FINANCES = ["SECRETAIRE_GENERAL", "TRESORIERE", "ADMIN"]; // données financières (RG-15)
const SYSTEME = ["SECRETAIRE_GENERAL", "ADMIN"]; // configuration & comptes

/**
 * Arborescence des 16 modules du Secrétariat Général, groupés comme la maquette.
 * Chaque item porte les `roles` autorisés (RBAC) : la sidebar et le routeur les
 * filtrent. L'ADMIN a toujours accès (cf. utilitaire `aAcces`).
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
      { name: "Avocats inscrits", path: "/avocats", icon: UsersIcon, roles: INSTITUTIONNEL, element: <Avocats /> },
      { name: "Avocats stagiaires", path: "/stagiaires", icon: AcademicCapIcon, roles: INSTITUTIONNEL, element: <Stagiaires /> },
      { name: "Corps électoral", path: "/corps-electoral", icon: CheckBadgeIcon, roles: INSTITUTIONNEL, element: <CorpsElectoral /> },
    ],
  },
  {
    label: "Finances",
    items: [
      { name: "Cotisations", path: "/cotisations", icon: BanknotesIcon, roles: FINANCES, element: <Cotisations /> },
      { name: "Quitus", path: "/quitus", icon: DocumentCheckIcon, roles: FINANCES, element: <Quitus /> },
      { name: "Reçus de paiement", path: "/recus", icon: ReceiptPercentIcon, roles: FINANCES, element: <Recus /> },
      { name: "Droits de plaidoirie", path: "/droits-plaidoirie", icon: CurrencyDollarIcon, roles: FINANCES, element: <DroitsPlaidoirie /> },
    ],
  },
  {
    label: "Institutionnel",
    items: [
      { name: "Réunions", path: "/reunions", icon: CalendarDaysIcon, roles: INSTITUTIONNEL, element: <Reunions /> },
      { name: "Assemblées générales", path: "/assemblees", icon: BuildingLibraryIcon, roles: INSTITUTIONNEL, element: <Assemblees /> },
      { name: "Discipline", path: "/discipline", icon: ScaleIcon, roles: INSTITUTIONNEL, element: <Discipline /> },
    ],
  },
  {
    label: "Documents",
    items: [
      { name: "Archives", path: "/archives", icon: ArchiveBoxIcon, roles: INSTITUTIONNEL, element: <Archives /> },
      { name: "Annuaire", path: "/annuaire", icon: BookOpenIcon, element: <Annuaire /> },
      { name: "Publications", path: "/publications", icon: MegaphoneIcon, roles: INSTITUTIONNEL, element: <Publications /> },
      { name: "Lettre du Bâtonnier", path: "/lettre-batonnier", icon: NewspaperIcon, roles: INSTITUTIONNEL, element: <LettreBatonnier /> },
    ],
  },
  {
    label: "Système",
    items: [
      { name: "Paramètres", path: "/parametres", icon: Cog6ToothIcon, roles: SYSTEME, element: <Parametres /> },
      { name: "Utilisateurs", path: "/utilisateurs", icon: UserGroupIcon, roles: SYSTEME, element: <Utilisateurs /> },
    ],
  },
];

/** Un rôle a-t-il accès à un item ? (ADMIN toujours autorisé ; item sans `roles` = public.) */
export const aAcces = (item, role) => !item.roles || role === "ADMIN" || item.roles.includes(role);

/** Sections filtrées pour un rôle (sections vides retirées). */
export const sectionsPourRole = (role) =>
  navSections
    .map((s) => ({ ...s, items: s.items.filter((i) => aAcces(i, role)) }))
    .filter((s) => s.items.length > 0);

/** Liste à plat de tous les modules (pour le routage). */
export const allModules = navSections.flatMap((s) => s.items);

/**
 * Routes de détail (hors menu) — pages dédiées par entité.
 * `parent` permet d'activer le bon module dans la sidebar et le titre de la barre.
 */
export const detailRoutes = [
  { path: "/profil", element: <Profil />, parent: "/" },
  { path: "/avocats/:id", element: <AvocatDetail />, parent: "/avocats" },
  { path: "/discipline/:id", element: <DossierDetail />, parent: "/discipline" },
  { path: "/reunions/:id", element: <ReunionDetail />, parent: "/reunions" },
  { path: "/assemblees/:id", element: <AssembleeDetail />, parent: "/assemblees" },
  { path: "/publications/:id", element: <PublicationDetail />, parent: "/publications" },
];

export default navSections;
