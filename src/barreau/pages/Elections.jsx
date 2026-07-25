import { useCallback, useEffect, useRef, useState } from "react";
import { PlusIcon, TrashIcon, LockOpenIcon, LockClosedIcon, MegaphoneIcon, CheckBadgeIcon, UsersIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, FormField, PageHeader, useToast, useConfirm, TableSkeleton, ErrorState, EmptyState } from "../components";
import { useAuth } from "../auth/AuthContext";
import {
  listerScrutins, getScrutin, creerScrutin, ajouterCandidat, supprimerCandidat,
  ouvrirScrutin, saisirVoix, cloreScrutin, publierScrutin,
} from "../api/resources";

const TYPE = { CONSEIL: "Conseil de l'Ordre", BATONNIER: "Bâtonnier", AUTRE: "Autre scrutin" };
const MODALITE = { PRESENTIEL: "Présentiel (saisie)", EN_LIGNE: "Vote en ligne" };
const STATUT = {
  PREPARATION: { label: "En préparation", ton: "gris" },
  OUVERT: { label: "Ouvert", ton: "vert" },
  CLOS: { label: "Clôturé", ton: "or" },
  PUBLIE: { label: "Publié", ton: "bleu" },
};
const videForm = { titre: "", type: "CONSEIL", modalite: "EN_LIGNE", nbSieges: 1 };

