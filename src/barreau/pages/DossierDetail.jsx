import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, ShieldExclamationIcon, CheckIcon, ArrowDownTrayIcon, PaperClipIcon, PlusIcon, XMarkIcon, DocumentTextIcon, ScaleIcon } from "@heroicons/react/24/outline";
import { Badge, DocumentModal, useToast, FormField, PageHeader, Tabs } from "../components";
import { STATUT_DOSSIER_META } from "../data/institutionnel";
import { getDossier, majDossier, archiverDoc, telechargerDecisionDisciplinePdf } from "../api/resources";

const STATUTS = ["ouvert", "instruction", "audience", "decision", "classe"];

export function DossierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [dossier, setDossier] = useState(null);
  const [form, setForm] = useState(null);
  const [enregistre, setEnregistre] = useState(false);
  const [convocation, setConvocation] = useState(false);
  const [nouvellePiece, setNouvellePiece] = useState("");

  // getDossier journalise la consultation côté serveur (RG-13).
  useEffect(() => {
    getDossier(Number(id)).then((d) => { setDossier(d); setForm(d); }).catch(() => setDossier(false));
  }, [id]);

  if (dossier === false) {
    return (
      <div className="py-20 text-center">
        <p className="text-gris">Dossier introuvable.</p>
        <button className="bpn-btn bpn-btn-ghost mt-4" onClick={() => navigate("/discipline")}>Retour</button>
      </div>
    );
  }
  if (!dossier || !form) return <div className="py-20 text-center text-sm text-gris">Chargement…</div>;

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setEnregistre(false); };
  const meta = STATUT_DOSSIER_META[form.statut];
  const pieces = form.pieces ?? [];

  const ajouterPiece = () => {
    const v = nouvellePiece.trim();
    if (!v) return;
    setForm({ ...form, pieces: [...pieces, v] });
    setNouvellePiece("");
    setEnregistre(false);
  };
  const retirerPiece = (i) => { setForm({ ...form, pieces: pieces.filter((_, j) => j !== i) }); setEnregistre(false); };

  const enregistrer = async () => {
    try {
      await majDossier(dossier.id, {
        statut: form.statut, dateConvocation: form.dateConvocation, dateAudience: form.dateAudience,
        decision: form.decision, sanction: form.sanction, pieces: form.pieces ?? [],
      });
      setEnregistre(true);
      toast.success("Dossier mis à jour.");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const telechargerDecision = async () => {
    try {
      await enregistrer();
      await telechargerDecisionDisciplinePdf(dossier.id);
      toast.success("Décision générée, archivée et téléchargée (PDF).");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/discipline" className="inline-flex items-center gap-1.5 text-sm text-gris hover:text-navy">
        <ArrowLeftIcon className="h-4 w-4" /> Retour aux dossiers
      </Link>

      <div className="flex items-center gap-2 rounded border-l-[3px] border-rouge bg-rougeL px-4 py-2.5 text-sm text-rouge">
        <ShieldExclamationIcon className="h-5 w-5 shrink-0" /> Dossier confidentiel — consultation journalisée (RG-13).
      </div>

      {/* En-tête */}
      <PageHeader
        eyebrow="Conseil de discipline"
        titre={`Dossier N° ${dossier.reference}`}
        sousTitre={
          <span className="flex flex-wrap items-center gap-2">
            <Badge ton={meta.ton}>{meta.label}</Badge>
            <span>Mis en cause : <span className="font-medium text-encre">{dossier.avocatNom === "Confidentiel" ? "Confidentiel" : `Me ${dossier.avocatNom}`}</span> · saisine du {dossier.dateSaisine}</span>
          </span>
        }
      >
        <button className="bpn-btn bpn-btn-danger" onClick={() => setConvocation(true)}>
          Convocation disciplinaire
        </button>
      </PageHeader>

      <Tabs
        tabs={[
          {
            id: "saisine",
            label: "Saisine",
            icon: DocumentTextIcon,
            content: (
              <div className="bpn-card">
                <div className="bpn-card-header"><span className="bpn-card-heading">Objet de la saisine</span></div>
                <p className="p-4 text-sm text-encre">{dossier.objet}</p>
              </div>
            ),
          },
          {
            id: "pieces",
            label: "Pièces",
            icon: PaperClipIcon,
            badge: pieces.length || null,
            content: (
              <div className="bpn-card">
                <div className="bpn-card-header"><span className="bpn-card-heading">Pièces du dossier</span><span className="font-mono text-xs text-gris">{pieces.length}</span></div>
                <div className="p-4">
                  {pieces.length > 0 ? (
                    <ul className="mb-3 space-y-1.5">
                      {pieces.map((p, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 rounded border border-grisL bg-grisL/40 px-3 py-2 text-sm">
                          <span className="flex items-center gap-2 text-encre"><PaperClipIcon className="h-4 w-4 shrink-0 text-gris" /> {p}</span>
                          <button type="button" onClick={() => retirerPiece(i)} title="Retirer" className="text-gris transition hover:text-rouge"><XMarkIcon className="h-4 w-4" /></button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mb-3 text-sm text-gris">Aucune pièce enregistrée. Référencez ici les pièces versées au dossier (plaintes, PV d'audition, correspondances…).</p>
                  )}
                  <div className="flex gap-2">
                    <input value={nouvellePiece} onChange={(e) => setNouvellePiece(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), ajouterPiece())}
                      className="bpn-input flex-1" placeholder="Référence ou intitulé de la pièce…" />
                    <button type="button" className="bpn-btn bpn-btn-ghost shrink-0" onClick={ajouterPiece}><PlusIcon className="h-4 w-4" /> Ajouter</button>
                  </div>
                  <p className="mt-2 text-[11px] text-gris">Pensez à « Enregistrer le dossier » pour conserver les pièces.</p>
                </div>
              </div>
            ),
          },
          {
            id: "instruction",
            label: "Instruction & décision",
            icon: ScaleIcon,
            content: (
              <div className="bpn-card">
                <div className="bpn-card-header"><span className="bpn-card-heading">Instruction & décision</span></div>
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                  <FormField label="Statut de la procédure">
                    <select value={form.statut} onChange={set("statut")} className="bpn-input">
                      {STATUTS.map((s) => <option key={s} value={s}>{STATUT_DOSSIER_META[s].label}</option>)}
                    </select>
                  </FormField>
                  <div />
                  <FormField label="Date de convocation">
                    <input type="date" value={form.dateConvocation ?? ""} onChange={set("dateConvocation")} className="bpn-input" />
                  </FormField>
                  <FormField label="Date d'audience">
                    <input type="date" value={form.dateAudience ?? ""} onChange={set("dateAudience")} className="bpn-input" />
                  </FormField>
                  <FormField label="Décision rendue" full>
                    <textarea rows={3} value={form.decision ?? ""} onChange={set("decision")} className="bpn-input" placeholder="Motifs et dispositif de la décision…" />
                  </FormField>
                  <FormField label="Sanction éventuelle" full>
                    <input value={form.sanction ?? ""} onChange={set("sanction")} className="bpn-input" placeholder="Avertissement, blâme, suspension, radiation…" />
                  </FormField>
                </div>
                <div className="flex items-center justify-end gap-3 border-t border-grisM px-4 py-3">
                  {enregistre && <span className="flex items-center gap-1 text-sm text-vert"><CheckIcon className="h-4 w-4" /> Enregistré</span>}
                  <button className="bpn-btn bpn-btn-ghost" onClick={telechargerDecision} disabled={!form.decision} title={form.decision ? "" : "Renseigner la décision d'abord"}>
                    <ArrowDownTrayIcon className="h-4 w-4" /> Décision (PDF)
                  </button>
                  <button className="bpn-btn bpn-btn-primary" onClick={enregistrer}>Enregistrer le dossier</button>
                </div>
              </div>
            ),
          },
        ]}
      />

      <DocumentModal
        open={convocation}
        onClose={() => setConvocation(false)}
        title="Convocation disciplinaire"
        org="Conseil de discipline"
        reference={`Dossier N° ${dossier.reference}`}
        pdfPath={`/discipline/${dossier.id}/convocation/pdf`} pdfFilename={`Convocation-disciplinaire-${dossier.reference}.pdf`}
        signataire={{ role: "Le Bâtonnier, Président du Conseil de discipline", nom: "Me BIKINDOU Audrey Séverin" }}
        onArchive={() => archiverDoc({ categorie: "Convocation disciplinaire", titre: `Convocation — dossier ${dossier.reference}`, reference: dossier.reference, date: new Date().toISOString().slice(0, 10) })}
      >
        <p>
          Dans le cadre du dossier disciplinaire <strong>N° {dossier.reference}</strong>,{" "}
          <strong>{dossier.avocatNom === "Confidentiel" ? "l'avocat concerné" : `Me ${dossier.avocatNom}`}</strong>{" "}
          est invité(e) à comparaître devant le Conseil de discipline de l'Ordre des Avocats du
          Barreau de Pointe-Noire{form.dateAudience ? <>, le <strong>{new Date(form.dateAudience).toLocaleDateString("fr-FR")}</strong></> : null}.
        </p>
        <p className="mt-3">Objet : {dossier.objet}.</p>
        <p className="mt-3 text-[12px] text-gris">L'intéressé(e) pourra se faire assister du conseil de son choix.</p>
      </DocumentModal>
    </div>
  );
}

export default DossierDetail;
