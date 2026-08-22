import { useEffect, useMemo, useState } from "react";
import { CheckIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useToast } from "./Toast";
import { TableSkeleton } from "./Skeleton";
import { ErrorState } from "./ErrorState";
import { getRbac, majRbacRole } from "../api/resources";

/**
 * Matrice de rôles × modules — éditable. SG et Administrateur conservent un accès
 * complet non modifiable. Chaque ligne de rôle s'enregistre indépendamment.
 */
export function MatriceAcces() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [matrice, setMatrice] = useState({}); // { role: Set(perm) } local, éditable
  const [enregistrement, setEnregistrement] = useState(null); // rôle en cours

  const charger = () => {
    setErreur(false);
    getRbac()
      .then((d) => {
        setData(d);
        setMatrice(Object.fromEntries(d.rolesEditables.map((r) => [r.cle, new Set(d.matrice[r.cle] ?? [])])));
      })
      .catch(() => setErreur(true));
  };
  useEffect(() => { charger(); /* eslint-disable-line */ }, []);

  const initiale = useMemo(
    () => (data ? Object.fromEntries(data.rolesEditables.map((r) => [r.cle, new Set(data.matrice[r.cle] ?? [])])) : {}),
    [data]
  );
  const modifie = (role) => {
    const a = matrice[role], b = initiale[role];
    if (!a || !b || a.size !== b.size) return true;
    for (const p of a) if (!b.has(p)) return true;
    return false;
  };

  const basculer = (role, perm) => {
    setMatrice((m) => {
      const s = new Set(m[role]);
      s.has(perm) ? s.delete(perm) : s.add(perm);
      return { ...m, [role]: s };
    });
  };

  const enregistrer = async (role) => {
    setEnregistrement(role);
    try {
      await majRbacRole(role, [...matrice[role]]);
      toast.success("Permissions mises à jour.");
      // Rafraîchit la référence (état « propre ») sans recharger toute la page.
      setData((d) => ({ ...d, matrice: { ...d.matrice, [role]: [...matrice[role]] } }));
    } catch (e) { toast.error(e.message); } finally { setEnregistrement(null); }
  };

  if (erreur) return <ErrorState title="Indisponible" description="La matrice des accès n'a pas pu être chargée." onRetry={charger} />;
  if (!data) return <TableSkeleton rows={6} cols={5} />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gris">
        Cochez les modules accessibles à chaque profil. Le <strong className="text-encre">Secrétaire Général</strong> et
        l'<strong className="text-encre">Administrateur</strong> disposent d'un accès complet, non modifiable.
        Les actions sensibles (émissions, validations, suppressions) restent réservées aux profils habilités.
      </p>

      <div className="overflow-x-auto rounded-lg border border-grisM">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-navy text-left text-2xs uppercase tracking-wide text-white/90">
              <th className="sticky left-0 z-10 bg-navy px-3 py-2.5 font-medium">Profil</th>
              {data.permissions.map((p) => (
                <th key={p.cle} className="px-2 py-2.5 text-center font-medium" title={p.description}>{p.libelle}</th>
              ))}
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {/* Rôles à accès complet (lecture seule) */}
            {data.rolesComplet.map((r) => (
              <tr key={r.cle} className="border-b border-grisL bg-vertL/30">
                <td className="sticky left-0 z-10 bg-vertL/60 px-3 py-2.5 font-medium text-encre">{r.libelle}</td>
                <td colSpan={data.permissions.length} className="px-3 py-2.5 text-xs text-vert">
                  <span className="inline-flex items-center gap-1.5"><ShieldCheckIcon className="h-4 w-4" /> Accès complet (non modifiable)</span>
                </td>
                <td />
              </tr>
            ))}
            {/* Rôles éditables */}
            {data.rolesEditables.map((r) => (
              <tr key={r.cle} className="border-b border-grisL hover:bg-grisL/40">
                <td className="sticky left-0 z-10 bg-white px-3 py-2.5 font-medium text-encre">{r.libelle}</td>
                {data.permissions.map((p) => (
                  <td key={p.cle} className="px-2 py-2.5 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-navy"
                      aria-label={`${r.libelle} — ${p.libelle}`}
                      checked={matrice[r.cle]?.has(p.cle) ?? false}
                      onChange={() => basculer(r.cle, p.cle)}
                    />
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => enregistrer(r.cle)}
                    disabled={!modifie(r.cle) || enregistrement === r.cle}
                    className="bpn-btn bpn-btn-primary bpn-btn-sm disabled:opacity-40"
                  >
                    <CheckIcon className="h-3.5 w-3.5" /> {enregistrement === r.cle ? "…" : "Enregistrer"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MatriceAcces;
