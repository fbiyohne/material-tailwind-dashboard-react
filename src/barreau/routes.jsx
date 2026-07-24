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
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  HandRaisedIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import { lazy } from "react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Cotisations = lazy(() => import("./pages/Cotisations"));
const Recus = lazy(() => import("./pages/Recus"));
const Quitus = lazy(() => import("./pages/Quitus"));
const Avocats = lazy(() => import("./pages/Avocats"));
const Stagiaires = lazy(() => import("./pages/Stagiaires"));
const Cabinets = lazy(() => import("./pages/Cabinets"));
const Pieces = lazy(() => import("./pages/Pieces"));
const TableauOrdre = lazy(() => import("./pages/TableauOrdre"));
const CorpsElectoral = lazy(() => import("./pages/CorpsElectoral"));
const Elections = lazy(() => import("./pages/Elections"));
const Conseil = lazy(() => import("./pages/Conseil"));
const Reunions = lazy(() => import("./pages/Reunions"));
const Assemblees = lazy(() => import("./pages/Assemblees"));
const Discipline = lazy(() => import("./pages/Discipline"));
const DroitsPlaidoirie = lazy(() => import("./pages/DroitsPlaidoirie"));
const Archives = lazy(() => import("./pages/Archives"));
const Annuaire = lazy(() => import("./pages/Annuaire"));
const Publications = lazy(() => import("./pages/Publications"));
const LettreBatonnier = lazy(() => import("./pages/LettreBatonnier"));
const Parametres = lazy(() => import("./pages/Parametres"));
const Utilisateurs = lazy(() => import("./pages/Utilisateurs"));
const JournalAudit = lazy(() => import("./pages/JournalAudit"));
const Messagerie = lazy(() => import("./pages/Messagerie"));
const Profil = lazy(() => import("./pages/Profil"));
const AvocatDetail = lazy(() => import("./pages/AvocatDetail"));
const DossierDetail = lazy(() => import("./pages/DossierDetail"));
const ReunionDetail = lazy(() => import("./pages/ReunionDetail"));
const AssembleeDetail = lazy(() => import("./pages/AssembleeDetail"));
const PublicationDetail = lazy(() => import("./pages/PublicationDetail"));

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
      { name: "Personnes morales", path: "/cabinets", icon: BuildingOffice2Icon, roles: INSTITUTIONNEL, element: <Cabinets /> },
      { name: "Tableau de l'Ordre", path: "/tableau", icon: ClipboardDocumentListIcon, roles: INSTITUTIONNEL, element: <TableauOrdre /> },
      { name: "Vérification des pièces", path: "/pieces", icon: ShieldCheckIcon, roles: INSTITUTIONNEL, element: <Pieces /> },
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
      { name: "Élections", path: "/elections", icon: HandRaisedIcon, roles: INSTITUTIONNEL, element: <Elections /> },
      { name: "Conseil de l'Ordre", path: "/conseil", icon: UserGroupIcon, roles: INSTITUTIONNEL, element: <Conseil /> },
      { name: "Messagerie", path: "/messagerie", icon: ChatBubbleLeftRightIcon, roles: ["SECRETAIRE_GENERAL", "BATONNIER", "TRESORIERE"], element: <Messagerie /> },
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
      { name: "Journal d'audit", path: "/journal-audit", icon: ShieldCheckIcon, roles: INSTITUTIONNEL, element: <JournalAudit /> },
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
