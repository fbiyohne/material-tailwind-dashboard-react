import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { CreditCardIcon, DevicePhoneMobileIcon, BuildingLibraryIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { Modal } from "./Modal";
import { FormField } from "./FormField";
import { Notice } from "./Notice";
import { Button } from "./Button";
import { useToast } from "./Toast";
import { formatFCFA } from "../utils/format";
import { initierPaiement, confirmerPaiementSandbox } from "../api/resources";
import { canauxActifs } from "../data/config";

const CANAUX = [
  { value: "MTN", label: "MTN Mobile Money", icon: DevicePhoneMobileIcon },
  { value: "AIRTEL", label: "Airtel Money", icon: DevicePhoneMobileIcon },
  { value: "CARTE", label: "Carte (Visa / MasterCard)", icon: CreditCardIcon },
  { value: "VIREMENT", label: "Virement (UBA / Ecobank)", icon: BuildingLibraryIcon },
];
// Canaux réellement proposés = ceux activés dans les Paramètres (repli sur tous).
const canauxProposes = () => {
  const actifs = canauxActifs();
  const liste = CANAUX.filter((c) => actifs.includes(c.value));
  return liste.length ? liste : CANAUX;
};

/**
 * Paiement en ligne (passerelle) d'une cotisation ou d'un droit. En sandbox,
 * le retour de la passerelle est simulé (succès / échec). À la réussite, le
 * reçu est émis et la situation mise à jour (BR-03).
 */
export function PaiementEnLigneModal({ ligne, exercice, type = "cotisation", open, onClose, onDone }) {
  const toast = useToast();
  const solde = ligne ? Math.max(0, ligne.montantDu - ligne.montantPaye) : 0;
  const canaux = canauxProposes();
  const [canal, setCanal] = useState(canaux[0]?.value ?? "MTN");
  const [montant, setMontant] = useState(solde);
  const [phase, setPhase] = useState("form"); // form | attente
  const [paiement, setPaiement] = useState(null);
  const [sandbox, setSandbox] = useState(true);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ligne) { setCanal(canaux[0]?.value ?? "MTN"); setMontant(solde); setPhase("form"); setPaiement(null); setInstruction(""); }
  }, [ligne, solde]);

  if (!ligne) return null;
  const membre = ligne.membre;

  const initier = async () => {
    const m = Number(montant);
    if (!m || m <= 0) { toast.error("Montant invalide."); return; }
    setLoading(true);
    try {
      const r = await initierPaiement({ membreId: membre.id, annee: exercice, montant: m, type, canal });
      setPaiement(r.paiement);
      setSandbox(r.sandbox);
      setInstruction(r.instruction || "");
      setPhase("attente");
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const confirmer = async (succes) => {
    setLoading(true);
    try {
      const r = await confirmerPaiementSandbox(paiement.ref, succes);
      if (r.statut === "REUSSI") {
        toast.success(`Paiement réussi — reçu N° ${r.recuNumero} (Me ${membre.nom}).`);
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
      title={`Paiement en ligne — Me ${membre.nom}`}
      footer={
        phase === "form" ? (
          <Button variant="or" loading={loading} disabled={Number(montant) <= 0} onClick={initier}>
            <CreditCardIcon className="h-4 w-4" /> Initier le paiement
          </Button>
        ) : null
      }
    >
      <Notice ton="gris" className="mb-4">
        Exercice {exercice} · dû {formatFCFA(ligne.montantDu)} · solde <span className="font-medium text-rouge">{formatFCFA(solde)}</span>
      </Notice>

      {phase === "form" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Canal de paiement" full>
            <select value={canal} onChange={(e) => setCanal(e.target.value)} className="bpn-input">
              {canaux.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </FormField>
          <FormField label="Montant (FCFA)" full>
            <input type="number" min={0} step={5000} value={montant} onChange={(e) => setMontant(e.target.value)} className="bpn-input" />
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

PaiementEnLigneModal.propTypes = {
  ligne: PropTypes.object,
  exercice: PropTypes.number,
  type: PropTypes.oneOf(["cotisation", "droit"]),
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onDone: PropTypes.func,
};

export default PaiementEnLigneModal;
