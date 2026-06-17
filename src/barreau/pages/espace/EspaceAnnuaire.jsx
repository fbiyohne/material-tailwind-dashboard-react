import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon, BookOpenIcon, EnvelopeIcon, PhoneIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, useToast, TableSkeleton, ErrorState, EmptyState } from "../../components";
import { QUALITE_LABEL } from "../../data/derivations";
import { getEspaceAnnuaire } from "../../api/resources";

/** Espace avocat — annuaire des confrères (lecture seule, coordonnées pro). */
export function EspaceAnnuaire() {
  const toast = useToast();
  const [membres, setMembres] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [recherche, setRecherche] = useState("");

  const charger = () => {
    setErreur(false);
    getEspaceAnnuaire().then(setMembres).catch((e) => { setErreur(true); toast.error(e.message); });
  };
  useEffect(() => { charger(); /* eslint-disable-line */ }, []);

  const lignes = useMemo(() => {
    if (!membres) return [];
    const q = recherche.trim().toLowerCase();
    return membres.filter((m) => !q || m.nom.toLowerCase().includes(q) || (m.cabinet ?? "").toLowerCase().includes(q));
  }, [membres, recherche]);

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="L'annuaire n'a pas pu être chargé." onRetry={charger} /></div>;
  if (!membres) return <div className="bpn-card p-6"><TableSkeleton rows={6} cols={3} /></div>;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mon espace" titre="Annuaire du Barreau" sousTitre="Coordonnées professionnelles de vos consœurs et confrères inscrits." />

      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher par nom ou cabinet…" className="bpn-input pl-9" />
      </div>

      <div className="bpn-card">
        <div className="bpn-card-header">
          <span className="bpn-card-heading">Annuaire — Barreau de Pointe-Noire</span>
          <span className="font-mono text-xs text-gris">{lignes.length}</span>
        </div>
        {lignes.length === 0 ? (
          <div className="p-4"><EmptyState icon={BookOpenIcon} title="Aucun confrère trouvé" description="Essayez un autre nom ou cabinet." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grisL text-left text-[11px] uppercase tracking-wide text-gris">
                  <th className="px-4 py-2.5 font-medium">Identité</th>
                  <th className="px-4 py-2.5 font-medium">Titre</th>
                  <th className="px-4 py-2.5 font-medium">Cabinet</th>
                  <th className="px-4 py-2.5 font-medium">N° d'inscription</th>
                  <th className="px-4 py-2.5 font-medium">Téléphone</th>
                  <th className="px-4 py-2.5 font-medium">E-mail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grisL">
                {lignes.map((m) => (
                  <tr key={m.id} className="hover:bg-grisL/40">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-encre">Me {m.nom}</td>
                    <td className="px-4 py-2.5"><Badge ton="bleu" dot={false}>{QUALITE_LABEL[m.qualite] ?? m.qualite}</Badge></td>
                    <td className="px-4 py-2.5 text-gris">{m.cabinet || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-or">{m.numInscription || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {m.tel ? <a href={`tel:${m.tel}`} className="inline-flex items-center gap-1 font-mono text-xs text-gris transition hover:text-navy"><PhoneIcon className="h-3.5 w-3.5" />{m.tel}</a> : <span className="text-gris">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {m.email ? <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 text-xs text-navy transition hover:underline"><EnvelopeIcon className="h-3.5 w-3.5" />{m.email}</a> : <span className="text-gris">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default EspaceAnnuaire;
