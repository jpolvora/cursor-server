#!/usr/bin/env bash
# cursor-server local verification gate for ship-pr (typecheck + build).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

echo "==> npm run typecheck"
npm run typecheck

echo "==> npm run build"
npm run build

echo "==> verify OK"
