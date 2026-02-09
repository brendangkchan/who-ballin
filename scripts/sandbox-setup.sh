#!/usr/bin/env bash
set -euo pipefail

echo "[sandbox] Node version: $(node -v 2>/dev/null || echo 'not found')"
echo "[sandbox] npm version: $(npm -v 2>/dev/null || echo 'not found')"

EXPECTED_NODE="v22.21.1"
EXPECTED_NPM="10.9.4"

if command -v node >/dev/null 2>&1; then
  if [ "$(node -v)" != "$EXPECTED_NODE" ]; then
    echo "[sandbox] WARN: expected node ${EXPECTED_NODE} (see .node-version)"
  fi
fi

if command -v npm >/dev/null 2>&1; then
  if [ "$(npm -v)" != "$EXPECTED_NPM" ]; then
    echo "[sandbox] WARN: expected npm ${EXPECTED_NPM} (see package.json engines)"
  fi
fi

echo "[sandbox] Note: Codex sandbox may not allow network access for npm install."