export function Elections() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const peutGerer = ["SECRETAIRE_GENERAL", "ADMIN"].includes(user?.role);

  const [scrutins, setScrutins] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [selId, setSelId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(videForm);
  const [nomCand, setNomCand] = useState("");
  const [nonce, setNonce] = useState(0);

  const charger = useCallback(() => {
    setErreur(false);
    listerScrutins().then(setScrutins).catch(() => setErreur(true));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const ouvrirDetail = useCallback((id) => {
    setSelId(id);
    setDetail(null);
    getScrutin(id).then(setDetail).catch((e) => toast.error(e.message));
  }, [toast]);

  const rafraichir = () => { charger(); if (selId) getScrutin(selId).then(setDetail).catch(() => {}); };
  // `nonce` force le remontage des saisies non contrôlées (voix) après chaque action,
  // y compris en cas d'échec. `enCoursRef` évite qu'un double-clic déclenche deux fois
  // la même action de cycle de vie (ouvrir/clôturer/publier), fiable dès le 2e clic.
  const enCoursRef = useRef(false);
  const action = async (fn, msg) => {
    if (enCoursRef.current) return;
    enCoursRef.current = true;
    try { await fn(); toast.success(msg); rafraichir(); }
    catch (e) { toast.error(e.message); }
    finally { enCoursRef.current = false; setNonce((n) => n + 1); }
  };

  const creer = async () => {
    try {
      const s = await creerScrutin({ ...form, nbSieges: Number(form.nbSieges) || 1 });
      toast.success("Scrutin créé.");
      setModal(false); setForm(videForm); charger(); ouvrirDetail(s.id);
    } catch (e) { toast.error(e.message); }
  };

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="Les scrutins n'ont pas pu être chargés." onRetry={charger} /></div>;
  if (!scrutins) return <div className="bpn-card p-6"><TableSkeleton rows={5} cols={2} /></div>;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Institutionnel" titre="Élections" sousTitre="Scrutins du Conseil de l'Ordre et du Bâtonnier — vote en ligne ou saisie en présentiel.">
        {peutGerer && <button className="bpn-btn bpn-btn-or" onClick={() => setModal(true)}><PlusIcon className="h-4 w-4" /> Nouveau scrutin</button>}
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_1fr]">
        {/* Liste des scrutins */}
        <div className="space-y-2">
          {scrutins.length === 0 && <div className="bpn-card p-5"><EmptyState icon={MegaphoneIcon} title="Aucun scrutin" description="Créez un scrutin pour commencer." /></div>}
          {scrutins.map((s) => (
            <button key={s.id} onClick={() => ouvrirDetail(s.id)}
              className={`w-full rounded-lg border p-3 text-left transition ${selId === s.id ? "border-or bg-or-L" : "border-grisL bg-white hover:border-or/40"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-encre">{s.titre}</span>
                <Badge ton={STATUT[s.statut].ton} dot={false}>{STATUT[s.statut].label}</Badge>
              </div>
              <div className="mt-1 text-xs text-gris">{TYPE[s.type]} · {MODALITE[s.modalite]} · {s._count.candidats} candidat(s)</div>
            </button>
          ))}
        </div>

        {/* Détail du scrutin sélectionné */}
        <div className="bpn-card p-5">
          {!detail ? (
            <p className="py-10 text-center text-sm text-gris">Sélectionnez un scrutin pour le gérer.</p>
          ) : (
            <ScrutinDetail detail={detail} peutGerer={peutGerer} action={action} confirm={confirm} nomCand={nomCand} setNomCand={setNomCand} />
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau scrutin"
        footer={<button className="bpn-btn bpn-btn-or" disabled={!form.titre.trim()} onClick={creer}><CheckBadgeIcon className="h-4 w-4" /> Créer</button>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Intitulé" required full><input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} className="bpn-input" placeholder="Élection du Conseil de l'Ordre 2026" /></FormField>
          <FormField label="Type"><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="bpn-input">{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormField>
          <FormField label="Modalité"><select value={form.modalite} onChange={(e) => setForm({ ...form, modalite: e.target.value })} className="bpn-input">{Object.entries(MODALITE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormField>
          <FormField label="Sièges à pourvoir"><input type="number" min="1" value={form.nbSieges} onChange={(e) => setForm({ ...form, nbSieges: e.target.value })} className="bpn-input" /></FormField>
        </div>
      </Modal>
    </div>
  );
}

/** Détail + gestion d'un scrutin selon son statut. */
function ScrutinDetail({ detail, peutGerer, action, confirm, nomCand, setNomCand }) {
  const s = detail;
  const total = s.candidats.reduce((a, c) => a + c.voix, 0);
  const resultatsVisibles = s.statut === "CLOS" || s.statut === "PUBLIE";

  const ajouter = () => { if (nomCand.trim()) { action(() => ajouterCandidat(s.id, { nom: nomCand.trim() }), "Candidat ajouté."); setNomCand(""); } };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold text-encre">{s.titre}</h3>
          <div className="mt-0.5 text-xs text-gris">{TYPE[s.type]} · {MODALITE[s.modalite]} · {s.nbSieges} siège(s) · {s._count.emargements} votant(s)</div>
        </div>
        <Badge ton={STATUT[s.statut].ton} dot={false}>{STATUT[s.statut].label}</Badge>
      </div>

      {/* Ajout de candidat (préparation) */}
      {peutGerer && s.statut === "PREPARATION" && (
        <div className="flex gap-2">
          <input value={nomCand} onChange={(e) => setNomCand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ajouter()} placeholder="Nom du candidat (Me …)" className="bpn-input flex-1" />
          <button className="bpn-btn bpn-btn-primary" onClick={ajouter} disabled={!nomCand.trim()}><PlusIcon className="h-4 w-4" /> Ajouter</button>
        </div>
      )}

      {/* Candidats / résultats */}
      {s.candidats.length === 0 ? (
        <p className="py-6 text-center text-sm text-gris">Aucun candidat.</p>
      ) : (
        <ul className="space-y-2">
          {s.candidats.map((c, i) => {
            const elu = resultatsVisibles && i < s.nbSieges && c.voix > 0;
            const pct = total > 0 ? Math.round((c.voix / total) * 100) : 0;
            return (
              <li key={c.id} className={`rounded-lg border p-3 ${elu ? "border-vert/50 bg-vert/[0.06]" : "border-grisL"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-encre">{c.nom} {elu && <Badge ton="vert" dot={false}>Élu(e)</Badge>}</span>
                  <div className="flex items-center gap-2">
                    {/* Saisie des voix (présentiel, ouvert/clos) */}
                    {peutGerer && s.modalite === "PRESENTIEL" && s.statut !== "PUBLIE" && s.statut !== "PREPARATION" ? (
                      <input key={`voix-${c.id}-${nonce}`} type="number" min="0" defaultValue={c.voix} aria-label={`Voix de ${c.nom}`} className="bpn-input !w-24 !py-1 text-right text-sm"
                        onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== c.voix) action(() => saisirVoix(s.id, c.id, v), "Voix enregistrées."); }} />
                    ) : resultatsVisibles ? (
                      <span className="font-mono text-sm text-encre">{c.voix} voix · {pct}%</span>
                    ) : null}
                    {peutGerer && s.statut === "PREPARATION" && (
                      <button type="button" onClick={() => confirm({ title: "Retirer le candidat ?", message: c.nom, confirmLabel: "Retirer", danger: true }).then((ok) => ok && action(() => supprimerCandidat(s.id, c.id), "Candidat retiré."))}
                        className="rounded p-1.5 text-gris transition hover:bg-rougeL hover:text-rouge"><TrashIcon className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </div>
                {resultatsVisibles && <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.nom} : ${c.voix} voix, ${pct}%`} className="mt-2 h-1.5 overflow-hidden rounded bg-grisM"><div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: elu ? "var(--bpn-vert)" : "var(--bpn-or)" }} /></div>}
              </li>
            );
          })}
        </ul>
      )}

      {/* Actions de cycle de vie */}
      {peutGerer && (
        <div className="flex flex-wrap gap-2 border-t border-grisL pt-4">
          {s.statut === "PREPARATION" && <button className="bpn-btn bpn-btn-or" disabled={s.candidats.length === 0} onClick={() => action(() => ouvrirScrutin(s.id), "Scrutin ouvert.")}><LockOpenIcon className="h-4 w-4" /> Ouvrir le scrutin</button>}
          {s.statut === "OUVERT" && <button className="bpn-btn bpn-btn-primary" onClick={() => confirm({ title: "Clôturer le scrutin ?", message: "Le vote sera arrêté et les résultats figés.", confirmLabel: "Clôturer" }).then((ok) => ok && action(() => cloreScrutin(s.id), "Scrutin clôturé."))}><LockClosedIcon className="h-4 w-4" /> Clôturer</button>}
          {s.statut === "CLOS" && <button className="bpn-btn bpn-btn-or" onClick={() => confirm({ title: "Publier les résultats ?", message: s.type === "CONSEIL" ? "Les résultats seront publiés et la composition du Conseil mise à jour." : "Les résultats seront publiés.", confirmLabel: "Publier" }).then((ok) => ok && action(() => publierScrutin(s.id), "Résultats publiés."))}><MegaphoneIcon className="h-4 w-4" /> Publier les résultats</button>}
          {s.statut === "PUBLIE" && <span className="inline-flex items-center gap-1.5 text-sm text-vert"><CheckBadgeIcon className="h-4 w-4" /> Résultats publiés{s.type === "CONSEIL" ? " · Conseil mis à jour" : ""}.</span>}
          {s.modalite === "EN_LIGNE" && s.statut === "OUVERT" && <span className="inline-flex items-center gap-1.5 text-sm text-gris"><UsersIcon className="h-4 w-4" /> {s._count.emargements} avocat(s) ont voté.</span>}
        </div>
      )}
    </div>
  );
}

export default Elections;
