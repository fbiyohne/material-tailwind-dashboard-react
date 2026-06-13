import { api } from "./client";

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
export const validerCotisation = (membreId, annee, valide = true) =>
  api(`/cotisations/${membreId}/valider`, { method: "POST", body: { annee, valide } });

// ─── Reçus / Quitus ──────────────────────────────────────────────────────
export const listerRecus = (annee) => api(`/recus${annee ? `?annee=${annee}` : ""}`);
export const quitusEligibles = (annee) => api(`/quitus/eligibles?annee=${annee}`);
export const listerQuitus = () => api("/quitus");
export const genererQuitus = (membreId, annee) => api("/quitus", { method: "POST", body: { membreId, annee } });
