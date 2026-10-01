#!/bin/zsh
set -e

SCRIPT_DIR=${0:A:h}
cd "$SCRIPT_DIR"

PORT=8080
echo "Starting Epicyon at http://localhost:${PORT}"
echo "Keep this window open. Press Control-C to stop."

(sleep 1; open "http://localhost:${PORT}") &
exec python3 serve.py "$PORT"
