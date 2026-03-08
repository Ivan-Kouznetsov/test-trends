#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

FROM_DATE="${FROM_DATE:-2026-01-01}"
TO_DATE="${TO_DATE:-2026-01-31}"
RUNS_PER_DAY="${RUNS_PER_DAY:-4}"
PORT="${DASHBOARD_PORT:-5173}"
SUMMARY_OUT="${SUMMARY_OUT:-${ROOT_DIR}/dashboard/src/data/summary.json}"

cd "${ROOT_DIR}/data-generator"

npm run generate -- --from "${FROM_DATE}" --to "${TO_DATE}" --runs-per-day "${RUNS_PER_DAY}"

cd "${ROOT_DIR}"
node analysis-cli/cli.js --path ./data --format json --out "${SUMMARY_OUT}"

cd "${ROOT_DIR}/dashboard"

npm run dev -- --port "${PORT}" > /tmp/test-trends-dashboard.log 2>&1 &
DASHBOARD_PID=$!

cleanup() {
  kill "${DASHBOARD_PID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

until curl --silent --fail "http://localhost:${PORT}" >/dev/null; do
  sleep 0.5
done

open "http://localhost:${PORT}"

wait "${DASHBOARD_PID}"
