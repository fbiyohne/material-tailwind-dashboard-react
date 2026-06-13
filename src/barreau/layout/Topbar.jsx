import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import {
  Bars3Icon,
  DocumentTextIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  BellIcon,
  ReceiptPercentIcon,
  DocumentCheckIcon,
  ArchiveBoxIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { prochainesEcheances } from "../data/dashboard-data";
import { listerMembres } from "../api/resources";

const DOCS = [
  { label: "Émettre un reçu", to: "/recus", icon: ReceiptPercentIcon },
  { label: "Générer un quitus", to: "/quitus", icon: DocumentCheckIcon },
  { label: "Consulter les archives", to: "/archives", icon: ArchiveBoxIcon },
];

/**
 * Barre supérieure : titre, recherche globale (avocats), menu de génération de
 * documents, notifications (échéances) et action d'inscription.
 */
export function Topbar({ title, onOpenMenu, onAddAvocat }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(null); // "docs" | "notifs" | null
  const [membres, setMembres] = useState([]);

  useEffect(() => {
    listerMembres().then((d) => setMembres(d.items)).catch(() => {});
  }, []);

  const resultats = q.trim()
    ? membres.filter((m) => m.nom.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
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
          placeholder="Rechercher un avocat…"
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
                  <span className="font-mono text-[11px] text-gris">N° {m.num}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Menu Document */}
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
          <ul className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-grisM bg-white py-1 shadow-card">
            {DOCS.map((d) => (
              <li key={d.to}>
                <button className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-encre hover:bg-grisL" onClick={() => aller(d.to)}>
                  <d.icon className="h-4 w-4 text-gris" /> {d.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Notifications */}
      <div className="relative shrink-0">
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-navy hover:bg-grisL"
          onClick={() => setMenu(menu === "notifs" ? null : "notifs")}
          aria-label="Notifications — prochaines échéances"
          aria-haspopup="true"
          aria-expanded={menu === "notifs"}
        >
          <BellIcon className="h-5 w-5" />
          {prochainesEcheances.length > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rouge ring-2 ring-white" />
          )}
        </button>
        {menu === "notifs" && (
          <div className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-grisM bg-white shadow-card">
            <div className="border-b border-grisM px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gris">
              Prochaines échéances
            </div>
            <ul className="divide-y divide-grisL">
              {prochainesEcheances.map((e) => (
                <li key={e.libelle} className="px-3 py-2.5">
                  <div className="text-sm text-encre">{e.libelle}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-or">{e.date}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button type="button" className="bpn-btn bpn-btn-or shrink-0" onClick={onAddAvocat}>
        <PlusIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Avocat</span>
      </button>

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
