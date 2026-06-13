#!/usr/bin/env bash
# =============================================================================
# Setup de l'environnement Claude Code — Barreau de Pointe-Noire
# -----------------------------------------------------------------------------
# Réinstalle les plugins et skills à chaque session (l'environnement distant est
# éphémère : ~/.claude est recréé à neuf). Lancé automatiquement par le hook
# SessionStart défini dans .claude/settings.json.
#
# Idempotent et non bloquant : toute erreur est tolérée (|| true) pour ne jamais
# empêcher le démarrage d'une session.
# =============================================================================
set +e

LOG() { echo "[setup-claude-env] $*"; }
SRC="$HOME/.claude/local-plugins/src"
LP="$HOME/.claude/local-plugins"
mkdir -p "$SRC"

# --- 1. Marketplaces officiels / communautaires -----------------------------
LOG "Ajout des marketplaces…"
claude plugin marketplace add obra/superpowers-marketplace >/dev/null 2>&1 || true
claude plugin marketplace add anthropics/claude-code        >/dev/null 2>&1 || true

# --- 2. Plugins ------------------------------------------------------------
LOG "Installation des plugins…"
claude plugin install superpowers@superpowers-marketplace        >/dev/null 2>&1 || true
claude plugin install superpowers-chrome@superpowers-marketplace >/dev/null 2>&1 || true
claude plugin install frontend-design@claude-code-plugins        >/dev/null 2>&1 || true
claude plugin install feature-dev@claude-code-plugins            >/dev/null 2>&1 || true
claude plugin install code-review@claude-code-plugins            >/dev/null 2>&1 || true

# --- Helper : empaquette un dépôt de skills bruts en plugin local namespacé -
# $1 = nom du plugin   $2 = repo github   $3 = description
#  • Les SKILL.md du dépôt sont aplatis sous skills/<nom>/ (un seul niveau)
#  • Installé via un marketplace local → skills accessibles en <plugin>:<skill>
build_local_plugin() {
  local name="$1" repo="$2" desc="$3"
  local repodir="$SRC/$name" plugdir="$LP/$name"

  if [ ! -d "$repodir/.git" ]; then
    LOG "Clone $repo…"
    timeout 90 git clone --depth 1 "https://github.com/$repo.git" "$repodir" >/dev/null 2>&1 || { LOG "clone $repo échoué"; return; }
  fi

  rm -rf "$plugdir"
  mkdir -p "$plugdir/.claude-plugin" "$plugdir/skills"

  # Aplatissement : chaque dossier contenant un SKILL.md devient skills/<base>/
  find "$repodir" -name SKILL.md -not -path "*/.git/*" | while read -r f; do
    local d base; d="$(dirname "$f")"; base="$(basename "$d")"
    mkdir -p "$plugdir/skills/$base"
    cp -R "$d/." "$plugdir/skills/$base/" 2>/dev/null || true
  done

  cat > "$plugdir/.claude-plugin/plugin.json" <<EOF
{ "name": "$name", "version": "1.0.0", "description": "$desc" }
EOF
  cat > "$plugdir/.claude-plugin/marketplace.json" <<EOF
{ "name": "$name-mkt", "owner": { "name": "local" },
  "plugins": [ { "name": "$name", "source": "./", "description": "$desc" } ] }
EOF

  claude plugin marketplace add "$plugdir" >/dev/null 2>&1 || true
  claude plugin install "$name@$name-mkt"  >/dev/null 2>&1 || true
  LOG "plugin local '$name' installé ($(find "$plugdir/skills" -name SKILL.md | wc -l | tr -d ' ') skills)"
}

# --- 3. Skills « taste » (jugement design & qualité) ------------------------
# taste-quality : évaluation transverse code/archi/produit/design/communication
build_local_plugin "taste-quality" "VOIDXAI/taste" \
  "Jugement qualité 5 dimensions : code, architecture, produit, design, communication"
# taste-design : bibliothèque de jugement design (hiérarchie, typo, couleur, craft…)
build_local_plugin "taste-design" "Dragoon0x/taste-skills" \
  "Bibliotheque de jugement design : hierarchie, typographie, couleur, espacement, craft"

# --- 4. Backend (PostgreSQL + API) ------------------------------------------
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$PROJECT_DIR/server/scripts/setup-dev.sh" ]; then
  LOG "Bootstrap du backend (PostgreSQL + migrations)…"
  bash "$PROJECT_DIR/server/scripts/setup-dev.sh" || true
fi

LOG "Terminé."
exit 0
