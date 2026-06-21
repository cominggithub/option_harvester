#!/usr/bin/env bash
#
# Daily data refresh, run by the option_harvester-ingest systemd timer.
# 1. Snapshot: price / IV / market cap / volume / weekly-expiry coverage.
# 2. History:  rolling daily OHLCV window + recomputed trend (down/up/sideways).
#
# Logs to log/daily.log. Safe to run manually:  scripts/daily.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p log
LOG="$ROOT/log/daily.log"

# Make npm/node available under systemd's minimal environment.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
fi

stamp() { date '+%Y-%m-%d %H:%M:%S %Z'; }
echo "[$(stamp)] daily refresh started" >>"$LOG"

npm run ingest >>"$LOG" 2>&1
snap=$?
npm run ingest:history >>"$LOG" 2>&1
hist=$?

echo "[$(stamp)] done (snapshot exit=$snap, history exit=$hist)" >>"$LOG"
# Non-zero if either step failed, so systemd marks the run failed.
[ "$snap" -eq 0 ] && [ "$hist" -eq 0 ]
