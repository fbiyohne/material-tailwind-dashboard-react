-- Nouveaux profils (valeurs d'enum ajoutées de façon idempotente).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SECRETAIRE_ADJOINT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CONSULTATION';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ACCUEIL';

-- Matrice de permissions éditable (rôle × module).
CREATE TABLE "RolePermission" (
    "role"       "Role" NOT NULL,
    "permission" TEXT NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role", "permission")
);
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");
