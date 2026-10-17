import { prisma } from "../prisma.js";

/**
 * L'assistant d'installation n'est actif que sur un déploiement VPS
 * (INSTALL_WIZARD=1), tant qu'aucun compte ADMIN n'existe et que le flag
 * `installe` n'a pas été posé. Sur Render (flag absent) → toujours inactif.
 */
export async function wizardActif(): Promise<boolean> {
  if (process.env.INSTALL_WIZARD !== "1") return false;
  const row = await prisma.parametres.findUnique({ where: { id: 1 } });
  if ((row?.data as { installe?: boolean } | undefined)?.installe) return false;
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  return admins === 0;
}
