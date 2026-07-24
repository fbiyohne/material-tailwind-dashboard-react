import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlusIcon, TrashIcon, UserGroupIcon, ArrowRightOnRectangleIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, PageHeader, useToast, useConfirm, TableSkeleton, ErrorState, EmptyState } from "../components";
import { formatDate } from "../utils/format";
import { fonctionsConseil } from "../data/config";
import { useAuth } from "../auth/AuthContext";
import { listerConseil, ajouterMembreConseil, majMembreConseil, supprimerMembreConseil, listerMembres } from "../api/resources";

// Rôles structurés : pilotent le regroupement à l'affichage (cf. Ordre National).
const ROLES = [
  { value: "membre", label: "Membre" },
  { value: "bureau", label: "Bureau" },
  { value: "batonnier", label: "Bâtonnier" },
];
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

// Ordre protocolaire du bureau (Secrétaire Général, adjoint, Trésorier, adjoint).
const SIGLES = ["SGO", "SGA", "TG", "TGA"];
const SIGLE_ORDER = { SGO: 1, SGA: 2, TG: 3, TGA: 4 };
const bureauRang = (m) => SIGLE_ORDER[m.sigle] ?? 9;

const MOTIFS_SORTIE = ["Fin de mandat", "Démission", "Décès", "Radiation", "Empêchement définitif", "Incompatibilité", "Autre"];

// Fonction par défaut proposée selon le rôle (l'intitulé reste éditable pour le bureau).
const fonctionDefaut = (role) => (role === "batonnier" ? "Bâtonnier" : role === "membre" ? "Membre du Conseil" : "Secrétaire Général");

const optionsFonction = (courant) => {
  const base = fonctionsConseil();
  return courant && !base.includes(courant) ? [courant, ...base] : base;
};

// Ancienneté d'un siège : date de serment de l'avocat rattaché (repli : début de mandat).
const anciennete = (m) => {
  const t = Date.parse(m.anciennete || m.mandatDebut || "");
  return Number.isNaN(t) ? Infinity : t;
};

const videForm = { nom: "", fonction: "Membre du Conseil", role: "membre", sigle: "", membreId: null };

/**
 * Composition du Conseil de l'Ordre — gestion des membres, rôles et mandats (SG).
 * Affichage regroupé par rôle (Bâtonnier / Bureau / Membres) ; les membres sont
 * classés par ancienneté. Les fins de mandat sont enregistrées comme « sorties »
 * motivées et datées : le siège devient « sortant » et reste conservé en historique
 * (rétablissement possible). La composition est recomposée automatiquement à la
 * publication d'une élection du Conseil.
 */
