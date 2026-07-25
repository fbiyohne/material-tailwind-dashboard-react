import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MagnifyingGlassIcon, CheckCircleIcon, EnvelopeIcon, ArrowDownTrayIcon, PrinterIcon, RectangleStackIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, useToast, useConfirm, PaiementModal, PaiementEnLigneModal, EtatImprimable, PageHeader, EmptyState, DataTable } from "../components";
import { useAuth } from "../auth/AuthContext";
import { EXERCICES, EXERCICE_COURANT } from "../data/dashboard-data";
import { STATUT_META, QUALITE_LABEL } from "../data/derivations";
import { formatFCFA, formatDate } from "../utils/format";
import { telechargerCsv } from "../utils/exportCsv";
import { exporterExcel, exporterPdf } from "../utils/exports";
import { PERIODES, moisDePeriode, libellePeriode } from "../utils/periode";
import { getCotisations, getMembre, validerCotisation, lancerRelances, genererCotisations, supprimerCotisation } from "../api/resources";

const FILTRES = [
  { value: "tous", label: "Tous les statuts" },
  { value: "ajour", label: "À jour" },
  { value: "partiel", label: "Partiel" },
  { value: "retard", label: "En retard" },
  { value: "exonere", label: "Exonéré" },
];

const statutLigne = (du, paye) => (du === 0 ? "exonere" : paye <= 0 ? "retard" : paye >= du ? "ajour" : "partiel");

