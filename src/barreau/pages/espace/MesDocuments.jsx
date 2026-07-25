import { useEffect, useRef, useState } from "react";
import { ArrowDownTrayIcon, ArrowUpTrayIcon, DocumentTextIcon, DocumentCheckIcon, PaperClipIcon, TrashIcon, EyeIcon, AcademicCapIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, EmptyState, Notice, Tabs, FormField, useToast, useConfirm, TableSkeleton, ErrorState } from "../../components";
import { formatFCFA, formatDate } from "../../utils/format";
import {
  getEspaceDocuments, telechargerEspaceRecuPdf, telechargerEspaceQuitusPdf,
  getEspacePieces, soumettreEspacePiece, supprimerEspacePiece, voirEspacePiece,
  getEspaceMoi, telechargerEspaceAttestationInscription, telechargerEspaceAttestationNonRedevance,
} from "../../api/resources";

/** Lit un fichier en base64 (sans le préfixe data:), pour l'envoi au serveur. */
const lireBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const TYPES_PIECE = [
  { value: "IDENTITE", label: "Pièce d'identité" },
  { value: "DIPLOME", label: "Diplôme / CAPA" },
  { value: "SERMENT", label: "Procès-verbal de serment" },
  { value: "PHOTO", label: "Photo d'identité" },
  { value: "CASIER", label: "Casier judiciaire" },
  { value: "AUTRE", label: "Autre document" },
];
const TYPE_PIECE_LABEL = Object.fromEntries(TYPES_PIECE.map((t) => [t.value, t.label]));
const STATUT_PIECE_META = {
  A_VERIFIER: { label: "En attente de vérification", ton: "or" },
  VERIFIEE: { label: "Vérifiée", ton: "vert" },
  REJETEE: { label: "Rejetée", ton: "rouge" },
};
const MAX_TAILLE_PIECE = 5 * 1024 * 1024; // 5 Mo

