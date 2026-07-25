import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon, BookOpenIcon, EnvelopeIcon, PhoneIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, DataTable, useToast } from "../../components";
import { QUALITE_LABEL } from "../../data/derivations";
import { getEspaceAnnuaire } from "../../api/resources";

/** Espace avocat — annuaire des confrères (lecture seule, coordonnées pro). */
export function EspaceAnnuaire() {
  const toast = useToast();
  const [membres, setMembres] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [recherche, setRecherche] = useState("");

  const charger = () => {
    setChargement(true);
    setErreur(false);
    getEspaceAnnuaire().then(setMembres).catch((e) => { setErreur(true); toast.error(e.message); }).finally(() => setChargement(false));
  };
  useEffect(() => { charger(); /* eslint-disable-line */ }, []);

  const lignes = useMemo(() => {
    if (!membres) return [];
    const q = recherche.trim().toLowerCase();
    return membres.filter((m) => !q || m.nom.toLowerCase().includes(q) || (m.cabinet ?? "").toLowerCase().includes(q));
  }, [membres, recherche]);

  const colonnes = [
    { key: "identite", label: "Identité", sortable: true, sortValue: (m) => m.nom.toLowerCase(),
      cell: (m) => <span className="font-medium text-encre">Me {m.nom}</span> },
    { key: "titre", label: "Titre", sortable: true, sortValue: (m) => m.qualite,
      cell: (m) => <Badge ton="bleu" dot={false}>{QUALITE_LABEL[m.qualite] ?? m.qualite}</Badge> },
    { key: "cabinet", label: "Cabinet", sortable: true, sortValue: (m) => (m.cabinet ?? "").toLowerCase(),
      cell: (m) => <span className="text-gris">{m.cabinet || "—"}</span> },
    { key: "num", label: "N° d'inscription",
      cell: (m) => <span className="font-mono text-xs text-or-fonce">{m.numInscription || "—"}</span> },
    { key: "tel", label: "Téléphone",
      cell: (m) => (m.tel
        ? <a href={`tel:${m.tel}`} className="inline-flex items-center gap-1 font-mono text-xs text-gris transition hover:text-navy"><PhoneIcon className="h-3.5 w-3.5" />{m.tel}</a>
        : <span className="text-gris">—</span>) },
    { key: "email", label: "E-mail",
      cell: (m) => (m.email
        ? <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 text-xs text-navy transition hover:underline"><EnvelopeIcon className="h-3.5 w-3.5" />{m.email}</a>
        : <span className="text-gris">—</span>) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mon espace" titre="Annuaire du Barreau" sousTitre="Coordonnées professionnelles de vos consœurs et confrères inscrits." />

      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher par nom ou cabinet…" aria-label="Rechercher un confrère" className="bpn-input pl-9" />
      </div>

      <div className="bpn-card">
        <DataTable
          columns={colonnes}
          rows={lignes}
          getRowId={(m) => m.id}
          loading={chargement}
          error={erreur}
          onRetry={charger}
          pageSize={12}
          libelle="confrères"
          initialSort={{ key: "identite", dir: "asc" }}
          emptyIcon={BookOpenIcon}
          emptyTitle="Aucun confrère trouvé"
          emptyDescription={recherche ? "Essayez un autre nom ou cabinet." : "L'annuaire est vide."}
        />
      </div>
    </div>
  );
}

export default EspaceAnnuaire;
