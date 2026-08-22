import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { CreditCardIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { Modal, FormField, Notice, Button, useToast } from "../../components";
import { formatFCFA } from "../../utils/format";
import { canauxActifs } from "../../data/config";
import { initierEspacePaiement, confirmerEspacePaiementSandbox } from "../../api/resources";

const CANAUX = [
  { value: "MTN", label: "MTN Mobile Money" },
  { value: "AIRTEL", label: "Airtel Money" },
  { value: "CARTE", label: "Carte (Visa / MasterCard)" },
  { value: "VIREMENT", label: "Virement (UBA / Ecobank)" },
];
const canauxProposes = () => {
  const actifs = canauxActifs();
  const liste = CANAUX.filter((c) => actifs.includes(c.value));
  return liste.length ? liste : CANAUX;
};

/**
 * Paiement en ligne par l'avocat de SA propre cotisation / droit de plaidoirie
 * (espace cloisonné). En sandbox, le retour de la passerelle est simulé ; à la
 * réussite, le reçu est émis et la situation mise à jour côté serveur (BR-03).
 */
export function PaiementEspaceModal({ open, onClose, type = "cotisation", annee, du, solde, onDone }) {
  const toast = useToast();
  const canaux = canauxProposes();
  const [canal, setCanal] = useState(canaux[0]?.value ?? "MTN");
  const [montant, setMontant] = useState(solde);
  const [phase, setPhase] = useState("form"); // form | attente
  const [paiement, setPaiement] = useState(null);
  const [sandbox, setSandbox] = useState(true);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) { setCanal(canaux[0]?.value ?? "MTN"); setMontant(solde); setPhase("form"); setPaiement(null); setInstruction(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, solde]);

  const libelle = type === "droit" ? "Droit de plaidoirie" : "Cotisation";

  const initier = async () => {
    const m = Number(montant);
    if (!m || m <= 0) { toast.error("Montant invalide."); return; }
    if (m > solde) { toast.error(`Montant supérieur au solde dû (${formatFCFA(solde)}).`); return; }
    setLoading(true);
    try {
      const r = await initierEspacePaiement({ annee, type, canal, montant: m });
      setPaiement(r.paiement);
      setSandbox(r.sandbox);
      setInstruction(r.instruction || "");
      setPhase("attente");
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const confirmer = async (succes) => {
    setLoading(true);
    try {
      const r = await confirmerEspacePaiementSandbox(paiement.ref, succes);
      if (r.statut === "REUSSI") {
        toast.success(`Paiement réussi — reçu N° ${r.recuNumero}.`);
        onDone?.();
        onClose();
      } else {
        toast.error("Paiement en échec (simulation).");
        setPhase("form");
      }
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Payer — ${libelle} ${annee}`}
      footer={
        phase === "form" ? (
          <Button variant="or" loading={loading} disabled={Number(montant) <= 0} onClick={initier}>
            <CreditCardIcon className="h-4 w-4" /> Initier le paiement
          </Button>
        ) : null
      }
    >
      <Notice ton="gris" className="mb-4">
        {libelle} {annee} · dû {formatFCFA(du)} · solde <span className="font-medium text-rouge">{formatFCFA(solde)}</span>
      </Notice>

      {phase === "form" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Canal de paiement" full>
            <select value={canal} onChange={(e) => setCanal(e.target.value)} className="bpn-input">
              {canaux.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </FormField>
          <FormField label="Montant (FCFA)" full>
            <input type="number" min={0} max={solde} step={5000} value={montant} onChange={(e) => setMontant(e.target.value)} className="bpn-input" />
          </FormField>
        </div>
      ) : (
        <div className="space-y-4">
          <Notice ton="or">
            Paiement <span className="font-mono font-medium text-navy">{paiement?.ref}</span> initié via {CANAUX.find((c) => c.value === canal)?.label}{" "}
            pour {formatFCFA(Number(montant))} — en attente du retour de la passerelle.
          </Notice>
          {sandbox ? (
            <div>
              <p className="mb-2 text-xs text-gris">{instruction || "Mode sandbox : simulez le retour de la passerelle."}</p>
              <div className="flex gap-2">
                <Button variant="or" loading={loading} onClick={() => confirmer(true)}>
                  <CheckCircleIcon className="h-4 w-4" /> Simuler le succès
                </Button>
                <button className="bpn-btn bpn-btn-ghost" disabled={loading} onClick={() => confirmer(false)}>
                  <XCircleIcon className="h-4 w-4" /> Simuler l'échec
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gris">En attente de la confirmation de la passerelle…</p>
          )}
        </div>
      )}
    </Modal>
  );
}

PaiementEspaceModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  type: PropTypes.oneOf(["cotisation", "droit"]),
  annee: PropTypes.number,
  du: PropTypes.number,
  solde: PropTypes.number,
  onDone: PropTypes.func,
};

export default PaiementEspaceModal;
