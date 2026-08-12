#!/usr/bin/env bash
set -euo pipefail
: "${DATA_DIR:?}"
: "${GAME_LABEL:=ETS2}"; : "${PID_FILE:=$DATA_DIR/ets2.pid}"
pidfile="$PID_FILE"
[[ -f "$pidfile" ]] || { echo "Server ist bereits gestoppt."; exit 0; }
pid="$(cat "$pidfile")"
if kill -0 "$pid" 2>/dev/null; then
  kill -TERM "$pid"
  for _ in {1..20}; do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
  if kill -0 "$pid" 2>/dev/null; then kill -KILL "$pid"; fi
fi
rm -f "$pidfile"
echo "$GAME_LABEL Server gestoppt."
