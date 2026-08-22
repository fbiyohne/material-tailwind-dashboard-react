import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Badge } from "./Badge";
import { useAuth } from "../auth/AuthContext";
import { formatDate } from "../utils/format";
import { casierDiscipline } from "../api/resources";

const STATUT = {
  OUVERT: { label: "Ouvert", ton: "or" },
  INSTRUCTION: { label: "Instruction", ton: "or" },
  AUDIENCE: { label: "Audience", ton: "bleu" },
  DECISION: { label: "Décision", ton: "bleu" },
  CLASSE: { label: "Classé", ton: "gris" },
};

/** Casier disciplinaire d'un avocat : historique de ses dossiers (RG-13). */
export function CasierDiscipline({ membreId }) {
  const { user } = useAuth();
  const autorise = ["SECRETAIRE_GENERAL", "BATONNIER", "ADMIN"].includes(user?.role);
  const [dossiers, setDossiers] = useState(null);

  useEffect(() => {
    if (autorise) casierDiscipline(membreId).then(setDossiers).catch(() => setDossiers([]));
  }, [membreId, autorise]);

  if (!autorise) return <p className="text-sm text-gris">Accès restreint au Conseil de discipline (RG-13).</p>;
  if (dossiers === null) return <p className="text-sm text-gris">Chargement…</p>;
  if (dossiers.length === 0) return <p className="text-sm text-gris">Aucun dossier disciplinaire — casier vierge.</p>;

  return (
    <ul className="divide-y divide-grisL">
      {dossiers.map((d) => {
        const m = STATUT[d.statut] ?? { label: d.statut, ton: "gris" };
        return (
          <li key={d.id} className="py-2.5">
            <div className="flex items-center justify-between gap-2">
              <Link to={`/discipline/${d.id}`} className="font-mono text-xs text-or hover:underline">{d.reference}</Link>
              <Badge ton={m.ton} dot={false}>{m.label}</Badge>
            </div>
            <div className="mt-0.5 text-sm text-encre">{d.objet}</div>
            <div className="text-xs text-gris">
              Saisine {formatDate(d.dateSaisine)}
              {d.rapporteur ? ` · Rapporteur : ${d.rapporteur}` : ""}
              {d.sanction ? ` · Sanction : ${d.sanction}` : ""}
              {d.recours ? " · Recours formé" : ""}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

CasierDiscipline.propTypes = { membreId: PropTypes.number.isRequired };

export default CasierDiscipline;
