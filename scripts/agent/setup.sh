#!/usr/bin/env bash
# Install blipmap agent tooling prerequisites:
#   - verifies Python 3 (required for PreToolUse / PostToolUse hooks)
#   - installs npm dependencies
#   - installs Playwright Chromium (required for browser QA smoke test)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "=== blipmap agent setup ==="

# Python 3 — required by hook scripts
if command -v python3 &>/dev/null; then
  echo "✓ $(python3 --version)"
elif command -v python &>/dev/null && python --version 2>&1 | grep -q "Python 3"; then
  echo "✓ $(python --version)"
else
  echo ""
  echo "ERROR: Python 3 is required for agent lifecycle hooks."
  echo "Install: https://www.python.org/downloads/"
  exit 1
fi

# Node.js
if ! command -v node &>/dev/null; then
  echo ""
  echo "ERROR: Node.js is required. Install: https://nodejs.org/"
  exit 1
fi
echo "✓ Node $(node --version)"

# npm install (skip if node_modules already present and up-to-date)
if [ -f "package.json" ]; then
  echo ""
  echo "Installing npm dependencies..."
  npm install
fi

# Playwright Chromium — required by browser-qa smoke test
echo ""
echo "Installing Playwright Chromium..."
npx playwright install chromium --with-deps

echo ""
echo "=== Setup complete. Agent tooling is ready. ==="
