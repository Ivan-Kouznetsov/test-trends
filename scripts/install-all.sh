#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODULES=(
  "chaos-server"
  "demo-tests"
  "analysis-cli"
  "dashboard"
  "data-generator"
)

for module in "${MODULES[@]}"; do
  echo "Installing dependencies in ${module}..."
  (
    cd "${ROOT_DIR}/${module}"
    npm install
  )
done

echo "All module dependencies installed."
