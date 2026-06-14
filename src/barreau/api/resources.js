import { api, telechargerPdf } from "./client";

export const telechargerRecuPdf = (id, numero) => telechargerPdf(`/recus/${id}/pdf`, `Recu-${numero}.pdf`);
export const telechargerQuitusPdf = (id, numero) => telechargerPdf(`/quitus/${id}/pdf`, `Quitus-${numero}.pdf`);
export const telechargerAttestationPdf = (id, num) => telechargerPdf(`/membres/${id}/attestation/pdf`, `Attestation-${num}.pdf`);
export const telechargerConvocationReunionPdf = (id) => telechargerPdf(`/reunions/${id}/convocation/pdf`, `Convocation-reunion.pdf`);
export const telechargerFeuillePdf = (id) => telechargerPdf(`/reunions/${id}/feuille-presence/pdf`, `Feuille-presence.pdf`);
export const telechargerConvocationAgPdf = (id) => telechargerPdf(`/assemblees/${id}/convocation/pdf`, `Convocation-AG.pdf`);
export const telechargerConvocationDisciplinePdf = (id) => telechargerPdf(`/discipline/${id}/convocation/pdf`, `Convocation-disciplinaire.pdf`);
export const telechargerPvReunionPdf = (id) => telechargerPdf(`/reunions/${id}/pv/pdf`, `PV-reunion.pdf`);
export const telechargerPvAgPdf = (id) => telechargerPdf(`/assemblees/${id}/pv/pdf`, `PV-assemblee.pdf`);
export const telechargerDecisionDisciplinePdf = (id) => telechargerPdf(`/discipline/${id}/decision/pdf`, `Decision-disciplinaire.pdf`);

/**
 * Couche d'accès aux ressources de l'API. Normalise les formats du backend
 * (enums majuscules → minuscules, dates ISO → AAAA-MM-JJ, stage à plat → objet)
 * pour que les composants UI existants restent inchangés.
 */

const dateCourte = (v) => (v ? String(v).slice(0, 10) : null);

export function normaliserMembre(m) {
  if (!m) return m;
  return {
    ...m,
    qualite: m.qualite?.toLowerCase(),
    statut: m.statut?.toLowerCase(),
    dateInscription: dateCourte(m.dateInscription),
    dateNaissance: dateCourte(m.dateNaissance),
    stage: m.dateServment
      ? { dateServment: dateCourte(m.dateServment), dureeMois: m.dureeMois ?? 24, maitreStage: m.maitreStage }
      : undefined,
    cotisations: m.cotisations?.map((c) => ({ ...c, datePaiement: dateCourte(c.datePaiement) })),
    recus: m.recus?.map((r) => ({ ...r, date: dateCourte(r.date) })),
    quitus: m.quitus?.map((q) => ({ ...q, date: dateCourte(q.dateEmission) })),
  };
}

const toApiEnum = (v) => (v ? v.toUpperCase() : v);

// ─── Membres ─────────────────────────────────────────────────────────────
export async function listerMembres(params = {}) {
  const qs = new URLSearchParams({ pageSize: "200", ...params }).toString();
  const data = await api(`/membres?${qs}`);
  return { ...data, items: data.items.map(normaliserMembre) };
}

export async function getMembre(id) {
  return normaliserMembre(await api(`/membres/${id}`));
}

export function inscrireMembre(data) {
  return api("/membres", {
    method: "POST",
    body: { ...data, qualite: toApiEnum(data.qualite), statut: toApiEnum(data.statut) },
  }).then(normaliserMembre);
}

export function modifierMembre(id, patch) {
  return api(`/membres/${id}`, {
    method: "PATCH",
    body: { ...patch, qualite: patch.qualite ? toApiEnum(patch.qualite) : undefined, statut: patch.statut ? toApiEnum(patch.statut) : undefined },
  }).then(normaliserMembre);
}

export const radierMembre = (id) => api(`/membres/${id}/radier`, { method: "POST" }).then(normaliserMembre);
export const genererAttestation = (id) => api(`/membres/${id}/attestation`, { method: "POST" });

// ─── Cotisations ─────────────────────────────────────────────────────────
export async function getCotisations(annee) {
  const data = await api(`/cotisations?annee=${annee}`);
  return data.lignes.map((l) => ({ ...l, membre: { ...l.membre, qualite: l.membre.qualite?.toLowerCase() }, datePaiement: dateCourte(l.datePaiement) }));
}

