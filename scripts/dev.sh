#!/usr/bin/env bash
# Start/stop/check the whole stack locally: Postgres (port 5433), backend (8080),
# AI service (8000), frontend (5173).
#   ./scripts/dev.sh start | stop | status | restart-backend
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/.devdb-run"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@16/bin}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export LC_ALL=C
export DB_HOST=127.0.0.1 DB_PORT=5433 DB_NAME=college_db DB_USER=college_app
export OTP_LOG_CODES=true
export AI_SERVICE_URL="${AI_SERVICE_URL:-http://localhost:8000}"

mkdir -p "$RUN"

# Local secrets are generated once and kept in .devdb-run/dev.env (git-ignored); nothing sensitive is stored in the repo.
ENV_FILE="$RUN/dev.env"
if [ ! -f "$ENV_FILE" ]; then
  {
    echo "DB_PASSWORD=$(openssl rand -hex 16)"
    echo "JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')"
    echo "BOOTSTRAP_ADMIN_EMAIL=admin@college.edu"
    echo "BOOTSTRAP_ADMIN_PASSWORD=$(openssl rand -hex 6)Aa1!"
    echo "DEMO_PASSWORD=$(openssl rand -hex 6)Dd1!"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi
set -a; . "$ENV_FILE"; set +a

start_db() {
  if [ ! -d "$ROOT/.devdb" ]; then
    "$PGBIN/initdb" -D "$ROOT/.devdb" -U "$(whoami)" --auth=trust -E UTF8 >"$RUN/initdb.log" 2>&1 || { echo "initdb failed"; exit 1; }
  fi
  if ! "$PGBIN/pg_isready" -q -h 127.0.0.1 -p 5433; then
    "$PGBIN/pg_ctl" -D "$ROOT/.devdb" -l "$RUN/postgres.log" -o "-p 5433 -k $RUN" start >/dev/null
  fi
  "$PGBIN/psql" -h 127.0.0.1 -p 5433 -U "$(whoami)" -d postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='college_app'" | grep -q 1 \
    || "$PGBIN/psql" -h 127.0.0.1 -p 5433 -U "$(whoami)" -d postgres -c "CREATE ROLE college_app LOGIN" >/dev/null
  "$PGBIN/psql" -h 127.0.0.1 -p 5433 -U "$(whoami)" -d postgres -c "ALTER ROLE college_app PASSWORD '$DB_PASSWORD'" >/dev/null
  "$PGBIN/psql" -h 127.0.0.1 -p 5433 -U "$(whoami)" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='college_db'" | grep -q 1 \
    || "$PGBIN/createdb" -h 127.0.0.1 -p 5433 -U "$(whoami)" -O college_app college_db
  echo "postgres: up on 5433"
  echo "admin login: $BOOTSTRAP_ADMIN_EMAIL / $BOOTSTRAP_ADMIN_PASSWORD  (kept in $ENV_FILE)"
}

start_backend() {
  pkill -f "com.cms.backend.BackendApplication" 2>/dev/null
  (cd "$ROOT/backend" && nohup mvn -q spring-boot:run >"$RUN/backend.log" 2>&1 </dev/null & echo $! >"$RUN/backend.pid")
  echo "backend: starting (log: $RUN/backend.log)"
}

start_ai() {
  if [ ! -d "$ROOT/ai-service/.venv" ]; then
    python3 -m venv "$ROOT/ai-service/.venv"
    "$ROOT/ai-service/.venv/bin/pip" install -q -r "$ROOT/ai-service/requirements.txt"
  fi
  pkill -f "uvicorn main:app" 2>/dev/null
  (cd "$ROOT/ai-service" && nohup .venv/bin/uvicorn main:app --port 8000 >"$RUN/ai.log" 2>&1 </dev/null & echo $! >"$RUN/ai.pid")
  echo "ai-service: starting on 8000"
}

start_frontend() {
  [ -d "$ROOT/frontend/node_modules" ] || (cd "$ROOT/frontend" && npm install >/dev/null 2>&1)
  pkill -f "vite" 2>/dev/null
  (cd "$ROOT/frontend" && nohup npm run dev >"$RUN/frontend.log" 2>&1 </dev/null & echo $! >"$RUN/frontend.pid")
  echo "frontend: starting on 5173"
}

wait_for() { # url name
  for _ in $(seq 1 60); do
    curl -s -o /dev/null "$1" && { echo "$2: ready"; return 0; }
    sleep 1
  done
  echo "$2: NOT ready (see logs in $RUN)"; return 1
}

status() {
  for pair in "backend|http://localhost:8080/api/courses" "ai-service|http://localhost:8000/health" "frontend|http://localhost:5173"; do
    name="${pair%%|*}"; url="${pair##*|}"
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url"); echo "$name: HTTP $code"
  done
  "$PGBIN/pg_isready" -h 127.0.0.1 -p 5433
}

case "${1:-start}" in
  start) start_db; start_ai; start_backend; start_frontend
         wait_for http://localhost:8080/api/courses backend; wait_for http://localhost:8000/health ai-service; wait_for http://localhost:5173 frontend ;;
  restart-backend) start_backend; wait_for http://localhost:8080/api/courses backend ;;
  stop) pkill -f "com.cms.backend.BackendApplication"; pkill -f "uvicorn main:app"; pkill -f "vite"
        "$PGBIN/pg_ctl" -D "$ROOT/.devdb" stop >/dev/null 2>&1; echo stopped ;;
  status) status ;;
  reset-db) # wipes ALL data in the local dev database and re-runs migrations (admin login is re-created)
        pkill -f "com.cms.backend.BackendApplication"; sleep 1
        "$PGBIN/psql" -h 127.0.0.1 -p 5433 -U "$(whoami)" -d postgres -c "DROP DATABASE IF EXISTS college_db WITH (FORCE)" >/dev/null
        "$PGBIN/createdb" -h 127.0.0.1 -p 5433 -U "$(whoami)" -O college_app college_db
        rm -rf "$ROOT/backend/uploads"
        start_backend; wait_for http://localhost:8080/api/courses backend ;;
  *) echo "usage: $0 start|stop|status|restart-backend|reset-db" ;;
esac
