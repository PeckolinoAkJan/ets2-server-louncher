#!/usr/bin/env bash
set -euo pipefail
: "${DATA_DIR:?}"; : "${ETS2_HOME:?}"; : "${ETS2_SERVER_DIR:?}"
: "${GAME_BINARY:=eurotrucks2_server}"; : "${GAME_LABEL:=ETS2}"; : "${PID_FILE:=$DATA_DIR/ets2.pid}"
pidfile="$PID_FILE"
if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then echo "Server läuft bereits."; exit 0; fi
binary="$ETS2_SERVER_DIR/bin/linux_x64/$GAME_BINARY"
[[ -x "$binary" ]] || { echo "ETS2 ist noch nicht installiert." >&2; exit 1; }
[[ -s "$ETS2_HOME/server_packages.sii" && -s "$ETS2_HOME/server_packages.dat" ]] || { echo "server_packages.sii und server_packages.dat fehlen." >&2; exit 1; }
export XDG_DATA_HOME="$DATA_DIR"
export HOME="$DATA_DIR"
nohup "$binary" -nosingle -server_cfg "server_config.sii" > "$ETS2_HOME/process.log" 2>&1 &
pid=$!; echo "$pid" > "$pidfile"; sleep 2
kill -0 "$pid" 2>/dev/null || { rm -f "$pidfile"; tail -50 "$ETS2_HOME/process.log" >&2; exit 1; }
echo "$GAME_LABEL Server gestartet (PID $pid)."
