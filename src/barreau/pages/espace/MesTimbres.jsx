import { useEffect, useMemo, useState } from "react";
import { TicketIcon, ArrowDownTrayIcon, ClipboardDocumentIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Badge, VignetteTimbre, PageHeader, FormField, Notice, useToast, TableSkeleton, ErrorState, EmptyState } from "../../components";
import { canauxActifs } from "../../data/config";
import { formatFCFA, formatDate } from "../../utils/format";
import { exporterPng, copierPng } from "../../utils/exports";
import { getEspaceTimbres, creerEspaceTimbre } from "../../api/resources";

const CANAL_LABEL = { MTN: "MTN Money", AIRTEL: "Airtel Money", CARTE: "Carte bancaire", VIREMENT: "Virement" };
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Espace avocat — l'avocat émet ses timbres de plaidoirie (paiement) et les récupère. */
export function MesTimbres() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [moi, setMoi] = useState(null);
  const [affaire, setAffaire] = useState("");
  const [reference, setReference] = useState("");
  const [juridiction, setJuridiction] = useState("");
  const [canal, setCanal] = useState("MTN");
  const [emission, setEmission] = useState(false);
  const [succes, setSucces] = useState(null);

  const charger = () => {
    setErreur(false);
    getEspaceTimbres().then(setData).catch(() => setErreur(true));
  };
  useEffect(() => { charger(); }, []);

  const montant = data?.montant ?? 15000;
  const apercu = succes ?? {
    numero: "—", code: "—", affaire: affaire || "—", reference, juridiction,
    cabinet: moi?.cabinet, montant, membre: { nom: moi?.nom ?? "" }, createdAt: aujourdhui(),
  };

  // Récupère cabinet/nom pour l'aperçu depuis le premier timbre connu, sinon vide.
  useEffect(() => {
    if (data?.timbres?.[0]) setMoi({ nom: data.timbres[0].membre?.nom, cabinet: data.timbres[0].cabinet });
  }, [data]);

  const emettre = async () => {
    if (!affaire.trim() || emission) return;
    setEmission(true);
    try {
      const t = await creerEspaceTimbre({ affaire: affaire.trim(), reference: reference.trim() || undefined, juridiction: juridiction.trim() || undefined, canal });
      setSucces(t);
      setMoi({ nom: t.membre?.nom, cabinet: t.cabinet });
      charger();
      toast.success(`Timbre N° ${t.numero} émis.`);
    } catch (e) { toast.error(e.message); } finally { setEmission(false); }
  };

  const telecharger = () => succes && exporterPng("#vignette-timbre", `Timbre-${succes.numero}`).catch((e) => toast.error(e.message));
  const copier = async () => {
    if (!succes) return;
    const ok = await copierPng("#vignette-timbre").catch(() => false);
    if (ok) toast.success("Timbre copié — collez-le dans votre document (Ctrl+V).");
    else { toast.error("Copie non disponible — téléchargement du PNG."); telecharger(); }
  };

  const canaux = useMemo(() => (canauxActifs().length ? canauxActifs() : ["MTN", "AIRTEL", "CARTE", "VIREMENT"]), []);

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Vos timbres n'ont pas pu être chargés." onRetry={charger} /></div>;
  if (!data) return <div className="bpn-card p-6"><TableSkeleton rows={4} cols={2} /></div>;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mon espace" titre="Mes timbres de plaidoirie" sousTitre="Émettez un timbre par affaire, réglez le droit de plaidoirie, puis téléchargez-le ou copiez-le dans vos actes." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* Émission */}
        <div className="bpn-card">
          <div className="bpn-card-header"><span className="bpn-card-heading">Nouveau timbre</span><Badge ton="or" dot={false}>{formatFCFA(montant)}</Badge></div>
          <div className="space-y-3 p-4">
            <FormField label="Affaire" required><input value={affaire} onChange={(e) => setAffaire(e.target.value)} className="bpn-input" placeholder="Ex. ARENS Vanessa" /></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Référence"><input value={reference} onChange={(e) => setReference(e.target.value)} className="bpn-input" placeholder="151024" /></FormField>
              <FormField label="Juridiction"><input value={juridiction} onChange={(e) => setJuridiction(e.target.value)} className="bpn-input" placeholder="TI de Tié-Tié" /></FormField>
            </div>
            <FormField label="Moyen de paiement">
              <select value={canal} onChange={(e) => setCanal(e.target.value)} className="bpn-input">
                {canaux.map((c) => <option key={c} value={c}>{CANAL_LABEL[c] ?? c}</option>)}
              </select>
            </FormField>
            <button type="button" onClick={emettre} disabled={!affaire.trim() || emission} className="bpn-btn bpn-btn-or w-full justify-center">
              <TicketIcon className="h-4 w-4" /> {emission ? "Émission…" : `Payer & émettre (${formatFCFA(montant)})`}
            </button>
            {succes && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={telecharger} className="bpn-btn bpn-btn-ghost justify-center"><ArrowDownTrayIcon className="h-4 w-4" /> PNG</button>
                  <button type="button" onClick={copier} className="bpn-btn bpn-btn-ghost justify-center"><ClipboardDocumentIcon className="h-4 w-4" /> Copier</button>
                </div>
                <a href={`/verifier/timbre/${encodeURIComponent(succes.code)}`} target="_blank" rel="noreferrer" className="block text-center text-xs text-gris underline hover:text-navy">Page de vérification</a>
              </>
            )}
            {!succes && <Notice ton="or">Le montant est fixé par l'Ordre. Après paiement, votre timbre est généré avec un QR de vérification à apposer sur l'acte.</Notice>}
          </div>
        </div>

        {/* Aperçu */}
        <div className="flex justify-center rounded-lg border border-grisM bg-grisL/40 p-6">
          <VignetteTimbre timbre={apercu} />
        </div>
      </div>

      {/* Mes timbres émis */}
      <div className="bpn-card">
        <div className="bpn-card-header"><span className="bpn-card-heading">Timbres émis</span><span className="font-mono text-xs text-gris">{data.timbres.length}</span></div>
        {data.timbres.length === 0 ? (
          <div className="p-4"><EmptyState icon={TicketIcon} title="Aucun timbre" description="Vos timbres de plaidoirie apparaîtront ici." /></div>
        ) : (
          <ul className="divide-y divide-grisL">
            {data.timbres.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="font-mono text-xs text-or-fonce">N° {t.numero}</span>
                  <span className="truncate text-sm text-encre">{t.affaire}</span>
                  {t.juridiction && <span className="shrink-0 text-xs text-gris">· {t.juridiction}</span>}
                  <Badge ton={t.statut === "ANNULE" ? "rouge" : "vert"} dot={false}>{t.statut === "ANNULE" ? "Annulé" : "Valide"}</Badge>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-gris">{formatDate(t.createdAt)}</span>
                  <a href={`/verifier/timbre/${encodeURIComponent(t.code)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:text-or-fonce"><ShieldCheckIcon className="h-4 w-4" /> Vérifier</a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default MesTimbres;
