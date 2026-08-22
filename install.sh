#!/usr/bin/env bash
set -euo pipefail

echo "== Installation — Barreau de Pointe-Noire (VPS) =="

# 1. Docker + plugin Compose
if ! command -v docker >/dev/null 2>&1; then
  echo "Installation de Docker…"
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Le plugin docker compose est requis (Docker récent). Abandon." >&2
  exit 1
fi

# 2. Domaine (vide → HTTP simple)
read -rp "Nom de domaine (laisser vide pour HTTP sur l'IP) : " DOMAIN_INPUT
if [ -z "$DOMAIN_INPUT" ]; then
  DOMAIN=":80"; CLIENT_ORIGIN="http://localhost"
else
  DOMAIN="$DOMAIN_INPUT"; CLIENT_ORIGIN="https://$DOMAIN_INPUT"
fi

# 3. Secrets + .env (ne pas écraser un .env existant)
if [ -f .env ]; then
  echo ".env déjà présent — réutilisé."
else
  echo "Génération des secrets…"
  {
    echo "DOMAIN=$DOMAIN"
    echo "CLIENT_ORIGIN=$CLIENT_ORIGIN"
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo "JWT_SECRET=$(openssl rand -hex 32)"
    echo "SIGNATURE_SECRET=$(openssl rand -hex 32)"
  } > .env
  chmod 600 .env
fi

# 4. Build + lancement
echo "Construction et démarrage des conteneurs…"
docker compose up -d --build

echo ""
echo "== Terminé =="
if [ "$DOMAIN" = ":80" ]; then
  echo "Ouvrez http://<IP-du-serveur> pour finaliser l'installation."
else
  echo "Ouvrez https://$DOMAIN pour finaliser l'installation (l'assistant web)."
fi
