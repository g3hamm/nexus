#!/usr/bin/env bash
#
# Runs the repository integration tests against a throwaway Postgres.
#
#   ./scripts/test-db.sh
#
# Uses Docker if it is available, otherwise a local PostgreSQL install. The
# database is created fresh and thrown away, so it never touches anything you
# care about.
set -euo pipefail

PORT="${TEST_DB_PORT:-55432}"
NAME="nexus-test-db"

cleanup() {
  if [ "${STARTED_DOCKER:-0}" = "1" ]; then
    docker rm -f "$NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "Starting Postgres in Docker on port $PORT…"
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  # pgvector's image, because the schema declares a vector column.
  docker run -d --name "$NAME" \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=nexus_test \
    -p "$PORT:5432" \
    pgvector/pgvector:pg16 >/dev/null
  STARTED_DOCKER=1

  printf "Waiting for it to accept connections"
  for _ in $(seq 1 30); do
    if docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
    printf "."
    sleep 1
  done
  echo

  export TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:$PORT/nexus_test"
else
  echo "Docker not available — using a local PostgreSQL."
  echo "Needs pgvector installed (e.g. apt install postgresql-16-pgvector)."
  : "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a database you do not mind losing}"
fi

echo "Running repository integration tests…"
pnpm --filter @nexus/db test
