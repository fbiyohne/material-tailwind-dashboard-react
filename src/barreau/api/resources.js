import { api, telechargerPdf, ouvrirFichierAuth } from "./client";

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
export const supprimerMembre = (id) => api(`/membres/${id}`, { method: "DELETE" });
/** Provisionne (ou renvoie) l'accès à l'espace avocat d'un membre. SG/Admin. */
export const provisionnerAccesAvocat = (membreId) => api(`/membres/${membreId}/acces`, { method: "POST" });
export const importerMembres = (membres, qualiteDefaut) =>
  api("/membres/import", { method: "POST", body: { membres, ...(qualiteDefaut ? { qualiteDefaut } : {}) } });
export const genererAttestation = (id) => api(`/membres/${id}/attestation`, { method: "POST" });

// ─── Pièces du dossier (vérification documentaire) ───────────────────────────
// Casier disciplinaire d'un avocat (dossiers le concernant)
export const casierDiscipline = (membreId) => api(`/discipline?membreId=${membreId}`);

// Personnes morales (cabinets)
export const listerCabinets = () => api("/cabinets");
export const ajouterCabinet = (body) => api("/cabinets", { method: "POST", body });
export const majCabinet = (id, body) => api(`/cabinets/${id}`, { method: "PATCH", body });
export const supprimerCabinet = (id) => api(`/cabinets/${id}`, { method: "DELETE" });
export const rattacherMembreCabinet = (id, membreId) => api(`/cabinets/${id}/membres/${membreId}`, { method: "POST" });
export const detacherMembreCabinet = (id, membreId) => api(`/cabinets/${id}/membres/${membreId}`, { method: "DELETE" });
export const purgerCabinets = () => api("/cabinets/purge", { method: "POST" });

// Conseil de l'Ordre (composition)
export const listerConseil = (tous) => api(`/conseil${tous ? "?tous=1" : ""}`);
export const ajouterMembreConseil = (body) => api("/conseil", { method: "POST", body });
export const majMembreConseil = (id, body) => api(`/conseil/${id}`, { method: "PATCH", body });
export const supprimerMembreConseil = (id) => api(`/conseil/${id}`, { method: "DELETE" });

// Élections — back-office (scrutins)
export const listerScrutins = () => api("/scrutins");
export const getScrutin = (id) => api(`/scrutins/${id}`);
export const creerScrutin = (body) => api("/scrutins", { method: "POST", body });
export const ajouterCandidat = (id, body) => api(`/scrutins/${id}/candidats`, { method: "POST", body });
export const supprimerCandidat = (id, cid) => api(`/scrutins/${id}/candidats/${cid}`, { method: "DELETE" });
export const ouvrirScrutin = (id) => api(`/scrutins/${id}/ouvrir`, { method: "POST" });
export const saisirVoix = (id, candidatId, voix) => api(`/scrutins/${id}/voix`, { method: "POST", body: { candidatId, voix } });
export const cloreScrutin = (id) => api(`/scrutins/${id}/clore`, { method: "POST" });
export const publierScrutin = (id) => api(`/scrutins/${id}/publier`, { method: "POST" });
export const majScrutin = (id, body) => api(`/scrutins/${id}`, { method: "PATCH", body });
export const supprimerScrutin = (id) => api(`/scrutins/${id}`, { method: "DELETE" });
export const telechargerPvScrutinPdf = (id) => telechargerPdf(`/scrutins/${id}/pv/pdf`, `PV-scrutin-${id}.pdf`);
// Élections — espace avocat (vote en ligne)
export const getEspaceScrutins = () => api("/espace/scrutins");
export const voterScrutin = (id, candidatIds) => api(`/espace/scrutins/${id}/voter`, { method: "POST", body: { candidatIds } });

// Tableau de l'Ordre
export const getTableau = () => api("/tableau");
export const telechargerTableauPdf = () => telechargerPdf("/tableau/pdf", "Tableau-de-l-Ordre.pdf");
export const publierTableau = () => api("/tableau/publier", { method: "POST" });

