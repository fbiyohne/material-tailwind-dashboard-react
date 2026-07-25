import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlusIcon, TrashIcon, BuildingOffice2Icon, ArrowUturnLeftIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, PageHeader, useToast, useConfirm, TableSkeleton, ErrorState, EmptyState } from "../components";
import { formatDate } from "../utils/format";
import { useAuth } from "../auth/AuthContext";
import {
  listerCabinets, ajouterCabinet, majCabinet, supprimerCabinet,
  rattacherMembreCabinet, detacherMembreCabinet, purgerCabinets, listerMembres,
} from "../api/resources";

const FORMES = ["Cabinet individuel", "Société civile professionnelle", "Société d'avocats", "Association d'avocats", "Autre"];
const anc = (c) => { const t = Date.parse(c.anciennete || ""); return Number.isNaN(t) ? Infinity : t; };

/**
 * Personnes morales (cabinets, sociétés, associations d'avocats). Regroupe des
 * membres, porte un titulaire et une convention ; les conventions déposées sont
 * numérotées (C1, C2…) par ancienneté. Gestion réservée au Secrétaire Général.
 */
export function Cabinets() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const peutGerer = ["SECRETAIRE_GENERAL", "ADMIN"].includes(user?.role);

  const [cabinets, setCabinets] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState("actif"); // actif | retiré | tous
  const [conv, setConv] = useState("tous"); // conv | tous
  const [edition, setEdition] = useState(null); // fiche cabinet en cours (création/édition)
  const [gestion, setGestion] = useState(null); // cabinet dont on gère les membres

  const charger = useCallback(() => {
    setErreur(false);
    listerCabinets().then(setCabinets).catch(() => setErreur(true));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  // Après un ajout/détachement de membre : recharge la liste et rafraîchit la
  // fenêtre de gestion ouverte (effectif, titulaire, membres à jour).
  const syncApresMembre = useCallback(async () => {
    try {
      const l = await listerCabinets();
      setCabinets(l);
      setGestion((g) => (g ? l.find((x) => x.id === g.id) ?? g : g));
    } catch { /* silencieux : la fermeture rechargera */ }
  }, []);

  const action = async (fn, msg) => { try { await fn(); toast.success(msg); charger(); } catch (e) { toast.error(e.message); } };

  // Numérotation C : conventions déposées et actives, classées par ancienneté.
  const numeros = useMemo(() => {
    if (!cabinets) return new Map();
    const conventions = cabinets.filter((c) => c.conventionDeposee && c.statut !== "retiré").slice().sort((a, b) => anc(a) - anc(b) || a.nom.localeCompare(b.nom));
    return new Map(conventions.map((c, i) => [c.id, `C${i + 1}`]));
  }, [cabinets]);

  const liste = useMemo(() => {
    if (!cabinets) return [];
    let l = cabinets.slice();
    if (conv === "conv") l = l.filter((c) => c.conventionDeposee);
    if (filtre === "actif") l = l.filter((c) => c.statut !== "retiré");
    else if (filtre === "retiré") l = l.filter((c) => c.statut === "retiré");
    if (q) { const s = q.toLowerCase(); l = l.filter((c) => (c.nom + " " + (c.adresse || "")).toLowerCase().includes(s)); }
    return l.sort((a, b) => {
      const ra = a.statut === "retiré" ? 1 : 0, rb = b.statut === "retiré" ? 1 : 0;
      return ra - rb || anc(a) - anc(b) || a.nom.localeCompare(b.nom);
    });
  }, [cabinets, q, filtre, conv]);

  const retirer = (c) => confirm({ title: "Retirer la personne morale ?", message: `${c.nom} sortira de la liste active et de la numérotation. Action réversible.`, confirmLabel: "Retirer", danger: true })
    .then((ok) => ok && action(() => majCabinet(c.id, { statut: "retiré", dateRetrait: new Date().toISOString().slice(0, 10), motifRetrait: "Retrait manuel" }), "Cabinet retiré."));
  const retablir = (c) => action(() => majCabinet(c.id, { statut: "actif", dateRetrait: null, motifRetrait: null }), "Cabinet rétabli.");
  const supprimer = (c) => confirm({ title: "Supprimer définitivement ?", message: `${c.nom} sera supprimé et ses membres détachés. Cette action est irréversible.`, confirmLabel: "Supprimer", danger: true })
    .then((ok) => ok && action(() => supprimerCabinet(c.id), "Cabinet supprimé."));
  const purger = () => confirm({ title: "Retirer les cabinets à titulaire inactif ?", message: "Les personnes morales actives dont le titulaire n'est plus en exercice (ou sans titulaire) seront retirées. Réversible.", confirmLabel: "Retirer" })
    .then((ok) => ok && action(async () => { const r = await purgerCabinets(); toast.success(`${r.retires} cabinet(s) retiré(s).`); }, "Purge effectuée."));

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="La liste des personnes morales n'a pas pu être chargée." onRetry={charger} /></div>;
  if (!cabinets) return <div className="bpn-card p-6"><TableSkeleton rows={8} cols={5} /></div>;

  const nbConv = cabinets.filter((c) => c.conventionDeposee && c.statut !== "retiré").length;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Membres" titre="Personnes morales" sousTitre={`Cabinets, sociétés et associations d'avocats — ${nbConv} convention(s) déposée(s).`}>
        {peutGerer && <button className="bpn-btn bpn-btn-ghost" onClick={purger}>Retirer les titulaires inactifs</button>}
        {peutGerer && <button className="bpn-btn bpn-btn-or" onClick={() => setEdition({ nom: "", forme: "Cabinet individuel", adresse: "", tel: "", email: "", conventionDeposee: false })}><PlusIcon className="h-4 w-4" /> Ajouter</button>}
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un cabinet, une adresse…" className="bpn-input flex-1" />
        <select value={conv} onChange={(e) => setConv(e.target.value)} className="bpn-input sm:w-64"><option value="tous">Toutes les personnes morales</option><option value="conv">Conventions déposées ({nbConv})</option></select>
        <select value={filtre} onChange={(e) => setFiltre(e.target.value)} className="bpn-input sm:w-40"><option value="actif">Actifs</option><option value="retiré">Retirés</option><option value="tous">Tous</option></select>
      </div>

      <div className="bpn-card overflow-hidden">
        {liste.length === 0 ? (
          <div className="p-6"><EmptyState icon={BuildingOffice2Icon} title="Aucune personne morale" description="Ajoutez un cabinet ou rattachez des membres depuis leur fiche." /></div>
        ) : (
          <table className="bpn-table">
            <thead>
              <tr>
                <th className="w-14">N°</th>
                <th>Personne morale</th>
                <th>Titulaire</th>
                <th>Forme</th>
                <th className="text-center">Effectif</th>
                <th className="text-center">Convention</th>
                <th className="text-right">{peutGerer ? "Actions" : "Statut"}</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((c) => {
                const retire = c.statut === "retiré";
                return (
                  <tr key={c.id} className={retire ? "opacity-60" : ""}>
                    <td className="font-mono text-or">{retire ? "—" : (numeros.get(c.id) ?? "·")}</td>
                    <td>
                      <div className="font-medium text-encre">{c.nom}</div>
                      {c.adresse && <div className="text-xs text-gris">{c.adresse}</div>}
                      {retire && c.motifRetrait && <div className="text-xs text-rouge">{c.motifRetrait}{c.dateRetrait ? ` · ${formatDate(c.dateRetrait)}` : ""}</div>}
                    </td>
                    <td>
                      {c.titulaire ? (
                        <span className="text-sm">Me {c.titulaire.nom}{c.titulaire.statut !== "INSCRIT" && <Badge ton="gris" dot={false} className="ml-1 !text-[10px]">inactif</Badge>}</span>
                      ) : <span className="text-xs text-gris">—</span>}
                    </td>
                    <td className="text-xs text-gris">{c.forme || "—"}</td>
                    <td className="text-center font-mono text-navy">{c.effectif}</td>
                    <td className="text-center">{c.conventionDeposee ? <Badge ton="vert" dot={false}>Déposée</Badge> : <span className="text-xs text-gris">—</span>}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        <Badge ton={retire ? "gris" : "bleu"} dot={false} className="whitespace-nowrap">{retire ? "Retiré" : "Actif"}</Badge>
                        {peutGerer && (
                          <>
                            <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs" onClick={() => setGestion(c)}>Membres</button>
                            <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs" onClick={() => setEdition({ ...c, forme: c.forme || "Cabinet individuel", adresse: c.adresse || "", tel: c.tel || "", email: c.email || "" })}>Éditer</button>
                            {retire
                              ? <button className="bpn-btn bpn-btn-ghost !px-2 !py-1 text-xs" onClick={() => retablir(c)} title="Rétablir"><ArrowUturnLeftIcon className="h-3.5 w-3.5" /></button>
                              : <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs" onClick={() => retirer(c)}>Retirer</button>}
                            <button type="button" onClick={() => supprimer(c)} title="Supprimer" className="rounded p-1.5 text-gris transition hover:bg-rougeL hover:text-rouge"><TrashIcon className="h-3.5 w-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <CabinetForm cabinet={edition} onClose={() => setEdition(null)} onSaved={() => { setEdition(null); charger(); }} />
      <MembresManager cabinet={gestion} onClose={() => setGestion(null)} onChange={syncApresMembre} />
    </div>
  );
}

/** Formulaire de création / édition d'une personne morale. */
function CabinetForm({ cabinet, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(cabinet ?? {});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(cabinet ?? {}); }, [cabinet]);
  if (!cabinet) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const estEdition = !!cabinet.id;

  const enregistrer = async () => {
    // Garde anti double-clic : une création répétée dupliquerait la personne morale.
    if (!form.nom?.trim() || busy) return;
    const body = {
      nom: form.nom.trim(), forme: form.forme || null, adresse: form.adresse || null,
      tel: form.tel || null, email: form.email || null, conventionDeposee: !!form.conventionDeposee,
      ...(estEdition ? { titulaireId: form.titulaireId ? Number(form.titulaireId) : null } : {}),
    };
    setBusy(true);
    try {
      if (estEdition) await majCabinet(cabinet.id, body); else await ajouterCabinet(body);
      toast.success(estEdition ? "Cabinet mis à jour." : "Cabinet créé.");
      onSaved();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={estEdition ? "Modifier la personne morale" : "Nouvelle personne morale"}
      footer={<><button className="bpn-btn bpn-btn-ghost" onClick={onClose}>Annuler</button><button className="bpn-btn bpn-btn-primary" onClick={enregistrer} disabled={!form.nom?.trim() || busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button></>}>
      <div className="space-y-3">
        <label className="block text-sm"><span className="mb-1 block text-xs uppercase tracking-wide text-gris">Dénomination</span>
          <input value={form.nom ?? ""} onChange={set("nom")} className="bpn-input w-full" /></label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm"><span className="mb-1 block text-xs uppercase tracking-wide text-gris">Forme</span>
            <select value={form.forme ?? "Cabinet individuel"} onChange={set("forme")} className="bpn-input w-full">{FORMES.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
          {estEdition && (
            <label className="block text-sm"><span className="mb-1 block text-xs uppercase tracking-wide text-gris">Titulaire</span>
              <select value={form.titulaireId ?? ""} onChange={set("titulaireId")} className="bpn-input w-full">
                <option value="">— membre le plus ancien —</option>
                {(cabinet.membres ?? []).map((m) => <option key={m.id} value={m.id}>Me {m.nom}</option>)}
              </select></label>
          )}
        </div>
        <label className="block text-sm"><span className="mb-1 block text-xs uppercase tracking-wide text-gris">Adresse / siège</span>
          <input value={form.adresse ?? ""} onChange={set("adresse")} className="bpn-input w-full" /></label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm"><span className="mb-1 block text-xs uppercase tracking-wide text-gris">Téléphone</span>
            <input value={form.tel ?? ""} onChange={set("tel")} className="bpn-input w-full" /></label>
          <label className="block text-sm"><span className="mb-1 block text-xs uppercase tracking-wide text-gris">Courriel</span>
            <input value={form.email ?? ""} onChange={set("email")} className="bpn-input w-full" /></label>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-encre">
          <input type="checkbox" checked={!!form.conventionDeposee} onChange={set("conventionDeposee")} className="h-4 w-4" />
          Convention d'association ou de société déposée à l'Ordre (figure dans la liste numérotée des personnes morales)
        </label>
      </div>
    </Modal>
  );
}

/** Gestion des membres rattachés à un cabinet (ajout par recherche / détachement). */
function MembresManager({ cabinet, onClose, onChange }) {
  const toast = useToast();
  const [nom, setNom] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const champ = useRef(null);

  useEffect(() => {
    const q = nom.trim();
    if (q.length < 2) { setSuggestions([]); return undefined; }
    const t = setTimeout(() => { listerMembres({ q, pageSize: 6 }).then((d) => setSuggestions(d.items)).catch(() => setSuggestions([])); }, 220);
    return () => clearTimeout(t);
  }, [nom]);

  if (!cabinet) return null;
  const action = async (fn, msg) => { try { await fn(); toast.success(msg); onChange(); } catch (e) { toast.error(e.message); } };
  const rattacher = (m) => { setNom(""); setSuggestions([]); action(() => rattacherMembreCabinet(cabinet.id, m.id), `Me ${m.nom} rattaché(e).`); };
  const detacher = (m) => action(() => detacherMembreCabinet(cabinet.id, m.id), "Membre détaché.");

  return (
    <Modal open onClose={onClose} title={`Membres — ${cabinet.nom}`} footer={<button className="bpn-btn bpn-btn-primary" onClick={onClose}>Fermer</button>}>
      <div className="space-y-4">
        <div className="relative">
          <label className="mb-1 block text-xs uppercase tracking-wide text-gris">Rattacher un avocat</label>
          <input ref={champ} value={nom} onChange={(e) => { setNom(e.target.value); setOuvert(true); }} onFocus={() => setOuvert(true)} onBlur={() => setTimeout(() => setOuvert(false), 120)}
            placeholder="Rechercher un avocat (Me …)" className="bpn-input w-full" autoComplete="off" />
          {ouvert && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-grisM bg-white shadow-card">
              {suggestions.map((m) => (
                <li key={m.id}>
                  <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-grisL" onMouseDown={(e) => { e.preventDefault(); rattacher(m); }}>
                    <span className="font-medium text-encre">Me {m.nom}</span><span className="font-mono text-xs text-gris">N° {m.num}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-grisL">
          <div className="border-b border-grisL bg-grisL/50 px-3 py-2 text-xs font-medium text-encre">Membres rattachés — {cabinet.membres?.length ?? 0}</div>
          {(cabinet.membres ?? []).length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-gris">Aucun membre rattaché.</p>
          ) : (
            <ul className="divide-y divide-grisL">
              {cabinet.membres.map((m) => (
                <li key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-encre">Me {m.nom}{cabinet.titulaire?.id === m.id && <Badge ton="or" dot={false} className="ml-2 !text-[10px]">titulaire</Badge>}</span>
                  <button type="button" onClick={() => detacher(m)} className="rounded p-1.5 text-gris transition hover:bg-rougeL hover:text-rouge" title="Détacher"><TrashIcon className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default Cabinets;
