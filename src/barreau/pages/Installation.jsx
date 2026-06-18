import { useState } from "react";
import { useToast, FormField } from "../components";
import { formatFCFA } from "../utils/format";
import { installer, testerEmailInstallation } from "../api/resources";

const ETAPES = ["Bienvenue", "Administrateur", "Institution", "Tarifs & exercice", "Email", "Récapitulatif"];

const IDENTITE_DEFAUT = {
  denomination: "Barreau de Pointe-Noire",
  ordre: "Ordre National des Avocats du Congo",
  batonnier: "", tresoriere: "", secretaireGeneral: "",
  adresse: "Maison de l'Avocat — Pointe-Noire, République du Congo",
};
const TARIFS_DEFAUT = { avocat: 150000, stagiaire: 75000, droitsPlaidoirie: 60000 };
// Pré-réglages Gmail (mot de passe d'application requis — pas le mot de passe du compte).
const SMTP_DEFAUT = { host: "smtp.gmail.com", port: 587, user: "", pass: "", from: "", secure: false };

export function Installation() {
  const toast = useToast();
  const [etape, setEtape] = useState(0);
  const [admin, setAdmin] = useState({ nom: "", email: "", motDePasse: "", confirme: "" });
  const [identite, setIdentite] = useState(IDENTITE_DEFAUT);
  const [tarifs, setTarifs] = useState(TARIFS_DEFAUT);
  const [exercice, setExercice] = useState(new Date().getFullYear());
  const [premier, setPremier] = useState(new Date().getFullYear() - 6);
  const [emailActif, setEmailActif] = useState(false);
  const [smtp, setSmtp] = useState(SMTP_DEFAUT);
  const [testCible, setTestCible] = useState("");
  const [enCours, setEnCours] = useState(false);

  const setA = (k) => (e) => setAdmin({ ...admin, [k]: e.target.value });
  const setI = (k) => (e) => setIdentite({ ...identite, [k]: e.target.value });
  const setT = (k) => (e) => setTarifs({ ...tarifs, [k]: Number(String(e.target.value).replace(/\D/g, "")) || 0 });
  const setS = (k) => (e) => setSmtp({ ...smtp, [k]: k === "port" ? Number(e.target.value) || 0 : e.target.value });

  // Erreurs par champ (n'apparaissent qu'une fois le champ touché) : guident la
  // saisie plutôt que de se contenter de désactiver « Suivant » silencieusement.
  const emailErr = admin.email && !/\S+@\S+\.\S+/.test(admin.email) ? "Adresse email invalide." : undefined;
  const mdpErr = admin.motDePasse && admin.motDePasse.length < 8 ? "8 caractères minimum." : undefined;
  const confirmeErr = admin.confirme && admin.confirme !== admin.motDePasse ? "Les mots de passe ne correspondent pas." : undefined;

  const adminValide = Boolean(admin.nom.trim() && /\S+@\S+\.\S+/.test(admin.email) && admin.motDePasse.length >= 8 && admin.motDePasse === admin.confirme);
  const identiteValide = Object.values(identite).every((v) => v.trim());
  // Exercices : années plausibles et premier ≤ courant (sinon un champ vidé
  // soumettrait silencieusement 0 — refusé côté serveur, mais on bloque avant).
  const exercicesValides = Number(exercice) >= 1900 && Number(premier) >= 1900 && Number(premier) <= Number(exercice);
  const peutSuivant = etape === 1 ? adminValide : etape === 2 ? identiteValide : etape === 3 ? exercicesValides : true;

  const tester = async () => {
    if (!smtp.host || !smtp.from || !/\S+@\S+\.\S+/.test(testCible)) { toast.error("Renseignez le SMTP et une adresse de test."); return; }
    setEnCours(true);
    try { await testerEmailInstallation({ ...smtp, to: testCible }); toast.success("Email de test envoyé."); }
    catch (e) { toast.error(e.message); }
    finally { setEnCours(false); }
  };

  const installerApp = async () => {
    setEnCours(true);
    try {
      await installer({
        admin: { nom: admin.nom.trim(), email: admin.email.trim(), motDePasse: admin.motDePasse },
        identite, tarifs, exerciceCourant: Number(exercice), premierExercice: Number(premier),
        smtp: emailActif && smtp.host ? smtp : null,
      });
      toast.success("Installation terminée. Connectez-vous avec votre compte administrateur.");
      setTimeout(() => window.location.assign("/"), 1000);
    } catch (e) { toast.error(e.message); setEnCours(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-3 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-grisM bg-white shadow-modal">
        <div className="bg-navy px-6 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-or">Barreau de Pointe-Noire</div>
          <div className="font-display text-lg text-white">Installation — étape {etape + 1}/{ETAPES.length} · {ETAPES[etape]}</div>
        </div>
        <div className="h-1 bg-grisL"><div className="h-full bg-or transition-all" style={{ width: `${((etape + 1) / ETAPES.length) * 100}%` }} /></div>

        <div className="space-y-4 px-6 py-6">
          {etape === 0 && (
            <p className="text-sm leading-7 text-encre">Bienvenue. Cet assistant configure votre installation : compte administrateur, identité de l'Ordre, tarifs et email (optionnel). À la fin, la base sera vide et prête : vous importerez vos avocats depuis le module Avocats.</p>
          )}

          {etape === 1 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Nom affiché" required htmlFor="adm-nom"><input id="adm-nom" value={admin.nom} onChange={setA("nom")} className="bpn-input" placeholder="Administrateur système" /></FormField>
              <FormField label="Email" required htmlFor="adm-email" error={emailErr}><input id="adm-email" type="email" value={admin.email} onChange={setA("email")} className={`bpn-input ${emailErr ? "is-invalid" : ""}`} placeholder="admin@votre-barreau.cg" /></FormField>
              <FormField label="Mot de passe" required hint="8 caractères minimum" htmlFor="adm-mdp" error={mdpErr}><input id="adm-mdp" type="password" value={admin.motDePasse} onChange={setA("motDePasse")} className={`bpn-input ${mdpErr ? "is-invalid" : ""}`} /></FormField>
              <FormField label="Confirmer le mot de passe" required htmlFor="adm-confirme" error={confirmeErr}><input id="adm-confirme" type="password" value={admin.confirme} onChange={setA("confirme")} className={`bpn-input ${confirmeErr ? "is-invalid" : ""}`} /></FormField>
            </div>
          )}

          {etape === 2 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Dénomination" required htmlFor="id-denomination"><input id="id-denomination" value={identite.denomination} onChange={setI("denomination")} className="bpn-input" /></FormField>
              <FormField label="Ordre" required htmlFor="id-ordre"><input id="id-ordre" value={identite.ordre} onChange={setI("ordre")} className="bpn-input" /></FormField>
              <FormField label="Bâtonnier" required htmlFor="id-batonnier"><input id="id-batonnier" value={identite.batonnier} onChange={setI("batonnier")} className="bpn-input" /></FormField>
              <FormField label="Trésorière" required htmlFor="id-tresoriere"><input id="id-tresoriere" value={identite.tresoriere} onChange={setI("tresoriere")} className="bpn-input" /></FormField>
              <FormField label="Secrétaire Général" required htmlFor="id-sg"><input id="id-sg" value={identite.secretaireGeneral} onChange={setI("secretaireGeneral")} className="bpn-input" /></FormField>
              <FormField label="Adresse" required htmlFor="id-adresse"><input id="id-adresse" value={identite.adresse} onChange={setI("adresse")} className="bpn-input" /></FormField>
            </div>
          )}

          {etape === 3 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Cotisation avocat (FCFA)" htmlFor="tar-avocat"><input id="tar-avocat" value={tarifs.avocat} onChange={setT("avocat")} className="bpn-input" inputMode="numeric" /></FormField>
              <FormField label="Cotisation stagiaire (FCFA)" htmlFor="tar-stagiaire"><input id="tar-stagiaire" value={tarifs.stagiaire} onChange={setT("stagiaire")} className="bpn-input" inputMode="numeric" /></FormField>
              <FormField label="Droit de plaidoirie (FCFA)" htmlFor="tar-droit"><input id="tar-droit" value={tarifs.droitsPlaidoirie} onChange={setT("droitsPlaidoirie")} className="bpn-input" inputMode="numeric" /></FormField>
              <FormField label="Exercice courant" htmlFor="ex-courant"><input id="ex-courant" type="number" value={exercice} onChange={(e) => setExercice(e.target.value)} className="bpn-input" /></FormField>
              <FormField label="Premier exercice" hint="borne basse des filtres" htmlFor="ex-premier"><input id="ex-premier" type="number" value={premier} onChange={(e) => setPremier(e.target.value)} className="bpn-input" /></FormField>
            </div>
          )}

          {etape === 4 && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-encre">
                <input type="checkbox" checked={emailActif} onChange={(e) => setEmailActif(e.target.checked)} className="h-4 w-4 accent-navy" />
                Configurer l'envoi d'emails (Gmail) — sinon les notifications restent en simulation.
              </label>
              {emailActif && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Serveur SMTP" htmlFor="smtp-host"><input id="smtp-host" value={smtp.host} onChange={setS("host")} className="bpn-input" /></FormField>
                  <FormField label="Port" htmlFor="smtp-port"><input id="smtp-port" type="number" value={smtp.port} onChange={setS("port")} className="bpn-input" /></FormField>
                  <FormField label="Utilisateur (adresse Gmail)" htmlFor="smtp-user"><input id="smtp-user" value={smtp.user} onChange={setS("user")} className="bpn-input" placeholder="vous@gmail.com" /></FormField>
                  <FormField label="Mot de passe d'application" hint="Gmail : créez un « mot de passe d'application » (2FA requise)." htmlFor="smtp-pass"><input id="smtp-pass" type="password" value={smtp.pass} onChange={setS("pass")} className="bpn-input" /></FormField>
                  <FormField label="Expéditeur (From)" htmlFor="smtp-from"><input id="smtp-from" value={smtp.from} onChange={setS("from")} className="bpn-input" placeholder="vous@gmail.com" /></FormField>
                  <FormField label="Email de test" htmlFor="smtp-test">
                    <div className="flex gap-2">
                      <input id="smtp-test" value={testCible} onChange={(e) => setTestCible(e.target.value)} className="bpn-input" placeholder="email de test" />
                      <button type="button" onClick={tester} disabled={enCours} className="bpn-btn bpn-btn-ghost shrink-0">Tester</button>
                    </div>
                  </FormField>
                </div>
              )}
            </div>
          )}

          {etape === 5 && (
            <div className="space-y-2 text-sm text-encre">
              <div><span className="text-gris">Administrateur :</span> {admin.nom} ({admin.email})</div>
              <div><span className="text-gris">Institution :</span> {identite.denomination}</div>
              <div><span className="text-gris">Tarifs :</span> avocat {formatFCFA(tarifs.avocat)} · stagiaire {formatFCFA(tarifs.stagiaire)} · droit {formatFCFA(tarifs.droitsPlaidoirie)}</div>
              <div><span className="text-gris">Exercices :</span> {premier} → {exercice}</div>
              <div><span className="text-gris">Email :</span> {emailActif && smtp.host ? `${smtp.host} (${smtp.user})` : "simulation"}</div>
              <p className="pt-2 text-xs text-gris">La base démarrera vide (seuls le compte admin et cette configuration). Action finale ci-dessous.</p>
            </div>
          )}

          {!peutSuivant && etape >= 1 && etape <= 3 && (
            <p className="text-xs text-gris">Complétez les champs requis pour activer « Suivant ».</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-grisM px-6 py-4">
          <button type="button" className="bpn-btn bpn-btn-ghost disabled:opacity-40" disabled={etape === 0 || enCours} onClick={() => setEtape((s) => s - 1)}>Précédent</button>
          {etape < ETAPES.length - 1 ? (
            <button type="button" className="bpn-btn bpn-btn-primary disabled:opacity-40" disabled={!peutSuivant} onClick={() => setEtape((s) => s + 1)}>Suivant</button>
          ) : (
            <button type="button" className="bpn-btn bpn-btn-or disabled:opacity-40" disabled={enCours} onClick={installerApp}>{enCours ? "Installation…" : "Installer l'application"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Installation;
