#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKEND_DIR="$ROOT_DIR/pos-backend"
FRONTEND_DIR="$ROOT_DIR/pos-frontend"
ML_DIR="$ROOT_DIR/ml-logic"

BACKEND_PORT="${BACKEND_PORT:-5000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
ML_PORT="${ML_PORT:-7000}"

echo "== Smart Biometric POS: start_all =="
echo "Root: $ROOT_DIR"

echo
echo "1) Checking Docker…"
if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker is not running. Start Docker Desktop and re-run."
  exit 1
fi

echo
echo "2) Starting PostgreSQL (Docker) if not running…"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-biometric-pos-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-biometric_pos}"

if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}\$"; then
  if docker ps -a --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}\$"; then
    docker start "$POSTGRES_CONTAINER" >/dev/null
  else
    docker run -d \
      --name "$POSTGRES_CONTAINER" \
      -e POSTGRES_USER="$POSTGRES_USER" \
      -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
      -e POSTGRES_DB="$POSTGRES_DB" \
      -p 5432:5432 \
      -v biometric_pos_pgdata:/var/lib/postgresql/data \
      postgres:16 >/dev/null
  fi
fi

echo "Postgres container: $POSTGRES_CONTAINER"

echo
echo "3) Installing backend deps…"
pushd "$BACKEND_DIR" >/dev/null
npm install >/dev/null
popd >/dev/null

echo
echo "4) Installing frontend deps…"
pushd "$FRONTEND_DIR" >/dev/null
npm install >/dev/null
popd >/dev/null

echo
echo "5) Creating Python venv (ml-logic) if needed…"
pushd "$ML_DIR" >/dev/null
if [[ ! -d ".venv" ]]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r requirements.txt >/dev/null
deactivate
popd >/dev/null

echo
echo "6) Starting ML bridge (port $ML_PORT)…"
pushd "$ML_DIR" >/dev/null
source .venv/bin/activate
nohup env ML_PORT="$ML_PORT" POS_BACKEND_URL="http://localhost:${BACKEND_PORT}" \
  uvicorn palm_bridge:app --host 0.0.0.0 --port "$ML_PORT" \
  > "$ROOT_DIR/ml-bridge.log" 2>&1 &
deactivate
popd >/dev/null
echo "ML bridge logs: $ROOT_DIR/ml-bridge.log"

echo
echo "7) Starting backend (port $BACKEND_PORT)…"
pushd "$BACKEND_DIR" >/dev/null
nohup env PORT="$BACKEND_PORT" CHANNEL_NAME="mychannel" CHAINCODE_NAME="palmpos" \
  CORS_ORIGINS="http://localhost:${FRONTEND_PORT}" \
  node server.js > "$ROOT_DIR/backend.log" 2>&1 &
popd >/dev/null
echo "Backend logs: $ROOT_DIR/backend.log"

echo
echo "8) Starting frontend (port $FRONTEND_PORT)…"
pushd "$FRONTEND_DIR" >/dev/null
nohup env NEXT_PUBLIC_BACKEND_URL="http://localhost:${BACKEND_PORT}" NEXT_PUBLIC_ML_URL="http://localhost:${ML_PORT}" \
  npm run dev -- -p "$FRONTEND_PORT" > "$ROOT_DIR/frontend.log" 2>&1 &
popd >/dev/null
echo "Frontend logs: $ROOT_DIR/frontend.log"

echo
echo "All services started."
echo "- Frontend: http://localhost:${FRONTEND_PORT}"
echo "- Backend:  http://localhost:${BACKEND_PORT}"
echo "- ML:       http://localhost:${ML_PORT}/health"

