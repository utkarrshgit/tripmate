#!/usr/bin/env bash
# TripMate in one command.
#   ./run.sh              set up (first time only), ask real models or mock data, and start
#   ./run.sh --real       start with the local AI models (Ollama)
#   ./run.sh --mock       start with mock data: rules and the catalog, no AI needed
#   ./run.sh setup        install everything, don't start
#   ./run.sh test         install, then run backend tests and a website build
#   ./run.sh stop         stop anything a previous run left behind, and unload the models
# Works on macOS, Linux and Windows (Git Bash / WSL). Ctrl+C stops everything it started and
# frees the memory the models were using. Nothing is ever downloaded without asking.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="$ROOT/.run"            # logs + install stamps (git-ignored)
MODE="start"; DATA="${TRIPMATE_MODE:-}"
for arg in "$@"; do
  case "$arg" in
    --real|real) DATA="real" ;;
    --mock|mock) DATA="mock" ;;
    setup|test|stop|start) MODE="$arg" ;;
    *) printf 'Unknown option %s (use --real, --mock, setup, test or stop)\n' "$arg" >&2; exit 1 ;;
  esac
done
mkdir -p "$STATE"
OLLAMA_URL="http://127.0.0.1:11434"
MODELS="gemma4:e2b-mlx tev1:0.8b qwen3-embedding:0.6b"

say()  { printf '\033[1m▸ %s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
ask()  {  # ask "question" → 0 for yes; anything else (or no terminal) is no
  [ -t 0 ] || return 1
  local reply; printf '\033[1m? %s [y/N] \033[0m' "$1"; read -r reply || return 1
  case "$reply" in [yY]|[yY][eE][sS]) return 0 ;; *) return 1 ;; esac
}

# --- Stopping: every process this script starts, and the models' memory ------
# Kills a process and its children (uvicorn --reload runs a worker under a watcher).
kill_tree() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child"; done
  kill "$pid" 2>/dev/null || true
}
ollama_up() { curl -fsS -m 2 "$OLLAMA_URL/api/version" >/dev/null 2>&1; }
# Asks Ollama to drop the models from memory now (keep_alive 0) instead of in 30 minutes.
unload_models() {
  ollama_up || return 0
  local m
  for m in $MODELS; do
    curl -fsS -m 10 "$OLLAMA_URL/api/generate" -d "{\"model\":\"$m\",\"keep_alive\":0}" >/dev/null 2>&1 \
      || curl -fsS -m 10 "$OLLAMA_URL/api/embed" -d "{\"model\":\"$m\",\"input\":\"\",\"keep_alive\":0}" >/dev/null 2>&1 || true
  done
}
stop_all() {  # everything listed in .run/pids (this run's, or a previous run's)
  local pid
  if [ -f "$STATE/pids" ]; then
    while read -r pid; do [ -n "$pid" ] && kill_tree "$pid"; done < "$STATE/pids"
    rm -f "$STATE/pids"
  fi
  unload_models
  if [ -f "$STATE/ollama.pid" ]; then  # Ollama, only if this script started it
    kill_tree "$(cat "$STATE/ollama.pid")"; rm -f "$STATE/ollama.pid"
  fi
}
if [ "$MODE" = "stop" ]; then
  say "Stopping TripMate"; stop_all; say "Stopped, and the models are unloaded from memory"; exit 0
fi

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

# --- Database ---------------------------------------------------------------
# Creates the databases named in backend/.env if they're missing, applies migrations
# and loads the destination catalog. Returns 2 when PostgreSQL isn't available.
setup_db() {
  command -v pg_isready >/dev/null && command -v createdb >/dev/null || return 2
  pg_isready -q || return 2
  local names
  names="$("$VPY" -c 'from urllib.parse import urlparse; from app.core.config import settings as s; print(*(urlparse(u).path.lstrip("/") for u in (s.database_url, s.test_database_url)))')" || return 1
  for db in $names; do
    psql -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$db'" | grep -q 1 || createdb "$db" || return 1
  done
  "$VPY" -m alembic upgrade head && "$VPY" -m app.cli seed-catalog
}
db_status=0; setup_db > "$STATE/db.log" 2>&1 || db_status=$?
case "$db_status" in
  0) say "Database ready" ;;
  2) say "PostgreSQL isn't running, so accounts and saved trips won't work yet. Start it with: brew services start postgresql@18" ;;
  *) tail -n 15 "$STATE/db.log"; fail "Database setup failed — error above (full log: .run/db.log)" ;;
esac

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

# --- Real models or mock data ---------------------------------------------------
choose_mode() {
  if [ -z "$DATA" ]; then
    if [ -t 0 ]; then
      say "How should TripMate plan trips?"
      note "1) Real AI models: gemma4, tev1 and qwen3-embedding through Ollama, on this computer (about 9 GB of memory)"
      note "2) Mock data: rules and TripMate's guide, no AI needed. Fast and predictable, with prompts to try"
      local reply; printf '\033[1m? Choose 1 or 2 [2] \033[0m'; read -r reply || reply=2
      [ "$reply" = "1" ] && DATA="real" || DATA="mock"
    else
      DATA="mock"
    fi
  fi
}