/** Espace avocat — reçus et quitus personnels, téléchargeables en PDF officiel. */
export function MesDocuments() {
  const toast = useToast();
  const confirm = useConfirm();
  const [docs, setDocs] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [pieces, setPieces] = useState(null);
  const [moi, setMoi] = useState(null);
  const [typePiece, setTypePiece] = useState("IDENTITE");
  const [envoiPiece, setEnvoiPiece] = useState(false);
  const fichierRef = useRef(null);

  const charger = () => {
    setErreur(false);
    getEspaceDocuments().then(setDocs).catch((e) => { setErreur(true); toast.error(e.message); });
  };
  const chargerPieces = () => getEspacePieces().then(setPieces).catch(() => setPieces([]));
  useEffect(() => { charger(); chargerPieces(); getEspaceMoi().then(setMoi).catch(() => {}); /* eslint-disable-line */ }, []);

  const telecharger = async (fn) => { try { await fn(); } catch (e) { toast.error(e.message || "Téléchargement impossible."); } };

  const soumettrePiece = async () => {
    const file = fichierRef.current?.files?.[0];
    if (!file || envoiPiece) return;
    if (file.size > MAX_TAILLE_PIECE) { toast.error("Fichier trop volumineux (max 5 Mo)."); return; }
    setEnvoiPiece(true);
    try {
      const donnees = await lireBase64(file);
      await soumettreEspacePiece({ type: typePiece, nomFichier: file.name, mimeType: file.type || "application/octet-stream", donnees });
      toast.success("Document soumis au Secrétariat pour vérification.");
      if (fichierRef.current) fichierRef.current.value = "";
      chargerPieces();
    } catch (e) { toast.error(e.message); } finally { setEnvoiPiece(false); }
  };

  const retirerPiece = async (p) => {
    const ok = await confirm({
      title: "Retirer ce document ?",
      message: `« ${p.nomFichier} » sera retiré de votre dossier. Vous pourrez le soumettre à nouveau.`,
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    try { await supprimerEspacePiece(p.id); toast.success("Document retiré."); chargerPieces(); }
    catch (e) { toast.error(e.message); }
  };

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Vos documents n'ont pas pu être chargés." onRetry={charger} /></div>;
  if (!docs) return <div className="bpn-card p-6"><TableSkeleton rows={4} cols={3} /></div>;

  const quitus = (
    <div className="bpn-card">
      {docs.quitus.length === 0 ? (
        <div className="p-4"><EmptyState icon={DocumentCheckIcon} title="Aucun quitus" description="Vos quitus apparaîtront ici une fois délivrés par le Secrétariat." /></div>
      ) : (
        <ul className="divide-y divide-grisL">
          {docs.quitus.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-3">
                <Badge ton="bleu" dot={false}>Quitus {q.annee}</Badge>
                <span className="font-mono text-xs text-or-fonce">{q.numero}</span>
                <span className="text-xs text-gris">{formatDate(q.date)}</span>
              </span>
              <button className="bpn-btn bpn-btn-ghost bpn-btn-sm" onClick={() => telecharger(() => telechargerEspaceQuitusPdf(q.id, q.numero))}>
                <ArrowDownTrayIcon className="h-3.5 w-3.5" /> PDF
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const recus = (
    <div className="bpn-card">
      {docs.recus.length === 0 ? (
        <div className="p-4"><EmptyState icon={DocumentTextIcon} title="Aucun reçu" description="Vos reçus apparaîtront ici après chaque paiement enregistré." /></div>
      ) : (
        <ul className="divide-y divide-grisL">
          {docs.recus.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="font-mono text-xs text-or-fonce">{r.numero}</span>
                <span className="truncate text-sm text-encre">{r.objet ?? `Paiement ${r.annee}`}</span>
                <span className="shrink-0 text-xs text-gris">{formatDate(r.date)}</span>
                <span className="shrink-0 font-medium">{formatFCFA(r.montant)}</span>
              </span>
              <button className="bpn-btn bpn-btn-ghost bpn-btn-sm" onClick={() => telecharger(() => telechargerEspaceRecuPdf(r.id, r.numero))}>
                <ArrowDownTrayIcon className="h-3.5 w-3.5" /> PDF
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const piecesJustificatives = (
    <div className="space-y-4">
      {/* Formulaire de soumission */}
      <div className="bpn-card">
        <div className="bpn-card-header"><span className="bpn-card-heading">Soumettre un document</span></div>
        <div className="space-y-3 p-4">
          <Notice ton="or" icon={PaperClipIcon}>
            Transmettez au Secrétariat vos pièces justificatives (identité, diplôme, serment…).
            Chaque document est vérifié par le Secrétariat. Formats courants (PDF, image) — 5 Mo maximum.
          </Notice>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Type de document">
              <select value={typePiece} onChange={(e) => setTypePiece(e.target.value)} className="bpn-input">
                {TYPES_PIECE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </FormField>
            <FormField label="Fichier">
              <input ref={fichierRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,image/*,application/pdf"
                className="block w-full text-sm text-gris file:mr-3 file:rounded file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-navy-2" />
            </FormField>
          </div>
          <div className="flex justify-end">
            <button className="bpn-btn bpn-btn-or" onClick={soumettrePiece} disabled={envoiPiece}>
              <ArrowUpTrayIcon className="h-4 w-4" /> {envoiPiece ? "Envoi…" : "Soumettre le document"}
            </button>
          </div>
        </div>
      </div>

      {/* Liste des pièces soumises */}
      <div className="bpn-card">
        <div className="bpn-card-header"><span className="bpn-card-heading">Documents soumis</span><span className="font-mono text-xs text-gris">{pieces?.length ?? 0}</span></div>
        {pieces === null ? (
          <div className="p-4"><TableSkeleton rows={3} cols={2} /></div>
        ) : pieces.length === 0 ? (
          <div className="p-4"><EmptyState icon={PaperClipIcon} title="Aucun document soumis" description="Utilisez le formulaire ci-dessus pour transmettre une pièce au Secrétariat." /></div>
        ) : (
          <ul className="divide-y divide-grisL">
            {pieces.map((p) => {
              const meta = STATUT_PIECE_META[p.statut] ?? { label: p.statut, ton: "gris" };
              return (
                <li key={p.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge ton="bleu" dot={false}>{TYPE_PIECE_LABEL[p.type] ?? p.type}</Badge>
                      <span className="truncate text-sm text-encre">{p.nomFichier}</span>
                      <Badge ton={meta.ton} dot={false}>{meta.label}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-gris">Soumis le {formatDate(p.createdAt)}</div>
                    {p.statut === "REJETEE" && p.note && <div className="mt-1 text-xs text-rouge">Motif : {p.note}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button className="bpn-btn bpn-btn-ghost bpn-btn-sm" onClick={() => voirEspacePiece(p.id).catch((e) => toast.error(e.message))}>
                      <EyeIcon className="h-3.5 w-3.5" /> Voir
                    </button>
                    {p.statut !== "VERIFIEE" && (
                      <button className="bpn-btn bpn-btn-ghost bpn-btn-sm text-rouge" onClick={() => retirerPiece(p)} title="Retirer">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  // Attestation de non-redevance : disponible seulement si la cotisation de l'exercice est soldée.
  const cotSoldee = moi ? (moi.situation?.cotisation?.solde ?? 1) === 0 : false;
  const attestations = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="bpn-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5 text-navy"><AcademicCapIcon className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold text-encre">Attestation d'inscription</h3>
            <p className="mt-1 text-sm text-gris">Atteste votre inscription au Tableau de l'Ordre. Document officiel numéroté et archivé.</p>
          </div>
        </div>
        <button className="bpn-btn bpn-btn-or mt-4 w-full justify-center" onClick={() => telecharger(telechargerEspaceAttestationInscription)}>
          <ArrowDownTrayIcon className="h-4 w-4" /> Télécharger le PDF
        </button>
      </div>

      <div className="bpn-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5 text-navy"><ShieldCheckIcon className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold text-encre">Attestation de non-redevance</h3>
            <p className="mt-1 text-sm text-gris">Atteste que vous êtes à jour de votre cotisation pour l'exercice en cours.</p>
          </div>
        </div>
        {!cotSoldee && moi && (
          <Notice ton="or" className="mt-3 text-xs">Disponible une fois votre cotisation de l'exercice intégralement réglée.</Notice>
        )}
        <button className="bpn-btn bpn-btn-or mt-4 w-full justify-center disabled:opacity-50" disabled={!cotSoldee}
          onClick={() => telecharger(telechargerEspaceAttestationNonRedevance)}>
          <ArrowDownTrayIcon className="h-4 w-4" /> Télécharger le PDF
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mon espace" titre="Mes documents" sousTitre="Vos reçus, quitus, attestations et la soumission de vos pièces justificatives au Secrétariat." />
      <Tabs
        tabs={[
          { id: "quitus", label: `Quitus de cotisation (${docs.quitus.length})`, icon: DocumentCheckIcon, content: quitus },
          { id: "recus", label: `Reçus de paiement (${docs.recus.length})`, icon: DocumentTextIcon, content: recus },
          { id: "attestations", label: "Attestations", icon: AcademicCapIcon, content: attestations },
          { id: "pieces", label: `Pièces justificatives${pieces ? ` (${pieces.length})` : ""}`, icon: PaperClipIcon, content: piecesJustificatives },
        ]}
      />
    </div>
  );
}

export default MesDocuments;
