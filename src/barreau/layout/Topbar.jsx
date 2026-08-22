import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import {
  Bars3Icon,
  DocumentTextIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ReceiptPercentIcon,
  DocumentCheckIcon,
  ArchiveBoxIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { listerMembres, getAgenda, getMesNotifications, marquerNotifLue, marquerToutesNotifsLues } from "../api/resources";
import { useAuth } from "../auth/AuthContext";
import { aAcces } from "../routes";
import { ClocheNotifications } from "../components";

// API du centre de notifications back-office, transmise à la cloche partagée.
const API_NOTIFS = { charger: getMesNotifications, marquerLu: marquerNotifLue, marquerTout: marquerToutesNotifsLues };

const FINANCES = ["SECRETAIRE_GENERAL", "TRESORIERE", "ADMIN"];
const INSTITUTIONNEL = ["SECRETAIRE_GENERAL", "BATONNIER", "ADMIN"];
const DOCS = [
  { label: "Émettre un reçu", to: "/recus", icon: ReceiptPercentIcon, roles: FINANCES },
  { label: "Générer un quitus", to: "/quitus", icon: DocumentCheckIcon, roles: FINANCES },
  { label: "Consulter les archives", to: "/archives", icon: ArchiveBoxIcon, roles: INSTITUTIONNEL },
];

/**
 * Barre supérieure : titre, recherche globale (avocats), menu de génération de
 * documents, notifications (échéances) et action d'inscription.
 */
export function Topbar({ title, onOpenMenu, onAddAvocat }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(null); // "docs" | null
  const [membres, setMembres] = useState([]);
  const [echeances, setEcheances] = useState([]);
  const docs = DOCS.filter((d) => aAcces(d, user)); // RBAC : raccourcis filtrés.

  useEffect(() => {
    listerMembres().then((d) => setMembres(d.items)).catch(() => {});
    // Échéances réelles (réunions + AG à venir) via l'agenda — même source que le dashboard.
    getAgenda().then(setEcheances).catch(() => {});
  }, []);

  // Fermeture des menus déroulants au clavier (Échap), en complément du clic extérieur.
  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setMenu(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  // Navigation clavier du menu « Document » (sémantique ARIA menu / menuitem) :
  // à l'ouverture, le focus entre sur le 1er item ; ↑/↓/Début/Fin le déplacent.
  const docsMenuRef = useRef(null);
  useEffect(() => {
    if (menu === "docs") docsMenuRef.current?.querySelector('[role="menuitem"]')?.focus();
  }, [menu]);
  const onMenuKeyDown = (e) => {
    const items = Array.from(e.currentTarget.querySelectorAll('[role="menuitem"]'));
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); items[items.length - 1]?.focus(); }
  };

  const resultats = q.trim()
    ? membres.filter((m) => {
        const s = q.trim().toLowerCase();
        return m.nom.toLowerCase().includes(s)
          || (m.cabinet ?? "").toLowerCase().includes(s)
          || (m.numInscription ?? "").toLowerCase().includes(s)
          || String(m.num ?? "").includes(s);
      }).slice(0, 6)
    : [];

  const aller = (path) => { setMenu(null); setQ(""); navigate(path); };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-grisM bg-white/95 px-4 backdrop-blur md:px-6">
      <button type="button" onClick={onOpenMenu} className="text-navy hover:text-or xl:hidden" aria-label="Ouvrir le menu">
        <Bars3Icon className="h-6 w-6" />
      </button>

      <h1 className="hidden shrink-0 truncate font-display text-lg text-navy sm:block">{title}</h1>

      {/* Recherche globale */}
      <div className="relative mx-auto w-full max-w-sm">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un avocat (nom, n°, cabinet)…"
          className="bpn-input !py-1.5 pl-9 text-sm"
          aria-label="Recherche globale"
        />
        {resultats.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-grisM bg-white shadow-card">
            {resultats.map((m) => (
              <li key={m.id}>
                <button
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-grisL"
                  onClick={() => aller(`/avocats/${m.id}`)}
                >
                  <span className="font-medium text-encre">Me {m.nom}</span>
                  <span className="font-mono text-xs text-gris">N° {m.num}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Menu Document */}
      {docs.length > 0 && (
      <div className="relative shrink-0">
        <button
          className="bpn-btn bpn-btn-ghost"
          onClick={() => setMenu(menu === "docs" ? null : "docs")}
          aria-haspopup="menu"
          aria-expanded={menu === "docs"}
        >
          <DocumentTextIcon className="h-4 w-4" />
          <span className="hidden md:inline">Document</span>
          <ChevronDownIcon className="hidden h-3 w-3 md:inline" />
        </button>
        {menu === "docs" && (
          <ul ref={docsMenuRef} role="menu" aria-label="Génération de documents" onKeyDown={onMenuKeyDown} className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-grisM bg-white py-1 shadow-card">
            {docs.map((d) => (
              <li key={d.to} role="none">
                <button role="menuitem" className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-encre hover:bg-grisL focus:bg-grisL focus:outline-none" onClick={() => aller(d.to)}>
                  <d.icon className="h-4 w-4 text-gris" /> {d.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      )}

      {/* Centre de notifications (alertes in-app + prochaines échéances) */}
      <ClocheNotifications api={API_NOTIFS} onNaviguer={navigate} echeances={echeances} variante="clair" />

      {onAddAvocat && (
        <button type="button" className="bpn-btn bpn-btn-primary shrink-0" onClick={onAddAvocat}>
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Avocat</span>
        </button>
      )}

      {/* Voile de fermeture des menus */}
      {menu && <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} aria-hidden="true" />}
    </header>
  );
}

Topbar.propTypes = {
  title: PropTypes.string,
  onOpenMenu: PropTypes.func,
  onAddAvocat: PropTypes.func,
};

export default Topbar;
