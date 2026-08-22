import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { NavLink, useLocation } from "react-router-dom";
import { XMarkIcon, ArrowRightOnRectangleIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { sectionsPourUser } from "../routes";
import { Sceau } from "../components";
import { identite } from "../data/config";
import { useAuth } from "../auth/AuthContext";
import { getCotisations, listerDossiers, getMessagerieNonLus, listerToutesPieces } from "../api/resources";
import { onRealtime } from "../api/realtime";
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
  const sections = sectionsPourUser(user); // RBAC : menu filtré par permissions.

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
      listerToutesPieces("A_VERIFIER")
        .then((ps) => actif && setBadges((b) => ({ ...b, "/pieces": ps.length })))
        .catch(() => {});
    }
    return () => { actif = false; };
  }, [user?.role]);

  // Pastille de messagerie côté administration — rafraîchie à chaque navigation,
  // en temps réel (WebSocket) et par sondage léger (filet de sécurité).
  useEffect(() => {
    if (!["SECRETAIRE_GENERAL", "BATONNIER", "TRESORIERE", "ADMIN"].includes(user?.role)) return undefined;
    let actif = true;
    const charger = () => getMessagerieNonLus().then((d) => actif && setBadges((b) => ({ ...b, "/messagerie": d.total }))).catch(() => {});
    charger();
    const t = setInterval(charger, 30000);
    const off = onRealtime((evt) => { if (evt.type === "messagerie") charger(); });
    return () => { actif = false; clearInterval(t); off(); };
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

        {/* Bloc logo + emblème (source unique : Paramètres → identité/logo) */}
        <div className="relative flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 pb-4 pt-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-or/40 shadow-[0_0_0_4px_rgba(196,153,10,0.12)]">
            <Sceau size={40} />
          </div>
          <div className="min-w-0">
            <div className="mb-0.5 text-[10px] font-medium uppercase leading-tight tracking-[0.12em] text-or/80">
              République du Congo
            </div>
            <div className="font-display text-sm font-semibold leading-[1.15] text-white">
              {identite().denomination}
            </div>
            <div className="mt-0.5 text-xs tracking-wide text-white/45">Secrétariat Général</div>
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
              <div className="px-3 pb-1.5 pt-4 text-2xs font-semibold uppercase tracking-[0.18em] text-or/60">
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
                      `group relative mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 ${
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
                          <span className="ml-auto flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-rouge px-1 text-2xs font-semibold leading-none text-white">
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

        {/* Compte connecté : identité + déconnexion explicite */}
        <div className="shrink-0 space-y-2 border-t border-white/[0.08] p-3">
          <NavLink
            to="/profil"
            onClick={onClose}
            className="group flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2.5 transition hover:border-or/30 hover:bg-white/[0.07]"
            title="Voir mon profil"
          >
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-or/25 to-navy-2 text-sm font-semibold text-or-2 ring-1 ring-or/40">
                {initiales(user?.nom)}
              </div>
              {/* Indicateur de session active */}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-navy-3 bg-vert" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium leading-tight text-white">{user?.nom}</div>
              <div className="mt-1 inline-flex items-center rounded-full bg-or/[0.14] px-2 py-0.5">
                <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-or-2">
                  {ROLE_LABEL[user?.role] ?? user?.role}
                </span>
              </div>
            </div>
            <ChevronRightIcon className="h-4 w-4 shrink-0 self-center text-white/30 transition group-hover:text-or-2" />
          </NavLink>

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.07] px-3 py-2 text-xs font-medium text-white/70 transition hover:border-rouge/40 hover:bg-rouge/10 hover:text-white"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" /> Se déconnecter
          </button>
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
