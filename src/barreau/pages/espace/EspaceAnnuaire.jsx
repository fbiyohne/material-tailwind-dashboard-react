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
          <ul className="divide-y divide-grisL">
            {lignes.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-encre">Me {m.nom}</span>
                    <Badge ton="bleu" dot={false}>{QUALITE_LABEL[m.qualite] ?? m.qualite}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-gris">
                    {m.cabinet || "Cabinet non renseigné"}{m.numInscription ? ` · ${m.numInscription}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs">
                  {m.tel && <a href={`tel:${m.tel}`} className="inline-flex items-center gap-1 font-mono text-gris transition hover:text-navy"><PhoneIcon className="h-3.5 w-3.5" />{m.tel}</a>}
                  {m.email && <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 text-navy transition hover:underline"><EnvelopeIcon className="h-3.5 w-3.5" />{m.email}</a>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default EspaceAnnuaire;
