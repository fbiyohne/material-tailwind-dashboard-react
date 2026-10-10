import { Router } from "express";
import { prisma } from "../prisma.js";
import { anneeDeRequete, dateDeRequete } from "../lib/requete.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { dateReferenceScrutin, electeursADate } from "../lib/cycleVie.js";
import { reglesActuelles } from "../lib/regles.js";

export const corpsElectoralRouter = Router();
// Corps électoral (éligibilité = cotisations + discipline) : SG/Bâtonnier/Admin.
corpsElectoralRouter.use(requireAuth, requirePermission("corps_electoral"));

/**
 * GET /corps-electoral?date=AAAA-MM-JJ | ?scrutinId= | ?annee= — liste générée à la
 * date du scrutin (X-03, RG-04 à RG-06) : statut, sanctions et paiements sont
 * appréciés à cette date (situationADate). `?annee=` reste accepté : date au 31/12
 * de l'exercice, même liste que la règle historique. Un scrutin utilise sa dateScrutin.
 */
corpsElectoralRouter.get(
  "/",
  asyncH(async (req, res) => {
    let date = dateDeRequete(req);
    if (!date && req.query.scrutinId) {
      const s = await prisma.scrutin.findUnique({ where: { id: Number(req.query.scrutinId) }, select: { dateScrutin: true, ouvertLe: true } });
      if (!s) throw new HttpError(404, "Scrutin introuvable");
      date = dateReferenceScrutin(s);
    }
    if (!date) date = new Date(Date.UTC(anneeDeRequete(req), 11, 31, 23, 59, 59, 999));
    const annee = date.getUTCFullYear();
    const regles = await reglesActuelles();
    // Les stagiaires n'apparaissent dans aucune liste, sauf si les règles en font des électeurs.
    const where = regles.electoral.qualites.includes("STAGIAIRE") ? {} : { qualite: { not: "STAGIAIRE" as const } };

    const electeurs: any[] = [];
    const exclusCotisation: any[] = [];
    const exclusStatut: any[] = [];
    const exclusAutre: any[] = []; // honoraires & autres motifs : ne pas les perdre silencieusement
    for (const { membre: m, situation, eligible, raison } of await electeursADate(where, date, regles)) {
      const item = { id: m.id, num: m.num, nom: m.nom, cabinet: m.cabinet, dateInscription: m.dateInscription, statutADate: situation.statut, sursis: situation.sursis, raison };
      if (eligible) electeurs.push(item);
      else if (raison === "cotisation") exclusCotisation.push(item);
      else if (raison === "statut") exclusStatut.push(item);
      else exclusAutre.push(item);
    }
    res.json({
      annee,
      date,
      electeurs,
      exclusCotisation,
      exclusStatut,
      exclusAutre,
      stats: {
        electeurs: electeurs.length,
        exclusCotisation: exclusCotisation.length,
        exclusStatut: exclusStatut.length,
        exclusAutre: exclusAutre.length,
      },
    });
  })
);
