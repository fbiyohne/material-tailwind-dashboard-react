import { useCallback, useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon, ArrowDownTrayIcon, PrinterIcon, BookOpenIcon } from "@heroicons/react/24/outline";
import { StatutBadge, PageHeader, DataTable } from "../components";
import { exporterExcel } from "../utils/exports";
import { listerMembres } from "../api/resources";
import { identite } from "../data/config";

export function Annuaire() {
  const [membres, setMembres] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [mode, setMode] = useState("public"); // public | interne
  const [recherche, setRecherche] = useState("");

  const charger = useCallback(() => {
    setChargement(true);
    setErreur(false);
    listerMembres()
      .then((d) => setMembres(d.items.filter((m) => m.qualite !== "stagiaire")))
      .catch(() => setErreur(true))
      .finally(() => setChargement(false));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const interne = mode === "interne";

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return membres.filter((m) => (!q ? true : m.nom.toLowerCase().includes(q) || (m.cabinet ?? "").toLowerCase().includes(q)));
  }, [membres, recherche]);

  const exporterXlsx = () => {
    const entete = interne ? ["Nom", "Cabinet", "Téléphone", "Email", "Statut"] : ["Nom", "Cabinet", "Statut"];
    const rows = lignes.map((m) =>
      interne ? [`Me ${m.nom}`, m.cabinet, m.tel, m.email, m.statut] : [`Me ${m.nom}`, m.cabinet, m.statut]
    );
    exporterExcel(`annuaire-${mode}`, [entete, ...rows], `Annuaire ${mode}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader className="bpn-no-print" eyebrow="Documents" titre="Annuaire du Barreau" sousTitre={`Annuaire ${interne ? "interne (avec coordonnées)" : "public"} des avocats inscrits.`}>
        <div className="flex rounded border border-grisM p-0.5">
          {["public", "interne"].map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`rounded px-3 py-1 text-xs capitalize transition ${mode === m ? "bg-navy text-white" : "text-gris hover:text-encre"}`}>
              {m}
            </button>
          ))}
        </div>
        <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs" onClick={() => window.print()}>
          <PrinterIcon className="h-4 w-4" /> Imprimer
        </button>
        <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs" onClick={exporterXlsx}>
          <ArrowDownTrayIcon className="h-4 w-4" /> Excel
        </button>
      </PageHeader>

      <div className="bpn-no-print relative max-w-md">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
        <input type="text" value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher par nom ou cabinet…" aria-label="Rechercher un avocat" className="bpn-input pl-9" />
      </div>

      {/* Écran : liste paginée (10/page). */}
      <div className="bpn-no-print bpn-card">
        <div className="bpn-card-header">
          <span className="bpn-card-heading">
            Annuaire {interne ? "interne" : "public"} — {identite().denomination}
          </span>
          <span className="font-mono text-xs text-gris">{lignes.length} avocats</span>
        </div>
        <DataTable
          columns={[
            { key: "nom", label: "Avocat", sortable: true, sortValue: (m) => m.nom, cell: (m) => <span className="font-medium">Me {m.nom}</span> },
            { key: "cabinet", label: "Cabinet", sortable: true, sortValue: (m) => m.cabinet, cell: (m) => <span className="text-gris">{m.cabinet}</span> },
            ...(interne ? [
              { key: "tel", label: "Téléphone", cell: (m) => <span className="font-mono text-xs text-gris">{m.tel}</span> },
              { key: "email", label: "Email", cell: (m) => <span className="text-xs text-gris">{m.email}</span> },
            ] : []),
            { key: "statut", label: "Statut", sortable: true, sortValue: (m) => m.statut, cell: (m) => <StatutBadge statut={m.statut} /> },
          ]}
          rows={lignes}
          loading={chargement}
          error={erreur}
          onRetry={charger}
          pageSize={10}
          emptyIcon={BookOpenIcon}
          emptyTitle={recherche ? "Aucun avocat trouvé" : "Annuaire vide"}
          emptyDescription={recherche ? "Aucun résultat pour cette recherche. Essayez un autre nom ou cabinet." : "Aucun avocat inscrit à afficher pour le moment."}
          initialSort={{ key: "nom", dir: "asc" }}
        />
      </div>

      {/* Impression : annuaire complet (toutes les lignes, non paginé). */}
      <div className="bpn-print-zone hidden print:block">
        <div className="mb-2 text-center font-display text-xl text-navy">
          Annuaire {interne ? "interne" : "public"} — {identite().denomination}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy text-left text-xs uppercase text-navy">
              <th className="py-1">Avocat</th>
              <th className="py-1">Cabinet</th>
              {interne && <th className="py-1">Téléphone</th>}
              {interne && <th className="py-1">Email</th>}
              <th className="py-1">Statut</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((m) => (
              <tr key={m.id} className="border-b border-grisL">
                <td className="py-1">Me {m.nom}</td>
                <td className="py-1">{m.cabinet ?? "—"}</td>
                {interne && <td className="py-1">{m.tel ?? "—"}</td>}
                {interne && <td className="py-1">{m.email ?? "—"}</td>}
                <td className="py-1">{m.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Annuaire;