export function Conseil() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const peutGerer = ["SECRETAIRE_GENERAL", "ADMIN"].includes(user?.role);

  const [membres, setMembres] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [form, setForm] = useState(videForm);
  const [sortie, setSortie] = useState(null); // { membre, motif, date } — modale de sortie

  // Autocomplétion sur le nom (annuaire des avocats).
  const [suggestions, setSuggestions] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const champNom = useRef(null);

  const charger = useCallback(() => {
    setErreur(false);
    // `tous` : on récupère aussi les sièges sortants pour l'historique.
    listerConseil(true).then(setMembres).catch(() => setErreur(true));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    const q = form.nom.trim();
    if (!peutGerer || form.membreId || q.length < 2) { setSuggestions([]); return undefined; }
    const t = setTimeout(() => {
      listerMembres({ q, pageSize: 6 }).then((d) => setSuggestions(d.items)).catch(() => setSuggestions([]));
    }, 220);
    return () => clearTimeout(t);
  }, [form.nom, form.membreId, peutGerer]);

  const choisir = (m) => { setForm((f) => ({ ...f, nom: `Me ${m.nom}`, membreId: m.id })); setOuvert(false); setSuggestions([]); };

  const action = async (fn, msg) => { try { await fn(); toast.success(msg); charger(); } catch (e) { toast.error(e.message); } };

  const ajouter = () => {
    if (!form.nom.trim()) return;
    const fonction = form.fonction.trim() || fonctionDefaut(form.role);
    action(
      () => ajouterMembreConseil({ nom: form.nom.trim(), fonction, role: form.role, sigle: form.role === "bureau" ? form.sigle.trim() || null : null, membreId: form.membreId ?? null, ordre: (membres?.length ?? 0) + 1 }),
      "Membre ajouté.",
    );
    setForm(videForm);
    setSuggestions([]);
  };

  const supprimer = (m) => confirm({ title: "Retirer du Conseil ?", message: `${m.nom} sera définitivement retiré(e) de la composition et de l'historique.`, confirmLabel: "Retirer", danger: true })
    .then((ok) => ok && action(() => supprimerMembreConseil(m.id), "Membre retiré."));

  const retablir = (m) => action(() => majMembreConseil(m.id, { actif: true, motifSortie: null, mandatFin: null }), "Mandat rétabli.");

  const enregistrerSortie = () => {
    if (!sortie) return;
    const motif = sortie.motif === "Autre" ? (sortie.detail?.trim() || "Autre") : sortie.motif;
    action(() => majMembreConseil(sortie.membre.id, { actif: false, motifSortie: motif, mandatFin: sortie.date || undefined }), "Sortie enregistrée.");
    setSortie(null);
  };

  const enFonction = useMemo(() => (membres ?? []).filter((m) => m.actif), [membres]);
  const sortants = useMemo(() => (membres ?? []).filter((m) => !m.actif), [membres]);
  const batonnier = enFonction.filter((m) => m.role === "batonnier");
  const bureau = enFonction.filter((m) => m.role === "bureau").slice().sort((a, b) => bureauRang(a) - bureauRang(b));
  const membresOrd = enFonction.filter((m) => m.role !== "batonnier" && m.role !== "bureau")
    .slice().sort((a, b) => anciennete(a) - anciennete(b) || (a.ordre ?? 0) - (b.ordre ?? 0) || a.nom.localeCompare(b.nom));

  if (erreur) return <div className="bpn-card p-6"><ErrorState title="Indisponible" description="La composition n'a pas pu être chargée." onRetry={charger} /></div>;
  if (!membres) return <div className="bpn-card p-6"><TableSkeleton rows={6} cols={3} /></div>;

  const ligne = (m, num) => (
    <tr key={m.id} className={m.actif ? "" : "opacity-60"}>
      <td className="font-mono text-or">{num ?? m.sigle ?? "—"}</td>
      <td>
        <div className="font-medium text-encre">{m.nom}</div>
        {!m.actif && <div className="text-xs text-gris">{m.motifSortie || "Mandat clôturé"}{m.mandatFin ? ` · ${formatDate(m.mandatFin)}` : ""}</div>}
      </td>
      <td>
        {peutGerer && m.actif ? (
          <select defaultValue={m.role} className="bpn-input !w-32 !py-1 text-sm"
            onChange={(e) => { const v = e.target.value; if (v !== m.role) action(() => majMembreConseil(m.id, { role: v }), "Rôle mis à jour."); }}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        ) : <span className="text-gris">{ROLE_LABEL[m.role] || "Membre"}</span>}
      </td>
      <td>
        {peutGerer && m.actif ? (
          <select defaultValue={m.fonction} className="bpn-input !w-48 !py-1 text-sm"
            onChange={(e) => { const v = e.target.value; if (v && v !== m.fonction) action(() => majMembreConseil(m.id, { fonction: v }), "Fonction mise à jour."); }}>
            {optionsFonction(m.fonction).map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        ) : <span className="text-gris">{m.fonction}</span>}
      </td>
      <td className="whitespace-nowrap text-xs text-gris">{m.anciennete ? formatDate(m.anciennete) : m.mandatDebut ? formatDate(m.mandatDebut) : "—"}</td>
      <td>
        <div className="flex items-center justify-end gap-2">
          {m.actif && m.role === "bureau" && peutGerer && (
            <select defaultValue={m.sigle || ""} className="bpn-input !w-20 !py-1 text-xs"
              onChange={(e) => action(() => majMembreConseil(m.id, { sigle: e.target.value || null }), "Sigle mis à jour.")}>
              <option value="">—</option>
              {SIGLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <Badge ton={m.actif ? "vert" : "gris"} className="whitespace-nowrap">{m.actif ? "En exercice" : "Sortant"}</Badge>
          {peutGerer && (m.actif ? (
            <>
              <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs" onClick={() => setSortie({ membre: m, motif: MOTIFS_SORTIE[0], date: new Date().toISOString().slice(0, 10), detail: "" })}>
                <ArrowRightOnRectangleIcon className="h-3.5 w-3.5" /> Enregistrer une sortie
              </button>
              <button type="button" onClick={() => supprimer(m)} title="Retirer" aria-label={`Retirer ${m.nom} du Conseil`} className="rounded p-1.5 text-gris transition hover:bg-rougeL hover:text-rouge">
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs" onClick={() => retablir(m)}>
              <ArrowUturnLeftIcon className="h-3.5 w-3.5" /> Rétablir
            </button>
          ))}
        </div>
      </td>
    </tr>
  );

  const section = (titre, sousTitre, rows) => (
    <div className="bpn-card overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-grisL px-4 py-2.5">
        <h2 className="font-display text-base text-navy">{titre}</h2>
        {sousTitre && <span className="text-xs text-gris">{sousTitre}</span>}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-gris">—</p>
      ) : (
        <table className="bpn-table">
          <thead>
            <tr>
              <th className="w-16">{titre === "Bureau" ? "Sigle" : "N°"}</th>
              <th>Membre</th>
              <th className="w-32">Rôle</th>
              <th>Fonction</th>
              <th className="whitespace-nowrap">Serment / mandat</th>
              <th className="text-right">{peutGerer ? "Actions" : "Statut"}</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Institutionnel" titre="Conseil de l'Ordre" sousTitre={`Composition et mandats — ${enFonction.length} membre(s) en exercice.`} />

      {peutGerer && (
        <div className="flex flex-col gap-2 rounded-lg border border-grisL bg-grisL/30 p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[12rem] flex-1">
            <input
              ref={champNom}
              value={form.nom}
              onChange={(e) => { setForm({ ...form, nom: e.target.value, membreId: null }); setOuvert(true); }}
              onFocus={() => setOuvert(true)}
              onBlur={() => setTimeout(() => setOuvert(false), 120)}
              placeholder="Rechercher un avocat (Me …)"
              className="bpn-input w-full"
              autoComplete="off"
              role="combobox"
              aria-expanded={ouvert && suggestions.length > 0}
              aria-controls="conseil-suggestions"
            />
            {ouvert && suggestions.length > 0 && (
              <ul id="conseil-suggestions" className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-grisM bg-white shadow-card">
                {suggestions.map((m) => (
                  <li key={m.id}>
                    <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-grisL" onMouseDown={(e) => { e.preventDefault(); choisir(m); }}>
                      <span className="font-medium text-encre">Me {m.nom}</span>
                      <span className="font-mono text-xs text-gris">N° {m.num}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, fonction: fonctionDefaut(e.target.value) })} className="bpn-input sm:w-36">
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {form.role === "bureau" && (
            <select value={form.sigle} onChange={(e) => setForm({ ...form, sigle: e.target.value })} className="bpn-input sm:w-24" aria-label="Sigle du bureau">
              <option value="">Sigle…</option>
              {SIGLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select value={form.fonction} onChange={(e) => setForm({ ...form, fonction: e.target.value })} className="bpn-input sm:w-56">
            {optionsFonction(form.fonction).map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <button className="bpn-btn bpn-btn-or shrink-0" onClick={ajouter} disabled={!form.nom.trim()}><PlusIcon className="h-4 w-4" /> Ajouter</button>
        </div>
      )}

      {enFonction.length === 0 && sortants.length === 0 ? (
        <div className="bpn-card p-6"><EmptyState icon={UserGroupIcon} title="Conseil vide" description="Ajoutez les membres du Conseil ou publiez une élection." /></div>
      ) : (
        <>
          {section("Bâtonnier", null, batonnier.map((m) => ligne(m)))}
          {section("Bureau", `${bureau.length} membre(s)`, bureau.map((m) => ligne(m)))}
          {section("Membres", `classés par ancienneté · ${membresOrd.length} membre(s)`, membresOrd.map((m, i) => ligne(m, i + 1)))}
          {sortants.length > 0 && section("Membres sortants", `historique des mandats · ${sortants.length}`, sortants.slice().sort((a, b) => (b.mandatFin || "").localeCompare(a.mandatFin || "")).map((m) => ligne(m)))}
        </>
      )}

      <Modal
        open={!!sortie}
        onClose={() => setSortie(null)}
        title="Enregistrer une sortie du Conseil"
        footer={sortie && (
          <>
            <button className="bpn-btn bpn-btn-ghost" onClick={() => setSortie(null)}>Annuler</button>
            <button className="bpn-btn bpn-btn-primary" onClick={enregistrerSortie}>Enregistrer la sortie</button>
          </>
        )}
      >
        {sortie && (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-gris">
              Fin de fonction au Conseil de l'Ordre. Le siège de <strong>{sortie.membre.nom}</strong> passe en « sortant » et quitte la composition
              active ; il reste conservé dans l'historique et peut être rétabli.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs uppercase tracking-wide text-gris">Motif de la sortie</span>
                <select value={sortie.motif} onChange={(e) => setSortie({ ...sortie, motif: e.target.value })} className="bpn-input w-full">
                  {MOTIFS_SORTIE.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs uppercase tracking-wide text-gris">Date d'effet</span>
                <input type="date" value={sortie.date} onChange={(e) => setSortie({ ...sortie, date: e.target.value })} className="bpn-input w-full" />
              </label>
            </div>
            {sortie.motif === "Autre" && (
              <label className="block text-sm">
                <span className="mb-1 block text-xs uppercase tracking-wide text-gris">Précision</span>
                <input value={sortie.detail} onChange={(e) => setSortie({ ...sortie, detail: e.target.value })} placeholder="Précisez le motif" className="bpn-input w-full" />
              </label>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Conseil;
