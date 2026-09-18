#!/usr/bin/env bash
# blipmap full verification: type-check → tests → production build
# Used by QA agent and CI. Exits non-zero on first failure.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "=== blipmap verification ==="

echo ""
echo "[1/3] Type check..."
npx tsc --noEmit --skipLibCheck

echo ""
echo "[2/3] Unit tests..."
npm test -- --run

echo ""
echo "[3/3] Production build..."
npm run build

echo ""
echo "=== All checks passed ==="
