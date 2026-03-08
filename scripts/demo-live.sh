#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHAOS_PORT="${CHAOS_PORT:-3000}"
REQUEST_TIMEOUT_MS="${REQUEST_TIMEOUT_MS:-2000}"
RUN_ID="${RUN_ID:-live-run-$(date -u +"%Y-%m-%d-%H%M%S")}"
CAPTURE_DIR="${CAPTURE_DIR:-${ROOT_DIR}/data}"
SUMMARY_OUT="${SUMMARY_OUT:-${ROOT_DIR}/dashboard/src/data/summary.json}"
MAX_TEST_ATTEMPTS="${MAX_TEST_ATTEMPTS:-3}"
STRICT_TEST_EXIT="${STRICT_TEST_EXIT:-0}"

CHAOS_PID=""

cleanup() {
  if [[ -n "${CHAOS_PID}" ]]; then
    kill "${CHAOS_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

mkdir -p "${CAPTURE_DIR}"
mkdir -p "$(dirname "${SUMMARY_OUT}")"

(
  cd "${ROOT_DIR}/chaos-server"
  PORT="${CHAOS_PORT}" npm start > /tmp/test-trends-chaos.log 2>&1
) &
CHAOS_PID=$!

for _ in {1..40}; do
  if curl --silent --fail \
    --request POST \
    --header "Content-Type: application/json" \
    --data '{"ready":true}' \
    "http://localhost:${CHAOS_PORT}/static/mirror" >/dev/null; then
    break
  fi
  sleep 0.25
done

if ! curl --silent --fail \
  --request POST \
  --header "Content-Type: application/json" \
  --data '{"ready":true}' \
  "http://localhost:${CHAOS_PORT}/static/mirror" >/dev/null; then
  echo "Chaos server did not become ready on port ${CHAOS_PORT}." >&2
  exit 1
fi

attempt=1
tests_passed=0
last_test_exit=0

while [[ "${attempt}" -le "${MAX_TEST_ATTEMPTS}" ]]; do
  echo "Running demo-tests (attempt ${attempt}/${MAX_TEST_ATTEMPTS})..."
  if (
    cd "${ROOT_DIR}/demo-tests"
    CHAOS_SERVER_URL="http://localhost:${CHAOS_PORT}" \
    RUN_ID="${RUN_ID}" \
    REQUEST_TIMEOUT_MS="${REQUEST_TIMEOUT_MS}" \
    CAPTURE_DIR="${CAPTURE_DIR}" \
    npm test
  ); then
    tests_passed=1
    break
  fi

  last_test_exit=$?

  attempt=$((attempt + 1))
done

cd "${ROOT_DIR}"
node analysis-cli/cli.js --path "${CAPTURE_DIR}" --format json --out "${SUMMARY_OUT}"

echo "Run complete."
echo "- Run ID: ${RUN_ID}"
echo "- Captured data: ${CAPTURE_DIR}/${RUN_ID}"
echo "- Dashboard summary: ${SUMMARY_OUT}"

if [[ "${tests_passed}" -ne 1 ]]; then
  echo "Warning: demo-tests did not fully pass after ${MAX_TEST_ATTEMPTS} attempts (expected with flaky cases)." >&2
  if [[ "${STRICT_TEST_EXIT}" == "1" ]]; then
    exit "${last_test_exit}"
  fi
fi