// Cycle du stage (avocats stagiaires)
export const listerRapportsStage = (membreId) => api(`/membres/${membreId}/rapports`);
export const ajouterRapportStage = (membreId, body) => api(`/membres/${membreId}/rapports`, { method: "POST", body });
export const supprimerRapportStage = (membreId, rid) => api(`/membres/${membreId}/rapports/${rid}`, { method: "DELETE" });
export const validerStage = (membreId) => api(`/membres/${membreId}/valider-stage`, { method: "POST" });

export const listerPieces = (membreId) => api(`/membres/${membreId}/pieces`);
export const listerToutesPieces = (statut) => api(`/pieces${statut ? `?statut=${statut}` : ""}`);
export const televerserPiece = (membreId, body) => api(`/membres/${membreId}/pieces`, { method: "POST", body });
export const verifierPiece = (id) => api(`/pieces/${id}/verifier`, { method: "POST" });
export const rejeterPiece = (id, note) => api(`/pieces/${id}/rejeter`, { method: "POST", body: { note } });
export const supprimerPiece = (id) => api(`/pieces/${id}`, { method: "DELETE" });
export const voirPiece = (id) => ouvrirFichierAuth(`/pieces/${id}/fichier`);

// ─── Demandes d'accès (page publique « Demander un accès ») ──────────────────
export const soumettreDemandeAcces = (body) => api("/auth/demande-acces", { method: "POST", auth: false, body });
export const listerDemandesAcces = (statut) => api(`/demandes-acces${statut ? `?statut=${statut}` : ""}`);
export const approuverDemandeAcces = (id) => api(`/demandes-acces/${id}/approuver`, { method: "POST" });
export const approuverDemandeEspace = (id) => api(`/demandes-acces/${id}/approuver-espace`, { method: "POST" });
export const refuserDemandeAcces = (id) => api(`/demandes-acces/${id}/refuser`, { method: "POST" });

// ─── Cotisations ─────────────────────────────────────────────────────────
export async function getCotisations(annee) {
  const data = await api(`/cotisations?annee=${annee}`);
  return data.lignes.map((l) => ({ ...l, membre: { ...l.membre, qualite: l.membre.qualite?.toLowerCase() }, datePaiement: dateCourte(l.datePaiement) }));
}

export const enregistrerPaiement = (payload) => api("/cotisations/paiement", { method: "POST", body: payload });
// Centre de notifications in-app (back-office)
export const getMesNotifications = () => api("/mes-notifications");
export const marquerNotifLue = (id) => api(`/mes-notifications/${id}/lu`, { method: "POST" });
export const marquerToutesNotifsLues = () => api("/mes-notifications/lu-tout", { method: "POST" });

export const lancerRelances = (annee) => api(`/cotisations/relances?annee=${annee}`, { method: "POST" });
export const lancerRelancesDroits = (annee) => api(`/droits/relances?annee=${annee}`, { method: "POST" });
export const genererCotisations = (annee) => api(`/cotisations/generer?annee=${annee}`, { method: "POST" });
export const validerCotisation = (membreId, annee, valide = true) =>
  api(`/cotisations/${membreId}/valider`, { method: "POST", body: { annee, valide } });
export const supprimerCotisation = (membreId, annee) => api(`/cotisations/${membreId}/${annee}`, { method: "DELETE" });

// ─── Reçus / Quitus ──────────────────────────────────────────────────────
export const listerRecus = (annee) => api(`/recus${annee ? `?annee=${annee}` : ""}`);
export const annulerRecu = (id) => api(`/recus/${id}`, { method: "DELETE" });
export const quitusEligibles = (annee) => api(`/quitus/eligibles?annee=${annee}`);
export const listerQuitus = () => api("/quitus");
export const genererQuitus = (membreId, annee) => api("/quitus", { method: "POST", body: { membreId, annee } });
export const genererQuitusLot = (annee) => api(`/quitus/lot?annee=${annee}`, { method: "POST" });

