#!/usr/bin/env bash
#
# Daily data refresh, run by the option_harvester-ingest systemd timer.
# 1. Snapshot: price / IV / market cap / volume / weekly-expiry coverage.
# 2. History:  rolling daily OHLCV window + recomputed trend (down/up/sideways).
# 3. Predict:  Δ0.30 CC model -> option_harvest_cc_scores (web "Edge" column) +
#              frozen predictions/cc-<date>.jsonl for forward validation.
# 4. OH snap:  per-ticker screen inputs + list membership, for the /wl-log change log.
# 5. Risk snap: one recorded /risk analysis (position half; strategy half only if the
#              closed record moved), so /risk can diff itself over time.
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
# Prediction needs fresh trend + prices, so it runs after history.
npm run predict >>"$LOG" 2>&1
pred=$?
# OH-watchlist screen snapshot for the change log — after everything, so it captures
# the fresh screen (nc/held/positions/greeks + NC criteria) for day-over-day diffs.
npm run snapshot:oh >>"$LOG" 2>&1
snapoh=$?
# One recorded /risk analysis per day, so the page has a history to diff against. It is
# idempotent by fingerprint (src/lib/risksnap.ts), so this writes nothing when the book and
# the balances have not moved since the last run — the operator can also take one by hand
# after a Sync (`npm run snapshot:risk`) and get a real row rather than a duplicate.
npm run snapshot:risk -- --daily >>"$LOG" 2>&1
snaprisk=$?

echo "[$(stamp)] done (snapshot exit=$snap, history exit=$hist, predict exit=$pred, oh-snapshot exit=$snapoh, risk-snapshot exit=$snaprisk)" >>"$LOG"
# Non-zero if any step failed, so systemd marks the run failed.
[ "$snap" -eq 0 ] && [ "$hist" -eq 0 ] && [ "$pred" -eq 0 ] && [ "$snapoh" -eq 0 ] && [ "$snaprisk" -eq 0 ]
