#!/usr/bin/env bash
# Horodatage OpenTimestamps du registre forward — preuve d'ANTÉRIORITÉ ancrée dans Bitcoin
# (impossible à antidater, vérifiable par n'importe qui, indépendamment de git).
#
# À relancer (`stamp`) À CHAQUE modification de ledger.json (le hash change), puis committer
# le nouveau ledger.json.ots. La preuve est immédiate ; l'ancrage Bitcoin se récupère qq heures
# plus tard via `upgrade`. Pour prouver un état passé : checkout le commit, puis `verify`.
#
#   ./stamp.sh stamp     # crée/rafraîchit ledger.json.ots (à committer)
#   ./stamp.sh upgrade   # récupère l'ancrage Bitcoin une fois confirmé (qq heures après)
#   ./stamp.sh verify    # vérifie la preuve (affiche le bloc/date Bitcoin)
set -euo pipefail
OTS="${OTS:-$HOME/.ots-venv/bin/ots}"
DIR="$(cd "$(dirname "$0")" && pwd)"
LEDGER="$DIR/ledger.json"
case "${1:-stamp}" in
  stamp)   "$OTS" stamp "$LEDGER" ;;
  upgrade) "$OTS" upgrade "$LEDGER.ots" ;;
  verify)  "$OTS" verify "$LEDGER.ots" ;;
  *)       echo "usage: $0 stamp|upgrade|verify" >&2; exit 1 ;;
esac
