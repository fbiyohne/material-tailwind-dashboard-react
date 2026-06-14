import PropTypes from "prop-types";

/**
 * Tableau d'état officiel rendu hors écran, capturé tel quel par l'export PDF
 * (exporterPdf("#id")). Indépendant de la pagination de la vue : il contient
 * toujours la totalité des lignes fournies. Sert aux états Cotisations, Droits…
 */
export function EtatImprimable({ id, titre, sousTitre, entete, lignes, totaux }) {
  return (
    <div
      id={id}
      aria-hidden="true"
      className="pointer-events-none fixed -left-[10000px] top-0 w-[820px] bg-white p-8 text-encre"
    >
      <div className="text-center">
        <div className="font-display text-xl font-bold text-navy">Barreau de Pointe-Noire</div>
        <div className="text-[11px] uppercase tracking-wide text-gris">Ordre National des Avocats du Congo</div>
      </div>
      <h3 className="mt-5 font-display text-lg font-semibold text-navy">{titre}</h3>
      {sousTitre && <p className="text-sm text-gris">{sousTitre}</p>}
      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr>
            {entete.map((h) => (
              <th key={h} className="border-b-2 border-navy/40 px-2 py-1.5 text-left font-semibold text-navy">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="border-b border-grisL px-2 py-1">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {totaux && (
          <tfoot>
            <tr>
              {totaux.map((c, j) => (
                <td key={j} className="border-t-2 border-navy/40 px-2 py-1.5 font-semibold">{c}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      <p className="mt-6 text-right text-[11px] text-gris">
        Fait à Pointe-Noire, le {new Date().toLocaleDateString("fr-FR")} — Le Secrétariat Général
      </p>
    </div>
  );
}

EtatImprimable.propTypes = {
  id: PropTypes.string.isRequired,
  titre: PropTypes.string.isRequired,
  sousTitre: PropTypes.string,
  entete: PropTypes.arrayOf(PropTypes.string).isRequired,
  lignes: PropTypes.arrayOf(PropTypes.array).isRequired,
  totaux: PropTypes.array,
};

export default EtatImprimable;
