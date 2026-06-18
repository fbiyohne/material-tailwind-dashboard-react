import { useState } from "react";
import PropTypes from "prop-types";
import {
  UserIcon, EnvelopeIcon, IdentificationIcon, BuildingOffice2Icon,
  ArrowLeftIcon, PaperAirplaneIcon, CheckCircleIcon, ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { AuthLayout } from "./AuthLayout";
import { Field } from "./Field";
import { Button } from "../components";
import { soumettreDemandeAcces } from "../api/resources";

const vide = () => ({ nom: "", email: "", numInscription: "", cabinet: "", motif: "" });

function valider(f) {
  const e = {};
  if (f.nom.trim().length < 2) e.nom = "Indiquez votre nom complet.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Adresse email invalide.";
  if (f.motif.trim().length < 10) e.motif = "Précisez le motif de votre demande (10 caractères min.).";
  return e;
}

export function DemandeAcces({ onRetour }) {
  const [f, setF] = useState(vide);
  const [erreurs, setErreurs] = useState({});
  const [erreurGlobale, setErreurGlobale] = useState(null);
  const [loading, setLoading] = useState(false);
  const [succes, setSucces] = useState(false);

  const set = (k) => (e) => {
    setF((prev) => ({ ...prev, [k]: e.target.value }));
    if (erreurs[k]) setErreurs((prev) => ({ ...prev, [k]: undefined }));
  };

  const soumettre = async (e) => {
    e.preventDefault();
    setErreurGlobale(null);
    const v = valider(f);
    setErreurs(v);
    if (Object.keys(v).length) return;
    setLoading(true);
    try {
      await soumettreDemandeAcces({
        nom: f.nom.trim(),
        email: f.email.trim(),
        numInscription: f.numInscription.trim() || undefined,
        cabinet: f.cabinet.trim() || undefined,
        motif: f.motif.trim(),
      });
      setSucces(true);
    } catch (err) {
      setErreurGlobale(err.message || "Envoi impossible. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  };

  if (succes) {
    return (
      <AuthLayout
        devise="Nul ne peut exercer la profession d'avocat s'il n'est inscrit au tableau d'un barreau."
        deviseAuteur="Règlement Intérieur National"
        eyebrow="Demande envoyée"
        titre="Demande transmise"
        sousTitre="Votre demande est désormais entre les mains du Secrétariat Général."
      >
        <div className="rounded-xl border border-or/30 bg-or/[0.07] p-6 text-center">
          <CheckCircleIcon className="mx-auto h-12 w-12 text-or-2" />
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Merci, <span className="font-medium text-white">{f.nom.trim()}</span>. Votre demande d'accès a été
            transmise au Secrétariat Général du Barreau. Après vérification, vous serez contacté par email
            à <span className="text-or-2">{f.email.trim()}</span> pour l'activation de votre compte.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onRetour} className="mt-6 !w-full justify-center !rounded-lg !border-white/15 !py-2.5 !text-sm !text-white/70 hover:!bg-white/5 hover:!text-white">
          <ArrowLeftIcon className="h-4 w-4" /> Retour à la connexion
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      devise="Nul ne peut exercer la profession d'avocat s'il n'est inscrit au tableau d'un barreau."
      deviseAuteur="Règlement Intérieur National"
      eyebrow="Nouvel accès"
      titre="Demander un accès"
      sousTitre="Soumettez votre demande : le Secrétariat Général la vérifiera avant d'ouvrir votre compte."
      pied={
        <span>
          Déjà un accès ?{" "}
          <button type="button" onClick={onRetour} className="font-medium text-or-2 underline-offset-4 transition hover:text-or-3 hover:underline">
            Se connecter
          </button>
        </span>
      }
    >
      <form onSubmit={soumettre} noValidate className="space-y-4">
        {erreurGlobale && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-[#c2554f]/40 bg-[#c2554f]/[0.12] px-3.5 py-3 text-sm text-[#eab1ad]">
            <ExclamationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erreurGlobale}</span>
          </div>
        )}

        <Field id="dem-nom" label="Nom complet" icon={UserIcon} value={f.nom} onChange={set("nom")} error={erreurs.nom} required autoComplete="name" placeholder="Me KOUMBA Jean" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="dem-num" label="N° d'inscription" hint="optionnel" icon={IdentificationIcon} value={f.numInscription} onChange={set("numInscription")} placeholder="T128" />
          <Field id="dem-cabinet" label="Cabinet" hint="optionnel" icon={BuildingOffice2Icon} value={f.cabinet} onChange={set("cabinet")} placeholder="SCPA …" />
        </div>

        <Field id="dem-email" label="Adresse email" icon={EnvelopeIcon} type="email" value={f.email} onChange={set("email")} error={erreurs.email} required autoComplete="email" placeholder="vous@cabinet.cg" />

        <Field id="dem-motif" label="Motif de la demande" as="textarea" rows={3} value={f.motif} onChange={set("motif")} error={erreurs.motif} placeholder="Précisez votre qualité et la raison de votre demande d'accès…" />

        <Button type="submit" variant="or" loading={loading} className="!w-full justify-center !rounded-lg !py-2.5 !text-sm">
          Envoyer la demande <PaperAirplaneIcon className="h-4 w-4" />
        </Button>

        <p className="text-center text-[11px] leading-relaxed text-white/30">
          Aucun compte n'est créé automatiquement. Votre demande est examinée par le Secrétariat Général.
        </p>
      </form>
    </AuthLayout>
  );
}

DemandeAcces.propTypes = { onRetour: PropTypes.func };

export default DemandeAcces;
