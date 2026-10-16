import { Router } from "express";
import { z } from "zod";
import { asyncH } from "../middleware/error.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { envoyerPdf } from "../lib/pdf.js";
import { documentHtml } from "../lib/templates.js";
import { esc } from "../lib/documentsCommun.js";
import { identite } from "../lib/identiteDocuments.js";

/**
 * POST /etats/pdf — listes et états de l'application (corps électoral, annuaire, stagiaires,
 * états des cotisations et des droits de plaidoirie) mis en page sur le gabarit officiel.
 * Le client envoie les lignes qu'il affiche déjà (mêmes filtres que l'écran) ; le serveur
 * n'en fait que la mise en page : document interne, sans cachet ni QR, diffusion restreinte.
 * Réservé aux organes de l'Ordre (jamais un compte avocat) : le papier à en-tête n'est pas
 * mis à disposition de contenus libres hors du secrétariat.
 */
export const etatsRouter = Router();
etatsRouter.use(requireAuth, requireRole("SECRETAIRE_GENERAL", "SECRETAIRE_ADJOINT", "BATONNIER", "TRESORIERE", "CONSULTATION", "ACCUEIL"));

const cellule = z.union([z.string().max(400), z.number()]).nullable().transform((v) => (v == null ? "" : String(v)));
const Etat = z.object({
  titre: z.string().min(1).max(120),
  sousTitre: z.string().max(300).optional(),
  entete: z.array(z.string().max(60)).min(1).max(14),
  lignes: z.array(z.array(cellule).max(14)).max(20000), // borne haute ; le corps JSON reste limité à 8 Mo (app.ts)
  totaux: z.array(cellule).max(14).optional(),
  signataire: z.enum(["sg", "tresoriere"]).default("sg"),
  fichier: z.string().max(80).regex(/^[\w.-]+$/).default("Etat"),
});

etatsRouter.post(
  "/pdf",
  asyncH(async (req, res) => {
    const e = Etat.parse(req.body);
    const id = identite();
    const ligne = (cells: string[], balise = "td") => `<tr>${cells.map((c) => `<${balise}>${esc(c)}</${balise}>`).join("")}</tr>`;
    const corps = `<table><thead>${ligne(e.entete, "th")}</thead><tbody>${e.lignes.map((l) => ligne(l)).join("")}</tbody>${e.totaux ? `<tfoot>${ligne(e.totaux)}</tfoot>` : ""}</table>`;
    const date = new Date();
    const sg = e.signataire === "sg";
    await envoyerPdf(res, documentHtml({
      org: sg ? "Le Secrétaire Général" : "La Trésorerie",
      title: esc(e.titre),
      sousTitre: esc([e.sousTitre, `${e.lignes.length} ligne${e.lignes.length > 1 ? "s" : ""}`].filter(Boolean).join(" · ")),
      reference: esc(`${e.titre} · ${date.toLocaleDateString("fr-FR")}`),
      bodyHtml: corps,
      signataire: sg ? { role: "Le Secrétaire Général", nom: id.secretaireGeneral } : { role: "La Trésorière de l'Ordre", nom: id.tresoriere },
      date,
      cachet: false,
      paysage: e.entete.length > 6,
      listeRestreinte: true,
    }), `${e.fichier}-${date.toISOString().slice(0, 10)}.pdf`);
  })
);
