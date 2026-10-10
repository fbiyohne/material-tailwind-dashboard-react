import { useState } from "react";
import PropTypes from "prop-types";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { DataTable } from "./DataTable";
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
  sexe: ["sexe", "genre", "civilite"],
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
  dateRadiation: ["dateradiation", "datederadiation", "radiation"],
  dateDeces: ["datedeces", "datededeces", "deces"],
  motifRadiation: ["motifradiation", "motifderadiation", "motif"],
};
// « N° inscription » (colonne des exports) se normalise en « ninscription » : volontairement non mappé, jamais pris pour num.

const CHAMPS_DATE = new Set(["dateNaissance", "dateInscription", "dateServment", "dateRadiation", "dateDeces"]);
// Date Excel (numéro de série) → « AAAA-MM-JJ ».
const serieVersIso = (n) => new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);

const LOOKUP = Object.entries(COLONNES).reduce((acc, [champ, syns]) => {
  syns.forEach((s) => { acc[s] = champ; });
  return acc;
}, {});

export function mapperLigne(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const champ = LOOKUP[cle(k)];
    if (!champ || v === "" || v == null) continue;
    // Le serveur attend des chaînes : nombres Excel (téléphone, série de date) convertis ici.
    if (typeof v === "number") out[champ] = CHAMPS_DATE.has(champ) ? serieVersIso(v) : champ === "num" ? v : String(v);
    else out[champ] = typeof v === "string" ? v.trim().replace(/^'(?=[=+\-@])/, "") : v; // retire l'apostrophe anti-formule posée à l'export
  }
  return out;
}

/**
 * Lignes d'une feuille sous forme d'objets { en-tête: valeur }. L'en-tête est la première ligne
 * qui contient à la fois une colonne « num » et une colonne « nom » : les exports commencent par
 * une mention de confidentialité qu'il faut sauter pour que l'aller-retour export → import fonctionne.
 */
// Décode un fichier texte : UTF-8 strict, sinon Windows-1252 (CSV d'Excel FR).
export function decoderTexte(buf) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { return new TextDecoder("windows-1252").decode(buf); }
}

export function tableauDepuisFeuille(XLSX, ws) {
  const lignes = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
  const i = lignes.findIndex((r) => { const c = r.map((x) => LOOKUP[cle(x)]); return c.includes("num") && c.includes("nom"); });
  if (i < 0) return [];
  const [entete, ...suite] = lignes.slice(i);
  return suite.map((r) => Object.fromEntries(entete.map((k, j) => [k, r[j] ?? ""])));
}

/**
 * Import du tableau du Barreau depuis un fichier .xlsx, .xls, .csv ou .txt (NFR-10).
 * Le fichier est analysé côté client puis transmis au serveur qui upsert par
 * numéro d'inscription. Colonnes reconnues : num, nom, qualité, statut, cabinet,
 * téléphone, email, rccm, cnss, adresse, observations, maître de stage, dates.
 */
