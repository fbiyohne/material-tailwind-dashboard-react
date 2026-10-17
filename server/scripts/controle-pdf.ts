/**
 * Contrôle des PDF de production (M-20261016, T6, D12) : appelle les VRAIES fonctions de gabarit
 * (templates.ts, documentsRiches.ts) puis htmlVersPdf, sur les données de barreau_pn_test, et
 * vérifie sur le PDF réel (PyMuPDF + OpenCV via controle_pdf.py, outils locaux, aucune dépendance npm) :
 * A4 à 1 pt près (A4 paysage pour la liste des avocats), une page pour les documents d'une page,
 * texte présent sur chaque page, « Page 1/ », mention C-13 absente hors démonstration, QR de
 * quitus et reçu décodé vers /v/... et reconnu « Authentique » par l'instance de test.
 *
 * Usage (depuis server/) : npx tsx scripts/apercus-gabarits.ts --production [--direction classique] [--debordement]
 *   --direction D   : direction graphique ; ne contrôle alors que quitus et liste (CA6)
 *   --debordement   : ajoute un document volontairement trop long, qui DOIT faire échouer le contrôle (code 1)
 * Environnement : VERIF_URL (défaut http://localhost:4100), instance de test à jour.
 * Sorties : docs/captures/m20261016/pdf/[<direction>/]<document>.pdf ; code 1 au moindre écart.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.resolve(ICI, "../../docs/captures/m20261016/pdf");
const VERIF_URL = process.env.VERIF_URL ?? "http://localhost:4100";
const A4 = { w: 595.28, h: 841.89 };

interface Cas { nom: string; html: string; unePage: boolean; paysage?: boolean; qr?: "q" | "r"; doitEchouer?: boolean }
interface Lecture { pages: { w: number; h: number; texte: string }[]; qr: string[] }

function lire(fichier: string): Lecture {
  const r = spawnSync("python", ["-I", path.join(ICI, "controle_pdf.py"), fichier], { encoding: "utf8", maxBuffer: 64e6 });
  if (r.status !== 0) throw new Error(`controle_pdf.py : ${r.stderr}`);
  return JSON.parse(r.stdout);
}

export async function controler(argv: string[]): Promise<number> {
  const i = argv.indexOf("--direction");
  const direction = i >= 0 ? argv[i + 1] : undefined;
  if (direction) process.env.PDF_DIRECTION = direction; // avant le chargement de gabarit.ts
  const { prisma } = await import("../src/prisma.js");
  const { htmlVersPdf } = await import("../src/lib/pdf.js");
  const { rafraichirIdentite, identite, MENTION_DEMONSTRATION } = await import("../src/lib/identiteDocuments.js");
  const T = await import("../src/lib/templates.js");
  const { quitusRicheHtml, recuRicheHtml } = await import("../src/lib/documentsRiches.js");
  const { qrDocument, hotePublic } = await import("../src/lib/signature.js");
  await rafraichirIdentite();

  // Cas extrême (R1) : nom, cabinet et adresse bien plus longs que ceux de la base.
  const extreme = { nom: "MBOUNGOU-NDZOUNGOU Marie-Chantal Hortense Aurélienne", num: 142, cabinet: "Société Civile Professionnelle d'Avocats Mboungou, Ndzoungou et Associés", adresse: "Cabinet Mboungou, immeuble Les Palmiers, 3e étage, porte 12, avenue de l'Indépendance, quartier Plateau, Pointe-Noire", dateInscription: new Date("2015-03-02") };
  const date = new Date("2026-10-11T10:00:00Z");
  const membresDb = await prisma.membre.findMany({ where: { statut: "INSCRIT" }, orderBy: { num: "asc" }, take: 60 });
  const quitus = await prisma.quitus.findFirstOrThrow({ orderBy: { id: "asc" } });
  const recu = await prisma.recu.findFirstOrThrow({ where: { statut: "EMIS" }, orderBy: { id: "asc" } });
  const reunion = { date, heure: "15 h 00", lieu: "Salle du Conseil, Maison de l'Avocat", ordreDuJour: ["Adoption du procès-verbal précédent", "Examen des demandes d'inscription", "Questions diverses"], presences: Object.fromEntries(["Me A", "Me B", "Me C", "Me D"].map((n, k) => [n, k < 3])), pv: "Le Conseil a délibéré.\n\nLes décisions ont été adoptées à l'unanimité." };
  const ag = { type: "AGO", date, lieu: "Palais de justice", ordreDuJour: ["Rapport moral", "Rapport financier"], quorumPresent: 48, pv: "L'assemblée a délibéré.", decisions: ["Quitus donné au Bâtonnier"] };
  const scrutin = { titre: "Élection du Conseil de l'Ordre 2026", type: "CONSEIL", modalite: "PRESENTIEL", nbSieges: 3, closLe: date, _count: { emargements: 40 }, candidats: [["Me A", 18], ["Me B", 12], ["Me C", 7], ["Me D", 3]].map(([nom, voix]) => ({ nom, voix })) };
  const dossier = { reference: "D-2026-004", avocatNom: extreme.nom, objet: "Manquement aux obligations déontologiques", dateAudience: date, sanction: "Avertissement", decidePar: "Conseil de discipline", dateDecision: date, motivation: "Attendu que les faits sont établis.\n\nPar ces motifs, le Conseil prononce un avertissement." };
  const accuse = { messageId: 42, sujet: "Convocation à l'assemblée générale ordinaire", auteurNom: extreme.nom, destinataire: "Me Ndinga Marc", envoyeLe: date, recuLe: date, luLe: date, empreinte: "a".repeat(64), pieceNom: "convocation.pdf", pieceTaille: 52000 };

  const cas: Cas[] = [
    { nom: "quitus", html: quitusRicheHtml(quitus, { ...extreme }, await qrDocument("q", quitus.numero), hotePublic()), unePage: true, qr: "q" },
    { nom: "recu", html: recuRicheHtml(recu, { ...extreme }, await qrDocument("r", recu.numero), hotePublic()), unePage: true, qr: "r" },
    { nom: "attestation-inscription", html: T.attestationHtml(extreme, "AT-2026-0001", date), unePage: true },
    { nom: "attestation-sortie", html: T.attestationSortieHtml(extreme, "AS-2026-0001", date, date), unePage: true },
    { nom: "attestation-non-redevance", html: T.attestationNonRedevanceHtml(extreme, "NR-2026-0001", 2026, date), unePage: true },
    { nom: "accuse-de-lecture", html: T.accuseReceptionHtml(accuse), unePage: true },
    { nom: "convocation-reunion", html: T.convocationReunionHtml(reunion), unePage: true },
    { nom: "convocation-ag", html: T.convocationAgHtml(ag), unePage: true },
    { nom: "convocation-discipline", html: T.convocationDisciplineHtml(dossier), unePage: true },
    { nom: "feuille-de-presence", html: T.feuillePresenceHtml(reunion), unePage: true },
    { nom: "pv-reunion", html: T.pvReunionHtml(reunion), unePage: false },
    { nom: "pv-ag", html: T.pvAssembleeHtml(ag), unePage: false },
    { nom: "pv-scrutin", html: T.pvScrutinHtml(scrutin), unePage: false },
    { nom: "decision-disciplinaire", html: T.decisionDisciplineHtml(dossier), unePage: false },
    { nom: "tableau-de-l-ordre", html: T.tableauOrdreHtml([{ qualite: "AVOCAT", membres: membresDb.map((m, k) => ({ ...m, rang: k + 1 })) }], date), unePage: false },
    { nom: "liste-des-avocats", html: T.listeAvocatsHtml([...membresDb, { ...extreme, num: 9999, qualite: "AVOCAT", statut: "INSCRIT", tel: "+242 06 000 00 00", email: "extreme@exemple.cg" }], "Tous les avocats", date), unePage: false, paysage: true },
  ];
  if (direction) cas.splice(0, cas.length, ...cas.filter((c) => c.nom === "quitus" || c.nom === "liste-des-avocats"));
  if (argv.includes("--debordement")) {
    const long = Array.from({ length: 400 }, (_, k) => `Considérant n° ${k}, texte volontairement trop long pour une page.`).join(" ");
    cas.push({ nom: "test-debordement", html: T.attestationHtml({ ...extreme, nom: long }, "AT-X", date), unePage: true });
  }

  const dossierSortie = direction ? path.join(SORTIE, direction) : SORTIE;
  fs.mkdirSync(dossierSortie, { recursive: true });
  const demo = identite().modeDemonstration;
  const erreurs: string[] = [];
  for (const c of cas) {
    const fichier = path.join(dossierSortie, `${c.nom}.pdf`);
    fs.writeFileSync(fichier, await htmlVersPdf(c.html));
    const err: string[] = [];
    const l = lire(fichier);
    const [w, h] = c.paysage ? [A4.h, A4.w] : [A4.w, A4.h];
    if (!l.pages.length) err.push("aucune page");
    l.pages.forEach((p, k) => {
      if (Math.abs(p.w - w) > 1 || Math.abs(p.h - h) > 1) err.push(`page ${k + 1} en ${p.w.toFixed(0)}x${p.h.toFixed(0)} pt`);
      if (p.texte.replace(/\s+/g, " ").length < 60) err.push(`page ${k + 1} vide de texte`);
    });
    if (c.unePage && l.pages.length > 1) err.push(`${l.pages.length} pages au lieu d'une (débordement)`);
    if (!/Page 1\//.test(l.pages[0]?.texte ?? "")) err.push("« Page 1/ » absent");
    if (!demo && l.pages.some((p) => p.texte.includes("Données entièrement fictives"))) err.push(`mention C-13 hors démonstration (${MENTION_DEMONSTRATION.slice(0, 20)}…)`);
    let qrInfo = "";
    if (c.qr) {
      const url = l.qr.find((u) => /\/v\/[qr]\//.test(u));
      if (!url) err.push("QR non décodé vers /v/...");
      else {
        const chemin = new URL(url).pathname;
        const r = await fetch(VERIF_URL + chemin).then((x) => x.text(), () => "");
        const ok = /<title>Authentique/.test(r);
        qrInfo = `  QR ${chemin} -> ${ok ? "authentique" : "NON authentique"}`;
        if (!ok) err.push(`vérification ${VERIF_URL}${chemin} : pas « Authentique »`);
      }
    }
    // Le cas volontairement trop long doit être détecté : le script sort alors en code 1, comme pour tout écart.
    console.log(`${(direction ? direction + "/" : "") + c.nom}.pdf  ${l.pages.length} page(s)  ${err.length ? "ÉCHEC" : "ok"}${qrInfo}${err.length ? "  [" + err.join(" ; ") + "]" : ""}`);
    if (err.length) erreurs.push(`${c.nom} : ${err.join(" ; ")}`);
  }
  console.log("Timbre : pas de PDF serveur (D11), couvert par l'aperçu docs/design/pdf/apercus/*-timbre.pdf.");
  if (erreurs.length) console.error("\n" + erreurs.join("\n"));
  await prisma.$disconnect();
  return erreurs.length ? 1 : 0;
}
