import { useMemo, useState } from "react";
import { MagnifyingGlassIcon, ArrowDownTrayIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { StatutBadge } from "../components";
import { useBarreau } from "../store/BarreauStore";

export function Annuaire() {
  const { membres } = useBarreau();
  const [mode, setMode] = useState("public"); // public | interne
  const [recherche, setRecherche] = useState("");

  const interne = mode === "interne";

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return membres
      .filter((m) => m.qualite !== "stagiaire")
      .filter((m) => (!q ? true : m.nom.toLowerCase().includes(q) || m.cabinet.toLowerCase().includes(q)));
  }, [membres, recherche]);

  const exporterCSV = () => {
    const entete = interne ? ["Nom", "Cabinet", "Téléphone", "Email", "Statut"] : ["Nom", "Cabinet", "Statut"];
    const rows = lignes.map((m) =>
      interne ? [`Me ${m.nom}`, m.cabinet, m.tel, m.email, m.statut] : [`Me ${m.nom}`, m.cabinet, m.statut]
    );
    const csv = [entete, ...rows].map((l) => l.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `annuaire-${mode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="bpn-no-print flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="bpn-eyebrow">Documents</div>
          <h2 className="bpn-title mt-2">Annuaire du Barreau</h2>
          <p className="mt-1 text-sm text-gris">
            Annuaire {interne ? "interne (avec coordonnées)" : "public"} des avocats inscrits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-grisM p-0.5">
            {["public", "interne"].map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`rounded px-3 py-1 text-xs capitalize transition ${mode === m ? "bg-navy text-white" : "text-gris hover:text-encre"}`}>
                {m}
              </button>
            ))}
          </div>
          <button className="bpn-btn bpn-btn-ghost !py-1.5 text-[11px]" onClick={() => window.print()}>
            <PrinterIcon className="h-4 w-4" /> Imprimer
          </button>
          <button className="bpn-btn bpn-btn-or !py-1.5 text-[11px]" onClick={exporterCSV}>
            <ArrowDownTrayIcon className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-[9px] uppercase tracking-[0.1em] text-white/90">
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
      </div>
    </div>
  );
}

export default Annuaire;
