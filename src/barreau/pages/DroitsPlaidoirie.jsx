import { useCallback, useEffect, useMemo, useState } from "react";
import { BanknotesIcon, ArrowDownTrayIcon, PrinterIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Badge, StatCard, PaiementModal, useToast, useConfirm, EtatImprimable, PageHeader, DataTable, SelecteurExercice } from "../components";
import { useAuth } from "../auth/AuthContext";
import { STATUT_META } from "../data/derivations";
import { EXERCICE_COURANT } from "../data/dashboard-data";
import { formatFCFA } from "../utils/format";
import { telechargerCsv } from "../utils/exportCsv";
import { exporterExcel, exporterPdf } from "../utils/exports";
import { getDroits, supprimerDroit } from "../api/resources";

const ENTETE_ETAT = ["N°", "Avocat", "Dû", "Perçu", "Solde", "Statut"];

const COLONNES_CSV = [
  { label: "N°", valeur: (l) => l.membre.num },
  { label: "Avocat", valeur: (l) => `Me ${l.membre.nom}` },
  { label: "Dû", valeur: (l) => l.du },
  { label: "Perçu", valeur: (l) => l.paye },
  { label: "Solde", valeur: (l) => l.solde },
];

export function DroitsPlaidoirie() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const estAdmin = user?.role === "ADMIN";
  const [exercice, setExercice] = useState(EXERCICE_COURANT);
  const [lignes, setLignes] = useState([]);
  const [totaux, setTotaux] = useState({ du: 0, paye: 0, solde: 0 });
  const [paiement, setPaiement] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  const charger = useCallback(() => {
    setChargement(true); setErreur(false);
    getDroits(exercice)
      .then((d) => { setLignes(d.lignes); setTotaux(d.totaux); })
      .catch(() => setErreur(true))
      .finally(() => setChargement(false));
  }, [exercice]);
  useEffect(() => { charger(); }, [charger]);

  // Suppression de la ligne de droit de plaidoirie (réinitialise l'exercice) — ADMIN.
  const supprimer = async (l) => {
    const ok = await confirm({
      title: "Supprimer le droit de plaidoirie",
      message: `La ligne de droit de plaidoirie ${exercice} de Me ${l.membre.nom} sera supprimée (situation réinitialisée). Cette action est irréversible.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try { await supprimerDroit(l.membre.id, exercice); toast.success(`Droit ${exercice} supprimé — Me ${l.membre.nom}.`); charger(); }
    catch (e) { toast.error(e.message); }
  };

  const colonnes = [
    { key: "num", label: "N°", sortable: true, sortValue: (l) => l.membre.num,
      cell: (l) => <span className="font-mono text-xs text-gris">{l.membre.num}</span> },
    { key: "nom", label: "Avocat", sortable: true, sortValue: (l) => l.membre.nom.toLowerCase(),
      cell: (l) => <span className="font-medium">Me {l.membre.nom}</span> },
    { key: "du", label: "Droit dû", align: "right", cell: (l) => formatFCFA(l.du) },
    { key: "paye", label: "Perçu", align: "right", sortable: true, sortValue: (l) => l.paye,
      cell: (l) => <span className={l.paye ? "text-vert" : "text-gris"}>{l.paye ? formatFCFA(l.paye) : "—"}</span> },
    { key: "solde", label: "Solde", align: "right", sortable: true, sortValue: (l) => l.solde,
      cell: (l) => <span className={`font-medium ${l.solde ? "text-rouge" : "text-vert"}`}>{l.solde ? formatFCFA(l.solde) : "✓ Soldé"}</span> },
    { key: "statut", label: "Statut", sortable: true, sortValue: (l) => l.statut,
      cell: (l) => { const meta = STATUT_META[l.statut]; return <Badge ton={meta.ton}>{meta.label}</Badge>; } },
    { key: "action", label: "Action", align: "right",
      cell: (l) => (
        <div className="flex items-center justify-end gap-1.5">
          {l.solde > 0 ? (
            <button className="bpn-btn bpn-btn-ghost !px-2.5 !py-1 text-xs" onClick={() => setPaiement(l)}>
              <BanknotesIcon className="h-3.5 w-3.5" /> Encaisser
            </button>
          ) : <span className="text-[11px] text-vert">✓ Soldé</span>}
          {estAdmin && l.aLigne && (
            <button className="bpn-btn bpn-btn-ghost !px-2 !py-1 text-xs text-rouge" onClick={() => supprimer(l)} title="Supprimer la ligne de droit">
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) },
  ];

  const lignesEtat = useMemo(
    () => lignes.map((l) => [
      l.membre.num, `Me ${l.membre.nom}`, formatFCFA(l.du),
      l.paye ? formatFCFA(l.paye) : "—", l.solde ? formatFCFA(l.solde) : "Soldé", STATUT_META[l.statut].label,
    ]),
    [lignes]
  );
  const totauxEtat = ["", "TOTAUX", formatFCFA(totaux.du), formatFCFA(totaux.paye), formatFCFA(totaux.solde), ""];

  const exporterEtat = (fmt) => {
    if (lignes.length === 0) { toast.error("Aucune ligne à exporter pour cet exercice."); return; }
    const nom = `etat-droits-plaidoirie-${exercice}`;
    if (fmt === "xlsx") exporterExcel(nom, [ENTETE_ETAT, ...lignesEtat, totauxEtat], `Droits ${exercice}`);
    else exporterPdf(nom, "#etat-droits");
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Finances" titre="Droits de plaidoirie" sousTitre="Suivi des droits par avocat et par exercice — états individuels et généraux.">
        <SelecteurExercice valeur={exercice} onChange={setExercice} />
        <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs" onClick={() => exporterEtat("pdf")}>
          <PrinterIcon className="h-4 w-4" /> État PDF
        </button>
        <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs disabled:opacity-40" disabled={lignes.length === 0}
          onClick={() => telechargerCsv(`Droits-plaidoirie-${exercice}`, COLONNES_CSV, lignes)}>
          <ArrowDownTrayIcon className="h-4 w-4" /> CSV
        </button>
        <button className="bpn-btn bpn-btn-ghost !py-1.5 text-xs" onClick={() => exporterEtat("xlsx")}>
          <ArrowDownTrayIcon className="h-4 w-4" /> Excel
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Droits dus" value={formatFCFA(totaux.du)} accent="navy" />
        <StatCard label="Droits perçus" value={formatFCFA(totaux.paye)} accent="vert" />
        <StatCard label="Arriérés" value={formatFCFA(totaux.solde)} accent="rouge" />
      </div>

      <div className="bpn-card">
        <DataTable
          columns={colonnes}
          rows={lignes}
          getRowId={(l) => l.membre.id}
          loading={chargement}
          error={erreur}
          onRetry={charger}
          emptyTitle="Aucun avocat"
          emptyDescription="Aucun avocat à afficher pour cet exercice."
          libelle="avocats"
          initialSort={{ key: "num", dir: "asc" }}
        />
      </div>

      <EtatImprimable id="etat-droits" titre="État des droits de plaidoirie" sousTitre={`Exercice ${exercice}`} entete={ENTETE_ETAT} lignes={lignesEtat} totaux={totauxEtat} />

      <PaiementModal
        ligne={paiement}
        exercice={exercice}
        type="droit"
        open={!!paiement}
        onClose={() => setPaiement(null)}
        onDone={charger}
      />
    </div>
  );
}

export default DroitsPlaidoirie;
