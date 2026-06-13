import { useState } from "react";
import { PlusIcon, CalendarDaysIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { Badge, Modal, DocumentModal } from "../components";
import { useBarreau } from "../store/BarreauStore";

const fmt = (d) => new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const OFFICE = [
  "Me BIKINDOU Audrey Séverin — Bâtonnier",
  "Me ONDZE BOYA Armelle Laure Carine — Trésorière",
  "Me KALINA-MENGA Lionel — Secrétaire Général",
];

function NouvelleReunionModal({ open, onClose }) {
  const { creerReunion } = useBarreau();
  const [form, setForm] = useState({ date: "", heure: "15:00", lieu: "Maison de l'Avocat — Pointe-Noire", odj: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const valider = () => {
    if (!form.date) return;
    creerReunion({
      date: form.date,
      heure: form.heure,
      lieu: form.lieu,
      ordreDuJour: form.odj.split("\n").map((s) => s.trim()).filter(Boolean),
    });
    onClose();
    setForm({ date: "", heure: "15:00", lieu: "Maison de l'Avocat — Pointe-Noire", odj: "" });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Planifier une réunion du Conseil"
      footer={<button className="bpn-btn bpn-btn-primary" onClick={valider}>Créer la réunion</button>}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="bpn-label">Date</span>
            <input type="date" value={form.date} onChange={set("date")} className="bpn-input mt-1" /></label>
          <label className="block"><span className="bpn-label">Heure</span>
            <input type="time" value={form.heure} onChange={set("heure")} className="bpn-input mt-1" /></label>
        </div>
        <label className="block"><span className="bpn-label">Lieu</span>
          <input value={form.lieu} onChange={set("lieu")} className="bpn-input mt-1" /></label>
        <label className="block"><span className="bpn-label">Ordre du jour (une ligne par point)</span>
          <textarea rows={4} value={form.odj} onChange={set("odj")} className="bpn-input mt-1" placeholder={"Approbation du PV précédent\nPoint cotisations\n…"} /></label>
      </div>
    </Modal>
  );
}

export function Reunions() {
  const { reunions, archiver, enregistrerPv } = useBarreau();
  const [creer, setCreer] = useState(false);
  const [convocation, setConvocation] = useState(null);
  const [feuille, setFeuille] = useState(null);
  const [pvReunion, setPvReunion] = useState(null);
  const [pvTexte, setPvTexte] = useState("");

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="bpn-eyebrow">Institutionnel</div>
          <h2 className="bpn-title mt-2">Réunions du Conseil de l'Ordre</h2>
          <p className="mt-1 text-sm text-gris">
            Planification, convocations, feuilles de présence et procès-verbaux.
          </p>
        </div>
        <button className="bpn-btn bpn-btn-or" onClick={() => setCreer(true)}>
          <PlusIcon className="h-4 w-4" /> Nouvelle réunion
        </button>
      </div>

      <div className="space-y-4">
        {reunions.map((r) => (
          <div key={r.id} className="bpn-card p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg capitalize text-navy">{fmt(r.date)}</span>
                  <Badge ton={r.statut === "tenue" ? "vert" : "or"}>
                    {r.statut === "tenue" ? "Tenue" : "Planifiée"}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gris">
                  <span className="flex items-center gap-1"><CalendarDaysIcon className="h-3.5 w-3.5" /> {r.heure}</span>
                  <span className="flex items-center gap-1"><MapPinIcon className="h-3.5 w-3.5" /> {r.lieu}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button className="bpn-btn bpn-btn-ghost !py-1.5 text-[11px]" onClick={() => setConvocation(r)}>Convocation</button>
                <button className="bpn-btn bpn-btn-ghost !py-1.5 text-[11px]" onClick={() => setFeuille(r)}>Feuille de présence</button>
                <button className="bpn-btn bpn-btn-ghost !py-1.5 text-[11px]" onClick={() => { setPvReunion(r); setPvTexte(r.pv ?? ""); }}>Procès-verbal</button>
              </div>
            </div>
            <ul className="mt-3 list-inside list-decimal space-y-0.5 text-sm text-encre">
              {r.ordreDuJour.map((pt, i) => <li key={i}>{pt}</li>)}
            </ul>
            {r.pv && (
              <div className="mt-3 rounded border-l-[3px] border-vert bg-grisL/60 px-3 py-2 text-xs text-gris">
                <span className="font-medium text-vert">PV : </span>{r.pv}
              </div>
            )}
          </div>
        ))}
      </div>

      <NouvelleReunionModal open={creer} onClose={() => setCreer(false)} />

      {/* Convocation */}
      <DocumentModal
        open={!!convocation}
        onClose={() => setConvocation(null)}
        title="Convocation"
        reference={convocation ? `Réunion du ${new Date(convocation.date).toLocaleDateString("fr-FR")}` : ""}
        date={convocation?.date}
        onArchive={() => convocation && archiver({ categorie: "Convocation (Conseil)", titre: `Convocation réunion du ${convocation.date}`, reference: convocation.date, date: convocation.date })}
      >
        {convocation && (
          <>
            <p>
              Le Bâtonnier a l'honneur de convier Mesdames et Messieurs les membres du Conseil de
              l'Ordre à la réunion qui se tiendra le <strong>{new Date(convocation.date).toLocaleDateString("fr-FR")}</strong> à{" "}
              <strong>{convocation.heure}</strong>, au <strong>{convocation.lieu}</strong>.
            </p>
            <p className="mt-3 font-medium">Ordre du jour :</p>
            <ol className="mt-1 list-inside list-decimal">
              {convocation.ordreDuJour.map((pt, i) => <li key={i}>{pt}</li>)}
            </ol>
          </>
        )}
      </DocumentModal>

      {/* Feuille de présence */}
      <DocumentModal
        open={!!feuille}
        onClose={() => setFeuille(null)}
        title="Feuille de présence"
        reference={feuille ? `Réunion du ${new Date(feuille.date).toLocaleDateString("fr-FR")}` : ""}
        date={feuille?.date}
        signataire={{ role: "Le Secrétaire Général", nom: "Me KALINA-MENGA Lionel" }}
        onArchive={() => feuille && archiver({ categorie: "Feuille de présence", titre: `Feuille de présence du ${feuille.date}`, reference: feuille.date, date: feuille.date })}
      >
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-navy text-left text-navy">
              <th className="py-1">Membre</th><th className="py-1 text-right">Émargement</th>
            </tr>
          </thead>
          <tbody>
            {[...OFFICE, "", "", "", "", ""].map((nom, i) => (
              <tr key={i} className="border-b border-grisM">
                <td className="py-3">{nom}</td><td />
              </tr>
            ))}
          </tbody>
        </table>
      </DocumentModal>

      {/* Procès-verbal */}
      <Modal
        open={!!pvReunion}
        onClose={() => setPvReunion(null)}
        title={pvReunion ? `Procès-verbal — réunion du ${new Date(pvReunion.date).toLocaleDateString("fr-FR")}` : ""}
        footer={
          <button
            className="bpn-btn bpn-btn-primary"
            onClick={() => {
              enregistrerPv(pvReunion.id, pvTexte);
              archiver({ categorie: "Procès-verbal (Conseil)", titre: `PV réunion du ${pvReunion.date}`, reference: pvReunion.date, date: pvReunion.date });
              setPvReunion(null);
            }}
          >
            Enregistrer &amp; archiver le PV
          </button>
        }
      >
        <textarea
          rows={8}
          value={pvTexte}
          onChange={(e) => setPvTexte(e.target.value)}
          className="bpn-input"
          placeholder="Rédiger le procès-verbal de la réunion…"
        />
      </Modal>
    </div>
  );
}

export default Reunions;