// Timbres / vignettes électroniques de droit de plaidoirie
export const listerTimbres = () => api("/timbres");
export const creerTimbre = (body) => api("/timbres", { method: "POST", body });
export const annulerTimbre = (id) => api(`/timbres/${id}/annuler`, { method: "POST" });
export const supprimerQuitus = (id) => api(`/quitus/${id}`, { method: "DELETE" });

// ─── Droits / Corps électoral / Dashboard ────────────────────────────────
export const getDroits = (annee) => api(`/droits?annee=${annee}`);
export const enregistrerPaiementDroit = (payload) => api("/droits/paiement", { method: "POST", body: payload });
export const supprimerDroit = (membreId, annee) => api(`/droits/${membreId}/${annee}`, { method: "DELETE" });
export const getAgenda = () => api("/dashboard/agenda");

// ─── Compte courant (libre-service) ───────────────────────────────────────
export const changerMotDePasse = (currentPassword, newPassword) =>
  api("/auth/password", { method: "POST", body: { currentPassword, newPassword } });
export const getCorpsElectoral = (annee) => api(`/corps-electoral?annee=${annee}`);
export const getJournalAudit = (limit = 12) => api(`/dashboard/journal?limit=${limit}`);

// ─── Réunions ─────────────────────────────────────────────────────────────
export const listerReunions = () => api("/reunions");
export const getReunion = (id) => api(`/reunions/${id}`);
export const creerReunion = (data) => api("/reunions", { method: "POST", body: data });
export const majReunion = (id, patch) => api(`/reunions/${id}`, { method: "PATCH", body: patch });
export const convoquerReunion = (id) => api(`/reunions/${id}/convoquer`, { method: "POST" });
export const supprimerReunion = (id) => api(`/reunions/${id}`, { method: "DELETE" });

// ─── Conseil de l'Ordre (feuilles de présence) ───────────────────────────
export const getConseil = () => api("/conseil");

// ─── Assemblées ───────────────────────────────────────────────────────────
export const listerAssemblees = () => api("/assemblees");
export const getAssemblee = (id) => api(`/assemblees/${id}`);
export const creerAssemblee = (data) => api("/assemblees", { method: "POST", body: data });
export const majAssemblee = (id, patch) => api(`/assemblees/${id}`, { method: "PATCH", body: patch });
export const convoquerAssemblee = (id) => api(`/assemblees/${id}/convoquer`, { method: "POST" });
export const supprimerAssemblee = (id) => api(`/assemblees/${id}`, { method: "DELETE" });

// ─── Discipline (statut enum → minuscule) ────────────────────────────────
const normDossier = (d) => ({
  ...d,
  statut: d.statut?.toLowerCase(),
  dateSaisine: dateCourte(d.dateSaisine),
  dateConvocation: dateCourte(d.dateConvocation),
  dateAudience: dateCourte(d.dateAudience),
  dateRecours: dateCourte(d.dateRecours),
});
export const listerDossiers = () => api("/discipline").then((a) => a.map(normDossier));
export const getDossier = (id) => api(`/discipline/${id}`).then(normDossier);
export const ouvrirDossier = (data) => api("/discipline", { method: "POST", body: data }).then(normDossier);
export const majDossier = (id, patch) =>
  api(`/discipline/${id}`, { method: "PATCH", body: { ...patch, statut: patch.statut ? patch.statut.toUpperCase() : undefined } }).then(normDossier);
export const supprimerDossier = (id) => api(`/discipline/${id}`, { method: "DELETE" });
export const journalDiscipline = () => api("/discipline/journal");

// ─── Publications (statut enum → minuscule) ──────────────────────────────
const normPub = (p) => ({ ...p, statut: p.statut?.toLowerCase(), date: dateCourte(p.date) });
export const listerPublications = () => api("/publications").then((a) => a.map(normPub));
export const getPublication = (id) => api(`/publications/${id}`).then(normPub);
export const creerPublication = (data) => api("/publications", { method: "POST", body: data }).then(normPub);
export const majPublication = (id, patch) => api(`/publications/${id}`, { method: "PATCH", body: patch }).then(normPub);
export const changerStatutPublication = (id, statut) =>
  api(`/publications/${id}/statut`, { method: "POST", body: { statut: statut.toUpperCase() } }).then(normPub);
