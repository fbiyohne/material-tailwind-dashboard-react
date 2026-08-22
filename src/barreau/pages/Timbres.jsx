import { useEffect, useMemo, useState } from "react";
import { TicketIcon, ArrowDownTrayIcon, ShieldCheckIcon, TrashIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { Badge, VignetteTimbre, PageHeader, DataTable, useToast, useConfirm } from "../components";
import { QUALITE_LABEL } from "../data/derivations";
import { canauxActifs } from "../data/config";
import { formatFCFA, formatDate } from "../utils/format";
import { exporterPng, copierPng } from "../utils/exports";
import { useAuth } from "../auth/AuthContext";
import { listerMembres, listerTimbres, creerTimbre, annulerTimbre } from "../api/resources";

const CANAL_LABEL = { MTN: "MTN Money", AIRTEL: "Airtel Money", CARTE: "Carte bancaire", VIREMENT: "Virement" };

const DP_DEFAUT = 15000; // droit de plaidoirie par affaire (modifiable à l'émission)
const aujourdhui = () => new Date().toISOString().slice(0, 10);

function Champ({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-white/55">{label}</span>
      {children}
    </label>
  );
}

/** Émission et registre des timbres électroniques de droit de plaidoirie. */
export function Timbres() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const estAdmin = user?.role === "ADMIN";

  const [membres, setMembres] = useState([]);
  const [membreId, setMembreId] = useState(null);
  const [affaire, setAffaire] = useState("");
  const [reference, setReference] = useState("");
  const [juridiction, setJuridiction] = useState("");
  const [montant, setMontant] = useState(DP_DEFAUT);
  const [canal, setCanal] = useState("MTN");
  const [emission, setEmission] = useState(false);
  const [succes, setSucces] = useState(null);
  const [registre, setRegistre] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  const chargerRegistre = () => {
    setChargement(true); setErreur(false);
    listerTimbres().then(setRegistre).catch(() => setErreur(true)).finally(() => setChargement(false));
  };
  useEffect(() => {
    listerMembres({ qualiteNot: "STAGIAIRE" }).then((d) => {
      setMembres(d.items);
      if (d.items[0]) setMembreId(d.items[0].id);
    }).catch((e) => toast.error(e.message));
    chargerRegistre();
  }, [toast]);

  const membre = useMemo(() => membres.find((m) => m.id === membreId), [membres, membreId]);

  // Aperçu : le timbre émis s'il existe, sinon un aperçu vivant depuis le formulaire.
  const apercu = succes ?? {
    numero: "—", code: "—", affaire: affaire || "—", reference, juridiction,
    cabinet: membre?.cabinet, montant: Number(montant) || 0, membre: { nom: membre?.nom ?? "" }, createdAt: aujourdhui(),
  };

  const emettre = async () => {
    if (!membre || !affaire.trim() || montant <= 0 || emission) return;
    setEmission(true);
    try {
      const t = await creerTimbre({ membreId, affaire: affaire.trim(), reference: reference.trim() || undefined, juridiction: juridiction.trim() || undefined, montant: Number(montant), canal });
      setSucces(t);
      chargerRegistre();
      toast.success(`Timbre N° ${t.numero} émis.`);
    } catch (e) { toast.error(e.message); } finally { setEmission(false); }
  };

  const telecharger = () => {
    if (!succes) return;
    exporterPng("#vignette-timbre", `Timbre-${succes.numero}`).catch((e) => toast.error(e.message));
  };
  const copier = async () => {
    if (!succes) return;
    try {
      const ok = await copierPng("#vignette-timbre");
      if (ok) toast.success("Timbre copié — collez-le dans votre document (Ctrl+V).");
      else { toast.error("Copie non disponible sur ce navigateur — téléchargement du PNG."); telecharger(); }
    } catch (e) { toast.error(e.message); }
  };

  const annuler = async (t) => {
    const ok = await confirm({ title: "Annuler le timbre", message: `Le timbre N° ${t.numero} (${t.affaire}) sera marqué annulé et invalidé à la vérification.`, confirmLabel: "Annuler le timbre", danger: true });
    if (!ok) return;
    try { await annulerTimbre(t.id); toast.success(`Timbre N° ${t.numero} annulé.`); chargerRegistre(); if (succes?.id === t.id) setSucces({ ...succes, statut: "ANNULE" }); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Finances" titre="Timbres de plaidoirie" sousTitre="Émission d'un timbre électronique par affaire — preuve vérifiable (QR) à apposer sur les actes." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* Formulaire d'émission */}
        <div className="rounded-lg bg-navy-3 p-5">
          <div className="mb-4 text-xs uppercase tracking-[0.2em] text-white/40">Émettre un timbre</div>
          <div className="space-y-3.5">
            <Champ label="Avocat">
              <select value={membreId ?? ""} onChange={(e) => { setMembreId(Number(e.target.value)); setSucces(null); }} className="bpn-input-dark">
                {membres.map((m) => <option key={m.id} value={m.id}>{m.num}. Me {m.nom} — {QUALITE_LABEL[m.qualite]}</option>)}
              </select>
            </Champ>
            <Champ label="Affaire"><input value={affaire} onChange={(e) => setAffaire(e.target.value)} className="bpn-input-dark" placeholder="Ex. ARENS Vanessa" /></Champ>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Référence"><input value={reference} onChange={(e) => setReference(e.target.value)} className="bpn-input-dark" placeholder="151024" /></Champ>
              <Champ label="Montant (FCFA)"><input type="number" min={0} step={500} value={montant} onChange={(e) => setMontant(e.target.value)} className="bpn-input-dark" /></Champ>
            </div>
            <Champ label="Juridiction"><input value={juridiction} onChange={(e) => setJuridiction(e.target.value)} className="bpn-input-dark" placeholder="TI de Tié-Tié" /></Champ>
            <Champ label="Paiement">
              <select value={canal} onChange={(e) => setCanal(e.target.value)} className="bpn-input-dark">
                {(canauxActifs().length ? canauxActifs() : ["MTN", "AIRTEL", "CARTE", "VIREMENT"]).map((c) => <option key={c} value={c}>{CANAL_LABEL[c] ?? c}</option>)}
              </select>
            </Champ>
            <button type="button" onClick={emettre} disabled={!membre || !affaire.trim() || montant <= 0 || emission} className="bpn-btn bpn-btn-or w-full justify-center !py-2.5">
              <TicketIcon className="h-4 w-4" /> {emission ? "Émission…" : `Payer & émettre (${formatFCFA(Number(montant) || 0)})`}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={telecharger} disabled={!succes} title={succes ? "" : "Émettez d'abord le timbre"} className="bpn-btn bpn-btn-ghost justify-center border-white/20 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40">
                <ArrowDownTrayIcon className="h-4 w-4" /> PNG
              </button>
              <button type="button" onClick={copier} disabled={!succes} title={succes ? "Copier pour coller dans Word/PDF" : "Émettez d'abord le timbre"} className="bpn-btn bpn-btn-ghost justify-center border-white/20 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40">
                <ClipboardDocumentIcon className="h-4 w-4" /> Copier
              </button>
            </div>
            {succes && (
              <a href={`/verifier/timbre/${encodeURIComponent(succes.code)}`} target="_blank" rel="noreferrer" className="block text-center text-xs text-white/60 underline hover:text-white">
                Page de vérification publique
              </a>
            )}
          </div>
        </div>

        {/* Aperçu de la vignette */}
        <div className="flex justify-center rounded-lg border border-grisM bg-grisL/40 p-6">
          <VignetteTimbre timbre={apercu} />
        </div>
      </div>

      {/* Registre */}
      <div className="bpn-card">
        <div className="bpn-card-header"><span className="bpn-card-heading">Timbres émis</span><span className="font-mono text-xs text-gris">{registre.length}</span></div>
        <DataTable
          columns={[
            { key: "numero", label: "N°", sortable: true, sortValue: (t) => t.numero, cell: (t) => <span className="font-mono text-xs text-or-fonce">{t.numero}</span> },
            { key: "avocat", label: "Avocat", sortable: true, sortValue: (t) => t.membre?.nom, cell: (t) => <span className="font-medium">Me {t.membre?.nom}</span> },
            { key: "affaire", label: "Affaire", sortable: true, sortValue: (t) => t.affaire, cell: (t) => <span>{t.affaire}</span> },
            { key: "juridiction", label: "Juridiction", cell: (t) => <span className="text-gris">{t.juridiction || "—"}</span> },
            { key: "montant", label: "Montant", align: "right", sortable: true, sortValue: (t) => t.montant, cell: (t) => formatFCFA(t.montant) },
            { key: "statut", label: "Statut", cell: (t) => <Badge ton={t.statut === "ANNULE" ? "rouge" : "vert"} dot={false}>{t.statut === "ANNULE" ? "Annulé" : "Valide"}</Badge> },
            { key: "date", label: "Date", cell: (t) => <span className="text-xs text-gris">{formatDate(t.createdAt)}</span> },
            {
              key: "actions", label: "", align: "right",
              cell: (t) => (
                <div className="flex items-center justify-end gap-3">
                  <a href={`/verifier/timbre/${encodeURIComponent(t.code)}`} target="_blank" rel="noreferrer" title="Vérifier" className="inline-flex items-center gap-1 text-xs font-medium text-navy transition hover:text-or-fonce">
                    <ShieldCheckIcon className="h-4 w-4" /> Vérifier
                  </a>
                  {estAdmin && t.statut !== "ANNULE" && (
                    <button type="button" onClick={() => annuler(t)} title="Annuler" className="text-gris transition hover:text-rouge"><TrashIcon className="h-4 w-4" /></button>
                  )}
                </div>
              ),
            },
          ]}
          rows={registre}
          loading={chargement}
          error={erreur}
          onRetry={chargerRegistre}
          emptyIcon={TicketIcon}
          emptyTitle="Aucun timbre émis"
          emptyDescription="Les timbres de plaidoirie émis apparaîtront ici."
          libelle="timbres"
          initialSort={{ key: "numero", dir: "desc" }}
        />
      </div>
    </div>
  );
}

export default Timbres;
