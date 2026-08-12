#!/usr/bin/env bash
set -euo pipefail
: "${DATA_DIR:?DATA_DIR fehlt}"
: "${ETS2_HOME:?ETS2_HOME fehlt}"
: "${ETS2_SERVER_DIR:?ETS2_SERVER_DIR fehlt}"
: "${GAME_APP_ID:=1948160}"; : "${GAME_LABEL:=Euro Truck Simulator 2}"; : "${INSTALL_LOG:=$DATA_DIR/install.log}"
log="$INSTALL_LOG"
exec > >(tee -a "$log") 2>&1
echo "[$(date -Is)] Prüfe SteamCMD …"
mkdir -p "$ETS2_SERVER_DIR" "$ETS2_HOME" "$DATA_DIR/steamcmd"
if ! command -v steamcmd >/dev/null 2>&1; then
  echo "SteamCMD nicht gefunden – portable Linux-Version wird geladen."
  archive="$DATA_DIR/steamcmd/steamcmd_linux.tar.gz"
  curl -fL --retry 3 -o "$archive" https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz
  tar -xzf "$archive" -C "$DATA_DIR/steamcmd"
  steam="$DATA_DIR/steamcmd/steamcmd.sh"
else
  steam="$(command -v steamcmd)"
fi
echo "[$(date -Is)] Installiere/aktualisiere $GAME_LABEL Dedicated Server (App $GAME_APP_ID) …"
"$steam" +force_install_dir "$ETS2_SERVER_DIR" +login anonymous +app_update "$GAME_APP_ID" validate +quit
steamclient="$(dirname "$steam")/linux64/steamclient.so"
if [[ -f "$steamclient" ]]; then
  mkdir -p "$DATA_DIR/.steam/sdk64"
  ln -sf "$steamclient" "$DATA_DIR/.steam/sdk64/steamclient.so"
fi
echo "[$(date -Is)] $GAME_LABEL Dedicated Server ist installiert."
