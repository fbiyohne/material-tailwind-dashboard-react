import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prisma } from "../src/prisma.js";

// Aucun envoi réel : on capture les appels aux canaux sortants.
const envoyerEmail = vi.fn(async () => ({ statut: "ENVOYE" as const, simulation: true }));
const envoyerSms = vi.fn(async () => ({ statut: "ENVOYE" as const, simulation: true }));
vi.mock("../src/lib/notifications.js", () => ({ envoyerEmail: (o: unknown) => envoyerEmail(o as never), envoyerSms: (o: unknown) => envoyerSms(o as never) }));

const { envoyerMessage, PIECE_MAX } = await import("../src/lib/messagerie.js");
const { notifierNouveauMessage, CL_NOTIF_EXTERNE } = await import("../src/lib/messagerieNotif.js");

/** Configuration de la messagerie dans Parametres.data (ligne id=1), restaurée en fin de suite. */
let avant: unknown;
async function regler(messagerie: Record<string, unknown>) {
  const row = await prisma.parametres.findUnique({ where: { id: 1 } });
  const data = { ...((row?.data as object) ?? {}), messagerie };
  await prisma.parametres.upsert({ where: { id: 1 }, update: { data: data as never }, create: { id: 1, data: data as never } });
}
const pdf = (octets: number) => ({ nomFichier: "a.pdf", donnees: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(octets)]).toString("base64") });
const creer = vi.fn(async () => "ok");

beforeAll(async () => { avant = (await prisma.parametres.findUnique({ where: { id: 1 } }))?.data; });
afterAll(async () => { if (avant !== undefined) await prisma.parametres.update({ where: { id: 1 }, data: { data: avant as never } }); });
beforeEach(() => { vi.clearAllMocks(); });

describe("messagerie : pièces jointes et interrupteur interne", () => {
  it("pièces jointes désactivées : upload refusé (403), message sans pièce accepté", async () => {
    await regler({ piecesJointes: false });
    await expect(envoyerMessage("x", pdf(10), creer)).rejects.toMatchObject({ status: 403 });
    expect(creer).not.toHaveBeenCalled();
    await expect(envoyerMessage("x", undefined, creer)).resolves.toBe("ok");
  });
  it("6 Mo refusé même si pieceMaxMo vaut 10 (plafond PIECE_MAX)", async () => {
    await regler({ piecesJointes: true, pieceMaxMo: 10 });
    expect(PIECE_MAX).toBe(5 * 1024 * 1024);
    await expect(envoyerMessage("x", pdf(6 * 1024 * 1024), creer)).rejects.toMatchObject({ status: 413 });
  });
  it("pieceMaxMo=1 : 2 Mo refusé, relu à chaque appel", async () => {
    await regler({ pieceMaxMo: 1 });
    await expect(envoyerMessage("x", pdf(2 * 1024 * 1024), creer)).rejects.toMatchObject({ status: 413 });
  });
  it("messagerie interne désactivée : tout envoi refusé (403)", async () => {
    await regler({ interneActive: false });
    await expect(envoyerMessage("x", undefined, creer)).rejects.toMatchObject({ status: 403 });
  });
});

describe("messagerie : relais externes au contenu neutre", () => {
  it("relais e-mail : CL-NOTIF-EXTERNE seule, ni sujet ni corps", async () => {
    await regler({ relaisEmail: true });
    await notifierNouveauMessage(async () => ["a@b.cg"]);
    expect(envoyerEmail).toHaveBeenCalledTimes(1);
    const o = envoyerEmail.mock.calls[0][0] as { text: string; subject: string };
    expect(o.text).toBe(CL_NOTIF_EXTERNE);
    expect(o.subject).toBe("Messagerie — nouveau message");
  });
  it("relaisEmail=false : aucun e-mail", async () => {
    await regler({ relaisEmail: false });
    await notifierNouveauMessage(async () => ["a@b.cg"]);
    expect(envoyerEmail).not.toHaveBeenCalled();
  });
  it("relaisSms=false (défaut) : aucun appel SMS", async () => {
    await regler({ relaisSms: false });
    await notifierNouveauMessage(async () => [], async () => ["+242060000000"]);
    expect(envoyerSms).not.toHaveBeenCalled();
  });
  it("relaisSms=true : SMS neutre, en simulation forcée", async () => {
    await regler({ relaisSms: true });
    await notifierNouveauMessage(async () => [], async () => ["+242060000000"]);
    expect(envoyerSms).toHaveBeenCalledWith({ to: "+242060000000", message: CL_NOTIF_EXTERNE, evenement: "MESSAGE", simulation: true });
  });
});
