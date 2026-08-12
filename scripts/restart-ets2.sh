#!/usr/bin/env bash
set -euo pipefail
base="$(cd "$(dirname "$0")" && pwd)"
bash "$base/stop-ets2.sh"
bash "$base/start-ets2.sh"