export const supprimerPublication = (id) => api(`/publications/${id}`, { method: "DELETE" });
export const genererArticleLettre = (mois, theme) =>
  api("/publications/lettre/generer", { method: "POST", body: { mois, theme } });

// ─── Calendrier éditorial (Lettre du Bâtonnier) ──────────────────────────
export const getCalendrierEditorial = () => api("/calendrier-editorial");
export const majArticleLettre = (mois, data) =>
  api(`/calendrier-editorial/${encodeURIComponent(mois)}`, { method: "PATCH", body: data });

// ─── Archives / Paramètres ───────────────────────────────────────────────
export const listerArchives = (params = {}) => api(`/archives?${new URLSearchParams(params).toString()}`);
export const archiverDoc = (entry) => api("/archives", { method: "POST", body: entry });
export const supprimerArchive = (id) => api(`/archives/${id}`, { method: "DELETE" });
export const getNotifications = () => api("/notifications");

// ─── Paiements en ligne (passerelle) ─────────────────────────────────────────
export const initierPaiement = (body) => api("/paiements/initier", { method: "POST", body });
export const confirmerPaiementSandbox = (ref, succes = true) => api(`/paiements/${ref}/confirmer-sandbox`, { method: "POST", body: { succes } });
export const getPaiement = (ref) => api(`/paiements/${ref}`);
export const getParametres = () => api("/parametres");
export const majParametres = (patch) => api("/parametres", { method: "PUT", body: patch });
// Réinitialisation totale (ADMIN) — supprime toutes les données sauf le compte admin.
export const reinitialiserDonnees = () => api("/parametres/reinitialiser-donnees", { method: "POST" });

// Matrice de rôles/permissions (RBAC éditable)
export const getRbac = () => api("/rbac");
export const majRbacRole = (role, permissions) => api("/rbac", { method: "PUT", body: { role, permissions } });

// ─── Installation (assistant de premier lancement, VPS) ──────────────────────
export const getEtatInstallation = () => api("/installation/etat", { auth: false });
export const installer = (body) => api("/installation", { method: "POST", auth: false, body });
export const testerEmailInstallation = (body) => api("/installation/test-email", { method: "POST", auth: false, body });

// ─── Espace avocat (rôle AVOCAT — libre-service cloisonné) ────────────────
export const getEspaceMoi = () => api("/espace/moi");
export const majEspaceCoordonnees = (body) => api("/espace/moi", { method: "PATCH", body });
export const getEspaceDocuments = () => api("/espace/documents");
// Pièces justificatives soumises par l'avocat (vérification par le Secrétariat).
export const getEspacePieces = () => api("/espace/pieces");
export const soumettreEspacePiece = (body) => api("/espace/pieces", { method: "POST", body });
export const supprimerEspacePiece = (id) => api(`/espace/pieces/${id}`, { method: "DELETE" });
export const voirEspacePiece = (id) => ouvrirFichierAuth(`/espace/pieces/${id}/fichier`);
export const telechargerEspaceRecuPdf = (id, numero) => telechargerPdf(`/espace/recus/${id}/pdf`, `Recu-${numero}.pdf`);
export const telechargerEspaceQuitusPdf = (id, numero) => telechargerPdf(`/espace/quitus/${id}/pdf`, `Quitus-${numero}.pdf`);
// Attestations éditées en self-service par l'avocat (inscription / non-redevance).
export const telechargerEspaceAttestationInscription = () => telechargerPdf("/espace/attestation/inscription/pdf", "Attestation-inscription.pdf");
export const telechargerEspaceAttestationNonRedevance = () => telechargerPdf("/espace/attestation/non-redevance/pdf", "Attestation-non-redevance.pdf");
// Timbres de plaidoirie (espace avocat)
export const getEspaceTimbres = () => api("/espace/timbres");
export const creerEspaceTimbre = (body) => api("/espace/timbres", { method: "POST", body });

