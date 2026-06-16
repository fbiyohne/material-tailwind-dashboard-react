import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { NavLink, useLocation } from "react-router-dom";
import { XMarkIcon, ScaleIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { sectionsPourRole } from "../routes";
import { useAuth } from "../auth/AuthContext";
import { getCotisations, listerDossiers, getMessagerieNonLus } from "../api/resources";
import { EXERCICE_COURANT } from "../data/dashboard-data";

const initiales = (nom) => {
  const parts = (nom ?? "").replace(/^Me\s+/i, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "?";
};

const ROLE_LABEL = {
  SECRETAIRE_GENERAL: "Secrétaire Général",
  BATONNIER: "Bâtonnier",
  TRESORIERE: "Trésorière",
  ADMIN: "Administrateur",
};

/**
 * Sidebar institutionnelle marine & or — version raffinée.
 * Identité : emblème (balance) + filet or. Lisibilité renforcée (contraste
 * conforme WCAG AA). Élément actif : liseré or + fond teinté + libellé or.
 * Pied : carte d'identité de l'utilisateur (rôle). Off-canvas sur mobile.
 */
export function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const sections = sectionsPourRole(user?.role); // RBAC : menu filtré par rôle.

  // Pastilles de notification calculées sur des données réelles (et non codées
  // en dur) : cotisations impayées de l'exercice courant et dossiers
  // disciplinaires actifs, selon les droits du rôle.
  const [badges, setBadges] = useState({});
  useEffect(() => {
    const role = user?.role;
    if (!role) return undefined;
    let actif = true;
    if (["SECRETAIRE_GENERAL", "TRESORIERE"].includes(role)) {
      getCotisations(EXERCICE_COURANT)
        .then((lignes) => actif && setBadges((b) => ({ ...b, "/cotisations": lignes.filter((l) => l.statut === "retard" || l.statut === "partiel").length })))
        .catch(() => {});
    }
    if (["SECRETAIRE_GENERAL", "BATONNIER"].includes(role)) {
      listerDossiers()
        .then((ds) => actif && setBadges((b) => ({ ...b, "/discipline": ds.filter((d) => d.statut !== "classe").length })))
        .catch(() => {});
    }
    return () => { actif = false; };
  }, [user?.role]);

  // Pastille de messagerie côté administration — rafraîchie à chaque navigation
  // (donc après lecture d'un fil) et par sondage léger (30 s) pour rester vivante.
  useEffect(() => {
    if (!["SECRETAIRE_GENERAL", "BATONNIER", "TRESORIERE", "ADMIN"].includes(user?.role)) return undefined;
    let actif = true;
    const charger = () => getMessagerieNonLus().then((d) => actif && setBadges((b) => ({ ...b, "/messagerie": d.total }))).catch(() => {});
    charger();
    const t = setInterval(charger, 30000);
    return () => { actif = false; clearInterval(t); };
  }, [user?.role, location.pathname]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-navy-3/60 xl:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-navy-3 transition-transform duration-300 xl:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          backgroundImage:
            "radial-gradient(120% 60% at 50% 0%, rgba(196,153,10,0.06) 0%, transparent 55%)",
        }}
      >
        {/* Filet or supérieur */}
        <div className="h-px shrink-0 bg-gradient-to-r from-transparent via-or/50 to-transparent" />

        {/* Bloc logo + emblème */}
        <div className="relative flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 pb-4 pt-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-or/40 bg-navy-2 shadow-[0_0_0_3px_rgba(196,153,10,0.06)]">
            <ScaleIcon className="h-5 w-5 text-or-2" />
          </div>
          <div className="min-w-0">
            <div className="mb-0.5 text-[9px] font-medium uppercase tracking-[0.24em] text-or/80">
              République du Congo
            </div>
            <div className="font-display text-[15px] font-semibold leading-[1.15] text-white">
              Barreau de Pointe-Noire
            </div>
            <div className="mt-0.5 text-[11px] tracking-wide text-white/45">Secrétariat Général</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-4 text-white/50 hover:text-white xl:hidden"
            aria-label="Fermer le menu"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3" aria-label="Navigation principale">
          {sections.map((section) => (
            <div key={section.label} className="px-2">
              <div className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-or/60">
                {section.label}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group relative mb-0.5 flex items-center gap-3 rounded-md px-3 py-[9px] text-[13.5px] transition-all duration-150 ${
                        isActive
                          ? "bg-or/[0.12] font-medium text-or-2"
                          : "text-white/75 hover:bg-white/[0.05] hover:text-white"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Liseré or de l'élément actif */}
                        <span
                          className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-or transition-opacity ${
                            isActive ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <Icon
                          className={`h-[18px] w-[18px] shrink-0 ${
                            isActive ? "text-or-2" : "text-white/60 group-hover:text-white/90"
                          }`}
                        />
                        <span className="truncate">{item.name}</span>
                        {badges[item.path] > 0 && (
                          <span className="ml-auto flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-rouge px-1 text-[10px] font-semibold text-white">
                            {badges[item.path]}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Carte d'identité utilisateur + déconnexion */}
        <div className="shrink-0 border-t border-white/[0.08] p-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2.5">
            <NavLink
              to="/profil"
              onClick={onClose}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded transition hover:opacity-90"
              title="Mon profil"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-or/30 bg-or/15 text-xs font-semibold text-or-2">
                {initiales(user?.nom)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-white/90">{user?.nom}</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-or/70">
                  {ROLE_LABEL[user?.role] ?? user?.role}
                </div>
              </div>
            </NavLink>
            <button
              type="button"
              onClick={logout}
              className="shrink-0 text-white/40 transition hover:text-rouge"
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

Sidebar.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
};

export default Sidebar;
