#!/usr/bin/env bash
#
# Intraday ATM option-spread refresh, run by the option_harvester-spreads timer
# during US market hours (Yahoo only returns live bid/ask while the US market is
# open). Logs to log/spreads.log. Safe to run manually:  scripts/spreads.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p log
LOG="$ROOT/log/spreads.log"

# Make npm/node available under systemd's minimal environment.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
fi

stamp() { date '+%Y-%m-%d %H:%M:%S %Z'; }
echo "[$(stamp)] spread refresh started" >>"$LOG"
npm run ingest:spreads >>"$LOG" 2>&1
code=$?
echo "[$(stamp)] done (exit=$code)" >>"$LOG"
exit "$code"
