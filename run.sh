#!/usr/bin/env bash
# TripMate in one command.
#   ./run.sh          set up (first time only) and start the API + website
#   ./run.sh setup    install everything, don't start
#   ./run.sh test     install, then run backend tests and a website build
# Works on macOS, Linux and Windows (Git Bash / WSL). Ctrl+C stops everything.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="$ROOT/.run"            # logs + install stamps (git-ignored)
MODE="${1:-start}"
mkdir -p "$STATE"

say()  { printf '\033[1m▸ %s\033[0m\n' "$*"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# --- Prerequisites ----------------------------------------------------------
PY=""
for c in python3.12 python3 python; do
  if command -v "$c" >/dev/null && "$c" -c 'import sys; sys.exit(sys.version_info < (3, 11))' 2>/dev/null; then PY="$c"; break; fi
done
[ -n "$PY" ] || fail "Python 3.11+ not found — install it from https://www.python.org/downloads/"
command -v node >/dev/null || fail "Node.js not found — install the LTS from https://nodejs.org/"
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || fail "Node.js 20+ needed (found $(node -v))"
command -v npm >/dev/null || fail "npm not found — reinstall Node.js"

# Reinstall only when the dependency file changed since the last install.
changed() { ! cmp -s <(cksum < "$1") "$STATE/$2.stamp" 2>/dev/null; }
stamp()   { cksum < "$1" > "$STATE/$2.stamp"; }

# --- Backend ----------------------------------------------------------------
cd "$ROOT/backend"
[ -d .venv ] || { say "Creating Python environment"; "$PY" -m venv .venv; }
BIN=".venv/bin"; [ -d "$BIN" ] || BIN=".venv/Scripts"           # Windows layout
VPY="$BIN/python"
if changed requirements-dev.txt backend || changed requirements.txt backend-base; then
  say "Installing backend packages"
  "$VPY" -m pip install -q --upgrade pip
  "$VPY" -m pip install -q -r requirements-dev.txt || fail "pip install failed — see the error above"
  stamp requirements-dev.txt backend; stamp requirements.txt backend-base
fi
[ -f .env ] || { say "Creating backend/.env from .env.example"; cp .env.example .env; }

# --- Frontend ---------------------------------------------------------------
cd "$ROOT/frontend"
if [ ! -d node_modules ] || changed package-lock.json frontend; then
  say "Installing website packages"
  npm ci --no-audit --no-fund || { say "npm ci failed — falling back to npm install"; npm install --no-audit --no-fund; }
  stamp package-lock.json frontend
fi

case "$MODE" in
  setup) say "Setup complete. Start with: ./run.sh"; exit 0 ;;
  test)
    say "Backend tests"; (cd "$ROOT/backend" && "$VPY" -m pytest -q)
    say "Website build"; npm run build --silent && rm -rf dist
    say "All checks passed"; exit 0 ;;
  start) ;;
  *) fail "Unknown command '$MODE' — use: ./run.sh [start|setup|test]" ;;
esac

# --- Start both, on free ports ----------------------------------------------
free_port() {  # first free port from $1 upwards
  "$ROOT/backend/$VPY" - "$1" <<'EOF'
import socket, sys
p = int(sys.argv[1])
while True:
    with socket.socket() as s:
        if s.connect_ex(("127.0.0.1", p)): print(p); break
    p += 1
EOF
}
API_PORT="$(free_port 8000)"; WEB_PORT="$(free_port 5173)"

PIDS=()
cleanup() {
  trap - EXIT
  say "Stopping"
  kill ${PIDS[@]+"${PIDS[@]}"} 2>/dev/null || true   # bash 3.2-safe on an empty array
  wait 2>/dev/null || true
}
trap cleanup EXIT                 # every way out stops both servers…
trap 'exit 130' INT TERM HUP      # …including Ctrl+C, kill, or closing the terminal

say "Starting API on :$API_PORT (log: .run/api.log)"
(cd "$ROOT/backend" && exec "$VPY" -m uvicorn app.main:app --reload --port "$API_PORT") > "$STATE/api.log" 2>&1 &
PIDS+=($!)

# Wait for /health (up to 30 s); show the log if it never comes up.
healthy() { "$ROOT/backend/$VPY" -c "import urllib.request as u; u.urlopen('http://127.0.0.1:$API_PORT/health', timeout=1)" 2>/dev/null; }
tries=0
until healthy; do
  # With --reload the watcher survives an import error, so also look for a traceback in the log.
  if ! kill -0 "${PIDS[0]}" 2>/dev/null || grep -q "Traceback" "$STATE/api.log"; then
    tail -n 15 "$STATE/api.log"; fail "API failed to start — error above (full log: .run/api.log)"
  fi
  tries=$((tries + 1)); [ "$tries" -lt 60 ] || { tail -n 20 "$STATE/api.log"; fail "API didn't answer on :$API_PORT within 30 s"; }
  sleep 0.5
done

say "Starting website on :$WEB_PORT"
VITE_API_URL="http://localhost:$API_PORT" node_modules/.bin/vite --port "$WEB_PORT" --strictPort &
PIDS+=($!)

say "TripMate is running → http://localhost:$WEB_PORT   (API docs: http://localhost:$API_PORT/docs)   Ctrl+C to stop"
# Keep running until either process stops, then the EXIT trap stops the other.
while kill -0 "${PIDS[0]}" 2>/dev/null && kill -0 "${PIDS[1]}" 2>/dev/null; do sleep 1; done
say "A server stopped — see .run/api.log or the output above"
