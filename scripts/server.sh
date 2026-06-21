#!/usr/bin/env bash
#
# Lifecycle manager for the Option Harvester Next.js servers.
# Both servers listen on 0.0.0.0 (reachable on the LAN).
#
#   prod -> port 19210, database option_harvester      (npm run start)
#   test -> port 19211, database option_harvester_test (npm run start:test)
#
# Usage:
#   scripts/server.sh start   [prod|test|all]   # default: prod
#   scripts/server.sh stop    [prod|test|all]
#   scripts/server.sh restart [prod|test|all]
#   scripts/server.sh status  [prod|test|all]
#
# Notes:
#   - `start` requires a production build (.next). It runs `npm run build`
#     automatically if .next is missing; pass `build` to force a rebuild.
#   - PIDs and logs live under ./log (git-ignored).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
LOG_DIR="$ROOT/log"
mkdir -p "$LOG_DIR"

# env -> "port npm-script"
prod_port=19210; prod_script="start"
test_port=19211; test_script="start:test"

pidfile() { echo "$LOG_DIR/$1.pid"; }
logfile() { echo "$LOG_DIR/$1.log"; }
port_of() { [ "$1" = prod ] && echo "$prod_port" || echo "$test_port"; }
script_of() { [ "$1" = prod ] && echo "$prod_script" || echo "$test_script"; }

is_running() {
  local env="$1" pf; pf="$(pidfile "$env")"
  [ -f "$pf" ] || return 1
  local pid; pid="$(cat "$pf")"
  # The recorded pid is a session/group leader; check the group still has procs.
  kill -0 "$pid" 2>/dev/null
}

ensure_build() {
  if [ ! -d "$ROOT/.next" ]; then
    echo "→ no .next build found; running production build..."
    npm run build
  fi
}

start_one() {
  local env="$1" port script pf log pid
  port="$(port_of "$env")"; script="$(script_of "$env")"
  pf="$(pidfile "$env")"; log="$(logfile "$env")"

  if is_running "$env"; then
    echo "✓ $env already running (pid $(cat "$pf"), port $port)"; return 0
  fi
  ensure_build

  # setsid starts a new session so the whole npm→next process tree shares a
  # group id == the leader pid, letting us stop it cleanly later.
  setsid npm run "$script" >>"$log" 2>&1 </dev/null &
  pid=$!
  echo "$pid" >"$pf"
  echo "→ starting $env on 0.0.0.0:$port (pid $pid), logging to $log"

  # Wait for the port to accept connections (up to ~30s).
  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null --max-time 1 "http://127.0.0.1:$port/" 2>/dev/null; then
      echo "✓ $env up: http://0.0.0.0:$port  (LAN: http://$(hostname -I | awk '{print $1}'):$port)"
      return 0
    fi
    kill -0 "$pid" 2>/dev/null || { echo "✗ $env exited early — see $log"; tail -n 15 "$log"; return 1; }
    sleep 0.5
  done
  echo "✗ $env did not become ready in time — see $log"; return 1
}

stop_one() {
  local env="$1" port pf pid
  port="$(port_of "$env")"; pf="$(pidfile "$env")"
  local stopped=0
  if [ -f "$pf" ]; then
    pid="$(cat "$pf")"
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
      stopped=1
    fi
    rm -f "$pf"
  fi
  # Fallback: kill anything still bound to the port (orphaned listeners).
  local listeners; listeners="$(_pids_on_port "$port")"
  if [ -n "$listeners" ]; then
    local p
    for p in $listeners; do
      # Kill the whole process group so the npm/node parent goes too.
      local pgid; pgid="$(ps -o pgid= -p "$p" 2>/dev/null | tr -d ' ')"
      [ -n "$pgid" ] && kill -TERM -- "-$pgid" 2>/dev/null || true
      kill -TERM "$p" 2>/dev/null || true
    done
    stopped=1
  fi
  if [ "$stopped" = 1 ]; then echo "✓ stopped $env (port $port)"; else echo "· $env not running"; fi
}

# List PIDs listening on a TCP port. ss is primary because under WSL2 lsof
# frequently cannot see sockets; fuser/lsof are fallbacks for non-WSL hosts.
_pids_on_port() {
  local port="$1" pids=""
  if command -v ss >/dev/null 2>&1; then
    pids="$(ss -ltnpH "( sport = :$port )" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)"
  fi
  if [ -z "$pids" ] && command -v fuser >/dev/null 2>&1; then
    pids="$(fuser "$port/tcp" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$')"
  fi
  if [ -z "$pids" ] && command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null)"
  fi
  echo "$pids"
}

status_one() {
  local env="$1" port; port="$(port_of "$env")"
  if curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:$port/" 2>/dev/null; then
    echo "✓ $env: UP   (http://0.0.0.0:$port)"
  elif is_running "$env"; then
    echo "… $env: starting/unhealthy (pid $(cat "$(pidfile "$env")"), port $port)"
  else
    echo "· $env: DOWN (port $port)"
  fi
}

action="${1:-}"; target="${2:-prod}"
case "$target" in
  prod|test) envs=("$target") ;;
  all)       envs=(prod test) ;;
  *) echo "unknown target: $target (use prod|test|all)"; exit 1 ;;
esac

case "$action" in
  start)   for e in "${envs[@]}"; do start_one "$e"; done ;;
  stop)    for e in "${envs[@]}"; do stop_one  "$e"; done ;;
  restart) for e in "${envs[@]}"; do stop_one "$e"; done; sleep 1; for e in "${envs[@]}"; do start_one "$e"; done ;;
  status)  for e in "${envs[@]}"; do status_one "$e"; done ;;
  build)   npm run build ;;
  *) echo "Usage: scripts/server.sh {start|stop|restart|status|build} [prod|test|all]"; exit 1 ;;
esac
