import { useEffect, useMemo, useRef, useState } from "react";
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, UserIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, useToast, TableSkeleton, ErrorState, EmptyState } from "../components";
import { formatDateTime } from "../utils/format";
import { getMessagerie, getConversationAdmin, repondreConversationAdmin } from "../api/resources";

/** Bulle de message — alignée à droite pour l'administration. */
function Bulle({ m }) {
  const aDroite = m.estAdministration;
  return (
    <div className={`flex ${aDroite ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${aDroite ? "bg-navy text-white" : "bg-grisL text-encre"}`}>
        <div className={`mb-0.5 text-[11px] font-semibold ${aDroite ? "text-or-2" : "text-or"}`}>{m.auteurNom}</div>
        <div className="whitespace-pre-line leading-relaxed">{m.corps}</div>
        <div className={`mt-1 text-[10px] ${aDroite ? "text-white/60" : "text-gris"}`}>{formatDateTime(m.createdAt)}</div>
      </div>
    </div>
  );
}

/** Back-office — messagerie de l'administration (fils adressés par les avocats). */
export function Messagerie() {
  const toast = useToast();
  const [convs, setConvs] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [selId, setSelId] = useState(null);
  const [fil, setFil] = useState(null);
  const [reponse, setReponse] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const finRef = useRef(null);

  const chargerListe = () =>
    getMessagerie().then(setConvs).catch((e) => { setErreur(true); toast.error(e.message); });

  useEffect(() => { setErreur(false); chargerListe(); /* eslint-disable-line */ }, []);
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: "smooth" }); }, [fil]);

  const ouvrir = (id) => {
    setSelId(id);
    setFil(null);
    getConversationAdmin(id)
      .then((d) => { setFil(d); setConvs((cs) => cs?.map((c) => (c.id === id ? { ...c, nonLus: 0 } : c))); })
      .catch((e) => toast.error(e.message));
  };

  const envoyer = async () => {
    if (!reponse.trim() || !selId) return;
    setEnvoi(true);
    try {
      await repondreConversationAdmin(selId, reponse.trim());
      setReponse("");
      setFil(await getConversationAdmin(selId));
      chargerListe();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  const totalNonLus = useMemo(() => (convs ?? []).reduce((a, c) => a + (c.nonLus || 0), 0), [convs]);

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="La messagerie n'a pas pu être chargée." onRetry={() => { setErreur(false); chargerListe(); }} /></div>;
  if (!convs) return <div className="bpn-card p-6"><TableSkeleton rows={5} cols={2} /></div>;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Institutionnel" titre="Messagerie" sousTitre="Demandes et messages adressés au Secrétariat par les avocats." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="bpn-card overflow-hidden">
          <div className="bpn-card-header">
            <span className="bpn-card-heading">Conversations</span>
            {totalNonLus > 0 && <Badge ton="rouge" dot={false}>{totalNonLus}</Badge>}
          </div>
          {convs.length === 0 ? (
            <div className="p-4"><EmptyState icon={ChatBubbleLeftRightIcon} title="Aucun message" description="Les messages des avocats apparaîtront ici." /></div>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-grisL overflow-y-auto">
              {convs.map((c) => (
                <li key={c.id}>
                  <button onClick={() => ouvrir(c.id)} className={`w-full px-4 py-3 text-left transition hover:bg-grisL/40 ${selId === c.id ? "bg-grisL/60" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium text-encre">
                        <UserIcon className="h-3.5 w-3.5 shrink-0 text-or" /> {c.expediteur}
                      </span>
                      {c.nonLus > 0 && <Badge ton="rouge" dot={false}>{c.nonLus}</Badge>}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-gris">{c.sujet}</div>
                    {c.apercu && <div className="mt-0.5 truncate text-xs text-gris">{c.apercu.estAdministration ? "Vous : " : ""}{c.apercu.corps}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bpn-card flex min-h-[60vh] flex-col">
          {!selId ? (
            <div className="flex flex-1 items-center justify-center p-4">
              <EmptyState icon={ChatBubbleLeftRightIcon} title="Aucune conversation sélectionnée" description="Choisissez une conversation pour la consulter et y répondre." />
            </div>
          ) : !fil ? (
            <div className="p-6"><TableSkeleton rows={4} cols={1} /></div>
          ) : (
            <>
              <div className="bpn-card-header">
                <span className="bpn-card-heading truncate">{fil.sujet}</span>
                <Badge ton="bleu" dot={false}>{fil.expediteur}</Badge>
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
                    placeholder="Répondre… (Ctrl+Entrée pour envoyer)"
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
    </div>
  );
}

export default Messagerie;
