import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { CheckBadgeIcon, XCircleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { Sceau } from "../components/Sceau";
import { formatFCFA, formatDate } from "../utils/format";

const TYPE_LABEL = { quitus: "Quitus de cotisation", recu: "Reçu de paiement" };

/**
 * Page publique de vérification d'authenticité d'un document officiel
 * (quitus / reçu), atteinte via le QR code. Accessible sans authentification.
 */
export function VerificationPublique({ type, numero }) {
  const [etat, setEtat] = useState({ statut: "chargement" });

  useEffect(() => {
    let actif = true;
    setEtat({ statut: "chargement" });
    fetch(`/api/verifier/${encodeURIComponent(type)}/${encodeURIComponent(numero)}`)
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => actif && setEtat({ statut: ok && data.valide ? "valide" : "invalide", data }))
      .catch(() => actif && setEtat({ statut: "erreur" }));
    return () => { actif = false; };
  }, [type, numero]);

  const d = etat.data;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy-3 px-4 py-10 text-white">
      <div className="mb-6 flex flex-col items-center text-center">
        <Sceau size={72} />
        <h1 className="mt-3 font-display text-xl text-white">Barreau de Pointe-Noire</h1>
        <p className="text-[12px] uppercase tracking-[0.2em] text-or">Vérification d'authenticité</p>
      </div>

      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white text-encre shadow-modal">
        {etat.statut === "chargement" && (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-gris">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-navy" />
            <p className="text-sm">Vérification du document…</p>
          </div>
        )}

        {etat.statut === "valide" && (
          <>
            <div className="flex flex-col items-center gap-2 bg-vertL px-6 py-8 text-center">
              <CheckBadgeIcon className="h-14 w-14 text-vert" />
              <p className="font-display text-xl text-vert">Document authentique</p>
              <p className="text-sm text-gris">{TYPE_LABEL[d.type] ?? "Document officiel"} enregistré par l'Ordre.</p>
            </div>
            <dl className="divide-y divide-grisL px-6 py-2 text-sm">
              <Ligne label="Type" valeur={TYPE_LABEL[d.type] ?? d.type} />
              <Ligne label="Numéro" valeur={d.numero} mono />
              <Ligne label="Bénéficiaire" valeur={d.beneficiaire} />
              {d.montant != null && <Ligne label="Montant" valeur={formatFCFA(d.montant)} />}
              {d.objet && <Ligne label="Objet" valeur={d.objet} />}
              {d.exercice && <Ligne label="Exercice" valeur={d.exercice} />}
              <Ligne label="Date de délivrance" valeur={formatDate(d.date)} />
              {d.empreinteCle && <Ligne label="Empreinte du signataire" valeur={d.empreinteCle} mono />}
            </dl>
            <p className="border-t border-grisL px-6 py-3 text-center text-[11px] text-gris">
              Signature électronique RSA-2048 / SHA-256 de l'Ordre des Avocats au Barreau de Pointe-Noire.
            </p>
          </>
        )}

        {(etat.statut === "invalide" || etat.statut === "erreur") && (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <XCircleIcon className="h-14 w-14 text-rouge" />
            <p className="font-display text-xl text-rouge">
              {etat.statut === "erreur" ? "Vérification impossible" : "Document introuvable"}
            </p>
            <p className="max-w-xs text-sm text-gris">
              {etat.statut === "erreur"
                ? "Le service de vérification est momentanément indisponible. Réessayez plus tard."
                : `Aucun document officiel ne correspond au numéro ${numero}. Méfiez-vous d'un document falsifié.`}
            </p>
          </div>
        )}
      </div>

      <a href="/" className="mt-6 text-[12px] text-white/50 transition hover:text-white/80">Accéder à l'application</a>
    </main>
  );
}

function Ligne({ label, valeur, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-gris">{label}</dt>
      <dd className={`text-right font-medium text-encre ${mono ? "break-all font-mono text-xs" : ""}`}>{valeur ?? "—"}</dd>
    </div>
  );
}

VerificationPublique.propTypes = {
  type: PropTypes.string.isRequired,
  numero: PropTypes.string.isRequired,
};

export default VerificationPublique;
