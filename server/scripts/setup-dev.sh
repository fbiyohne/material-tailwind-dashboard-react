#!/usr/bin/env bash
# =============================================================================
# Bootstrap du backend en développement (idempotent, non bloquant) :
# démarre PostgreSQL, prépare la base, installe les deps, applique les
# migrations et seed si nécessaire. Réutilisable en local et via SessionStart.
# =============================================================================
set +e
LOG() { echo "[backend] $*"; }
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 1) Démarrer le cluster PostgreSQL s'il est arrêté
if ! ss -ltn 2>/dev/null | grep -q ':5432'; then
  LOG "Démarrage de PostgreSQL…"
  pg_ctlcluster 16 main start >/dev/null 2>&1 || service postgresql start >/dev/null 2>&1 || true
  sleep 2
fi

# 2) Rôle applicatif + base de données
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='barreau'" 2>/dev/null | grep -q 1 ||
  sudo -u postgres psql -c "CREATE ROLE barreau LOGIN PASSWORD 'barreau_dev' CREATEDB;" >/dev/null 2>&1
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='barreau_pn'" 2>/dev/null | grep -q 1 ||
  sudo -u postgres createdb -O barreau barreau_pn >/dev/null 2>&1

cd "$DIR" || exit 0

# 3) Fichier .env de dev (gitignoré) si absent
if ! grep -q "barreau:barreau_dev@localhost" .env 2>/dev/null; then
  cat > .env <<'EOF'
DATABASE_URL="postgresql://barreau:barreau_dev@localhost:5432/barreau_pn?schema=public"
JWT_SECRET="dev-secret-barreau-pn-change-me"
PORT=4000
CLIENT_ORIGIN="http://localhost:5173"
EOF
fi

# 4) Dépendances, migrations, génération
[ -d node_modules ] || { LOG "Installation des dépendances…"; npm install >/dev/null 2>&1; }
LOG "Application des migrations…"
npx prisma migrate deploy >/dev/null 2>&1
npx prisma generate >/dev/null 2>&1

# 5) Seed si la base est vide
COUNT=$(PGPASSWORD=barreau_dev psql -h localhost -U barreau -d barreau_pn -tAc 'SELECT count(*) FROM "Membre"' 2>/dev/null)
if [ "${COUNT:-0}" = "0" ]; then LOG "Seed des données…"; npm run seed >/dev/null 2>&1; fi

LOG "Prêt. Lancer l'API : (cd server && npm run dev) → http://localhost:4000/api"
exit 0
