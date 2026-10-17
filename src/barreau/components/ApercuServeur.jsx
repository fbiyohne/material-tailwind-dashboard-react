import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { apiTexte } from "../api/client";
import { ApercuAjuste } from "./ApercuAjuste";

/** Largeur et hauteur d'une feuille A4 à 96 ppp (210 × 297 mm). */
const A4 = { l: 794, h: 1123 };

/**
 * Aperçu d'un document officiel rendu par le serveur (même assembleur que le PDF) : l'écran
 * montre exactement le document délivré. Recalculé 300 ms après la dernière saisie.
 * Iframe sans script (sandbox) : le HTML reçu ne s'exécute pas dans l'application.
 */
export function ApercuServeur({ chemin, corps, titre }) {
  const [html, setHtml] = useState("");
  const [erreur, setErreur] = useState("");
  const cle = JSON.stringify(corps);

  useEffect(() => {
    let actif = true;
    const t = setTimeout(() => {
      apiTexte(chemin, JSON.parse(cle))
        .then((h) => { if (actif) { setHtml(h); setErreur(""); } })
        .catch((e) => actif && setErreur(e.message));
    }, 300);
    return () => { actif = false; clearTimeout(t); };
  }, [chemin, cle]);

  if (erreur && !html) return <p className="rounded-lg border border-dashed border-grisM bg-white px-6 py-10 text-center text-sm text-gris">{erreur}</p>;
  return (
    <ApercuAjuste largeur={A4.l}>
      <div className="overflow-hidden rounded-sm bg-white shadow-sm ring-1 ring-black/5" style={{ width: A4.l, height: A4.h }}>
        {html ? <iframe title={titre} sandbox="" srcDoc={html} style={{ width: A4.l, height: A4.h, border: 0 }} />
          : <div className="flex h-full items-center justify-center text-sm text-gris">Préparation de l'aperçu…</div>}
      </div>
    </ApercuAjuste>
  );
}

ApercuServeur.propTypes = { chemin: PropTypes.string.isRequired, corps: PropTypes.object.isRequired, titre: PropTypes.string.isRequired };

export default ApercuServeur;
