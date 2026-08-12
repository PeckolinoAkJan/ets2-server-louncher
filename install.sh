#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker fehlt. Installiere Docker zuerst über https://docs.docker.com/engine/install/" >&2
  exit 1
fi
docker compose version >/dev/null 2>&1 || { echo "Docker Compose Plugin fehlt." >&2; exit 1; }
docker compose build
docker compose up -d
echo
echo "ETS2 Server Control läuft lokal auf http://127.0.0.1:3000"
echo "Verbinde jetzt deine HTTPS-Subdomain per Reverse Proxy mit 127.0.0.1:3000."
