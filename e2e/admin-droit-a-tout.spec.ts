/**
 * M-20261016-admin-droit-a-tout (T9) — l'ADMIN a droit à tout : Messagerie et ouverture d'une pièce
 * sur l'instance de test (base barreau_pn_test). Aucun envoi réel. Une pièce fictive « E2E » est
 * téléversée si la base n'en contient aucune. Capture : docs/captures/m20261016-admin/.
 */
import { test, expect } from "@playwright/test";
import { mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const CAPTURES = resolve(process.cwd(), "../docs/captures/m20261016-admin");
mkdirSync(CAPTURES, { recursive: true });

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n").toString("base64");

test("ADMIN : menu Messagerie, ouverture d'un fil, ligne de journalisation, ouverture d'une pièce", async ({ page, request }) => {
  const r = await request.post("/api/auth/login", { data: { email: "admin@barreau-pn.cg", password: "barreau" } });
  expect(r.status()).toBe(200);
  const { token, refreshToken } = (await r.json()) as { token: string; refreshToken: string };
  const h = { Authorization: `Bearer ${token}` };
  await page.addInitScript(({ t, f }) => { localStorage.setItem("bpn_token", t); localStorage.setItem("bpn_refresh", f); }, { t: token, f: refreshToken });

  // Pièce à ouvrir : une pièce existante, sinon une pièce fictive téléversée sur le premier membre.
  let pieces = (await (await request.get("/api/pieces", { headers: h })).json()) as { id: number; nomFichier: string }[];
  if (!pieces.length) {
    const liste = await (await request.get("/api/membres", { headers: h })).json();
    const membreId = (Array.isArray(liste) ? liste : liste.items ?? liste.data)[0].id;
    const up = await request.post(`/api/membres/${membreId}/pieces`, { headers: h, data: { type: "AUTRE", nomFichier: "E2E-admin.pdf", mimeType: "application/pdf", donnees: PDF } });
    expect(up.status(), "téléversement de la pièce fictive").toBeLessThan(300);
    pieces = (await (await request.get("/api/pieces", { headers: h })).json()) as { id: number; nomFichier: string }[];
  }
  expect(pieces.length).toBeGreaterThan(0);

  // Messagerie : menu, fil, ligne de journalisation.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Messagerie" }).first()).toBeVisible();
  await page.getByRole("link", { name: "Messagerie" }).first().click();
  await expect(page.getByRole("heading", { name: "Messagerie" }).first()).toBeVisible();
  await expect(page.getByText("Les accès de l'administrateur à ce contenu sont journalisés.")).toBeVisible();
  const filReponse = page.waitForResponse((x) => /\/api\/messagerie\/\d+$/.test(x.url()) && x.request().method() === "GET");
  await page.locator("ul button, ul li").first().click();
  expect((await filReponse).status(), "ouverture d'un fil").toBe(200);
  await page.waitForLoadState("networkidle");

  // Pièces : bouton « Voir » → GET du fichier en 200.
  await page.goto("/pieces");
  await page.getByRole("button", { name: "Toutes" }).click();
  await expect(page.getByRole("button", { name: "Voir" }).first()).toBeVisible();
  const fichier = page.waitForResponse((x) => /\/api\/pieces\/\d+\/fichier$/.test(x.url()));
  await page.getByRole("button", { name: "Voir" }).first().click();
  expect((await fichier).status(), "ouverture d'une pièce").toBe(200);

  const png = `${CAPTURES}/admin-messagerie-piece.png`;
  await page.screenshot({ path: png });
  expect(statSync(png).size, "capture < 1 Mo").toBeLessThan(1_048_576);
});
