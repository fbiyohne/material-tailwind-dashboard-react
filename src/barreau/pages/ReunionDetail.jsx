import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, CalendarDaysIcon, MapPinIcon, CheckIcon, ArrowDownTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Badge, DocumentModal, useToast, useConfirm, PageHeader } from "../components";
import { getReunion, majReunion, archiverDoc, telechargerPvReunionPdf, getConseil, supprimerReunion } from "../api/resources";

const fmt = (d) => new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
/** Libellé d'émargement d'un membre du Conseil — sert aussi de clé de présence. */
const labelConseil = (c) => `${c.nom} — ${c.fonction}`;

function Carte({ titre, action, children }) {
  return (
    <div className="bpn-card">
      <div className="bpn-card-header">
        <span className="bpn-card-heading">{titre}</span>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function ReunionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [reunion, setReunion] = useState(null);
  const [conseil, setConseil] = useState([]);
  const [odj, setOdj] = useState("");
  const [presences, setPresences] = useState({});
  const [pv, setPv] = useState("");
  const [convocation, setConvocation] = useState(false);
  const [feuille, setFeuille] = useState(false);

  useEffect(() => {
    getReunion(Number(id))
      .then((r) => {
        setReunion(r);
        setOdj((r.ordreDuJour ?? []).join("\n"));
        setPresences(r.presences ?? {});
        setPv(r.pv ?? "");
      })
      .catch(() => setReunion(false));
  }, [id]);

  useEffect(() => {
    getConseil().then(setConseil).catch(() => setConseil([]));
  }, []);

  const membresConseil = conseil.map(labelConseil);

  if (reunion === false) {
    return (
      <div className="py-20 text-center">
        <p className="text-gris">Réunion introuvable.</p>
        <button className="bpn-btn bpn-btn-ghost mt-4" onClick={() => navigate("/reunions")}>Retour</button>
      </div>
    );
  }
  if (!reunion) return <div className="py-20 text-center text-sm text-gris">Chargement…</div>;

  const dateCourte = String(reunion.date).slice(0, 10);
  const nbPresents = Object.values(presences).filter(Boolean).length;

  const sauverOdj = async () => {
    try {
      await majReunion(reunion.id, { ordreDuJour: odj.split("\n").map((s) => s.trim()).filter(Boolean) });
      toast.success("Ordre du jour mis à jour.");
    } catch (e) {
      toast.error(e.message);
    }
  };
  const sauverPresences = async () => {
    try {
      await majReunion(reunion.id, { presences });
      toast.success(`Présences enregistrées (${nbPresents}/${membresConseil.length}).`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const telechargerPv = async () => {
    try {
      await majReunion(reunion.id, { pv, statut: "tenue" });
      await telechargerPvReunionPdf(reunion.id);
      setReunion({ ...reunion, statut: "tenue" });
      toast.success("Procès-verbal enregistré, archivé et téléchargé (PDF).");
    } catch (e) {
      toast.error(e.message);
    }
  };
  const sauverPv = async () => {
    try {
      await majReunion(reunion.id, { pv, statut: "tenue" });
      await archiverDoc({ categorie: "Procès-verbal (Conseil)", titre: `PV réunion du ${dateCourte}`, reference: dateCourte, date: dateCourte });
      setReunion({ ...reunion, statut: "tenue" });
      toast.success("Procès-verbal enregistré et archivé.");
    } catch (e) {
      toast.error(e.message);
    }
  };
  const supprimer = async () => {
    const ok = await confirm({
      title: "Supprimer la réunion",
      message: "Cette réunion planifiée sera définitivement supprimée. Continuer ?",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try {
      await supprimerReunion(reunion.id);
      toast.success("Réunion supprimée.");
      navigate("/reunions");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/reunions" className="inline-flex items-center gap-1.5 text-sm text-gris hover:text-navy">
        <ArrowLeftIcon className="h-4 w-4" /> Retour aux réunions
      </Link>

      <PageHeader
        eyebrow="Conseil de l'Ordre"
        titre={<span className="capitalize">{fmt(reunion.date)}</span>}
        sousTitre={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Badge ton={reunion.statut === "tenue" ? "vert" : "or"}>{reunion.statut === "tenue" ? "Tenue" : "Planifiée"}</Badge>
            <span className="flex items-center gap-1"><CalendarDaysIcon className="h-3.5 w-3.5" /> {reunion.heure}</span>
            <span className="flex items-center gap-1"><MapPinIcon className="h-3.5 w-3.5" /> {reunion.lieu}</span>
          </span>
        }
      >
        <button className="bpn-btn bpn-btn-ghost" onClick={() => setConvocation(true)}>Convocation</button>
        <button className="bpn-btn bpn-btn-ghost" onClick={() => setFeuille(true)}>Feuille de présence</button>
        {reunion.statut !== "tenue" && (
          <button className="bpn-btn bpn-btn-ghost text-rouge" onClick={supprimer}><TrashIcon className="h-4 w-4" /> Supprimer</button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Carte titre="Ordre du jour" action={<button className="bpn-btn bpn-btn-primary !px-3 !py-1 text-xs" onClick={sauverOdj}>Enregistrer</button>}>
          <textarea rows={6} value={odj} onChange={(e) => setOdj(e.target.value)} className="bpn-input" placeholder="Un point par ligne…" />
        </Carte>

        <Carte titre={`Présences (${nbPresents}/${membresConseil.length})`} action={<button className="bpn-btn bpn-btn-primary !px-3 !py-1 text-xs" onClick={sauverPresences}>Enregistrer</button>}>
          <ul className="space-y-2">
            {membresConseil.map((nom) => (
              <li key={nom}>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input type="checkbox" checked={!!presences[nom]} onChange={(e) => setPresences({ ...presences, [nom]: e.target.checked })} className="h-4 w-4 accent-vert" />
                  <span className={presences[nom] ? "text-encre" : "text-gris"}>{nom}</span>
                </label>
              </li>
            ))}
          </ul>
        </Carte>
      </div>

      <Carte titre="Procès-verbal" action={
        <div className="flex gap-2">
          <button className="bpn-btn bpn-btn-ghost !px-3 !py-1 text-xs" onClick={telechargerPv}><ArrowDownTrayIcon className="h-3.5 w-3.5" /> PDF</button>
          <button className="bpn-btn bpn-btn-or !px-3 !py-1 text-xs" onClick={sauverPv}><CheckIcon className="h-3.5 w-3.5" /> Enregistrer &amp; archiver</button>
        </div>
      }>
        <textarea rows={8} value={pv} onChange={(e) => setPv(e.target.value)} className="bpn-input" placeholder="Rédiger le procès-verbal de la réunion…" />
      </Carte>

      <DocumentModal
        open={convocation} onClose={() => setConvocation(false)} title="Convocation"
        reference={`Réunion du ${new Date(reunion.date).toLocaleDateString("fr-FR")}`} date={dateCourte}
        pdfPath={`/reunions/${reunion.id}/convocation/pdf`} pdfFilename={`Convocation-reunion-${dateCourte}.pdf`}
        onArchive={() => archiverDoc({ categorie: "Convocation (Conseil)", titre: `Convocation réunion du ${dateCourte}`, reference: dateCourte, date: dateCourte })}
      >
        <p>Le Bâtonnier a l'honneur de convier les membres du Conseil de l'Ordre à la réunion du{" "}
          <strong>{new Date(reunion.date).toLocaleDateString("fr-FR")}</strong> à <strong>{reunion.heure}</strong>, au <strong>{reunion.lieu}</strong>.</p>
        <p className="mt-3 font-medium">Ordre du jour :</p>
        <ol className="mt-1 list-inside list-decimal">{reunion.ordreDuJour.map((pt, i) => <li key={i}>{pt}</li>)}</ol>
      </DocumentModal>

      <DocumentModal
        open={feuille} onClose={() => setFeuille(false)} title="Feuille de présence"
        reference={`Réunion du ${new Date(reunion.date).toLocaleDateString("fr-FR")}`} date={dateCourte}
        pdfPath={`/reunions/${reunion.id}/feuille-presence/pdf`} pdfFilename={`Feuille-presence-${dateCourte}.pdf`}
        signataire={{ role: "Le Secrétaire Général", nom: "Me KALINA-MENGA Lionel" }}
        onArchive={() => archiverDoc({ categorie: "Feuille de présence", titre: `Feuille de présence du ${dateCourte}`, reference: dateCourte, date: dateCourte })}
      >
        <table className="w-full text-[12px]">
          <thead><tr className="border-b border-navy text-left text-navy"><th className="py-1">Membre</th><th className="py-1 text-right">Émargement</th></tr></thead>
          <tbody>{[...membresConseil, "", "", ""].map((nom, i) => <tr key={i} className="border-b border-grisM"><td className="py-3">{nom}</td><td /></tr>)}</tbody>
        </table>
      </DocumentModal>
    </div>
  );
}

export default ReunionDetail;
