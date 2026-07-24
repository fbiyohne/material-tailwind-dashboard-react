import { useState } from "react";
import PropTypes from "prop-types";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import { importerMembres } from "../api/resources";

/** Normalise un en-tête de colonne (minuscule, sans accents ni séparateurs). */
const cle = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// Synonymes d'en-têtes acceptés → champ canonique.
const COLONNES = {
  num: ["num", "no", "numero", "numinscription", "numerodinscription", "ndinscription", "n"],
  nom: ["nom", "nometprenom", "nomprenom", "avocat", "nomcomplet"],
  qualite: ["qualite"],
  statut: ["statut", "situation"],
  cabinet: ["cabinet"],
  tel: ["tel", "telephone", "telephoneportable", "contact"],
  email: ["email", "courriel", "mail", "adresseemail"],
  rccm: ["rccm"],
  cnss: ["cnss"],
  adresse: ["adresse", "adresseprofessionnelle"],
  observations: ["observations", "observation", "remarques"],
  maitreStage: ["maitrestage", "maitredestage"],
  dateNaissance: ["datenaissance", "naissance", "datedenaissance"],
  dateInscription: ["dateinscription", "inscription", "datedinscription"],
  dateServment: ["dateserment", "serment", "prestationdeserment", "datedeserment"],
};

const LOOKUP = Object.entries(COLONNES).reduce((acc, [champ, syns]) => {
  syns.forEach((s) => { acc[s] = champ; });
  return acc;
}, {});

function mapperLigne(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const champ = LOOKUP[cle(k)];
    if (champ && v !== "" && v != null) out[champ] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

/**
 * Import du tableau du Barreau depuis un fichier .xlsx ou .csv (NFR-10).
 * Le fichier est analysé côté client puis transmis au serveur qui upsert par
 * numéro d'inscription. Colonnes reconnues : num, nom, qualité, statut, cabinet,
 * téléphone, email, rccm, cnss, adresse, observations, maître de stage, dates.
 */
export function ImportMembresModal({ open, onClose, onDone, qualiteDefaut, title, description }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [nomFichier, setNomFichier] = useState("");
  const [resume, setResume] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const reset = () => { setRows([]); setNomFichier(""); setResume(null); };

  const lireFichier = async (file) => {
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const mappees = json.map(mapperLigne).filter((r) => r.num && r.nom);
      if (mappees.length === 0) {
        toast.error("Aucune ligne valide (colonnes « num » et « nom » requises).");
        return;
      }
      setRows(mappees);
      setNomFichier(file.name);
      setResume(null);
    } catch (e) {
      toast.error(`Lecture impossible : ${e.message}`);
    }
  };

  const lancer = async () => {
    setEnCours(true);
    try {
      const r = await importerMembres(rows, qualiteDefaut);
      setResume(r);
      toast.success(`Import terminé : ${r.crees} créé(s), ${r.maj} mis à jour.`);
      onDone?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title={title || "Importer le tableau du Barreau"}
      footer={
        <>
          <button className="bpn-btn bpn-btn-ghost" onClick={() => { reset(); onClose(); }}>Fermer</button>
          <button className="bpn-btn bpn-btn-primary" disabled={rows.length === 0 || enCours} onClick={lancer}>
            {enCours ? "Import en cours…" : `Importer ${rows.length || ""} ligne${rows.length > 1 ? "s" : ""}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-gris">
          {description || (
            <>
              Sélectionnez un fichier <strong>.xlsx</strong> ou <strong>.csv</strong>. Les avocats sont mis à jour
              par numéro d'inscription (les nouveaux sont créés). Colonnes reconnues : num, nom, qualité, statut,
              cabinet, téléphone, email, rccm, cnss, adresse, observations, maître de stage, dates.
            </>
          )}
        </p>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded border-2 border-dashed border-grisM bg-grisL/40 px-4 py-6 text-sm text-gris transition hover:border-or hover:text-encre">
          <ArrowUpTrayIcon className="h-5 w-5" />
          {nomFichier || "Choisir un fichier .xlsx / .csv"}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => lireFichier(e.target.files?.[0])} />
        </label>

        {rows.length > 0 && !resume && (
          <div className="rounded border border-grisL">
            <div className="border-b border-grisL bg-grisL/50 px-3 py-2 text-xs font-medium text-encre">
              Aperçu — {rows.length} ligne(s) détectée(s)
            </div>
            <div className="max-h-44 overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-xs uppercase tracking-wide text-gris">
                  <tr><th className="px-3 py-1.5">N°</th><th className="px-3 py-1.5">Nom</th><th className="px-3 py-1.5">Qualité</th><th className="px-3 py-1.5">Statut</th></tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-t border-grisL">
                      <td className="px-3 py-1.5 font-mono text-gris">{r.num}</td>
                      <td className="px-3 py-1.5">Me {r.nom}</td>
                      <td className="px-3 py-1.5 text-gris">{r.qualite ?? (qualiteDefaut ? qualiteDefaut.toLowerCase() : "avocat")}</td>
                      <td className="px-3 py-1.5 text-gris">{r.statut ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 8 && <div className="px-3 py-1.5 text-xs text-gris">… et {rows.length - 8} autre(s).</div>}
            </div>
          </div>
        )}

        {resume && (
          <div className="rounded border border-grisL bg-grisL/40 p-3 text-sm">
            <p className="font-medium text-encre">Résultat de l'import</p>
            <ul className="mt-1 space-y-0.5 text-gris">
              <li>✅ {resume.crees} avocat(s) créé(s)</li>
              <li>♻️ {resume.maj} avocat(s) mis à jour</li>
              {resume.erreurs?.length > 0 && <li className="text-rouge">⚠️ {resume.erreurs.length} ligne(s) en erreur (ligne {resume.erreurs.map((e) => e.ligne).join(", ")})</li>}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

ImportMembresModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onDone: PropTypes.func,
  // Qualité appliquée aux lignes sans colonne « qualité » explicite (ex. "STAGIAIRE").
  qualiteDefaut: PropTypes.oneOf(["AVOCAT", "STAGIAIRE", "HONORAIRE"]),
  title: PropTypes.string,
  description: PropTypes.node,
};

export default ImportMembresModal;
