#!/usr/bin/env bash
#
# Check rapide que Docker + Postgres sont prêts avant `pnpm dev`.
# NE BLOQUE PAS le lancement de l'app si quelque chose cloche :
#   - avertit clairement avec les commandes de récupération
#   - exit 0 quand même pour laisser pnpm dev continuer
#
# Compatible macOS (n'utilise pas `timeout` GNU qui n'est pas natif macOS).

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[db]${NC} $1"; }
warn() { echo -e "${YELLOW}[db]${NC} $1"; }

# Helper portable : exécute une commande avec un timeout en arrière-plan.
# Marche sur macOS ET Linux, sans dépendance à GNU coreutils.
run_with_timeout() {
  local timeout_sec=$1
  shift
  ( "$@" ) &
  local pid=$!
  local elapsed=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$elapsed" -ge "$timeout_sec" ]; then
      kill -9 "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
      return 124  # convention timeout
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  wait "$pid"
  return $?
}

# ── 1. Docker daemon ─────────────────────────────────────────────────
# `docker info` répond instantanément si le daemon est joignable, sinon
# affiche "Cannot connect…" en stderr. Pas besoin de timeout dans 99% des cas.
if ! docker info > /dev/null 2>&1; then
  warn "Docker daemon non joignable."
  warn ""
  warn "Pour résoudre :"
  warn "  1. Lance Docker Desktop : open -a Docker"
  warn "  2. Attends que la baleine 🐳 soit stable dans la barre de menu (~30s)"
  warn "  3. Re-essaie : pnpm db:up"
  warn ""
  warn "L'app va se lancer quand même mais elle plantera sur les routes DB."
  exit 0
fi
log "Docker daemon OK"

# ── 2. Container Postgres ────────────────────────────────────────────
CONTAINER_STATUS=$(docker inspect -f '{{.State.Status}}' lubin-postgres 2>/dev/null || echo "missing")

case "$CONTAINER_STATUS" in
  running)
    log "Postgres déjà en cours"
    ;;
  exited|created|paused|stopped)
    log "Postgres arrêté ($CONTAINER_STATUS) — démarrage…"
    if ! docker start lubin-postgres > /dev/null 2>&1; then
      warn "Impossible de démarrer lubin-postgres. Lance manuellement : docker start lubin-postgres"
      exit 0
    fi
    ;;
  *)
    warn "Container 'lubin-postgres' absent. Création via docker compose…"
    if ! docker compose up -d postgres > /dev/null 2>&1; then
      warn "Échec docker compose up. Lance manuellement."
      exit 0
    fi
    ;;
esac

# ── 3. Postgres prêt à accepter des connexions ───────────────────────
for i in 1 2 3 4 5 6 7 8 9 10; do
  if docker exec lubin-postgres pg_isready -U lubin -d lubin_investment > /dev/null 2>&1; then
    log "Postgres prêt"
    exit 0
  fi
  sleep 1
done

warn "Postgres ne répond pas après 10s (mais le container tourne). L'app va essayer quand même."
exit 0
