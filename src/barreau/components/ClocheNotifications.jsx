import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { BellIcon, CheckIcon } from "@heroicons/react/24/outline";
import { onRealtime } from "../api/realtime";

const dateCourteFr = (v) => new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
const horodatage = (v) => {
  const d = new Date(v);
  const j = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  const h = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${j} · ${h}`;
};

/**
 * Cloche du centre de notifications, partagée par le back-office (variante claire)
 * et l'espace avocat (variante sombre). Autonome : sondage périodique, réveil
 * temps réel (WebSocket), pastille de non-lues, marquage lu au clic + navigation.
 * `echeances` (optionnel) ajoute une section secondaire « Prochaines échéances ».
 */
export function ClocheNotifications({ api, onNaviguer, echeances = [], variante = "clair" }) {
  const [ouvert, setOuvert] = useState(false);
  const [items, setItems] = useState([]);
  const [nonLus, setNonLus] = useState(0);
  const sombre = variante === "sombre";

  const charger = useCallback(() => {
    api.charger().then((d) => { setItems(d.items ?? []); setNonLus(d.nonLus ?? 0); }).catch(() => {});
  }, [api]);

  // Chargement initial, sondage léger (filet), et réveil temps réel.
  useEffect(() => {
    charger();
    const t = setInterval(charger, 45000);
    const off = onRealtime((evt) => { if (evt.type === "notification") charger(); });
    return () => { clearInterval(t); off(); };
  }, [charger]);

  // Rafraîchit à l'ouverture, et referme sur Échap.
  useEffect(() => {
    if (!ouvert) return undefined;
    charger();
    const onKey = (e) => { if (e.key === "Escape") setOuvert(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ouvert, charger]);

  const ouvrir = (n) => {
    setOuvert(false);
    if (!n.lu) { api.marquerLu(n.id).then(charger).catch(() => {}); }
    if (n.lien) onNaviguer(n.lien);
  };

  const toutMarquer = () => { api.marquerTout().then(charger).catch(() => {}); };

  const aEcheances = echeances.length > 0;
  const rien = items.length === 0 && !aEcheances;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-label={`Notifications${nonLus > 0 ? ` — ${nonLus} non lue(s)` : ""}`}
        aria-haspopup="true"
        aria-expanded={ouvert}
        className={
          sombre
            ? "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-white/70 transition hover:bg-white/10 hover:text-white"
            : "relative flex h-9 w-9 items-center justify-center rounded-full text-navy transition hover:bg-grisL"
        }
      >
        <BellIcon className="h-5 w-5" />
        {nonLus > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rouge px-1 text-2xs font-semibold leading-none text-white ring-2 ${sombre ? "ring-navy-3" : "ring-white"}`}>
            {nonLus > 9 ? "9+" : nonLus}
          </span>
        )}
      </button>

      {ouvert && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOuvert(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-grisM bg-white text-left shadow-card">
            <div className="flex items-center justify-between border-b border-grisM px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gris">Notifications</span>
              {nonLus > 0 && (
                <button type="button" onClick={toutMarquer} className="inline-flex items-center gap-1 text-xs font-medium text-navy transition hover:text-or-fonce">
                  <CheckIcon className="h-3.5 w-3.5" /> Tout marquer comme lu
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {rien ? (
                <p className="px-3 py-6 text-center text-xs text-gris">Aucune notification.</p>
              ) : (
                <ul className="divide-y divide-grisL">
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => ouvrir(n)}
                        className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-grisL ${n.lu ? "" : "bg-or-L/40"}`}
                      >
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lu ? "bg-transparent" : "bg-or"}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-encre">{n.titre}</span>
                          <span className="block truncate text-xs text-gris">{n.message}</span>
                          <span className="mt-0.5 block font-mono text-2xs text-gris">{horodatage(n.createdAt)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {aEcheances && (
                <div className="border-t border-grisM">
                  <div className="px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-gris">Prochaines échéances</div>
                  <ul className="divide-y divide-grisL pb-1">
                    {echeances.map((e) => (
                      <li key={`${e.date}-${e.libelle}`} className="px-3 py-2">
                        <div className="text-sm text-encre">{e.libelle}</div>
                        <div className="mt-0.5 font-mono text-xs text-or-fonce">{dateCourteFr(e.date)}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

ClocheNotifications.propTypes = {
  api: PropTypes.shape({
    charger: PropTypes.func.isRequired,
    marquerLu: PropTypes.func.isRequired,
    marquerTout: PropTypes.func.isRequired,
  }).isRequired,
  onNaviguer: PropTypes.func.isRequired,
  echeances: PropTypes.array,
  variante: PropTypes.oneOf(["clair", "sombre"]),
};

export default ClocheNotifications;