export const enregistrerPaiement = (payload) => api("/cotisations/paiement", { method: "POST", body: payload });
export const lancerRelances = (annee) => api(`/cotisations/relances?annee=${annee}`, { method: "POST" });
export const validerCotisation = (membreId, annee, valide = true) =>
  api(`/cotisations/${membreId}/valider`, { method: "POST", body: { annee, valide } });

// ─── Reçus / Quitus ──────────────────────────────────────────────────────
export const listerRecus = (annee) => api(`/recus${annee ? `?annee=${annee}` : ""}`);
export const quitusEligibles = (annee) => api(`/quitus/eligibles?annee=${annee}`);
export const listerQuitus = () => api("/quitus");
export const genererQuitus = (membreId, annee) => api("/quitus", { method: "POST", body: { membreId, annee } });

// ─── Droits / Corps électoral / Dashboard ────────────────────────────────
export const getDroits = (annee) => api(`/droits?annee=${annee}`);
export const enregistrerPaiementDroit = (payload) => api("/droits/paiement", { method: "POST", body: payload });
export const getCorpsElectoral = (annee) => api(`/corps-electoral?annee=${annee}`);
export const getJournalAudit = (limit = 12) => api(`/dashboard/journal?limit=${limit}`);

// ─── Réunions ─────────────────────────────────────────────────────────────
export const listerReunions = () => api("/reunions");
export const getReunion = (id) => api(`/reunions/${id}`);
export const creerReunion = (data) => api("/reunions", { method: "POST", body: data });
export const majReunion = (id, patch) => api(`/reunions/${id}`, { method: "PATCH", body: patch });

// ─── Assemblées ───────────────────────────────────────────────────────────
export const listerAssemblees = () => api("/assemblees");
export const getAssemblee = (id) => api(`/assemblees/${id}`);
export const creerAssemblee = (data) => api("/assemblees", { method: "POST", body: data });
export const majAssemblee = (id, patch) => api(`/assemblees/${id}`, { method: "PATCH", body: patch });

// ─── Discipline (statut enum → minuscule) ────────────────────────────────
const normDossier = (d) => ({
  ...d,
  statut: d.statut?.toLowerCase(),
  dateSaisine: dateCourte(d.dateSaisine),
  dateConvocation: dateCourte(d.dateConvocation),
  dateAudience: dateCourte(d.dateAudience),
});
export const listerDossiers = () => api("/discipline").then((a) => a.map(normDossier));
export const getDossier = (id) => api(`/discipline/${id}`).then(normDossier);
export const ouvrirDossier = (data) => api("/discipline", { method: "POST", body: data }).then(normDossier);
export const majDossier = (id, patch) =>
  api(`/discipline/${id}`, { method: "PATCH", body: { ...patch, statut: patch.statut ? patch.statut.toUpperCase() : undefined } }).then(normDossier);
export const journalDiscipline = () => api("/discipline/journal");

// ─── Publications (statut enum → minuscule) ──────────────────────────────
const normPub = (p) => ({ ...p, statut: p.statut?.toLowerCase(), date: dateCourte(p.date) });
export const listerPublications = () => api("/publications").then((a) => a.map(normPub));
export const getPublication = (id) => api(`/publications/${id}`).then(normPub);
export const creerPublication = (data) => api("/publications", { method: "POST", body: data }).then(normPub);
export const majPublication = (id, patch) => api(`/publications/${id}`, { method: "PATCH", body: patch }).then(normPub);
export const changerStatutPublication = (id, statut) =>
  api(`/publications/${id}/statut`, { method: "POST", body: { statut: statut.toUpperCase() } }).then(normPub);
export const genererArticleLettre = (mois, theme) =>
  api("/publications/lettre/generer", { method: "POST", body: { mois, theme } });

// ─── Archives / Paramètres ───────────────────────────────────────────────
export const listerArchives = (params = {}) => api(`/archives?${new URLSearchParams(params).toString()}`);
export const archiverDoc = (entry) => api("/archives", { method: "POST", body: entry });
export const getParametres = () => api("/parametres");
export const majParametres = (patch) => api("/parametres", { method: "PUT", body: patch });

// ─── Utilisateurs (comptes & rôles, SG/Admin) ────────────────────────────
export const listerUsers = () => api("/users");
export const creerUser = (data) => api("/users", { method: "POST", body: data });
export const majUser = (id, patch) => api(`/users/${id}`, { method: "PATCH", body: patch });
export const resetPasswordUser = (id, password) => api(`/users/${id}/password`, { method: "POST", body: { password } });