# Makes sure Ollama runs and has the three models. Asks before any download; on no, mock mode.
prepare_real() {
  if ! command -v ollama >/dev/null; then
    say "Ollama isn't installed. It runs the AI models on this computer."
    if ask "Install Ollama now? (an app of about 200 MB; the models are a separate step)"; then
      if command -v brew >/dev/null; then
        brew install ollama || { say "Ollama didn't install — using mock data instead"; return 1; }
      else
        note "Download it from https://ollama.com/download, then run ./run.sh --real again."
        command -v open >/dev/null && open "https://ollama.com/download" 2>/dev/null || true
        return 1
      fi
    else
      return 1
    fi
  fi
  if ! ollama_up; then
    say "Starting Ollama (log: .run/ollama.log)"
    ollama serve > "$STATE/ollama.log" 2>&1 &
    echo $! > "$STATE/ollama.pid"
    local tries=0
    until ollama_up; do tries=$((tries + 1)); [ "$tries" -lt 30 ] || { say "Ollama didn't start — using mock data instead"; return 1; }; sleep 0.5; done
  fi
  local installed missing="" m
  installed="$(curl -fsS -m 5 "$OLLAMA_URL/api/tags" 2>/dev/null)"
  for m in $MODELS; do printf '%s' "$installed" | grep -q "\"$m\"" || missing="$missing $m"; done
  if [ -n "$missing" ]; then
    say "These models aren't on this computer yet:$missing"
    note "gemma4:e2b-mlx is about 7.5 GB, tev1:0.8b 0.8 GB and qwen3-embedding:0.6b 0.6 GB."
    if ask "Download them now?"; then
      for m in $missing; do say "Downloading $m"; ollama pull "$m" || { say "$m didn't download — using mock data instead"; return 1; }; done
    else
      return 1
    fi
  fi
  # A gentle warning on small machines: the models need memory of their own.
  local mem_gb
  mem_gb="$("$ROOT/backend/$VPY" -c 'import os; print(os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") // 2**30)' 2>/dev/null || echo 0)"
  [ "$mem_gb" -gt 0 ] && [ "$mem_gb" -lt 16 ] && say "This computer has ${mem_gb} GB of memory; with the models loaded, other apps may slow down."
  return 0
}

choose_mode
if [ "$DATA" = "real" ] && ! prepare_real; then
  say "Running with mock data instead: plans use rules and the guide, and every feature still works."
  DATA="mock"
fi
AI_ENABLED=$([ "$DATA" = "real" ] && echo true || echo false)

# The demo account (only when the database is up): reset each start, so the demo is always the same.
if [ "$db_status" = "0" ]; then
  (cd "$ROOT/backend" && AI_ENABLED=false "$VPY" -m app.cli seed-demo) > "$STATE/demo.log" 2>&1 \
    && DEMO_READY=1 || { DEMO_READY=0; say "Couldn't make the demo account (see .run/demo.log)"; }
else
  DEMO_READY=0
fi

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

stop_all  # anything a previous run left behind
PIDS=()
cleanup() {
  trap - EXIT
  say "Stopping"
  stop_all
  wait 2>/dev/null || true
  say "Stopped everything this script started$([ "$DATA" = "real" ] && echo ", and unloaded the models from memory")"
}
trap cleanup EXIT                 # every way out stops both servers…
trap 'exit 130' INT TERM HUP      # …including Ctrl+C, kill, or closing the terminal

say "Starting API on :$API_PORT (log: .run/api.log)"
# The API accepts cookies only from the website's own address.
(cd "$ROOT/backend" && AI_ENABLED="$AI_ENABLED" CORS_ORIGINS="http://localhost:$WEB_PORT,http://127.0.0.1:$WEB_PORT" exec "$VPY" -m uvicorn app.main:app --reload --port "$API_PORT") > "$STATE/api.log" 2>&1 &
PIDS+=($!); echo $! >> "$STATE/pids"

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
VITE_API_URL="http://localhost:$API_PORT" node_modules/.bin/vite --port "$WEB_PORT" --strictPort > "$STATE/web.log" 2>&1 &
PIDS+=($!); echo $! >> "$STATE/pids"
tries=0; until curl -fsS -m 1 "http://127.0.0.1:$WEB_PORT" >/dev/null 2>&1; do tries=$((tries + 1)); [ "$tries" -lt 40 ] || break; sleep 0.5; done

echo
say "TripMate is running → http://localhost:$WEB_PORT   (API docs: http://localhost:$API_PORT/docs)"
if [ "$DATA" = "real" ]; then
  note "Mode: real AI models (gemma4:e2b-mlx, tev1:0.8b, qwen3-embedding:0.6b). A plan takes about 10–25 seconds; repeats are instant."
else
  note "Mode: mock data. Plans use rules and TripMate's guide: instant and predictable. Run ./run.sh --real for the AI models."
fi
if [ "$DEMO_READY" = "1" ]; then
  (cd "$ROOT/backend" && "$VPY" -m app.cli demo-account)
fi
echo
say "Try these on the Plan a trip page:"
(cd "$ROOT/backend" && "$VPY" -m app.cli demo-prompts $([ "$DATA" = "real" ] && echo --real))
echo
note "Full walkthrough: DEMO.md · Ctrl+C stops everything and frees the memory"
# Keep running until either process stops, then the EXIT trap stops the other.
while kill -0 "${PIDS[0]}" 2>/dev/null && kill -0 "${PIDS[1]}" 2>/dev/null; do sleep 1; done
say "A server stopped — see .run/api.log or the output above"
