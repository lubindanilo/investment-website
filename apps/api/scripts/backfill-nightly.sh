#!/bin/bash
# Backfill nocturne du score Resilience 5 etoiles.
# Ordre = capi decroissante ; ne re-score pas le deja-fait ; s'arrete au plafond
# quotidien (defaut 250), reprend la nuit suivante jusqu'a epuisement de l'univers.
# Portable : se localise via $0 (fonctionne dans n'importe quel checkout/worktree).
export PATH="/opt/homebrew/bin:/Users/lubin.danilo/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
DIR="$(cd "$(dirname "$0")/.." && pwd)"   # apps/api
LOG="$DIR/backfill-nightly.log"
CAP="${RESILIENCE_STARS_DAILY_CAP:-250}"
cd "$DIR" || { echo "$(date) cd fail" >> "$LOG"; exit 1; }
echo "=== $(date '+%Y-%m-%d %H:%M') START cap=$CAP ===" >> "$LOG"
pnpm run resilience:stars:backfill "$CAP" >> "$LOG" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M') END exit=$? ===" >> "$LOG"
