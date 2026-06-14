#!/usr/bin/env bash
# Bootstrap local — Application du Secrétariat Général du Barreau de Pointe-Noire.
# Installe les dépendances, prépare PostgreSQL, applique les migrations et les
# données de démonstration. Idempotent : peut être relancé sans risque.
#
# Usage :
#   ./scripts/bootstrap-local.sh
#   DATABASE_URL="postgresql://user:pass@localhost:5432/barreau_pn?schema=public" ./scripts/bootstrap-local.sh
set -euo pipefail

racine="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$racine"

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/barreau_pn?schema=public}"
DB_NAME="$(printf '%s' "$DB_URL" | sed -E 's#.*/([^/?]+).*#\1#')"

echo "▶ Vérification des prérequis…"
command -v node >/dev/null || { echo "✗ Node.js requis (≥ 18)."; exit 1; }
command -v npm  >/dev/null || { echo "✗ npm requis."; exit 1; }
echo "  Node $(node -v)"

echo "▶ Base de données « $DB_NAME »…"
if command -v createdb >/dev/null 2>&1; then
  createdb "$DB_NAME" 2>/dev/null && echo "  base créée" || echo "  base déjà présente (ou créée par ailleurs)"
else
  echo "  (createdb introuvable — créez la base « $DB_NAME » manuellement si besoin)"
fi

echo "▶ Configuration backend (server/.env)…"
if [ ! -f server/.env ]; then
  cp server/.env.example server/.env
  # Renseigne DATABASE_URL et un JWT_SECRET de développement.
  sed -i.bak -E "s#^DATABASE_URL=.*#DATABASE_URL=\"$DB_URL\"#" server/.env && rm -f server/.env.bak
  sed -i.bak -E "s#^JWT_SECRET=.*#JWT_SECRET=\"dev-$(date +%s)\"#" server/.env && rm -f server/.env.bak
  echo "  server/.env créé (email/SMS/paiements laissés vides → simulation/sandbox)"
else
  echo "  server/.env déjà présent — inchangé"
fi

echo "▶ Dépendances frontend…"
npm install --silent
echo "▶ Dépendances backend…"
(cd server && npm install --silent)

echo "▶ Migrations Prisma…"
(cd server && npx prisma migrate deploy)
echo "▶ Données de démonstration (seed)…"
(cd server && npm run seed)

cat <<'FIN'

✓ Prêt.

Démarrer l'application (deux terminaux) :
  cd server && npm run dev     # API    → http://localhost:4000
  npm run dev                  # Front  → http://localhost:5173

Connexion (mot de passe : barreau) :
  sg@barreau-pn.cg · tresoriere@barreau-pn.cg · batonnier@barreau-pn.cg · admin@barreau-pn.cg

Email/SMS = simulation · Paiements = sandbox (aucun compte externe requis).
FIN
