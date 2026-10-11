import { useState } from "react";
import { CheckIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { Notice } from "./Notice";
import { useToast } from "./Toast";
import navSections from "../routes";
import { config, appliquerConfig, MODULES_OBLIGATOIRES } from "../data/config";
import { majParametres } from "../api/resources";

/**
 * Paramètres → Modules : choisit les modules affichés dans le menu latéral.
 * Masquage d'affichage seulement ; les droits restent régis par la matrice RBAC.
 */
export function ParametresModules() {
  const toast = useToast();
  const [masques, setMasques] = useState(() => new Set(config.modules?.masques ?? []));
  const [envoi, setEnvoi] = useState(false);

  const basculer = (chemin) =>
    setMasques((m) => {
      const s = new Set(m);
      s.has(chemin) ? s.delete(chemin) : s.add(chemin);
      return s;
    });

  const enregistrer = async () => {
    setEnvoi(true);
    try {
      const liste = [...masques].filter((c) => !MODULES_OBLIGATOIRES.includes(c));
      await majParametres({ modules: { masques: liste } });
      appliquerConfig({ modules: { masques: liste } });
      toast.success("Modules du menu mis à jour.");
    } catch (e) { toast.error(e.message); } finally { setEnvoi(false); }
  };

  return (
    <div className="bpn-card">
      <div className="bpn-card-header"><span className="bpn-card-heading">Modules du menu</span></div>
      <div className="space-y-5 p-5">
        <Notice ton="or" icon={LockClosedIcon}>
          Masquer un module le retire du menu pour tous les profils. Les droits d'accès restent régis par la matrice « Rôles et sécurité ».
        </Notice>
        {navSections.map((section) => (
          <div key={section.label}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gris">{section.label}</div>
            <ul className="divide-y divide-grisM rounded-md border border-grisM">
              {section.items.map((item) => {
                const fige = MODULES_OBLIGATOIRES.includes(item.path);
                const visible = fige || !masques.has(item.path);
                const Icon = item.icon;
                return (
                  <li key={item.path} className="flex items-center gap-3 px-3 py-2.5">
                    <Icon className="h-[18px] w-[18px] shrink-0 text-gris" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-encre">{item.name}</div>
                      {fige && <div className="text-xs text-gris">non désactivable : obligation de traçabilité</div>}
                    </div>
                    <input
                      type="checkbox"
                      role="switch"
                      className="h-4 w-4 shrink-0 accent-navy disabled:opacity-50"
                      aria-label={`Afficher ${item.name} dans le menu`}
                      checked={visible}
                      disabled={fige}
                      onChange={() => basculer(item.path)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="flex justify-end">
          <button className="bpn-btn bpn-btn-primary" onClick={enregistrer} disabled={envoi}>
            <CheckIcon className="h-4 w-4" /> Enregistrer les modules
          </button>
        </div>
      </div>
    </div>
  );
}

export default ParametresModules;
