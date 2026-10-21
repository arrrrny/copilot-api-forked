#!/bin/bash
# Keep the launchd service logs bounded.
#
# launchd's StandardOutPath/StandardErrorPath append forever and have no
# rotation of their own. This truncates a log in place once it exceeds the
# cap. In-place truncation (rather than mv + recreate) keeps launchd's
# append-mode file descriptor pointing at the same inode, so the service keeps
# logging to the file it was started with.
set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAX_BYTES="${MAX_BYTES:-1048576}"

for name in stdout.log stderr.log; do
  file="$APP_DIR/$name"
  [ -f "$file" ] || continue

  size=$(wc -c < "$file" | tr -d ' ')
  if [ "$size" -gt "$MAX_BYTES" ]; then
    : > "$file"
    echo "[rotate-logs] truncated $name ($size bytes > $MAX_BYTES)"
  fi
done
