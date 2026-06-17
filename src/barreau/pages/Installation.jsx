import { useState } from "react";
import { useToast } from "../components";
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

const Champ = ({ label, children, hint }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gris">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-gris">{hint}</span>}
  </label>
);

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
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-or">Barreau de Pointe-Noire</div>
          <div className="font-display text-lg text-white">Installation — étape {etape + 1}/{ETAPES.length} · {ETAPES[etape]}</div>
        </div>
        <div className="h-1 bg-grisL"><div className="h-full bg-or transition-all" style={{ width: `${((etape + 1) / ETAPES.length) * 100}%` }} /></div>

        <div className="space-y-4 px-6 py-6">
          {etape === 0 && (
            <p className="text-sm leading-7 text-encre">Bienvenue. Cet assistant configure votre installation : compte administrateur, identité de l'Ordre, tarifs et email (optionnel). À la fin, la base sera vide et prête : vous importerez vos avocats depuis le module Avocats.</p>
          )}

          {etape === 1 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Champ label="Nom affiché"><input value={admin.nom} onChange={setA("nom")} className="bpn-input" placeholder="Administrateur système" /></Champ>
              <Champ label="Email"><input type="email" value={admin.email} onChange={setA("email")} className="bpn-input" placeholder="admin@votre-barreau.cg" /></Champ>
              <Champ label="Mot de passe" hint="8 caractères minimum"><input type="password" value={admin.motDePasse} onChange={setA("motDePasse")} className="bpn-input" /></Champ>
              <Champ label="Confirmer le mot de passe"><input type="password" value={admin.confirme} onChange={setA("confirme")} className={`bpn-input ${admin.confirme && admin.confirme !== admin.motDePasse ? "is-invalid" : ""}`} /></Champ>
            </div>
          )}

          {etape === 2 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Champ label="Dénomination"><input value={identite.denomination} onChange={setI("denomination")} className="bpn-input" /></Champ>
              <Champ label="Ordre"><input value={identite.ordre} onChange={setI("ordre")} className="bpn-input" /></Champ>
              <Champ label="Bâtonnier"><input value={identite.batonnier} onChange={setI("batonnier")} className="bpn-input" /></Champ>
              <Champ label="Trésorière"><input value={identite.tresoriere} onChange={setI("tresoriere")} className="bpn-input" /></Champ>
              <Champ label="Secrétaire Général"><input value={identite.secretaireGeneral} onChange={setI("secretaireGeneral")} className="bpn-input" /></Champ>
              <Champ label="Adresse"><input value={identite.adresse} onChange={setI("adresse")} className="bpn-input" /></Champ>
            </div>
          )}

          {etape === 3 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Champ label="Cotisation avocat (FCFA)"><input value={tarifs.avocat} onChange={setT("avocat")} className="bpn-input" inputMode="numeric" /></Champ>
              <Champ label="Cotisation stagiaire (FCFA)"><input value={tarifs.stagiaire} onChange={setT("stagiaire")} className="bpn-input" inputMode="numeric" /></Champ>
              <Champ label="Droit de plaidoirie (FCFA)"><input value={tarifs.droitsPlaidoirie} onChange={setT("droitsPlaidoirie")} className="bpn-input" inputMode="numeric" /></Champ>
              <Champ label="Exercice courant"><input type="number" value={exercice} onChange={(e) => setExercice(e.target.value)} className="bpn-input" /></Champ>
              <Champ label="Premier exercice" hint="borne basse des filtres"><input type="number" value={premier} onChange={(e) => setPremier(e.target.value)} className="bpn-input" /></Champ>
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
                  <Champ label="Serveur SMTP"><input value={smtp.host} onChange={setS("host")} className="bpn-input" /></Champ>
                  <Champ label="Port"><input type="number" value={smtp.port} onChange={setS("port")} className="bpn-input" /></Champ>
                  <Champ label="Utilisateur (adresse Gmail)"><input value={smtp.user} onChange={setS("user")} className="bpn-input" placeholder="vous@gmail.com" /></Champ>
                  <Champ label="Mot de passe d'application" hint="Gmail : créez un « mot de passe d'application » (2FA requise)."><input type="password" value={smtp.pass} onChange={setS("pass")} className="bpn-input" /></Champ>
                  <Champ label="Expéditeur (From)"><input value={smtp.from} onChange={setS("from")} className="bpn-input" placeholder="vous@gmail.com" /></Champ>
                  <div className="flex items-end gap-2">
                    <input value={testCible} onChange={(e) => setTestCible(e.target.value)} className="bpn-input" placeholder="email de test" />
                    <button type="button" onClick={tester} disabled={enCours} className="bpn-btn bpn-btn-ghost shrink-0">Tester</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {etape === 5 && (
            <div className="space-y-2 text-sm text-encre">
              <div><span className="text-gris">Administrateur :</span> {admin.nom} ({admin.email})</div>
              <div><span className="text-gris">Institution :</span> {identite.denomination}</div>
              <div><span className="text-gris">Tarifs :</span> avocat {tarifs.avocat} · stagiaire {tarifs.stagiaire} · droit {tarifs.droitsPlaidoirie} FCFA</div>
              <div><span className="text-gris">Exercices :</span> {exercice} → {premier}</div>
              <div><span className="text-gris">Email :</span> {emailActif && smtp.host ? `${smtp.host} (${smtp.user})` : "simulation"}</div>
              <p className="pt-2 text-xs text-gris">La base démarrera vide (seuls le compte admin et cette configuration). Action finale ci-dessous.</p>
            </div>
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