/** Modale d'historique des 7 exercices d'un membre (FR-COT-04). */
function HistoriqueModal({ membreId, onClose }) {
  const [membre, setMembre] = useState(null);
  useEffect(() => {
    if (membreId) getMembre(membreId).then(setMembre).catch(() => {});
    else setMembre(null);
  }, [membreId]);

  const parAnnee = useMemo(() => Object.fromEntries((membre?.cotisations ?? []).map((c) => [c.annee, c])), [membre]);

  return (
    <Modal open={!!membreId} onClose={onClose} title={membre ? `Historique — Me ${membre.nom}` : "Historique"}>
      {membre && (
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gris">
              <th className="pb-2">Exercice</th><th className="pb-2">Dû</th><th className="pb-2">Payé</th><th className="pb-2">Date</th><th className="pb-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {EXERCICES.map((annee) => {
              const c = parAnnee[annee];
              const du = c?.montantDu ?? (membre.qualite === "honoraire" ? 0 : membre.qualite === "stagiaire" ? 75000 : 150000);
              const paye = c?.montantPaye ?? 0;
              const meta = STATUT_META[statutLigne(du, paye)];
              return (
                <tr key={annee} className="border-t border-grisL">
                  <td className="py-2 font-mono text-xs text-gris">{annee}</td>
                  <td className="py-2">{formatFCFA(du)}</td>
                  <td className="py-2">{paye ? formatFCFA(paye) : "—"}</td>
                  <td className="py-2 text-xs text-gris">{formatDate(c?.datePaiement)}</td>
                  <td className="py-2"><Badge ton={meta.ton}>{meta.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </Modal>
  );
}

export function Cotisations() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const estAdmin = user?.role === "ADMIN";
  // La validation manuelle de situation est l'acte de la Trésorière (US-07,
  // POST /cotisations/:id/valider) : le SG ne voit pas le bouton (il obtiendrait 403).
  const peutValider = ["TRESORIERE", "ADMIN"].includes(user?.role);
  const [params, setParams] = useSearchParams();
  const exercice = Number(params.get("exercice")) || EXERCICE_COURANT;
  const filtre = params.get("statut") || "tous";
  const recherche = params.get("q") || "";
  const periode = params.get("periode") || "annee";

  const [lignes, setLignes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [historique, setHistorique] = useState(null);
  const [paiement, setPaiement] = useState(null);
  const [enLigne, setEnLigne] = useState(null);
  // Action de masse en cours (génération/relance) : évite les doubles campagnes
  // e-mail/SMS et les doubles générations sur double-clic.
  const [actionMasse, setActionMasse] = useState(null);

  const charger = useCallback(() => {
    setChargement(true);
    setErreur(false);
    getCotisations(exercice)
      .then(setLignes)
      .catch(() => setErreur(true))
      .finally(() => setChargement(false));
  }, [exercice]);

  useEffect(() => { charger(); }, [charger]);

  const setParam = (k, v, vide) =>
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (v && v !== vide) p.set(k, v);
      else p.delete(k);
      return p;
    }, { replace: true });

  const validerSituation = async (l) => {
    try {
      await validerCotisation(l.membre.id, exercice, !l.valideTresoriere);
      toast.success(l.valideTresoriere ? `Validation retirée — Me ${l.membre.nom}` : `Situation validée — Me ${l.membre.nom}`);
      charger();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Suppression de la ligne de cotisation (réinitialise l'exercice) — ADMIN.
  const supprimer = async (l) => {
    const ok = await confirm({
      title: "Supprimer la cotisation",
      message: `La ligne de cotisation ${exercice} de Me ${l.membre.nom} sera supprimée (situation réinitialisée). Cette action est irréversible.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try { await supprimerCotisation(l.membre.id, exercice); toast.success(`Cotisation ${exercice} supprimée — Me ${l.membre.nom}.`); charger(); }
    catch (e) { toast.error(e.message); }
  };

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const mois = moisDePeriode(periode);
    return lignes.filter((l) => {
      if (filtre !== "tous" && l.statut !== filtre) return false;
      if (mois) {
        if (!l.datePaiement) return false;
        if (!mois.includes(new Date(l.datePaiement).getMonth() + 1)) return false;
      }
      if (!q) return true;
      return l.membre.nom.toLowerCase().includes(q) || (l.membre.cabinet ?? "").toLowerCase().includes(q) || String(l.membre.num).includes(q);
    });
  }, [lignes, recherche, filtre, periode]);

  const sousTitreEtat = `Exercice ${exercice} — ${libellePeriode(periode)}${filtre !== "tous" ? ` · ${FILTRES.find((f) => f.value === filtre)?.label}` : ""}`;
  const lignesEtat = useMemo(
    () => filtrees.map((l) => [
      l.membre.num, `Me ${l.membre.nom}`, QUALITE_LABEL[l.membre.qualite],
      formatFCFA(l.montantDu), l.montantPaye ? formatFCFA(l.montantPaye) : "—",
      l.solde ? formatFCFA(l.solde) : "Soldé", formatDate(l.datePaiement), STATUT_META[l.statut].label,
    ]),
    [filtrees]
  );
  const ENTETE_ETAT = ["N°", "Avocat", "Qualité", "Dû", "Payé", "Solde", "Date", "Statut"];

  const exporterEtat = (fmt) => {
    if (filtrees.length === 0) { toast.error("Aucune ligne à exporter pour cette sélection."); return; }
    const nom = `etat-cotisations-${exercice}-${periode}`;
    if (fmt === "xlsx") exporterExcel(nom, [ENTETE_ETAT, ...lignesEtat], `Cotisations ${exercice}`);
    else exporterPdf(nom, "#etat-cotisations");
  };

  /** Colonnes de la DataTable — champs réels : l.membre.num, l.membre.nom, l.statut, l.montantDu, l.montantPaye, l.solde, l.datePaiement */
  const colonnes = useMemo(() => [
    {
      key: "num",
      label: "N°",
      sortable: true,
      sortValue: (l) => l.membre.num,
      cell: (l) => <span className="font-mono text-xs text-gris">{l.membre.num}</span>,
    },
    {
      key: "nom",
      label: "Avocat",
      sortable: true,
      sortValue: (l) => l.membre.nom.toLowerCase(),
      cell: (l) => <span className="font-medium">Me {l.membre.nom}</span>,
    },
    {
      key: "qualite",
      label: "Qualité",
      cell: (l) => <Badge ton={l.membre.qualite === "honoraire" ? "or" : "bleu"} dot={false}>{QUALITE_LABEL[l.membre.qualite]}</Badge>,
    },
    {
      key: "du",
      label: "Montant dû",
      sortable: true,
      sortValue: (l) => l.montantDu,
      cell: (l) => formatFCFA(l.montantDu),
    },
    {
      key: "paye",
      label: "Montant payé",
      sortable: true,
      sortValue: (l) => l.montantPaye,
      cell: (l) => (
        <span className={l.statut === "ajour" ? "font-medium text-vert" : l.statut === "partiel" ? "font-medium text-or" : l.statut === "retard" ? "font-medium text-rouge" : "text-gris"}>
          {l.montantPaye ? formatFCFA(l.montantPaye) : "—"}
        </span>
      ),
    },
    {
      key: "solde",
      label: "Solde",
      sortable: true,
      sortValue: (l) => l.solde,
      cell: (l) =>
        l.statut === "ajour" || l.statut === "exonere"
          ? <span className="font-medium text-vert">✓ Soldé</span>
          : <span className="font-medium text-rouge">{formatFCFA(l.solde)}</span>,
    },
    {
      key: "date",
      label: "Date paiement",
      cell: (l) => <span className="text-xs text-gris">{formatDate(l.datePaiement)}</span>,
    },
    {
      key: "statut",
      label: "Statut",
      sortable: true,
      sortValue: (l) => l.statut,
      cell: (l) => { const meta = STATUT_META[l.statut]; return <Badge ton={meta.ton}>{meta.label}</Badge>; },
    },
    {
      key: "actions",
      label: "",
      align: "right",
      cell: (l) => (
        <div className="flex items-center justify-end gap-1.5">
          {(l.statut === "retard" || l.statut === "partiel") && (
            <>
              <button type="button" onClick={() => setPaiement(l)} className="bpn-btn bpn-btn-or !px-2.5 !py-1 text-xs">Paiement</button>
              <button type="button" onClick={() => setEnLigne(l)} className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs">En ligne</button>
            </>
          )}
          {l.statut === "ajour" && (l.valideTresoriere ? (
            <button type="button" disabled={!peutValider} title={peutValider ? "Validé — cliquer pour annuler" : "Validé par la Trésorière"} onClick={() => peutValider && validerSituation(l)} className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs text-vert disabled:opacity-70">
              <CheckCircleIcon className="h-3.5 w-3.5" /> Validé
            </button>
          ) : peutValider ? (
            <button type="button" title="Valider la situation (Trésorière)" onClick={() => validerSituation(l)} className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs">Valider</button>
          ) : null)}
          <button type="button" onClick={() => setHistorique(l.membre.id)} className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs">Historique</button>
          {estAdmin && l.aLigne && (
            <button type="button" onClick={() => supprimer(l)} className="bpn-btn bpn-btn-ghost !px-2 !py-1 text-xs text-rouge" title="Supprimer la ligne de cotisation">
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [exercice, estAdmin, peutValider]);

  /** Colonnes CSV pour l'export sélection */
  const colonnesCsv = [
    { label: "N°", valeur: (l) => l.membre.num },
    { label: "Avocat", valeur: (l) => `Me ${l.membre.nom}` },
    { label: "Qualité", valeur: (l) => QUALITE_LABEL[l.membre.qualite] },
    { label: "Statut", valeur: (l) => STATUT_META[l.statut].label },
    { label: "Dû", valeur: (l) => l.montantDu },
    { label: "Payé", valeur: (l) => l.montantPaye ?? "" },
    { label: "Solde", valeur: (l) => l.solde ?? "" },
    { label: "Date paiement", valeur: (l) => formatDate(l.datePaiement) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Finances" titre="Cotisations ordinales" sousTitre="Suivi des cotisations 2020–2026, recherche en temps réel et historique par avocat.">
        <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs" onClick={() => exporterEtat("pdf")}>
          <PrinterIcon className="h-4 w-4" /> État PDF
        </button>
        <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs" onClick={() => exporterEtat("xlsx")}>
          <ArrowDownTrayIcon className="h-4 w-4" /> Excel
        </button>
        <button
          className="bpn-btn bpn-btn-ghost !py-1.5 text-xs"
          onClick={() => {
            if (filtrees.length === 0) { toast.error("Aucune ligne à exporter pour cette sélection."); return; }
            telechargerCsv(`cotisations-${exercice}`, colonnesCsv, filtrees);
          }}
        >
          <ArrowDownTrayIcon className="h-4 w-4" /> Export CSV
        </button>
        <button
          className="bpn-btn bpn-btn-ghost"
          disabled={actionMasse !== null}
          onClick={async () => {
            const ok = await confirm({
              title: `Générer les cotisations ${exercice} ?`,
              message: `Une ligne de cotisation sera créée pour chaque avocat (hors radiés) au titre de l'exercice ${exercice}. Les lignes déjà existantes (paiements, validations) sont préservées.`,
              confirmLabel: "Générer",
            });
            if (!ok) return;
            setActionMasse("generation");
            try {
              const r = await genererCotisations(exercice);
              toast.success(r.crees > 0 ? `${r.crees} cotisation${r.crees > 1 ? "s" : ""} générée${r.crees > 1 ? "s" : ""} (${r.existantes} déjà présentes).` : `Aucune nouvelle ligne — les ${r.existantes} cotisations existent déjà.`);
              charger();
            } catch (e) { toast.error(e.message); } finally { setActionMasse(null); }
          }}
        >
          <RectangleStackIcon className="h-4 w-4" /> {actionMasse === "generation" ? "Génération…" : "Générer l'exercice"}
        </button>
        <button
          type="button"
          className="bpn-btn bpn-btn-primary"
          disabled={actionMasse !== null}
          onClick={async () => {
            setActionMasse("relance");
            try {
              const r = await lancerRelances(exercice);
              toast.success(`${r.envoyes} relance${r.envoyes > 1 ? "s" : ""} envoyée${r.envoyes > 1 ? "s" : ""}${r.simulation ? " (simulation)" : ""}.`);
            } catch (e) { toast.error(e.message); } finally { setActionMasse(null); }
          }}
        >
          <EnvelopeIcon className="h-4 w-4" /> {actionMasse === "relance" ? "Envoi…" : "Relancer les retardataires"}
        </button>
      </PageHeader>

      <div className="flex flex-wrap gap-1 border-b border-grisM">
        {EXERCICES.map((annee) => (
          <button key={annee} type="button" onClick={() => setParam("exercice", String(annee), "2026")}
            className={`-mb-px rounded-t px-4 py-2 font-mono text-xs transition ${annee === exercice ? "border-b-2 border-or bg-white text-navy" : "text-gris hover:text-encre"}`}>
            {annee}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris" />
          <input type="text" value={recherche} onChange={(e) => setParam("q", e.target.value, "")} placeholder="Rechercher par nom, cabinet ou n°…" aria-label="Rechercher un avocat" className="bpn-input pl-9" />
        </div>
        <select value={filtre} onChange={(e) => setParam("statut", e.target.value, "tous")} aria-label="Filtrer par statut de cotisation" className="bpn-input sm:w-48">
          {FILTRES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={periode} onChange={(e) => setParam("periode", e.target.value, "annee")} className="bpn-input sm:w-48" title="Période de l'état (par date de paiement)">
          {PERIODES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      <div className="bpn-card">
        <DataTable
          columns={colonnes}
          rows={filtrees}
          getRowId={(l) => l.membre.id}
          loading={chargement}
          error={erreur}
          onRetry={charger}
          emptyTitle="Aucune cotisation"
          emptyDescription="Aucune cotisation ne correspond à votre recherche pour cet exercice."
          selectable
          libelle="cotisations"
          initialSort={{ key: "num", dir: "asc" }}
          renderBulkActions={(ids, clearSelection) => (
            <button
              type="button"
              className="bpn-btn bpn-btn-ghost !py-1 text-xs"
              onClick={() => {
                const sel = filtrees.filter((l) => ids.includes(l.membre.id));
                telechargerCsv(`cotisations-selection-${exercice}`, colonnesCsv, sel);
                clearSelection();
              }}
            >
              Exporter la sélection (CSV)
            </button>
          )}
        />
      </div>

      <EtatImprimable id="etat-cotisations" titre="État des cotisations ordinales" sousTitre={sousTitreEtat} entete={ENTETE_ETAT} lignes={lignesEtat} />

      <HistoriqueModal membreId={historique} onClose={() => setHistorique(null)} />
      <PaiementModal ligne={paiement} exercice={exercice} open={!!paiement} onClose={() => setPaiement(null)} onDone={charger} />
      <PaiementEnLigneModal ligne={enLigne} exercice={exercice} type="cotisation" open={!!enLigne} onClose={() => setEnLigne(null)} onDone={charger} />
    </div>
  );
}

export default Cotisations;
