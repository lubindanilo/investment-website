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
# $? est capture AVANT tout autre commande. Ecrit directement dans le echo, la substitution
# $(date ...) s'executait d'abord et remettait $? a 0 : ce log annonçait donc TOUJOURS exit=0,
# y compris la nuit du 05/08/2026 ou le backfill est mort en P1017 sans noter une seule entreprise.
code=$?
echo "=== $(date '+%Y-%m-%d %H:%M') END exit=$code ===" >> "$LOG"
# Propage le code : sans ca, launchd enregistre le succes du dernier echo, pas celui du backfill.
exit "$code"