// Centre de notifications de l'avocat (espace)
export const getEspaceNotifications = () => api("/espace/notifications");
export const marquerEspaceNotifLue = (id) => api(`/espace/notifications/${id}/lu`, { method: "POST" });
export const marquerToutesEspaceNotifsLues = () => api("/espace/notifications/lu-tout", { method: "POST" });

export const initierEspacePaiement = (body) => api("/espace/paiement", { method: "POST", body });
export const confirmerEspacePaiementSandbox = (ref, succes = true) => api(`/espace/paiement/${ref}/confirmer-sandbox`, { method: "POST", body: { succes } });

// Consultation en libre-service (annuaire, AG, discipline, archives, publications)
export const getEspaceAnnuaire = (q = "") =>
  api(`/espace/annuaire${q ? `?q=${encodeURIComponent(q)}` : ""}`).then((a) => a.map(normaliserMembre));
export const getEspaceAssemblees = () => api("/espace/assemblees");
export const getEspaceAssemblee = (id) => api(`/espace/assemblees/${id}`);
export const telechargerEspaceConvocationAgPdf = (id) => telechargerPdf(`/espace/assemblees/${id}/convocation/pdf`, "Convocation-AG.pdf");
export const telechargerEspacePvAgPdf = (id) => telechargerPdf(`/espace/assemblees/${id}/pv/pdf`, "PV-assemblee.pdf");
export const getEspaceDiscipline = () => api("/espace/discipline").then((a) => a.map(normDossier));
export const getEspaceDossier = (id) => api(`/espace/discipline/${id}`).then(normDossier);
export const telechargerEspaceDecisionPdf = (id, ref) => telechargerPdf(`/espace/discipline/${id}/decision/pdf`, `Decision-${ref}.pdf`);
export const getEspaceArchives = (q = "") => api(`/espace/archives${q ? `?q=${encodeURIComponent(q)}` : ""}`);
export const getEspacePublications = () => api("/espace/publications").then((a) => a.map(normPub));
export const getEspacePublication = (id) => api(`/espace/publications/${id}`).then(normPub);

// Messagerie interne — côté avocat
export const getEspaceMessagerie = () => api("/espace/messagerie");
export const getEspaceMessagerieNonLus = () => api("/espace/messagerie/non-lus");
export const getEspaceConversation = (id) => api(`/espace/messagerie/${id}`);
export const creerEspaceConversation = (body) => api("/espace/messagerie", { method: "POST", body });
export const repondreEspaceConversation = (id, corps) => api(`/espace/messagerie/${id}`, { method: "POST", body: { corps } });

// Messagerie interne — côté administration (Secrétariat)
export const getMessagerie = () => api("/messagerie");
export const getMessagerieNonLus = () => api("/messagerie/non-lus");
export const getConversationAdmin = (id) => api(`/messagerie/${id}`);
export const repondreConversationAdmin = (id, corps) => api(`/messagerie/${id}`, { method: "POST", body: { corps } });

// ─── Activation de compte (page publique « Activer mon espace ») ──────────
export const getActivation = (token) => api(`/auth/activation/${token}`, { auth: false });
export const activerCompte = (token, password) => api("/auth/activer", { method: "POST", auth: false, body: { token, password } });

// Réinitialisation de mot de passe en self-service
export const demanderResetMdp = (email) => api("/auth/forgot-password", { method: "POST", auth: false, body: { email } });
export const verifierResetToken = (token) => api(`/auth/reset/${token}`, { auth: false });
export const reinitialiserMdp = (token, password) => api("/auth/reset", { method: "POST", auth: false, body: { token, password } });

// Journal d'audit (consultation filtrée)
export const listerAudit = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
  return api(`/audit${qs ? `?${qs}` : ""}`);
};

// ─── Utilisateurs (comptes & rôles, SG/Admin) ────────────────────────────
export const listerUsers = () => api("/users");
export const creerUser = (data) => api("/users", { method: "POST", body: data });
export const majUser = (id, patch) => api(`/users/${id}`, { method: "PATCH", body: patch });
export const resetPasswordUser = (id, password) => api(`/users/${id}/password`, { method: "POST", body: { password } });
export const supprimerUser = (id) => api(`/users/${id}`, { method: "DELETE" });