export function ImportMembresModal({ open, onClose, onDone, qualiteDefaut, title, description }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [nomFichier, setNomFichier] = useState("");
  const [ignorees, setIgnorees] = useState(0);
  const [resume, setResume] = useState(null);
  const [apercu, setApercu] = useState(null); // résultat de la simulation serveur (rien d'écrit)
  const [enCours, setEnCours] = useState(false);

  const reset = () => { setRows([]); setNomFichier(""); setResume(null); setApercu(null); setIgnorees(0); };

  const lireFichier = async (file) => {
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      // Texte délimité (.csv/.txt) : lu en UTF-8, séparateur (; , tabulation) auto-détecté ;
      // raw:true conserve les valeurs telles quelles (zéro initial des téléphones, dates AAAA-MM-JJ).
      const texte = /\.(csv|txt)$/i.test(file.name);
      const buf = await file.arrayBuffer();
      const wb = texte ? XLSX.read(decoderTexte(buf), { type: "string", raw: true }) : XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = tableauDepuisFeuille(XLSX, ws);
      const mappees = json.map(mapperLigne).filter((r) => r.num && r.nom);
      if (mappees.length === 0) {
        toast.error("Aucune ligne valide (colonnes « num » et « nom » requises).");
        return;
      }
      setRows(mappees);
      setIgnorees(json.length - mappees.length);
      setNomFichier(file.name);
      setResume(null);
      setApercu(null);
      setApercu(await importerMembres(mappees, qualiteDefaut, true));
    } catch (e) {
      toast.error(`Lecture impossible : ${e.message}`);
    }
  };

  const annuler = () => { setRows([]); setNomFichier(""); setApercu(null); };

  const lancer = async () => {
    setEnCours(true);
    try {
      const r = await importerMembres(rows, qualiteDefaut);
      setResume(r);
      toast.success(`Import terminé : ${r.crees} créé(s), ${r.maj} mis à jour.`);
      onDone?.();
    } catch (e) {
      // L'import étant un upsert par numéro, relancer après une coupure ne crée aucun doublon.
      toast.error(`Import interrompu (${e.message}). Vérifiez la connexion puis relancez : les lignes déjà importées seront simplement mises à jour.`);
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
          {rows.length > 0 && !resume && <button className="bpn-btn bpn-btn-ghost" onClick={annuler}>Annuler l'aperçu</button>}
          <button className="bpn-btn bpn-btn-primary" disabled={rows.length === 0 || !apercu || enCours} onClick={lancer}>
            {enCours ? "Import en cours…" : `Confirmer l'import de ${rows.length || ""} ligne${rows.length > 1 ? "s" : ""}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-gris">
          {description || (
            <>
              Sélectionnez un fichier <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong> ou <strong>.txt</strong>
              (séparateur « ; », « , » ou tabulation). Les avocats sont mis à jour par numéro (les nouveaux sont créés,
              rien n'est supprimé). Colonnes reconnues : num, nom, qualité, statut (dont « décédé »), cabinet, téléphone,
              email, rccm, cnss, adresse, observations, maître de stage, dates (AAAA-MM-JJ) d'inscription, de naissance,
              de serment, de radiation et de décès, motif de radiation.
            </>
          )}
        </p>

        <a href="/modeles/modele-import-membres.csv" download className="inline-block text-sm text-navy underline">
          Télécharger le modèle d'import (.csv)
        </a>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded border-2 border-dashed border-grisM bg-grisL/40 px-4 py-6 text-sm text-gris transition hover:border-or hover:text-encre">
          <ArrowUpTrayIcon className="h-5 w-5" />
          {nomFichier || "Choisir un fichier .xlsx / .csv / .txt"}
          <input type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={(e) => lireFichier(e.target.files?.[0])} />
        </label>

        {rows.length > 0 && !resume && (
          <div className="rounded border border-grisL">
            <div className="border-b border-grisL bg-grisL/50 px-3 py-2 text-xs font-medium text-encre">
              Aperçu — {rows.length} ligne(s) retenue(s), {ignorees} ligne(s) ignorée(s) (sans numéro ou sans nom)
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

        {apercu && !resume && (
          <div className="space-y-2 rounded border border-grisL bg-grisL/40 p-3 text-sm" data-testid="apercu-simulation">
            <p className="font-medium text-encre">Simulation : rien n'est encore enregistré</p>
            <p className="text-gris">{apercu.crees} à créer, {apercu.maj} à mettre à jour, {apercu.erreurs.length} erreur(s), {apercu.doublons.length} doublon(s) possible(s).</p>
            {apercu.colonnes.manquantes.length > 0 && <p className="text-rouge">Colonne(s) obligatoire(s) manquante(s) : {apercu.colonnes.manquantes.join(", ")}</p>}
            {apercu.colonnes.inconnues.length > 0 && <p className="text-gris">Colonne(s) non reconnue(s), ignorée(s) : {apercu.colonnes.inconnues.join(", ")}</p>}
            {apercu.erreurs.filter((e) => e.ligne > 0).slice(0, 5).map((e) => <p key={e.ligne} className="text-rouge">Ligne {e.ligne} : {e.message}</p>)}
            {apercu.doublons.length > 0 && (
              <DataTable
                paginate={false} density="compact" libelle="doublons" getRowId={(d) => `${d.ligne}-${d.type}`}
                columns={[
                  { key: "ligne", label: "Ligne", cell: (d) => d.ligne },
                  { key: "type", label: "Doublon", cell: (d) => (d.type === "num" ? "Numéro" : "Nom") },
                  { key: "nom", label: "Nom", cell: (d) => d.nom },
                  { key: "avec", label: "Avec", cell: (d) => (d.avec === "base" ? "la base" : "le fichier") },
                ]}
                rows={apercu.doublons}
              />
            )}
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
