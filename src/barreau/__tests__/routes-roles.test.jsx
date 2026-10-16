// Alignement front/serveur des droits (M-20261016, D17) : le menu et les routes reflètent les gardes serveur.
import { describe, it, expect, vi } from "vitest";
import { sectionsPourUser, detailRoutes, aAcces } from "../routes";

const ROLES = ["SECRETAIRE_GENERAL", "BATONNIER", "TRESORIERE", "ADMIN", "SECRETAIRE_ADJOINT", "CONSULTATION", "ACCUEIL"];
// Permissions par défaut (lib/rbac.ts, DEFAUTS) : sert à simuler `user.permissions`.
const PERMS = {
  BATONNIER: ["membres", "corps_electoral", "reunions_assemblees", "discipline", "elections", "messagerie", "documents", "audit"],
  TRESORIERE: ["finances", "messagerie"],
  SECRETAIRE_ADJOINT: ["membres", "corps_electoral", "reunions_assemblees", "discipline", "elections", "messagerie", "documents", "audit"],
  CONSULTATION: ["membres", "corps_electoral", "documents", "audit"],
  ACCUEIL: ["membres", "documents"],
};
const TOUT = ["membres", "corps_electoral", "reunions_assemblees", "discipline", "elections", "messagerie", "documents", "audit", "finances", "parametres", "utilisateurs"];
const user = (role) => ({ role, permissions: PERMS[role] ?? TOUT });
const chemins = (role) => sectionsPourUser(user(role)).flatMap((s) => s.items.map((i) => i.path));

describe("menu par rôle", () => {
  it.each(ROLES)("%s : cohérent avec la matrice attendue", (role) => {
    const c = chemins(role);
    // Contenu des messages : refusé à l'ADMIN (secret professionnel).
    expect(c.includes("/messagerie")).toBe(role !== "ADMIN" && (PERMS[role] ?? TOUT).includes("messagerie"));
    // File de vérification des pièces : serveur réservé à SG, Bâtonnier (+ ADMIN).
    expect(c.includes("/pieces")).toBe(["SECRETAIRE_GENERAL", "BATONNIER", "ADMIN"].includes(role));
    // Discipline : jamais pour Trésorière, Accueil, Consultation.
    if (["TRESORIERE", "ACCUEIL", "CONSULTATION"].includes(role)) expect(c).not.toContain("/discipline");
  });

  it("fiche membre : réservée à SG, Bâtonnier, ADMIN", () => {
    const fiche = detailRoutes.find((d) => d.path === "/avocats/:id");
    for (const r of ROLES) {
      expect(aAcces(fiche, user(r))).toBe(["SECRETAIRE_GENERAL", "BATONNIER", "ADMIN"].includes(r));
    }
  });
});

describe("403 : message du serveur conservé", () => {
  it("ne réécrit pas le message serveur (le neutre vient du serveur)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ erreur: "Dossier disciplinaire 12 réservé" }), { status: 403, headers: { "Content-Type": "application/json" } })));
    const { api } = await import("../api/client");
    await expect(api("/membres/1")).rejects.toMatchObject({
      status: 403,
      message: "Dossier disciplinaire 12 réservé",
    });
    vi.unstubAllGlobals();
  });
});
