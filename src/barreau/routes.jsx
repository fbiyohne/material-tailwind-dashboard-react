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
  TicketIcon,
} from "@heroicons/react/24/outline";
import { lazy } from "react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Cotisations = lazy(() => import("./pages/Cotisations"));
const Recus = lazy(() => import("./pages/Recus"));
const Quitus = lazy(() => import("./pages/Quitus"));
const Timbres = lazy(() => import("./pages/Timbres"));
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
      { name: "Avocats inscrits", path: "/avocats", icon: UsersIcon, perm: "membres", element: <Avocats /> },
      { name: "Avocats stagiaires", path: "/stagiaires", icon: AcademicCapIcon, perm: "membres", element: <Stagiaires /> },
      { name: "Personnes morales", path: "/cabinets", icon: BuildingOffice2Icon, perm: "membres", element: <Cabinets /> },
      { name: "Tableau de l'Ordre", path: "/tableau", icon: ClipboardDocumentListIcon, perm: "membres", element: <TableauOrdre /> },
      { name: "Vérification des pièces", path: "/pieces", icon: ShieldCheckIcon, perm: "membres", element: <Pieces /> },
      { name: "Corps électoral", path: "/corps-electoral", icon: CheckBadgeIcon, perm: "corps_electoral", element: <CorpsElectoral /> },
    ],
  },
  {
    label: "Finances",
    items: [
      { name: "Cotisations", path: "/cotisations", icon: BanknotesIcon, perm: "finances", element: <Cotisations /> },
      { name: "Quitus", path: "/quitus", icon: DocumentCheckIcon, perm: "finances", element: <Quitus /> },
      { name: "Reçus de paiement", path: "/recus", icon: ReceiptPercentIcon, perm: "finances", element: <Recus /> },
      { name: "Droits de plaidoirie", path: "/droits-plaidoirie", icon: CurrencyDollarIcon, perm: "finances", element: <DroitsPlaidoirie /> },
      { name: "Timbres de plaidoirie", path: "/timbres", icon: TicketIcon, perm: "finances", element: <Timbres /> },
    ],
  },
  {
    label: "Institutionnel",
    items: [
      { name: "Réunions", path: "/reunions", icon: CalendarDaysIcon, perm: "reunions_assemblees", element: <Reunions /> },
      { name: "Assemblées générales", path: "/assemblees", icon: BuildingLibraryIcon, perm: "reunions_assemblees", element: <Assemblees /> },
      { name: "Discipline", path: "/discipline", icon: ScaleIcon, perm: "discipline", element: <Discipline /> },
      { name: "Élections", path: "/elections", icon: HandRaisedIcon, perm: "elections", element: <Elections /> },
      { name: "Conseil de l'Ordre", path: "/conseil", icon: UserGroupIcon, perm: "elections", element: <Conseil /> },
      { name: "Messagerie", path: "/messagerie", icon: ChatBubbleLeftRightIcon, perm: "messagerie", element: <Messagerie /> },
    ],
  },
  {
    label: "Documents",
    items: [
      { name: "Archives", path: "/archives", icon: ArchiveBoxIcon, perm: "documents", element: <Archives /> },
      { name: "Annuaire", path: "/annuaire", icon: BookOpenIcon, element: <Annuaire /> },
      { name: "Publications", path: "/publications", icon: MegaphoneIcon, perm: "documents", element: <Publications /> },
      { name: "Lettre du Bâtonnier", path: "/lettre-batonnier", icon: NewspaperIcon, perm: "documents", element: <LettreBatonnier /> },
    ],
  },
  {
    label: "Système",
    items: [
      { name: "Paramètres", path: "/parametres", icon: Cog6ToothIcon, perm: "parametres", element: <Parametres /> },
      { name: "Utilisateurs", path: "/utilisateurs", icon: UserGroupIcon, perm: "utilisateurs", element: <Utilisateurs /> },
      { name: "Journal d'audit", path: "/journal-audit", icon: ShieldCheckIcon, perm: "audit", element: <JournalAudit /> },
    ],
  },
];

/**
 * L'utilisateur a-t-il accès à un item ? Basé sur la matrice de permissions :
 * ADMIN et Secrétaire Général ont tout ; un item avec `perm` exige la permission
 * correspondante ; un item avec `roles` (héritage) est vérifié par rôle ; sinon
 * public. Accepte l'objet user ({ role, permissions }) ou, en repli, un rôle seul.
 */
export const aAcces = (item, user) => {
  const u = typeof user === "string" ? { role: user } : user;
  const role = u?.role;
  if (role === "ADMIN" || role === "SECRETAIRE_GENERAL") return true;
  if (item.perm) return !!u?.permissions?.includes(item.perm);
  if (item.roles) return item.roles.includes(role);
  return true;
};

/** Sections filtrées pour un utilisateur (sections vides retirées). */
export const sectionsPourUser = (user) =>
  navSections
    .map((s) => ({ ...s, items: s.items.filter((i) => aAcces(i, user)) }))
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
