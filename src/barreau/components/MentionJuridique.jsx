import PropTypes from "prop-types";
import { ScaleIcon } from "@heroicons/react/24/outline";

// Espace insécable avant « : » et « ; » (typographie française).
const NB = "\u00a0";
const LOI = "Loi n° 026-92 du 20 août 1992";

/**
 * Mentions préréglées, reprises mot pour mot de l'avis juridique du 2026-10-10
 * (clauses à prévoir). Les écrans les appellent par `type` au lieu de recopier
 * le texte : une seule source à corriger quand les textes seront confirmés.
 */
export const MENTIONS = {
  regles: {
    nature: "provisoire",
    article: `${LOI} · règlements intérieurs`,
    texte: `Les valeurs signalées « loi » reprennent la loi n° 026-92 du 20 août 1992 (article indiqué). Les valeurs signalées « provisoire » ne figurent pas dans la loi et doivent être confirmées par le règlement intérieur de l'Ordre et du Barreau avant tout usage officiel.`,
  },
  sursis: {
    nature: "provisoire",
    article: "Règlement intérieur — à confirmer",
    texte: "Le sursis n'est pas prévu par la loi n° 026-92. Ne l'appliquer que si le règlement intérieur le prévoit.",
  },
  sanction: {
    nature: "loi",
    article: `${LOI}, art. 18 et 36 à 42`,
    texte: `La sanction est prononcée par le Conseil du barreau siégeant en conseil de discipline (art. 18 et 36 loi n° 026-92), après audition ou convocation sous huitaine et communication du dossier (art. 37). Enregistrez la décision motivée (art. 38) et sa date de notification (art. 39). Opposition${NB}: 5 jours (art. 40)${NB}; appel${NB}: 10 jours francs (art. 42).`,
  },
  radiation: {
    nature: "loi",
    article: `${LOI}, art. 40 à 43`,
    texte: `Effet enregistré sous réserve des voies de recours (art. 40 à 43 loi n° 026-92)${NB}; en cas de réformation, la fiche est rétablie et l'opération tracée.`,
  },
  omission: {
    nature: "loi",
    article: `${LOI}, art. 8 et 35`,
    texte: `L'omission est prononcée par le Conseil de l'Ordre national (art. 8 et 35 loi n° 026-92). Mesure administrative distincte de la radiation disciplinaire${NB}; réinscription sur décision du Conseil, qui fixe le rang.`,
  },
  passageTableau: {
    nature: "loi",
    article: `${LOI}, art. 29 et 31`,
    texte: "Inscription au tableau sur demande de l'avocat stagiaire titulaire du certificat de fin de stage délivré par le Bâtonnier de l'Ordre national (art. 29 et 31 loi n° 026-92). Saisissez la référence du certificat et la date de la demande.",
  },
};

// « n° 026-92 » ne se coupe jamais en fin de ligne (relevé à 360 px).
for (const m of Object.values(MENTIONS)) m.texte = m.texte.replace(/n° /g, `n°${NB}`);

const NATURES = {
  loi: { etiquette: "Loi", boite: "border-navy/25 bg-bleuL", puce: "bg-navy text-white", icone: "text-navy" },
  provisoire: { etiquette: "Provisoire", boite: "border-or bg-or-L", puce: "bg-or-fonce text-white", icone: "text-or-fonce" },
};

/**
 * Bandeau d'information juridique : nature (« Loi » ou « Provisoire », en texte),
 * source (article) et explication. Usage préréglé `<MentionJuridique type="omission" />`
 * ou libre `<MentionJuridique nature="loi" article="…">texte</MentionJuridique>`.
 * Il informe, il ne décide rien : aucune promesse de sécurité ni de valeur probatoire.
 */
export function MentionJuridique({ type, nature, article, children, className = "" }) {
  const preset = MENTIONS[type] ?? {};
  const n = NATURES[nature ?? preset.nature] ?? NATURES.loi;
  const source = article ?? preset.article;
  return (
    <div role="note" className={`flex items-start gap-3 rounded-md border px-4 py-3 text-encre ${n.boite} ${className}`}>
      <ScaleIcon className={`mt-0.5 h-5 w-5 shrink-0 ${n.icone}`} aria-hidden="true" />
      <div className="min-w-0 space-y-1.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs">
          <span className={`rounded px-1.5 py-px font-semibold uppercase tracking-wide ${n.puce}`}>{n.etiquette}</span>
          {source && <span className="font-mono text-encre">{source}</span>}
        </p>
        <p className="text-justify text-sm hyphens-auto">{children ?? preset.texte}</p>
      </div>
    </div>
  );
}

MentionJuridique.propTypes = {
  type: PropTypes.oneOf(Object.keys(MENTIONS)),
  nature: PropTypes.oneOf(["loi", "provisoire"]),
  article: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
};

export default MentionJuridique;
