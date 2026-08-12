#!/usr/bin/env bash
set -euo pipefail
: "${DATA_DIR:?}"; : "${ETS2_HOME:?}"
dest="$DATA_DIR/backups"; mkdir -p "$dest"
: "${GAME_ID:=ets2}"
name="$GAME_ID-$(date -u +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$dest/$name" -C "$ETS2_HOME" .
retention=10
config="$DATA_DIR/panel-config.json"; [[ "$GAME_ID" == "ats" ]] && config="$DATA_DIR/ats-panel-config.json"
if [[ -f "$config" ]] && command -v node >/dev/null; then retention="$(node -p "try{require('$config').backup_retention||10}catch(e){10}")"; fi
find "$dest" -maxdepth 1 -type f -name "$GAME_ID-*.tar.gz" -printf '%T@ %p\n' | sort -rn | tail -n +$((retention+1)) | cut -d' ' -f2- | xargs -r rm -f
echo "$name"
