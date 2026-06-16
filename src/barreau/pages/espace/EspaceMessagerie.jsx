import { useEffect, useMemo, useRef, useState } from "react";
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, PlusIcon, BuildingLibraryIcon, UserIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, PageHeader, useToast, TableSkeleton, ErrorState, EmptyState } from "../../components";
import { formatDateTime } from "../../utils/format";
import {
  getEspaceMessagerie, getEspaceConversation, creerEspaceConversation,
  repondreEspaceConversation, getEspaceAnnuaire,
} from "../../api/resources";

/** Bulle de message — alignée à droite pour l'avocat connecté. */
function Bulle({ m }) {
  return (
    <div className={`flex ${m.estMoi ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.estMoi ? "bg-navy text-white" : "bg-grisL text-encre"}`}>
        {!m.estMoi && <div className="mb-0.5 text-[11px] font-semibold text-or">{m.estAdministration ? "Administration" : m.auteurNom}</div>}
        <div className="whitespace-pre-line leading-relaxed">{m.corps}</div>
        <div className={`mt-1 text-[10px] ${m.estMoi ? "text-white/60" : "text-gris"}`}>{formatDateTime(m.createdAt)}</div>
      </div>
    </div>
  );
}

/** Composeur d'un nouveau fil (administration ou confrère). */
function NouveauFil({ open, onClose, onCree }) {
  const toast = useToast();
  const [cible, setCible] = useState("administration"); // administration | confrere
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [destinataire, setDestinataire] = useState("");
  const [confreres, setConfreres] = useState([]);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (open) {
      setCible("administration"); setSujet(""); setCorps(""); setDestinataire("");
      getEspaceAnnuaire().then(setConfreres).catch(() => setConfreres([]));
    }
  }, [open]);

  const envoyer = async () => {
    if (!sujet.trim() || !corps.trim()) return toast.error("Renseignez l'objet et le message.");
    if (cible === "confrere" && !destinataire) return toast.error("Choisissez un confrère destinataire.");
    setEnvoi(true);
    try {
      const { id } = await creerEspaceConversation({
        sujet: sujet.trim(),
        corps: corps.trim(),
        avecAdministration: cible === "administration",
        destinataireMembreId: cible === "confrere" ? Number(destinataire) : undefined,
      });
      toast.success("Message envoyé.");
      onCree(id);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouveau message"
      footer={
        <>
          <button className="bpn-btn bpn-btn-ghost" onClick={onClose}>Annuler</button>
          <button className="bpn-btn bpn-btn-primary" onClick={envoyer} disabled={envoi}>
            <PaperAirplaneIcon className="h-4 w-4" /> {envoi ? "Envoi…" : "Envoyer"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gris">Destinataire</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: "administration", label: "Administration", icon: BuildingLibraryIcon },
              { v: "confrere", label: "Un confrère", icon: UserIcon },
            ].map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => setCible(v)}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${cible === v ? "border-navy bg-navy/5 font-medium text-navy" : "border-grisM text-gris hover:bg-grisL/40"}`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        {cible === "confrere" && (
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gris">Confrère</div>
            <select value={destinataire} onChange={(e) => setDestinataire(e.target.value)} className="bpn-input">
              <option value="">Sélectionner un confrère…</option>
              {confreres.map((c) => <option key={c.id} value={c.id}>Me {c.nom}{c.cabinet ? ` — ${c.cabinet}` : ""}</option>)}
            </select>
          </div>
        )}

        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gris">Objet</div>
          <input value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Objet du message" className="bpn-input" maxLength={160} />
        </div>

        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gris">Message</div>
          <textarea value={corps} onChange={(e) => setCorps(e.target.value)} rows={5} placeholder="Votre message…" className="bpn-input resize-none" maxLength={5000} />
        </div>
      </div>
    </Modal>
  );
}

/** Espace avocat — messagerie interne (administration & confrères). */
export function EspaceMessagerie() {
  const toast = useToast();
  const [convs, setConvs] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [selId, setSelId] = useState(null);
  const [fil, setFil] = useState(null); // conversation détaillée
  const [reponse, setReponse] = useState("");
  const [modal, setModal] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const finRef = useRef(null);

  const chargerListe = (selectAfter) =>
    getEspaceMessagerie()
      .then((d) => { setConvs(d); if (selectAfter) ouvrir(selectAfter); })
      .catch((e) => { setErreur(true); toast.error(e.message); });

  useEffect(() => { setErreur(false); chargerListe(); /* eslint-disable-line */ }, []);
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: "smooth" }); }, [fil]);

  const ouvrir = (id) => {
    setSelId(id);
    setFil(null);
    getEspaceConversation(id)
      .then((d) => { setFil(d); setConvs((cs) => cs?.map((c) => (c.id === id ? { ...c, nonLus: 0 } : c))); })
      .catch((e) => toast.error(e.message));
  };

  const envoyer = async () => {
    if (!reponse.trim() || !selId) return;
    setEnvoi(true);
    try {
      await repondreEspaceConversation(selId, reponse.trim());
      setReponse("");
      const d = await getEspaceConversation(selId);
      setFil(d);
      chargerListe();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  const totalNonLus = useMemo(() => (convs ?? []).reduce((a, c) => a + (c.nonLus || 0), 0), [convs]);

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Votre messagerie n'a pas pu être chargée." onRetry={() => { setErreur(false); chargerListe(); }} /></div>;
  if (!convs) return <div className="bpn-card p-6"><TableSkeleton rows={5} cols={2} /></div>;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Mon espace" titre="Messagerie" sousTitre="Échangez avec le Secrétariat de l'Ordre ou avec vos confrères.">
        <button className="bpn-btn bpn-btn-primary" onClick={() => setModal(true)}>
          <PlusIcon className="h-4 w-4" /> Nouveau message
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
        {/* Liste des fils */}
        <div className="bpn-card overflow-hidden">
          <div className="bpn-card-header">
            <span className="bpn-card-heading">Conversations</span>
            {totalNonLus > 0 && <Badge ton="rouge" dot={false}>{totalNonLus}</Badge>}
          </div>
          {convs.length === 0 ? (
            <div className="p-4"><EmptyState icon={ChatBubbleLeftRightIcon} title="Aucune conversation" description="Démarrez un échange avec « Nouveau message »." /></div>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-grisL overflow-y-auto">
              {convs.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => ouvrir(c.id)}
                    className={`w-full px-4 py-3 text-left transition hover:bg-grisL/40 ${selId === c.id ? "bg-grisL/60" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium text-encre">
                        {c.avecAdministration ? <BuildingLibraryIcon className="h-3.5 w-3.5 shrink-0 text-or" /> : <UserIcon className="h-3.5 w-3.5 shrink-0 text-or" />}
                        {c.interlocuteur}
                      </span>
                      {c.nonLus > 0 && <Badge ton="rouge" dot={false}>{c.nonLus}</Badge>}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-gris">{c.sujet}</div>
                    {c.apercu && <div className="mt-0.5 truncate text-xs text-gris">{c.apercu.estMoi ? "Vous : " : ""}{c.apercu.corps}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Fil sélectionné */}
        <div className="bpn-card flex min-h-[60vh] flex-col">
          {!selId ? (
            <div className="flex flex-1 items-center justify-center p-4">
              <EmptyState icon={ChatBubbleLeftRightIcon} title="Aucune conversation sélectionnée" description="Choisissez une conversation à gauche ou démarrez-en une nouvelle." />
            </div>
          ) : !fil ? (
            <div className="p-6"><TableSkeleton rows={4} cols={1} /></div>
          ) : (
            <>
              <div className="bpn-card-header">
                <span className="bpn-card-heading truncate">{fil.sujet}</span>
                <Badge ton="bleu" dot={false}>{fil.interlocuteur}</Badge>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {fil.messages.map((m) => <Bulle key={m.id} m={m} />)}
                <div ref={finRef} />
              </div>
              <div className="border-t border-grisL p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={reponse}
                    onChange={(e) => setReponse(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); envoyer(); } }}
                    rows={2}
                    placeholder="Écrire un message… (Ctrl+Entrée pour envoyer)"
                    className="bpn-input resize-none"
                    maxLength={5000}
                  />
                  <button className="bpn-btn bpn-btn-primary shrink-0" onClick={envoyer} disabled={envoi || !reponse.trim()}>
                    <PaperAirplaneIcon className="h-4 w-4" /> Envoyer
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <NouveauFil open={modal} onClose={() => setModal(false)} onCree={(id) => { setModal(false); chargerListe(id); }} />
    </div>
  );
}

export default EspaceMessagerie;
