#!/bin/bash
# launchd entrypoint for com.copilot-api-forked.
# Ensures dependencies and build output exist before starting the server, so
# the agent self-heals after a `git clean`, branch switch, or fresh clone.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/arrrrny/.bun/bin"
export NODE_ENV=production
export NODE_USE_SYSTEM_CA=1

if [ ! -d node_modules/hono ]; then
  echo "[ensure-running] node_modules missing - installing dependencies..."
  bun install
fi

if [ ! -f dist/main.js ]; then
  echo "[ensure-running] dist/main.js missing - building..."
  bun run build
fi

exec bun run dist/main.js start
