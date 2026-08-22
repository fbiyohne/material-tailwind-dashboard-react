import { useEffect, useMemo, useRef, useState } from "react";
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, UserIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Badge, PageHeader, useToast, TableSkeleton, ErrorState, EmptyState, MessageBulle } from "../components";
import { getMessagerie, getConversationAdmin, repondreConversationAdmin } from "../api/resources";
import { useMessagerieRealtime } from "../hooks/useMessagerieRealtime";

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

  // Temps réel : un nouveau message d'avocat recharge la liste et le fil ouvert.
  useMessagerieRealtime({ selId, onListe: chargerListe, onFilActif: (id) => getConversationAdmin(id).then(setFil).catch(() => {}) });

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
        {/* Liste — sur mobile, masquée dès qu'un fil est ouvert (vue maître/détail). */}
        <div className={`bpn-card overflow-hidden ${selId ? "hidden lg:block" : ""}`}>
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
                  <button onClick={() => ouvrir(c.id)} aria-current={selId === c.id ? "true" : undefined} className={`w-full px-4 py-3 text-left transition hover:bg-grisL/40 ${selId === c.id ? "bg-grisL/60" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium text-encre">
                        <UserIcon className="h-3.5 w-3.5 shrink-0 text-or" /> {c.expediteur}
                      </span>
                      {c.nonLus > 0 && <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-rouge px-1 text-2xs font-semibold leading-none text-white">{c.nonLus}</span>}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-gris">{c.sujet}</div>
                    {c.apercu && <div className="mt-0.5 truncate text-xs text-gris">{c.apercu.estAdministration ? "Vous : " : ""}{c.apercu.corps}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`bpn-card flex min-h-[60vh] flex-col ${selId ? "" : "hidden lg:flex"}`}>
          {selId && (
            <button
              type="button"
              onClick={() => { setSelId(null); setFil(null); }}
              className="flex items-center gap-1.5 border-b border-grisL px-4 py-2 text-sm text-gris transition hover:text-navy lg:hidden"
            >
              <ArrowLeftIcon className="h-4 w-4" /> Conversations
            </button>
          )}
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
                {fil.messages.map((m) => (
                  <MessageBulle key={m.id} aDroite={m.estAdministration} etiquette={m.auteurNom} corps={m.corps} date={m.createdAt} />
                ))}
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
