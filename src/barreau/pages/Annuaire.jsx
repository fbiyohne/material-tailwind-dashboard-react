import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon, ArrowDownTrayIcon, PrinterIcon, BookOpenIcon } from "@heroicons/react/24/outline";
import { StatutBadge, EmptyState, useToast, PageHeader } from "../components";
import { exporterExcel } from "../utils/exports";
import { listerMembres } from "../api/resources";

export function Annuaire() {
  const toast = useToast();
  const [membres, setMembres] = useState([]);
  const [mode, setMode] = useState("public"); // public | interne
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    listerMembres().then((d) => setMembres(d.items.filter((m) => m.qualite !== "stagiaire"))).catch((e) => toast.error(e.message));
  }, [toast]);

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
        <button className="bpn-btn bpn-btn-or !py-1.5 text-xs" onClick={exporterXlsx}>
          <ArrowDownTrayIcon className="h-4 w-4" /> Excel
        </button>
      </PageHeader>

      <div className="bpn-no-print relative max-w-md">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
        <input type="text" value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher par nom ou cabinet…" className="bpn-input pl-9" />
      </div>

      <div className="bpn-print-zone bpn-card">
        <div className="bpn-card-header">
          <span className="bpn-card-heading">
            Annuaire {interne ? "interne" : "public"} — Barreau de Pointe-Noire
          </span>
          <span className="font-mono text-xs text-gris">{lignes.length} avocats</span>
        </div>
        {lignes.length === 0 ? (
          <EmptyState
            icon={BookOpenIcon}
            title={recherche ? "Aucun avocat trouvé" : "Annuaire vide"}
            description={recherche ? "Aucun résultat pour cette recherche. Essayez un autre nom ou cabinet." : "Aucun avocat inscrit à afficher pour le moment."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="bpn-table">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 font-medium">Avocat</th>
                  <th className="px-3 py-2.5 font-medium">Cabinet</th>
                  {interne && <th className="px-3 py-2.5 font-medium">Téléphone</th>}
                  {interne && <th className="px-3 py-2.5 font-medium">Email</th>}
                  <th className="px-3 py-2.5 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((m) => (
                  <tr key={m.id} className="border-b border-grisL hover:bg-grisL/60">
                    <td className="px-3 py-2.5 font-medium">Me {m.nom}</td>
                    <td className="px-3 py-2.5 text-gris">{m.cabinet}</td>
                    {interne && <td className="px-3 py-2.5 font-mono text-xs text-gris">{m.tel}</td>}
                    {interne && <td className="px-3 py-2.5 text-xs text-gris">{m.email}</td>}
                    <td className="px-3 py-2.5"><StatutBadge statut={m.statut} /></td>
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

export default Annuaire;
